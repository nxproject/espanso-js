/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Browser replacement for espanso-detect (keyboard hooks) and espanso-inject
 * (keystroke / clipboard injection).
 *
 * Detection: instead of a global keyboard hook, we listen to the DOM events of
 * the page. Characters come from `input` events (so virtual keyboards and IMEs
 * work too), navigation keys from `keydown`, toggle-key releases from `keyup`,
 * and clicks / focus changes invalidate the buffer, like mouse clicks do in espanso.
 *
 * Injection: edits are applied to the focused <input>, <textarea> or
 * contenteditable element through `document.execCommand` when available (keeps the
 * native undo stack and notifies frameworks), falling back to `setRangeText` /
 * the Range API.
 */

import { nullInjector } from '../engine/engine.js';
import { htmlToText as flattenHtml } from '../engine/html-text.js';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', '']);

const NAVIGATION_KEYS = new Set([
  'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', 'Escape',
]);

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Shift', 'Meta', 'CapsLock', 'NumLock', 'AltGraph']);

const graphemeSegmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Follow focus into shadow roots. */
export function deepActiveElement(doc = document) {
  let el = doc.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/**
 * Returns 'input' for text-like <input>/<textarea>, 'contenteditable' for rich
 * editors, or null if the element is not an editable text field.
 */
export function editableKind(el, { includePasswordFields = false } = {}) {
  if (!el || el.nodeType !== 1) return null;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return el.readOnly || el.disabled ? null : 'input';
  if (tag === 'INPUT') {
    if (el.readOnly || el.disabled) return null;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (TEXT_INPUT_TYPES.has(type)) return 'input';
    if (type === 'password' && includePasswordFields) return 'input';
    return null;
  }
  if (el.isContentEditable) return 'contenteditable';
  // jsdom and some old engines do not implement isContentEditable
  if (el.isContentEditable === undefined) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const attr = node.getAttribute('contenteditable');
      if (attr === '' || attr === 'true' || attr === 'plaintext-only') return 'contenteditable';
      if (attr === 'false') return null;
    }
  }
  return null;
}

/** Find the editable element an event belongs to (handles shadow DOM). */
function eventTarget(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path[0] ?? event.target;
}

function editableRoot(el, options) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const kind = editableKind(node, options);
    if (kind === 'input') return node;
    if (kind === 'contenteditable') {
      // climb to the outermost contenteditable host
      let host = node;
      while (host.parentElement && editableKind(host.parentElement, options) === 'contenteditable') {
        host = host.parentElement;
      }
      return host;
    }
  }
  return null;
}

// --- Text helpers -------------------------------------------------------------

/** UTF-16 index reached by moving `count` code points backwards from `index`. */
function backByCodePoints(text, index, count) {
  let i = index;
  for (let n = 0; n < count && i > 0; n += 1) {
    const low = text.charCodeAt(i - 1);
    i -= 1;
    if (low >= 0xdc00 && low <= 0xdfff && i > 0) {
      const high = text.charCodeAt(i - 1);
      if (high >= 0xd800 && high <= 0xdbff) i -= 1;
    }
  }
  return i;
}

/** UTF-16 index reached by moving `count` grapheme clusters backwards from `index`. */
function backByGraphemes(text, index, count) {
  if (!graphemeSegmenter) return backByCodePoints(text, index, count);
  const boundaries = [];
  for (const { index: start } of graphemeSegmenter.segment(text.slice(0, index))) boundaries.push(start);
  const position = boundaries.length - count;
  return position <= 0 ? 0 : boundaries[position];
}


function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// --- Injector -----------------------------------------------------------------

export class DomInjector {
  /**
   * @param {{doc?: Document, getTarget?: () => Element|null, useExecCommand?: boolean}} [options]
   */
  constructor(options = {}) {
    this.doc = options.doc ?? (typeof document !== 'undefined' ? document : null);
    this.getFallbackTarget = options.getTarget ?? (() => null);
    this.useExecCommand = options.useExecCommand ?? true;
    this.injecting = false;
    this.editableOptions = options.editableOptions ?? {};
    // When false, HTML is always flattened to text and images are never inserted
    this.richText = options.richText ?? true;
  }

