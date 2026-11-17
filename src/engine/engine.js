/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-engine/src/lib.rs and espanso/src/cli/worker/engine/mod.rs:
 * wires the matchers, the renderer and the middleware chain together, and
 * dispatches the resulting effects to an injector.
 *
 * The engine itself is platform independent (no DOM access). Input events are
 * pushed in with `handleInput`, and effects come out through the `injector`:
 *
 *   injector = {
 *     injectKeys(keys: string[]): void|Promise   // 'Backspace' | 'ArrowLeft' ...
 *     injectText(text: string, {forceMode}): void|Promise
 *     injectHtml(html: string): void|Promise
 *     injectImage(path: string): void|Promise
 *   }
 */

import { RollingMatcher } from '../match/rolling.js';
import { RegexMatcher } from '../match/regex.js';
import { Renderer } from '../render/renderer.js';
import {
  createEchoExtension,
  createRandomExtension,
  createChoiceExtension,
  createFormExtension,
  createClipboardExtension,
  createUnsupportedExtension,
} from '../render/extensions/basic.js';
import { createDateExtension } from '../render/extensions/date.js';
import { createDomExtension } from '../render/extensions/dom.js';
import { matchDescription } from '../matches/loader.js';
import { EventType, Status, causedBy } from './events.js';
import { Processor } from './processor.js';
import { ConfigManager, RendererAdapter, convertMatches } from './adapters.js';
import {
  EventsDiscardMiddleware,
  DisableMiddleware,
  MatcherMiddleware,
  MatchExecRequestMiddleware,
  SuppressMiddleware,
  MatchSelectMiddleware,
  CauseCompensateMiddleware,
  MultiplexMiddleware,
  RenderMiddleware,
  ImageResolverMiddleware,
  CursorHintMiddleware,
  UndoMiddleware,
  ActionMiddleware,
  MarkdownMiddleware,
  processCursorHint,
  RENDERING_ERROR_TEXT,
} from './middleware.js';

const TOGGLE_KEY_MAP = {
  Ctrl: ['Control', null],
  Alt: ['Alt', null],
  Shift: ['Shift', null],
  Meta: ['Meta', null],
  RightCtrl: ['Control', 'right'],
  RightAlt: ['Alt', 'right'],
  RightShift: ['Shift', 'right'],
  RightMeta: ['Meta', 'right'],
  LeftCtrl: ['Control', 'left'],
  LeftAlt: ['Alt', 'left'],
  LeftShift: ['Shift', 'left'],
  LeftMeta: ['Meta', 'left'],
};

/** A no-op injector, useful for tests or for headless rendering. */
export const nullInjector = {
  injectKeys() {},
  injectText() {},
  injectHtml() {},
  injectImage() {},
};

