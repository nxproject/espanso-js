/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-match/src/regex/mod.rs
 */

const POSIX_CLASSES = {
  alnum: '0-9A-Za-z',
  alpha: 'A-Za-z',
  ascii: '\\x00-\\x7F',
  blank: '\\t ',
  cntrl: '\\x00-\\x1F\\x7F',
  digit: '0-9',
  graph: '!-~',
  lower: 'a-z',
  print: ' -~',
  punct: '!-\\/:-@\\[-`{-~',
  space: '\\t\\n\\v\\f\\r ',
  upper: 'A-Z',
  word: '0-9A-Za-z_',
  xdigit: '0-9A-Fa-f',
};

/**
 * Translate a Rust `regex` crate pattern into a JavaScript RegExp.
 *
 * Handles the differences that show up in real espanso configs:
 *   - named groups `(?P<name>...)` -> `(?<name>...)`
 *   - leading inline flags `(?i)`, `(?s)`, `(?m)` -> RegExp flags
 *   - `\A` / `\z` anchors -> `^` / `$`
 *   - POSIX classes like `[[:alpha:]]`
 *   - Unicode classes `\p{...}` (enables the `u` flag)
 *
 * @param {string} pattern
 * @param {string} [extraFlags]
 * @returns {RegExp}
 */
export function compileRegex(pattern, extraFlags = '') {
  let source = String(pattern);
  const flags = new Set(extraFlags.split('').filter(Boolean));

  // Leading global inline flags, e.g. "(?i)" or "(?ims)"
  for (;;) {
    const m = /^\(\?([imsxU]+)\)/.exec(source);
    if (!m) break;
    for (const f of m[1]) {
      if (f === 'i' || f === 'm' || f === 's') flags.add(f);
    }
    source = source.slice(m[0].length);
  }

  source = source
    .replace(/\(\?P<(\w+)>/g, '(?<$1>')
    .replace(/\(\?P=(\w+)\)/g, '\\k<$1>')
    .replace(/\\A/g, '^')
    .replace(/\\z/g, '$')
    .replace(/\[:(\^?)(\w+):\]/g, (whole, negate, name) => {
      const cls = POSIX_CLASSES[name];
      if (!cls) return whole;
      // Only valid inside a bracket expression; negated POSIX classes are rare.
      return negate ? whole : cls;
    });

  if (/\\[pP]\{/.test(source)) flags.add('u');

  const flagString = [...flags].join('');
  try {
    return new RegExp(source, flagString);
  } catch (error) {
    // Rust allows escaping any punctuation; JS forbids some escapes in unicode mode.
    if (flags.has('u')) {
      flags.delete('u');
      return new RegExp(source, [...flags].join(''));
    }
    throw error;
  }
}

/**
 * A regex-based matcher. It keeps a rolling buffer of the last typed characters
 * (at most `maxBufferSize`) and checks it against every regex after each key.
 *
 * Matcher protocol (shared with the RollingMatcher):
 *   process(prevState, event) -> { state, results }
 * where event = { type: 'key', key, chars } | { type: 'virtualSeparator' }
 * and results = [{ id, trigger, leftSeparator, rightSeparator, args }]
 */
export class RegexMatcher {
  /**
   * @param {Array<{id: any, regex: string}>} matches
   * @param {{maxBufferSize?: number, onError?: (err: Error, m: object) => void}} [options]
   */
  constructor(matches, options = {}) {
    this.entries = [];
    this.maxBufferSize = options.maxBufferSize ?? 30;
    for (const m of matches) {
      try {
        this.entries.push({ id: m.id, regex: compileRegex(m.regex) });
      } catch (error) {
        options.onError?.(new Error(`unable to compile regex: '${m.regex}', error: ${error.message}`), m);
      }
    }
  }

  process(prevState, event) {
    let buffer = prevState ? prevState.buffer : '';

    if (event.type === 'key' && event.chars != null) {
      buffer += event.chars;
    }

    // Keep the buffer length in check (counted in code points)
    if (Array.from(buffer).length > this.maxBufferSize) {
      buffer = Array.from(buffer).slice(1).join('');
    }

    const results = [];
    for (const { id, regex } of this.entries) {
      regex.lastIndex = 0;
      const captures = regex.exec(buffer);
      if (captures && captures[0] !== '') {
        const args = {};
        if (captures.groups) {
          for (const [name, value] of Object.entries(captures.groups)) {
            if (value !== undefined) args[name] = value;
          }
        }
        results.push({
          id,
          trigger: captures[0],
          leftSeparator: null,
          rightSeparator: null,
          args,
        });
      }
    }

    if (results.length > 0) {
      return { state: { buffer: '' }, results };
    }
    return { state: { buffer }, results: [] };
  }
}