  target() {
    const active = this.doc ? editableRoot(deepActiveElement(this.doc), this.editableOptions) : null;
    return active ?? this.getFallbackTarget();
  }

  /** Run `fn` while flagging that the changes come from us (so detection ignores them). */
  guard(fn) {
    const previous = this.injecting;
    this.injecting = true;
    try {
      return fn();
    } finally {
      this.injecting = previous;
    }
  }

  execCommand(command, value) {
    if (!this.useExecCommand || typeof this.doc?.execCommand !== 'function') return false;
    try {
      return this.doc.execCommand(command, false, value);
    } catch {
      return false;
    }
  }

  injectKeys(keys) {
    const el = this.target();
    if (!el) return;
    this.guard(() => {
      let backspaces = 0;
      let lefts = 0;
      const flush = () => {
        if (backspaces) this.deleteBackward(el, backspaces);
        if (lefts) this.moveLeft(el, lefts);
        backspaces = 0;
        lefts = 0;
      };
      for (const key of keys) {
        if (key === 'Backspace') {
          if (lefts) flush();
          backspaces += 1;
        } else if (key === 'ArrowLeft') {
          if (backspaces) flush();
          lefts += 1;
        } else if (key === 'ArrowRight') {
          flush();
          this.moveRight(el, 1);
        }
      }
      flush();
    });
  }

  injectText(text) {
    const el = this.target();
    if (!el) return;
    this.guard(() => this.insertText(el, text));
  }

  injectHtml(html) {
    const el = this.target();
    if (!el) return;
    this.guard(() => {
      if (this.richText && editableKind(el, this.editableOptions) === 'contenteditable') this.insertHtml(el, html);
      else this.insertText(el, flattenHtml(html));
    });
  }

  injectImage(path) {
    if (!this.richText) return;
    const el = this.target();
    if (!el || editableKind(el, this.editableOptions) !== 'contenteditable') return;
    this.guard(() => this.insertHtml(el, `<img src="${escapeAttribute(path)}">`));
  }

  // -- <input> / <textarea> --

