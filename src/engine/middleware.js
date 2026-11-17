/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-engine/src/process/middleware/*.rs
 *
 * Each middleware is `{ name, next(event, dispatch) }` where `next` returns (or
 * resolves to) the transformed event. `dispatch(event)` enqueues additional events
 * that will be processed after the current one.
 *
 * Middlewares of the desktop app that make no sense in a browser are not ported:
 * icon_status, alt_code_synthesizer, context_menu, hotkey, open_config, stats,
 * exit, search, notification, delay_modifiers.
 */

import { markdownToHtml } from './markdown.js';
import { htmlToText } from './html-text.js';
import { EventType, Key, Status, MODIFIER_KEYS, causedBy, detectedMatch } from './events.js';

const graphemeSegmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Number of user-perceived characters (grapheme clusters) in a string. */
export function graphemeCount(text) {
  if (graphemeSegmenter) {
    let count = 0;
    for (const _ of graphemeSegmenter.segment(text)) count += 1;
    return count;
  }
  return Array.from(text).length;
}

/** Number of Unicode code points (Rust's `chars().count()`). */
export function charCount(text) {
  return Array.from(text).length;
}

// ---------------------------------------------------------------------------

/** discard.rs: drops events whose source id falls in a discarded window. */
export class EventsDiscardMiddleware {
  name = 'discard';

  minIdThreshold = 0;

  maxIdThreshold = 0;

  next(event) {
    if (event.sourceId < this.maxIdThreshold && event.sourceId >= this.minIdThreshold) {
      return causedBy(event.sourceId, EventType.NOOP);
    }
    if (event.type === EventType.DiscardPrevious) {
      this.maxIdThreshold = event.minimumSourceId;
    } else if (event.type === EventType.DiscardBetween) {
      this.maxIdThreshold = event.endId;
      this.minIdThreshold = event.startId;
    }
    return event;
  }
}

/** disable.rs: enable/disable espanso (also by double-tapping the toggle key). */
export class DisableMiddleware {
  name = 'disable';

  /**
   * @param {{toggleKey?: string|null, toggleKeyVariant?: 'left'|'right'|null,
   *          toggleKeyMaximumWindow?: number, now?: () => number}} options
   */
  constructor(options = {}) {
    this.enabled = true;
    this.lastTogglePress = null;
    this.options = { toggleKeyMaximumWindow: 1000, now: () => Date.now(), ...options };
  }

  next(event, dispatch) {
    let changed = false;
    const { now } = this.options;

    switch (event.type) {
      case EventType.Keyboard:
        if (event.status === Status.Released) {
          if (this.isToggleKey(event)) {
            if (this.lastTogglePress !== null && now() - this.lastTogglePress < this.options.toggleKeyMaximumWindow) {
              this.enabled = !this.enabled;
              this.lastTogglePress = null;
              changed = true;
            } else {
              this.lastTogglePress = now();
            }
          } else {
            // Another key resets the window (espanso issue #815)
            this.lastTogglePress = null;
          }
        }
        break;
      case EventType.EnableRequest:
        this.enabled = true;
        changed = true;
        break;
      case EventType.DisableRequest:
        this.enabled = false;
        changed = true;
        break;
      case EventType.ToggleRequest:
        this.enabled = !this.enabled;
        changed = true;
        break;
      default:
        break;
    }

    if (changed) {
      dispatch(causedBy(event.sourceId, this.enabled ? EventType.Enabled : EventType.Disabled));
    }

    if (event.type === EventType.Keyboard && !this.enabled) {
      return causedBy(event.sourceId, EventType.NOOP);
    }
    return event;
  }

  isToggleKey(event) {
    const { toggleKey, toggleKeyVariant } = this.options;
    if (!toggleKey || toggleKey !== event.key) return false;
    if (toggleKeyVariant && event.variant) return toggleKeyVariant === event.variant;
    return true;
  }
}

// ---------------------------------------------------------------------------

function isEventOfInterest(event) {
  if (event.type === EventType.Keyboard) {
    return event.status === Status.Pressed && !MODIFIER_KEYS.has(event.key);
  }
  if (event.type === EventType.Mouse) return event.status === Status.Pressed;
  return event.type === EventType.MatchInjected;
}

function convertToMatcherEvent(event) {
  if (event.type === EventType.Keyboard) return { type: 'key', key: event.key, chars: event.value ?? null };
  if (event.type === EventType.Mouse || event.type === EventType.MatchInjected) {
    return { type: 'virtualSeparator' };
  }
  return null;
}

const INVALIDATING_KEYS = new Set([
  Key.ArrowDown, Key.ArrowLeft, Key.ArrowRight, Key.ArrowUp,
  Key.End, Key.Home, Key.PageDown, Key.PageUp, Key.Escape,
]);

