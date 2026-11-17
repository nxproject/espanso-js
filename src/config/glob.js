/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Minimal glob implementation, compatible with the patterns espanso uses for
 * `includes`/`excludes` (Rust `glob` crate semantics):
 *   `*`      any sequence of characters except `/`
 *   `?`      any single character except `/`
 *   `**`     any number of directories (when used as a whole path component)
 *   `[abc]`, `[a-z]`, `[!abc]`  character classes
 */

import { normalizePath } from './vfs.js';

const cache = new Map();

export function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  if (cache.has(normalized)) return cache.get(normalized);

  const parts = normalized.split('/');
  let source = '';
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    if (part === '**') {
      // Zero or more directories
      source += isLast ? '.*' : '(?:[^/]*/)*';
      return;
    }
    source += componentToRegExp(part);
    if (!isLast) source += '/';
  });

  const regex = new RegExp(`^${source}$`);
  cache.set(normalized, regex);
  return regex;
}

function componentToRegExp(component) {
  let out = '';
  for (let i = 0; i < component.length; i += 1) {
    const c = component[i];
    if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (c === '[') {
      const end = component.indexOf(']', i + 2);
      if (end < 0) {
        out += '\\[';
        continue;
      }
      let body = component.slice(i + 1, end);
      let negate = false;
      if (body.startsWith('!')) {
        negate = true;
        body = body.slice(1);
      }
      body = body.replace(/[\\\]^]/g, (m) => `\\${m}`);
      out += negate ? `[^/${body}]` : `[${body}]`;
      i = end;
    } else {
      out += c.replace(/[.+^${}()|\\]/g, (m) => `\\${m}`);
    }
  }
  return out;
}

/** Return the paths from `allPaths` matched by the glob `pattern`. */
export function glob(pattern, allPaths) {
  const regex = globToRegExp(pattern);
  return allPaths.filter((path) => regex.test(path));
}