  caret(el) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    return { start, end };
  }

  setSelection(el, start, end) {
    try {
      el.setSelectionRange(start, end);
    } catch {
      // Some input types (email, number) don't support selection
    }
  }

  fireInput(el, inputType, data = null) {
    const view = this.doc?.defaultView;
    const InputEventCtor = view?.InputEvent ?? (typeof InputEvent !== 'undefined' ? InputEvent : null);
    const EventCtor = view?.Event ?? Event;
    const event = InputEventCtor
      ? new InputEventCtor('input', { bubbles: true, inputType, data })
      : new EventCtor('input', { bubbles: true });
    el.dispatchEvent(event);
  }

  fireChange(el) {
    const EventCtor = this.doc?.defaultView?.Event ?? Event;
    el.dispatchEvent(new EventCtor('change', { bubbles: true }));
  }

  /**
   * Fallback edit of an <input>/<textarea> (when execCommand is unavailable).
   * A programmatic edit gets no native `change` on blur, so fire it here too:
   * pages that commit a field's value on `change` would otherwise lose the text.
   */
  replaceRange(el, text, start, end, inputType) {
    if (typeof el.setRangeText === 'function' && el.selectionStart != null) {
      el.setRangeText(text, start, end, 'end');
    } else {
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
    }
    this.fireInput(el, inputType, text || null);
    this.fireChange(el);
  }

  deleteBackward(el, count) {
    if (editableKind(el, this.editableOptions) === 'contenteditable') {
      this.deleteBackwardRich(el, count);
      return;
    }
    const { start, end } = this.caret(el);
    if (start !== end) {
      // A selection would be replaced by the first backspace
      this.replaceRange(el, '', start, end, 'deleteContentBackward');
      count -= 1;
    }
    const caret = this.caret(el).start;
    const from = backByCodePoints(el.value, caret, count);
    if (from === caret) return;
    this.setSelection(el, from, caret);
    if (!(this.isFocused(el) && this.execCommand('delete'))) {
      this.replaceRange(el, '', from, caret, 'deleteContentBackward');
    }
  }

  insertText(el, text) {
    if (editableKind(el, this.editableOptions) === 'contenteditable') {
      this.insertTextRich(el, text);
      return;
    }
    if (this.isFocused(el) && this.execCommand('insertText', text)) return;
    const { start, end } = this.caret(el);
    this.replaceRange(el, text, start, end, 'insertText');
  }

  moveLeft(el, count) {
    if (editableKind(el, this.editableOptions) === 'contenteditable') {
      this.moveRich(el, 'backward', count);
      return;
    }
    const { start } = this.caret(el);
    const position = backByGraphemes(el.value, start, count);
    this.setSelection(el, position, position);
  }

  moveRight(el, count) {
    if (editableKind(el, this.editableOptions) === 'contenteditable') {
      this.moveRich(el, 'forward', count);
      return;
    }
    const { end } = this.caret(el);
    const position = Math.min(el.value.length, end + count);
    this.setSelection(el, position, position);
  }

  isFocused(el) {
    return this.doc ? deepActiveElement(this.doc) === el : false;
  }

  // -- contenteditable --

  selection(el) {
    const root = el.getRootNode?.();
    if (root && typeof root.getSelection === 'function' && root !== this.doc) {
      const shadowSelection = root.getSelection();
      if (shadowSelection) return shadowSelection;
    }
    return (this.doc?.defaultView ?? globalThis).getSelection?.() ?? null;
  }

  deleteBackwardRich(el, count) {
    const sel = this.selection(el);
    if (!sel || sel.rangeCount === 0) return;
    if (!sel.isCollapsed) {
      if (!this.execCommand('delete')) sel.deleteFromDocument();
      count -= 1;
    }
    if (count <= 0) return;
    if (typeof sel.modify === 'function') {
      for (let i = 0; i < count; i += 1) sel.modify('extend', 'backward', 'character');
    } else {
      this.extendBackwardManually(sel, count);
    }
    if (!this.execCommand('delete')) {
      sel.deleteFromDocument();
      this.fireInput(el, 'deleteContentBackward');
    }
  }

  /** Fallback for engines without Selection.modify: walk back through text nodes. */
  extendBackwardManually(sel, count) {
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;
    if (node.nodeType !== 3) {
      // Find the text node right before the caret
      const child = node.childNodes[offset - 1];
      if (!child) return;
      node = child;
      while (node.nodeType !== 3 && node.lastChild) node = node.lastChild;
      if (node.nodeType !== 3) return;
      offset = node.data.length;
    }
    let remaining = count;
    let startNode = node;
    let startOffset = offset;
    while (remaining > 0 && startNode) {
      const newOffset = backByCodePoints(startNode.data, startOffset, remaining);
      remaining -= Array.from(startNode.data.slice(newOffset, startOffset)).length;
      startOffset = newOffset;
      if (remaining > 0) {
        const prev = previousTextNode(startNode);
        if (!prev) break;
        startNode = prev;
        startOffset = prev.data.length;
      }
    }
    const newRange = range.cloneRange();
    newRange.setStart(startNode, startOffset);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  insertTextRich(el, text) {
    if (this.execCommand('insertText', text)) return;
    const sel = this.selection(el);
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const doc = el.ownerDocument;
    // Keep line breaks visible in rich editors
    const fragment = doc.createDocumentFragment();
    text.split('\n').forEach((line, i) => {
      if (i > 0) fragment.appendChild(doc.createElement('br'));
      if (line) fragment.appendChild(doc.createTextNode(line));
    });
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    this.fireInput(el, 'insertText', text);
  }

  insertHtml(el, html) {
    if (this.execCommand('insertHTML', html)) return;
    const sel = this.selection(el);
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    this.fireInput(el, 'insertHTML');
  }

  moveRich(el, direction, count) {
    const sel = this.selection(el);
    if (!sel) return;
    if (typeof sel.modify === 'function') {
      for (let i = 0; i < count; i += 1) sel.modify('move', direction, 'character');
      return;
    }
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === 3) {
      const offset = direction === 'backward'
        ? backByGraphemes(node.data, range.startOffset, count)
        : Math.min(node.data.length, range.startOffset + count);
      range.setStart(node, offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

function previousTextNode(node) {
  let current = node;
  for (;;) {
    while (current && !current.previousSibling) {
      current = current.parentNode;
      if (!current || (current.nodeType === 1 && current.isContentEditable === true && !current.parentElement?.isContentEditable)) {
        return null;
      }
    }
    if (!current) return null;
    current = current.previousSibling;
    while (current && current.nodeType !== 3 && current.lastChild) current = current.lastChild;
    if (current && current.nodeType === 3) return current;
  }
}

// --- Detector -----------------------------------------------------------------

function keyEventVariant(event) {
  if (event.location === 1) return 'left';
  if (event.location === 2) return 'right';
  return null;
}

function normalizeModifier(key) {
  return key === 'AltGraph' ? 'Alt' : key;
}

function keyForChar(c) {
  if (c === ' ') return 'Space';
  if (c === '\n') return 'Enter';
  if (c === '\t') return 'Tab';
  return 'Other';
}

/**
 * Listen to the DOM and feed the engine.
 *
 * @param {import('../engine/engine.js').Engine} engine
 * @param {object} [options]
 * @param {Document|Element|ShadowRoot} [options.root=document]
 * @param {boolean} [options.includePasswordFields=false]
 * @param {(el: Element) => boolean} [options.shouldHandle]  return false to ignore a field
 * @param {DomInjector} [options.injector]
 * @returns {{detach(): void, injector: DomInjector}}
 */
export function attach(engine, options = {}) {
  const root = options.root ?? document;
  const doc = root.ownerDocument ?? (root.nodeType === 9 ? root : document);
  const config = engine.configManager?.default();
  const reportError = (kind, error) => (engine.reportError ? engine.reportError(kind, error) : console.error(error));

  const editableOptions = {
    includePasswordFields: options.includePasswordFields ?? config?.includePasswordFields ?? false,
  };
  const excludeSelector = validSelector(options.excludeSelector ?? config?.excludeSelector ?? '', doc, reportError);
  const customShouldHandle = options.shouldHandle ?? (() => true);
  const shouldHandle = (el) => {
    if (excludeSelector && el.closest(excludeSelector)) return false;
    return customShouldHandle(el);
  };
  const richText = options.richText ?? config?.richText ?? true;

  let lastTarget = null;
  const injector = options.injector ?? new DomInjector({ doc, getTarget: () => lastTarget, editableOptions, richText });
  injector.editableOptions = editableOptions;
  injector.richText = richText;
  engine.injector = injector;

  // `dom` variables read from the document of the field being typed in
  const previousDocumentProvider = engine.documentProvider;
  engine.documentProvider = () => (injector.target()?.ownerDocument ?? doc);

  const resolveField = (event) => {
    const el = editableRoot(eventTarget(event), editableOptions);
    if (!el || !shouldHandle(el)) return null;
    return el;
  };

  const sendChars = (text) => {
    for (const c of text) {
      engine.handleInput({ type: 'keyboard', key: keyForChar(c), value: c, status: 'pressed' });
    }
  };

  const invalidate = () => engine.handleInput({ type: 'mouse', status: 'pressed', button: 'left' });

  const onInput = (event) => {
    if (injector.injecting) return;
    const el = resolveField(event);
    if (!el) return;
    if (el !== lastTarget) {
      lastTarget = el;
    }
    if (event.isComposing) return; // handled on compositionend

    switch (event.inputType) {
      case 'insertText':
        if (event.data != null) sendChars(event.data);
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        engine.handleInput({ type: 'keyboard', key: 'Enter', value: '\n', status: 'pressed' });
        break;
      case 'deleteContentBackward':
        engine.handleInput({ type: 'keyboard', key: 'Backspace', value: null, status: 'pressed' });
        break;
      case 'insertCompositionText':
      case 'insertFromComposition': // Safari, after compositionend
      case 'deleteCompositionText': // Safari, after compositionend
        // IME input: the committed text is handled on compositionend
        break;
      case undefined:
      case '':
        // Engines without InputEvent.inputType: best effort, use `data` when present
        if (event.data != null) sendChars(event.data);
        else invalidate();
        break;
      default:
        // Paste, drop, undo/redo, word deletions, formatting...: the buffer is no
        // longer reliable, like after a mouse click in desktop espanso.
        invalidate();
        break;
    }
  };

  const onCompositionEnd = (event) => {
    if (injector.injecting) return;
    const el = resolveField(event);
    if (!el) return;
    lastTarget = el;
    if (event.data) sendChars(event.data);
  };

  const onKeyDown = (event) => {
    if (injector.injecting || event.isComposing) return;
    if (MODIFIER_KEYS.has(event.key)) {
      engine.handleInput({
        type: 'keyboard', key: normalizeModifier(event.key), value: null, status: 'pressed', variant: keyEventVariant(event),
      });
      return;
    }
    if (!resolveField(event)) return;
    if (NAVIGATION_KEYS.has(event.key)) {
      engine.handleInput({ type: 'keyboard', key: event.key, value: null, status: 'pressed' });
    }
  };

  const onKeyUp = (event) => {
    if (injector.injecting) return;
    // Releases only matter for the toggle key (double tap to enable/disable)
    const key = MODIFIER_KEYS.has(event.key) ? normalizeModifier(event.key) : 'Other';
    engine.handleInput({ type: 'keyboard', key, value: null, status: 'released', variant: keyEventVariant(event) });
  };

  const onPointerDown = () => invalidate();

  const onFocusIn = (event) => {
    const el = resolveField(event);
    if (el && el !== lastTarget) {
      lastTarget = el;
      engine.resetState();
    }
  };

  // A failure in a handler must never break the page's own event handling
  const safe = (fn) => (event) => {
    try {
      fn(event);
    } catch (error) {
      reportError('attach', error);
    }
  };

  const listeners = [
    ['input', onInput],
    ['compositionend', onCompositionEnd],
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['mousedown', onPointerDown],
    ['focusin', onFocusIn],
  ].map(([type, fn]) => [type, safe(fn)]);
  for (const [type, fn] of listeners) root.addEventListener(type, fn, true);

  return {
    injector,
    detach() {
      for (const [type, fn] of listeners) root.removeEventListener(type, fn, true);
      if (engine.injector === injector) engine.injector = nullInjector;
      engine.documentProvider = previousDocumentProvider ?? null;
    },
  };
}

/** An invalid selector is reported as a config error and ignored (never throws later). */
export class InvalidSelectorError extends Error {
  constructor() {
    super('exclude_selector is not a valid CSS selector; it is ignored');
    this.name = 'InvalidSelectorError';
  }
}

function validSelector(selector, doc, reportError) {
  if (typeof selector !== 'string' || selector.trim() === '') return '';
  try {
    doc.createDocumentFragment().querySelector(selector);
    return selector;
  } catch {
    reportError('config', new InvalidSelectorError());
    return '';
  }
}

/** App info used to pick app-specific configs (filter_title / filter_url). */
export function browserAppInfo() {
  if (typeof document === 'undefined') return {};
  return {
    title: document.title,
    url: typeof location !== 'undefined' ? location.href : undefined,
  };
}