export class Engine {
  /**
   * @param {object} options
   * @param {import('../config/config.js').ConfigStore} options.configStore
   * @param {import('../matches/store.js').MatchStore} options.matchStore
   * @param {object} [options.injector]
   * @param {() => object} [options.getAppInfo]  returns {title, url, class, exec}
   * @param {object[]} [options.extensions]  extra/overriding render extensions
   * @param {object} [options.formProvider]  { show(layout, fields, options) }
   * @param {object} [options.choiceSelector]  { show(choices) }
   * @param {object} [options.clipboardProvider]  { getText() }
   * @param {object} [options.matchSelector]  { select(matches, isSearch) } when several matches apply
   * @param {object} [options.dateOptions]  { now, getLocale }
   * @param {string|null} [options.renderingErrorText]  text that replaces the trigger when
   *        rendering fails, inserted as a literal. `null` leaves the field untouched (the
   *        trigger stays). Defaults to the `rendering_error_text` config key, then to
   *        espanso's message.
   * @param {string} [options.configDir]  substituted for $CONFIG in image paths
   * @param {(error: Error, kind: string) => void} [options.onError]
   *        kind is 'config' | 'render' | 'inject' | 'attach'; errors are also emitted
   *        as an `error` event with `{ kind, error }`
   * @param {() => Document|null} [options.getDocument]  document read by `dom` variables
   */
  constructor(options) {
    this.options = options;
    this.injector = options.injector ?? nullInjector;
    this.listeners = new Map();
    this.queue = Promise.resolve();
    this.lastSourceId = 0;
    this.onError = options.onError ?? ((error) => console.error('[espanso]', error));
    this.documentProvider = options.getDocument ?? null;

    this.configManager = new ConfigManager(options.configStore, options.matchStore, options.getAppInfo);
    const defaultConfig = this.configManager.default();

    // Explicit option, then the config key, then espanso's message
    const configErrorText = defaultConfig.renderingErrorText;
    this.renderingErrorText = options.renderingErrorText !== undefined
      ? options.renderingErrorText
      : configErrorText !== undefined ? configErrorText : RENDERING_ERROR_TEXT;

    // Renderer + extensions
    this.renderer = new Renderer([
      createEchoExtension(),
      createRandomExtension(),
      createDateExtension(options.dateOptions),
      createChoiceExtension(options.choiceSelector),
      createFormExtension(options.formProvider),
      createClipboardExtension(options.clipboardProvider),
      createUnsupportedExtension('shell'),
      createUnsupportedExtension('script'),
      createDomExtension({ getDocument: () => this.getDocument() }),
      ...(options.extensions ?? []),
    ], { disabledTypes: defaultConfig.disabledVarTypes });
    this.renderer.logger = { error: (msg) => this.reportError('render', new Error(msg)) };
    this.rendererAdapter = new RendererAdapter(this.configManager, this.renderer);

    // Matchers
    const { rolling, regex } = convertMatches(this.configManager.allMatches);
    this.matchers = [
      new RollingMatcher(rolling, { charWordSeparators: defaultConfig.wordSeparators }),
      new RegexMatcher(regex, {
        maxBufferSize: defaultConfig.maxRegexBufferSize,
        onError: (error) => this.reportError('config', error),
      }),
    ];

    const sequence = { getNextId: () => this.nextSourceId() };
    const toggle = TOGGLE_KEY_MAP[defaultConfig.toggleKey] ?? [null, null];

    this.matcherMiddleware = new MatcherMiddleware(this.matchers, {
      maxHistorySize: defaultConfig.backspaceLimit,
    });
    this.disableMiddleware = new DisableMiddleware({ toggleKey: toggle[0], toggleKeyVariant: toggle[1] });

    const matchSelector = this.createMatchSelector(options.matchSelector);

    this.processor = new Processor([
      new EventsDiscardMiddleware(),
      this.disableMiddleware,
      this.matcherMiddleware,
      new MatchExecRequestMiddleware(this.configManager),
      new SuppressMiddleware(() => this.configManager.active().enable),
      new MatchSelectMiddleware(this.configManager, matchSelector, sequence),
      new CauseCompensateMiddleware(),
      new MultiplexMiddleware(this.configManager),
      new RenderMiddleware(this.rendererAdapter, {
        onError: (error) => this.reportError('render', error),
        errorText: this.renderingErrorText,
      }),
      new ImageResolverMiddleware(options.configDir ?? ''),
      new CursorHintMiddleware(),
      new UndoMiddleware(() => this.configManager.default().undoBackspace),
      new ActionMiddleware(this.configManager, sequence, {
        isRichTextEnabled: () => this.configManager.default().richText,
      }),
      new MarkdownMiddleware(),
    ]);
  }

  createMatchSelector(selector) {
    return {
      select: async (ids, isSearch) => {
        if (!selector) return ids[0] ?? null;
        const matches = ids.map((id) => {
          const m = this.configManager.getMatch(id);
          return {
            id,
            label: m ? matchDescription(m) : String(id),
            triggers: m?.cause.type === 'trigger' ? m.cause.triggers : [],
            match: m,
          };
        });
        return selector.select(matches, isSearch);
      },
    };
  }

  /** The document `dom` variables read from (set by the DOM layer when attached). */
  getDocument() {
    return this.documentProvider?.() ?? (typeof document !== 'undefined' ? document : null);
  }

  /** Report an error of the given kind ('config' | 'render' | 'inject' | 'attach'). */
  reportError(kind, error) {
    try {
      this.onError(error, kind);
    } catch {
      // never let a reporting hook break the engine
    }
    this.emit('error', { kind, error });
  }

  nextSourceId() {
    this.lastSourceId += 1;
    return this.lastSourceId;
  }

