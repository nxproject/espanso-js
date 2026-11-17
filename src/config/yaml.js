/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 *
 * espanso is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Port of espanso-config/src/util.rs (YAML helpers).
 */

import yaml from 'js-yaml';

// YAML 1.2 core schema (dates stay strings, like serde_norway) plus merge keys (<<).
const SCHEMA = yaml.CORE_SCHEMA.extend({ implicit: [yaml.types.merge] });

/**
 * Check if the given string represents an empty YAML document,
 * i.e. it is only composed of whitespace and/or comments.
 */
export function isYamlEmpty(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#') && trimmed !== '') return false;
  }
  return true;
}

/**
 * Parse a YAML document into a plain object, with the same tolerances as espanso:
 *  - a leading UTF-8 BOM is ignored
 *  - an empty (or comment-only) document yields `{}`
 *  - if strict parsing fails, retry once on a leniently re-quoted copy
 *    (see `lenientFlowQuote`). If the retry fails as well, the original error is thrown.
 */
export function parseYaml(text) {
  const source = String(text ?? '').replace(/^﻿+/, '');
  if (isYamlEmpty(source)) return {};

  let doc;
  try {
    doc = yaml.load(source, { schema: SCHEMA });
  } catch (original) {
    try {
      doc = yaml.load(lenientFlowQuote(source), { schema: SCHEMA });
    } catch {
      throw original;
    }
  }
  if (doc === null || doc === undefined) return {};
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('invalid YAML document: expected a mapping at the top level');
  }
  return doc;
}

const LENIENT_FLOW_VALUE_FIRST_CHARS = new Set([':', '>', '|']);
const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/**
 * Re-quote bare flow-collection scalars whose first character is `:`, `>` or `|`
 * (e.g. `triggers: [:->, :-)]`) so that a strict YAML parser accepts them.
 * Only touches characters inside `[...]`/`{...}` collections; quoted scalars,
 * comments and block scalars are copied verbatim.
 */
export function lenientFlowQuote(input) {
  const chars = Array.from(input);
  const n = chars.length;
  let out = '';
  let depth = 0;
  let scalarStartPending = true;
  let i = 0;

  while (i < n) {
    if ((i === 0 || chars[i - 1] === '\n') && depth === 0) {
      const resume = blockScalarSpan(chars, i);
      if (resume !== null) {
        out += chars.slice(i, resume).join('');
        i = resume;
        continue;
      }
    }

    const c = chars[i];

    if (c === "'" || c === '"') {
      const res = copyQuotedScalar(chars, i);
      out += res.text;
      i = res.next;
      scalarStartPending = false;
      continue;
    }

    if (c === '[' || c === '{') {
      depth += 1;
      out += c;
      scalarStartPending = true;
      i += 1;
      continue;
    }
    if (c === ']' || c === '}') {
      depth = Math.max(depth - 1, 0);
      out += c;
      scalarStartPending = false;
      i += 1;
      continue;
    }

    if (c === '#' && commentStartsHere(chars, i)) {
      while (i < n && chars[i] !== '\n') {
        out += chars[i];
        i += 1;
      }
      continue;
    }

    if (depth > 0) {
      if (c === ',') {
        out += c;
        scalarStartPending = true;
        i += 1;
        continue;
      }
      if (c === ':' && isValueIndicator(chars, i)) {
        out += c;
        scalarStartPending = true;
        i += 1;
        continue;
      }
      if (scalarStartPending) {
        if (isWs(c)) {
          out += c;
          i += 1;
          continue;
        }
        if (LENIENT_FLOW_VALUE_FIRST_CHARS.has(c)) {
          const { resumeAt, value, trailing } = extractBareScalar(chars, i);
          out += "'" + value.replace(/'/g, "''") + "'" + trailing;
          scalarStartPending = false;
          i = resumeAt;
          continue;
        }
        out += c;
        scalarStartPending = false;
        i += 1;
        continue;
      }
    }

    out += c;
    if (!isWs(c)) scalarStartPending = false;
    i += 1;
  }

  return out;
}

function copyQuotedScalar(chars, start) {
  const n = chars.length;
  const quote = chars[start];
  let text = quote;
  let i = start + 1;
  if (quote === "'") {
    while (i < n) {
      const c = chars[i];
      text += c;
      i += 1;
      if (c === "'") {
        if (i < n && chars[i] === "'") {
          text += "'";
          i += 1;
        } else {
          break;
        }
      }
    }
  } else {
    while (i < n) {
      const c = chars[i];
      text += c;
      i += 1;
      if (c === '\\') {
        if (i < n) {
          text += chars[i];
          i += 1;
        }
      } else if (c === '"') {
        break;
      }
    }
  }
  return { text, next: i };
}

function isValueIndicator(chars, i) {
  const next = chars[i + 1];
  if (next === undefined) return true;
  return [' ', '\t', '\n', '\r', ',', ']', '}'].includes(next);
}

function commentStartsHere(chars, i) {
  if (i === 0) return true;
  return isWs(chars[i - 1]);
}

function extractBareScalar(chars, start) {
  const n = chars.length;
  let j = start;
  while (j < n) {
    const c = chars[j];
    if ([',', '[', ']', '{', '}', '\n', '\r'].includes(c)) break;
    if (c === '#' && commentStartsHere(chars, j)) break;
    if (c === ':' && isValueIndicator(chars, j)) break;
    j += 1;
  }
  const raw = chars.slice(start, j);
  let end = raw.length;
  while (end > 0 && (raw[end - 1] === ' ' || raw[end - 1] === '\t')) end -= 1;
  return {
    resumeAt: j,
    value: raw.slice(0, end).join(''),
    trailing: raw.slice(end).join(''),
  };
}

function blockScalarSpan(chars, lineStart) {
  const n = chars.length;
  let pos = lineStart;
  let parentIndent = 0;
  while (pos < n && (chars[pos] === ' ' || chars[pos] === '\t')) {
    parentIndent += 1;
    pos += 1;
  }
  if (!isBlockScalarHeader(chars, pos)) return null;

  let cur = pos;
  while (cur < n && chars[cur] !== '\n') cur += 1;

  for (;;) {
    if (cur >= n) break;
    cur += 1;
    if (cur >= n) break;

    let content = cur;
    let lineIndent = 0;
    while (content < n && (chars[content] === ' ' || chars[content] === '\t')) {
      lineIndent += 1;
      content += 1;
    }

    let scan = content;
    let blank = true;
    while (scan < n && chars[scan] !== '\n') {
      if (![' ', '\t', '\r'].includes(chars[scan])) {
        blank = false;
        break;
      }
      scan += 1;
    }

    if (blank || lineIndent > parentIndent) {
      while (cur < n && chars[cur] !== '\n') cur += 1;
      continue;
    }
    break;
  }
  return cur;
}

function isBlockScalarHeader(chars, start) {
  const n = chars.length;
  let eol = start;
  while (eol < n && chars[eol] !== '\n') eol += 1;

  let indicator = -1;
  for (let idx = eol - 1; idx >= start; idx -= 1) {
    if (chars[idx] === '|' || chars[idx] === '>') {
      indicator = idx;
      break;
    }
  }
  if (indicator < 0) return false;

  let after = indicator + 1;
  while (after < eol && (chars[after] === '+' || chars[after] === '-' || /[0-9]/.test(chars[after]))) {
    after += 1;
  }
  while (after < eol && (chars[after] === ' ' || chars[after] === '\t')) after += 1;
  if (after < eol && chars[after] === '#') return true;
  return after === eol;
}
