/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Browser entry point.
 *
 *   import { createEspanso } from 'espanso-js';
 *
 *   const espanso = createEspanso({
 *     files: {
 *       'config/default.yml': 'backspace_limit: 5',
 *       'match/base.yml': 'matches:\n  - trigger: ":hi"\n    replace: "Hello!"',
 *     },
 *   });
 *   espanso.attach(); // start expanding in every text field of the page
 */

import { createEngine } from './core.js';
import { attach as attachDom, browserAppInfo } from './browser/dom.js';

export * from './core.js';
export { attach, DomInjector, browserAppInfo, editableKind, deepActiveElement, InvalidSelectorError } from './browser/dom.js';

/**
 * Create an espanso instance for the current page.
 *
 * Accepts every option of `createEngine` (files, yaml, matches, globalVars,
 * extensions, formProvider, choiceSelector, clipboardProvider, matchSelector...),
 * plus `getAppInfo` which defaults to `{ title: document.title, url: location.href }`.
 *
 * @returns {{
 *   engine: import('./engine/engine.js').Engine,
 *   errors: Array<{path: string, level: string, error: Error}>,
 *   attach(options?: {root?: Node, includePasswordFields?: boolean, shouldHandle?: (el: Element) => boolean}): void,
 *   detach(): void,
 *   expand(trigger: string, args?: object): Promise<string|null>,
 *   exec(trigger: string, options?: {args?: object, compensate?: boolean}): Promise<object[]>,
 *   enable(): Promise, disable(): Promise, toggle(): Promise,
 *   on(type: string, listener: Function): () => void,
 * }}
 */
export function createEspanso(options = {}) {
  const { engine, errors } = createEngine({ getAppInfo: browserAppInfo, ...options });
  let attachment = null;

  return {
    engine,
    errors,
    attach(attachOptions = {}) {
      attachment?.detach();
      attachment = attachDom(engine, attachOptions);
      return this;
    },
    detach() {
      attachment?.detach();
      attachment = null;
      return this;
    },
    expand: (trigger, args) => engine.expand(trigger, args),
    exec: (trigger, execOptions) => engine.exec(trigger, execOptions),
    enable: () => engine.enable(),
    disable: () => engine.disable(),
    toggle: () => engine.toggle(),
    on: (type, listener) => engine.on(type, listener),
  };
}

/**
 * Fetch a set of espanso files over HTTP and build the virtual file map.
 * @param {Record<string, string>} urls  virtual path → URL, e.g. { 'match/base.yml': '/espanso/base.yml' }
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchFiles(urls, fetchImpl = globalThis.fetch) {
  const entries = await Promise.all(
    Object.entries(urls).map(async ([path, url]) => {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`unable to fetch ${url}: HTTP ${response.status}`);
      return [path, await response.text()];
    }),
  );
  return Object.fromEntries(entries);
}