  /** Whether espanso is currently enabled (toggle key / enable() / disable()). */
  get enabled() {
    return this.disableMiddleware.enabled;
  }

  /**
   * Feed an input event (keyboard or mouse). Events are processed strictly in order.
   * @param {{type: 'keyboard', key: string, value?: string|null, status?: string, variant?: string|null}
   *        | {type: 'mouse', status?: string, button?: string}} input
   * @returns {Promise<object[]>} the events produced by the processor
   */
  handleInput(input) {
    const event = causedBy(this.nextSourceId(), input.type, {
      status: Status.Pressed,
      value: null,
      variant: null,
      ...input,
    });
    return this.enqueue(event);
  }

  /** Convenience: simulate typing a string, one key event per character. */
  async type(text) {
    const produced = [];
    for (const c of text) {
      produced.push(...await this.handleInput({ type: 'keyboard', key: keyForChar(c), value: c }));
    }
    return produced;
  }

  /** Clear the matcher state (e.g. when the focus moves to another field). */
  resetState() {
    this.matcherMiddleware.reset();
  }

  enable() { return this.enqueue(causedBy(this.nextSourceId(), EventType.EnableRequest)); }

  disable() { return this.enqueue(causedBy(this.nextSourceId(), EventType.DisableRequest)); }

  toggle() { return this.enqueue(causedBy(this.nextSourceId(), EventType.ToggleRequest)); }

  /**
   * Expand the match with the given trigger at the current caret position,
   * like `espanso match exec`.
   * @param {string} trigger
   * @param {{args?: object, compensate?: boolean}} [options]
   *        compensate: delete the trigger text before inserting (default false)
   */
  exec(trigger, options = {}) {
    return this.enqueue(causedBy(this.nextSourceId(), EventType.MatchExecRequest, {
      trigger,
      args: options.args ?? {},
      compensate: options.compensate ?? false,
    }));
  }

  /**
   * Render the match with the given trigger and return the text, without injecting it.
   * @returns {Promise<string|null>} null if no active match has this trigger
   */
  async expand(trigger, args = {}) {
    const candidates = this.configManager.findMatchesFromTrigger(trigger).map((m) => m.id);
    const active = this.configManager.filterActive(candidates);
    if (active.length === 0) return null;
    const body = await this.rendererAdapter.render(active[0], trigger, args);
    return processCursorHint(body).body;
  }

  /** List the matches active in the current context. */
  activeMatches() {
    return this.configManager.activeMatchSet().matches;
  }

  on(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      try {
        listener(event);
      } catch (error) {
        try { this.onError(error, 'listener'); } catch { /* ignore */ }
      }
    }
  }

  enqueue(event) {
    const run = this.queue.then(async () => {
      const produced = await this.processor.process(event);
      // A failed render that inserts nothing must leave the field untouched: the
      // trigger deletion was queued before rendering failed, so drop it. This applies
      // to every failure when renderingErrorText is null, and always to matches
      // blocked by `disabled_var_types`.
      const blocked = new Set(produced
        .filter((e) => e.type === EventType.RenderingError &&
          (this.renderingErrorText === null || e.error?.name === 'DisabledVariableTypeError'))
        .map((e) => e.sourceId));
      for (const e of produced) {
        if (blocked.has(e.sourceId) && e.type === EventType.KeySequenceInject) continue;
        await this.dispatch(e);
      }
      return produced;
    });
    // Keep the chain alive even if something throws
    this.queue = run.catch((error) => this.reportError('render', error));
    return run;
  }

  async dispatch(event) {
    try {
      switch (event.type) {
        case EventType.KeySequenceInject:
          await this.injector.injectKeys(event.keys);
          break;
        case EventType.TextInject:
          await this.injector.injectText(event.text, { forceMode: event.forceMode });
          break;
        case EventType.HtmlInject:
          await this.injector.injectHtml(event.html);
          break;
        case EventType.ImageInject:
          await this.injector.injectImage(event.imagePath);
          break;
        default:
          break;
      }
    } catch (error) {
      this.reportError('inject', error);
    }
    this.emit(event.type, event);
    this.emit('*', event);
  }
}

function keyForChar(c) {
  if (c === ' ') return 'Space';
  if (c === '\n' || c === '\r') return 'Enter';
  if (c === '\t') return 'Tab';
  return 'Other';
}
