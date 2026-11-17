/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Self-starting loader ("espanso-auto"): a page includes a <script> tag and
 * publishes its configuration as JSON data. The loader starts itself, reads the
 * configuration, attaches to the page and reports through DOM events. The page
 * never calls a function of the library, and nothing is exposed on `window`.
 *
 *   <script src="espanso-auto.min.js" data-config-url="/snippets.json" defer></script>
 *
 * Configuration source (first match wins):
 *   1. data-config="<selector>"  the element's textContent, parsed as JSON
 *   2. data-config-url="<url>"   fetched (same-origin only, credentials: same-origin, no-store)
 *   3. the first <script type="application/x-espanso+json"> in the document
 *
 * Events, dispatched on the document (bubbles: false):
 *   espanso:ready  { matchCount }
 *   espanso:error  { kind: 'config'|'render'|'inject'|'attach', errorName, count }
 * The error detail never carries a message or any user text.
 *
 * Listened for on the document:
 *   espanso:reload  re-read the configuration, rebuild, re-attach, then espanso:ready
 */

import { createEngine } from '../create.js';
import { attach } from '../browser/dom.js';

export const CONFIG_MIME = 'application/x-espanso+json';
const ERROR_KINDS = new Set(['config', 'render', 'inject', 'attach']);

export class ConfigSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigSourceError';
  }
}

export class CrossOriginConfigError extends Error {
  constructor() {
    super('data-config-url must be same-origin; the configuration was not fetched');
    this.name = 'CrossOriginConfigError';
  }
}

export class InvalidConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;

/**
 * The error's class name, and nothing else (never the message). Taken from
 * `error.name` (set explicitly by every espanso-js error class, and correct for
 * built-in errors) because minification renames constructors; falls back to the
 * constructor name. Anything that is not identifier-like becomes "Error".
 */
export function errorName(error) {
  for (const name of [error?.name, error?.constructor?.name]) {
    if (typeof name === 'string' && IDENTIFIER.test(name)) return name;
  }
  return 'Error';
}

/**
 * Start the loader.
 * @param {object} options
 * @param {HTMLScriptElement|null} options.script  the loader's own <script> element
 * @param {Document} options.document
 * @param {typeof fetch} [options.fetch]
 * @returns {{ready: Promise<void>, reload(): Promise<void>, stop(): void}}  (for tests;
 *          the bundled entry point discards it)
 */
export function startAutoLoader({ script, document: doc, fetch: fetchImpl }) {
  const view = doc.defaultView ?? globalThis;
  const doFetch = fetchImpl ?? view.fetch?.bind(view);
  const debug = script?.hasAttribute?.('data-debug') ?? false;
  const counts = { config: 0, render: 0, inject: 0, attach: 0 };
  let attachment = null;
  let stopped = false;

  const dispatch = (type, detail) => {
    const EventCtor = view.CustomEvent ?? CustomEvent;
    doc.dispatchEvent(new EventCtor(type, { detail, bubbles: false }));
  };

  const reportError = (kind, error) => {
    const k = ERROR_KINDS.has(kind) ? kind : 'render';
    counts[k] += 1;
    if (debug) view.console?.warn?.('[espanso]', k, error);
    // Only the kind, the error class name and a counter: never message or user text
    dispatch('espanso:error', { kind: k, errorName: errorName(error), count: counts[k] });
  };

  async function readConfig() {
    const selector = script?.getAttribute?.('data-config');
    if (selector != null) {
      let element;
      try {
        element = doc.querySelector(selector);
      } catch {
        throw new ConfigSourceError('data-config is not a valid selector');
      }
      if (!element) throw new ConfigSourceError('data-config element not found');
      return JSON.parse(element.textContent ?? '');
    }

    const url = script?.getAttribute?.('data-config-url');
    if (url != null) {
      const base = doc.baseURI ?? doc.URL;
      let target;
      try {
        target = new URL(url, base);
      } catch {
        throw new ConfigSourceError('data-config-url is not a valid URL');
      }
      const pageOrigin = new URL(doc.URL).origin;
      if (pageOrigin === 'null' || target.origin !== pageOrigin) throw new CrossOriginConfigError();
      if (!doFetch) throw new ConfigSourceError('fetch is not available');
      const response = await doFetch(target.href, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new ConfigSourceError(`configuration request failed (HTTP ${response.status})`);
      return JSON.parse(await response.text());
    }

    const element = doc.querySelector(`script[type="${CONFIG_MIME}"]`);
    if (!element) return null;
    return JSON.parse(element.textContent ?? '');
  }

  function buildEngine(json) {
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      throw new InvalidConfigError('the configuration must be a JSON object');
    }
    for (const key of ['matches', 'global_vars']) {
      if (json[key] != null && !Array.isArray(json[key])) throw new InvalidConfigError(`'${key}' must be an array`);
    }
    if (json.config != null && (typeof json.config !== 'object' || Array.isArray(json.config))) {
      throw new InvalidConfigError("'config' must be an object");
    }

    const { engine, errors } = createEngine({
      config: json.config ?? {},
      matches: json.matches ?? [],
      globalVars: json.global_vars ?? [],
      getAppInfo: () => ({ title: doc.title, url: doc.URL }),
      getDocument: () => doc,
      onError: (error, kind) => reportError(kind, error),
    });
    for (const e of errors) reportError('config', e.error);
    return engine;
  }

  async function load() {
    attachment?.detach();
    attachment = null;
    if (stopped) return;

    let json = null;
    try {
      json = await readConfig();
    } catch (error) {
      reportError('config', error);
    }

    let engine = null;
    if (json != null) {
      try {
        engine = buildEngine(json);
      } catch (error) {
        reportError('config', error);
      }
    }

    let matchCount = 0;
    if (engine) {
      const defaultConfig = engine.configManager.default();
      if (defaultConfig.enable) matchCount = engine.configManager.matchSets.get(defaultConfig.id).matches.length;
    }

    // No configuration or no enabled matches: attach nothing
    if (engine && matchCount > 0 && !stopped) {
      try {
        attachment = attach(engine, { root: doc });
      } catch (error) {
        reportError('attach', error);
        matchCount = 0;
      }
    }

    dispatch('espanso:ready', { matchCount: attachment ? matchCount : 0 });
  }

  // Loads are serialized: a reload waits for the previous one
  let chain = Promise.resolve();
  const enqueue = () => {
    chain = chain.then(load, load);
    return chain;
  };

  const onReload = () => { enqueue(); };
  doc.addEventListener('espanso:reload', onReload);

  const ready = new Promise((resolve) => {
    const start = () => enqueue().then(resolve);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  });

  return {
    ready,
    reload: () => enqueue(),
    stop() {
      stopped = true;
      doc.removeEventListener('espanso:reload', onReload);
      attachment?.detach();
      attachment = null;
    },
  };
}