function isInvalidatingEvent(event) {
  if (event.type === EventType.Keyboard) return INVALIDATING_KEYS.has(event.key);
  return event.type === EventType.Mouse;
}

/**
 * matcher.rs: feeds the input events to the matchers, keeping a history of
 * matcher states so that Backspace can rewind it.
 */
export class MatcherMiddleware {
  name = 'matcher';

  /**
   * @param {Array<{process(prevState, event): {state, results}}>} matchers
   * @param {{maxHistorySize: number, shouldSkipKeyEvent?: () => boolean}} options
   */
  constructor(matchers, options) {
    this.matchers = matchers;
    this.maxHistorySize = options.maxHistorySize;
    this.shouldSkipKeyEvent = options.shouldSkipKeyEvent ?? (() => false);
    this.matcherStates = [];
  }

  reset() {
    this.matcherStates = [];
  }

  next(event) {
    if (!isEventOfInterest(event)) return event;

    const prevStates = this.matcherStates.length > 0 ? this.matcherStates[this.matcherStates.length - 1] : null;

    if (event.type === EventType.Keyboard) {
      if (event.key === Key.Backspace) {
        this.matcherStates.pop();
        return event;
      }
      if (this.shouldSkipKeyEvent()) return event;
    }

    if (isInvalidatingEvent(event)) {
      this.matcherStates = [];
      return event;
    }

    const matcherEvent = convertToMatcherEvent(event);
    if (!matcherEvent) return event;

    const allResults = [];
    const newStates = this.matchers.map((matcher, i) => {
      const { state, results } = matcher.process(prevStates ? prevStates[i] : null, matcherEvent);
      allResults.push(...results);
      return state;
    });

    this.matcherStates.push(newStates);
    if (this.matcherStates.length > this.maxHistorySize) this.matcherStates.shift();

    if (allResults.length > 0) {
      return causedBy(event.sourceId, EventType.MatchesDetected, {
        matches: allResults.map((r) => detectedMatch({
          id: r.id,
          trigger: r.trigger,
          leftSeparator: r.leftSeparator,
          rightSeparator: r.rightSeparator,
          args: r.args,
        })),
        isSearch: false,
      });
    }
    return event;
  }
}

/** match_exec.rs: turns an external "execute this trigger" request into a detection. */
export class MatchExecRequestMiddleware {
  name = 'match_exec_request';

  /** @param {{findMatchesFromTrigger(trigger: string): object[]}} resolver */
  constructor(resolver) {
    this.resolver = resolver;
  }

  next(event) {
    if (event.type !== EventType.MatchExecRequest) return event;

    const matches = event.trigger ? this.resolver.findMatchesFromTrigger(event.trigger) : [];
    for (const m of matches) {
      Object.assign(m.args, event.args ?? {});
      m.compensate = event.compensate ?? false;
    }
    if (matches.length === 0) return causedBy(event.sourceId, EventType.NOOP);
    return causedBy(event.sourceId, EventType.MatchesDetected, { matches, isSearch: false });
  }
}

/** suppress.rs: ignore detections when the active config has `enable: false`. */
export class SuppressMiddleware {
  name = 'suppress';

  constructor(isConfigEnabled) {
    this.isConfigEnabled = isConfigEnabled;
  }

  next(event) {
    if (event.type === EventType.MatchesDetected && !this.isConfigEnabled()) {
      return causedBy(event.sourceId, EventType.NOOP);
    }
    return event;
  }
}

/** match_select.rs: filter the matches active in the current context, pick one. */
export class MatchSelectMiddleware {
  name = 'match_select';

  /**
   * @param {{filterActive(ids: number[]): number[]}} matchFilter
   * @param {{select(ids: number[], isSearch: boolean): Promise<number|null>}} matchSelector
   * @param {{getNextId(): number}} sequence
   */
  constructor(matchFilter, matchSelector, sequence) {
    this.matchFilter = matchFilter;
    this.matchSelector = matchSelector;
    this.sequence = sequence;
  }

  async next(event, dispatch) {
    if (event.type !== EventType.MatchesDetected) return event;

    const ids = event.matches.map((m) => m.id);
    const validIds = this.matchFilter.filterActive(ids);

    if (validIds.length === 0) return causedBy(event.sourceId, EventType.NOOP);

    if (validIds.length === 1) {
      const chosen = event.matches.find((m) => m.id === validIds[0]);
      return chosen
        ? causedBy(event.sourceId, EventType.MatchSelected, { chosen })
        : causedBy(event.sourceId, EventType.NOOP);
    }

    // Multiple matches: ask the user which one to use
    const startId = this.sequence.getNextId();
    const selectedId = await this.matchSelector.select(validIds, event.isSearch);
    let next = causedBy(event.sourceId, EventType.NOOP);
    if (selectedId != null) {
      const chosen = event.matches.find((m) => m.id === selectedId);
      if (chosen) next = causedBy(event.sourceId, EventType.MatchSelected, { chosen });
    }
    const endId = this.sequence.getNextId();

    // Discard the events generated while the selector was open (espanso issue #781)
    dispatch(causedBy(event.sourceId, EventType.DiscardBetween, { startId, endId }));
    return next;
  }
}

