/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-engine/src/event/*.rs
 *
 * An event is a plain object: `{ sourceId, type, ...payload }`.
 * The `sourceId` is a monotonically increasing number given to each input event
 * and propagated to all the events it causes.
 */

export const EventType = Object.freeze({
  NOOP: 'noop',

  // Inputs
  Keyboard: 'keyboard', // { key, value, status, variant }
  Mouse: 'mouse', // { status, button }

  // External requests
  MatchExecRequest: 'matchExecRequest', // { trigger, args, compensate }

  // Internal
  MatchesDetected: 'matchesDetected', // { matches: DetectedMatch[], isSearch }
  MatchSelected: 'matchSelected', // { chosen }
  CauseCompensatedMatch: 'causeCompensatedMatch', // { m }
  RenderingRequested: 'renderingRequested', // { matchId, trigger, leftSeparator, rightSeparator, triggerArgs, format }
  ImageRequested: 'imageRequested', // { matchId, imagePath, trigger }
  Rendered: 'rendered', // { matchId, body, format }
  ImageResolved: 'imageResolved', // { imagePath }
  MatchInjected: 'matchInjected',
  DiscardPrevious: 'discardPrevious', // { minimumSourceId }
  DiscardBetween: 'discardBetween', // { startId, endId }
  Undo: 'undo', // { matchId, trigger, replace }
  RenderingError: 'renderingError', // { error }

  Disabled: 'disabled',
  Enabled: 'enabled',
  DisableRequest: 'disableRequest',
  EnableRequest: 'enableRequest',
  ToggleRequest: 'toggleRequest',

  // Effects
  TriggerCompensation: 'triggerCompensation', // { trigger, leftSeparator }
  CursorHintCompensation: 'cursorHintCompensation', // { cursorHintBackCount }
  KeySequenceInject: 'keySequenceInject', // { keys }
  TextInject: 'textInject', // { text, forceMode }
  MarkdownInject: 'markdownInject', // { markdown }
  HtmlInject: 'htmlInject', // { html }
  ImageInject: 'imageInject', // { imagePath }
});

/** Logical keys (port of espanso_engine::event::input::Key). */
export const Key = Object.freeze({
  // Modifiers
  Alt: 'Alt',
  CapsLock: 'CapsLock',
  Control: 'Control',
  Meta: 'Meta',
  NumLock: 'NumLock',
  Shift: 'Shift',
  // Whitespace
  Enter: 'Enter',
  Tab: 'Tab',
  Space: 'Space',
  // Navigation
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  End: 'End',
  Home: 'Home',
  PageDown: 'PageDown',
  PageUp: 'PageUp',
  // UI
  Escape: 'Escape',
  // Editing
  Backspace: 'Backspace',
  // Others
  Other: 'Other',
});

export const MODIFIER_KEYS = new Set([
  Key.Alt, Key.Shift, Key.CapsLock, Key.Meta, Key.NumLock, Key.Control,
]);

export const Status = Object.freeze({ Pressed: 'pressed', Released: 'released' });

export function causedBy(sourceId, type, payload = {}) {
  return { sourceId, type, ...payload };
}

/** A detected match (port of DetectedMatch). */
export function detectedMatch({
  id,
  trigger = null,
  leftSeparator = null,
  rightSeparator = null,
  args = {},
  compensate = true,
}) {
  return { id, trigger, leftSeparator, rightSeparator, args, compensate };
}