/** cause.rs: before expanding, the typed trigger must be deleted. */
export class CauseCompensateMiddleware {
  name = 'cause_compensate';

  next(event, dispatch) {
    if (event.type !== EventType.MatchSelected) return event;

    const { chosen } = event;
    const compensated = causedBy(event.sourceId, EventType.CauseCompensatedMatch, { m: chosen });
    if (chosen.trigger != null && chosen.compensate !== false) {
      dispatch(compensated);
      return causedBy(event.sourceId, EventType.TriggerCompensation, {
        trigger: chosen.trigger,
        leftSeparator: chosen.leftSeparator,
      });
    }
    return compensated;
  }
}

/** multiplex.rs: route the match to the right effect (text rendering or image). */
export class MultiplexMiddleware {
  name = 'multiplex';

  /** @param {{convert(m: object): object|null}} multiplexer returns {type, ...payload} */
  constructor(multiplexer) {
    this.multiplexer = multiplexer;
  }

  next(event) {
    if (event.type !== EventType.CauseCompensatedMatch) return event;
    const converted = this.multiplexer.convert(event.m);
    if (!converted) return causedBy(event.sourceId, EventType.NOOP);
    return { ...converted, sourceId: event.sourceId };
  }
}

export const RENDERING_ERROR_TEXT =
  '[Espanso]: An error occurred during rendering, please examine the logs for more information.';

/** render.rs */
export class RenderMiddleware {
  name = 'render';

  /**
   * @param {{render(matchId, trigger, triggerArgs): Promise<string>}} renderer
   * @param {{onError?: (error: Error) => void, errorText?: string|null}} [options]
   */
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    this.onError = options.onError ?? ((error) => console.error('[espanso] error during rendering:', error));
    this.errorText = options.errorText === undefined ? RENDERING_ERROR_TEXT : options.errorText;
  }

  async next(event, dispatch) {
    if (event.type !== EventType.RenderingRequested) return event;

    try {
      let body = await this.renderer.render(event.matchId, event.trigger, event.triggerArgs);
      if (event.rightSeparator != null) body += event.rightSeparator;
      return causedBy(event.sourceId, EventType.Rendered, {
        matchId: event.matchId,
        body,
        format: event.format,
      });
    } catch (error) {
      if (error?.name === 'RenderAbortedError') return causedBy(event.sourceId, EventType.NOOP);
      this.onError(error);
      // A disabled variable type means "don't expand": insert nothing at all
      if (this.errorText && error?.name !== 'DisabledVariableTypeError') {
        dispatch(causedBy(event.sourceId, EventType.TextInject, { text: this.errorText, forceMode: null }));
      }
      return causedBy(event.sourceId, EventType.RenderingError, { error });
    }
  }
}

/** image_resolve.rs: expand `$CONFIG` in image paths. */
export class ImageResolverMiddleware {
  name = 'image_resolve';

  constructor(configDir = '') {
    this.configDir = configDir;
  }

  next(event) {
    if (event.type !== EventType.ImageRequested) return event;
    const imagePath = event.imagePath.replace('$CONFIG', this.configDir);
    return causedBy(event.sourceId, EventType.ImageResolved, { imagePath });
  }
}

/** cursor_hint.rs: `$|$` marks where the caret should end up. */
export function processCursorHint(body) {
  const index = body.indexOf('$|$');
  if (index < 0) return { body, cursorHintBackCount: null };
  const charIndex = graphemeCount(body.slice(0, index));
  const totalSize = graphemeCount(body);
  const newBody = body.replaceAll('$|$', '');
  return { body: newBody, cursorHintBackCount: totalSize - charIndex - 3 };
}

export class CursorHintMiddleware {
  name = 'cursor_hint';

  next(event, dispatch) {
    if (event.type !== EventType.Rendered) return event;
    const { body, cursorHintBackCount } = processCursorHint(event.body);
    if (cursorHintBackCount !== null) {
      dispatch(causedBy(event.sourceId, EventType.CursorHintCompensation, { cursorHintBackCount }));
    }
    return { ...event, body };
  }
}

/** undo.rs: pressing Backspace right after an expansion restores the trigger. */
export class UndoMiddleware {
  name = 'undo';

  constructor(isUndoEnabled) {
    this.isUndoEnabled = isUndoEnabled;
    this.record = null;
  }

  next(event) {
    switch (event.type) {
      case EventType.TriggerCompensation:
        this.record = { id: event.sourceId, trigger: event.trigger, injectedText: null, matchId: null };
        break;
      case EventType.Rendered:
        if (event.format === 'plain' && this.record && this.record.id === event.sourceId) {
          this.record.injectedText = event.body;
          this.record.matchId = event.matchId;
        }
        break;
      case EventType.Keyboard:
        if (event.status === Status.Pressed) {
          const record = this.record;
          this.record = null;
          if (event.key === Key.Backspace && record &&
              record.trigger != null && record.injectedText != null && record.matchId != null &&
              this.isUndoEnabled()) {
            return causedBy(event.sourceId, EventType.Undo, {
              matchId: record.matchId,
              trigger: record.trigger,
              replace: record.injectedText,
            });
          }
        }
        break;
      case EventType.Mouse:
      case EventType.CursorHintCompensation:
        // Mouse events could mean a change of context, and cursor hints make
        // it too hard to know what to delete.
        this.record = null;
        break;
      default:
        break;
    }
    return event;
  }
}

/** action.rs: turn the internal events into concrete injection requests. */
export class ActionMiddleware {
  name = 'action';

  /**
   * @param {{getForceMode(matchId): string|null}} matchInfo
   * @param {{getNextId(): number}} sequence
   * @param {{isRichTextEnabled?: () => boolean}} [options]
   *        when rich text is disabled, html/markdown bodies are flattened to plain
   *        text here, so no HTML ever reaches the injector
   */
  constructor(matchInfo, sequence, options = {}) {
    this.matchInfo = matchInfo;
    this.sequence = sequence;
    this.isRichTextEnabled = options.isRichTextEnabled ?? (() => true);
  }

  next(event, dispatch) {
    switch (event.type) {
      case EventType.Rendered:
      case EventType.ImageResolved: {
        dispatch(causedBy(event.sourceId, EventType.MatchInjected));
        dispatch(causedBy(event.sourceId, EventType.DiscardPrevious, {
          minimumSourceId: this.sequence.getNextId(),
        }));
        const richText = this.isRichTextEnabled();
        if (event.type === EventType.ImageResolved) {
          // Image matches are dropped at load when rich text is off; never inject one.
          if (!richText) return causedBy(event.sourceId, EventType.NOOP);
          return causedBy(event.sourceId, EventType.ImageInject, { imagePath: event.imagePath });
        }
        if (!richText && (event.format === 'html' || event.format === 'markdown')) {
          let text = event.body;
          if (event.format === 'html') {
            text = htmlToText(event.body);
          } else {
            const html = markdownToHtml(event.body);
            if (html !== null) text = htmlToText(html);
          }
          return causedBy(event.sourceId, EventType.TextInject, { text, forceMode: null });
        }
        if (event.format === 'html') return causedBy(event.sourceId, EventType.HtmlInject, { html: event.body });
        if (event.format === 'markdown') {
          return causedBy(event.sourceId, EventType.MarkdownInject, { markdown: event.body });
        }
        return causedBy(event.sourceId, EventType.TextInject, {
          text: event.body,
          forceMode: this.matchInfo.getForceMode(event.matchId),
        });
      }
      case EventType.CursorHintCompensation:
        dispatch(causedBy(event.sourceId, EventType.DiscardPrevious, {
          minimumSourceId: this.sequence.getNextId(),
        }));
        return causedBy(event.sourceId, EventType.KeySequenceInject, {
          keys: Array(event.cursorHintBackCount).fill(Key.ArrowLeft),
        });
      case EventType.TriggerCompensation: {
        let count = charCount(event.trigger);
        // Preserve the left separator if present
        if (event.leftSeparator != null) count -= charCount(event.leftSeparator);
        return causedBy(event.sourceId, EventType.KeySequenceInject, {
          keys: Array(Math.max(count, 0)).fill(Key.Backspace),
        });
      }
      case EventType.Undo: {
        // The backspace that triggered the undo already removed the last char
        const count = Math.max(charCount(event.replace) - 1, 0);
        dispatch(causedBy(event.sourceId, EventType.TextInject, {
          text: event.trigger,
          forceMode: this.matchInfo.getForceMode(event.matchId),
        }));
        return causedBy(event.sourceId, EventType.KeySequenceInject, {
          keys: Array(count).fill(Key.Backspace),
        });
      }
      default:
        return event;
    }
  }
}

/**
 * markdown.rs: convert markdown injection requests to HTML. Without a markdown
 * renderer (slim build), the markdown source is inserted as plain text.
 */
export class MarkdownMiddleware {
  name = 'markdown';

  next(event) {
    if (event.type !== EventType.MarkdownInject) return event;
    const html = markdownToHtml(event.markdown);
    if (html === null) {
      return causedBy(event.sourceId, EventType.TextInject, { text: event.markdown, forceMode: null });
    }
    return causedBy(event.sourceId, EventType.HtmlInject, { html });
  }
}
