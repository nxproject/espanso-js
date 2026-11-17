/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Browsers have no file system, so espanso-js works on a *virtual* one: a flat
 * map from POSIX-style paths to YAML file contents, e.g.
 *
 *   {
 *     "config/default.yml": "...",
 *     "match/base.yml": "...",
 *     "match/packages/emoji/package.yml": "..."
 *   }
 *
 * This keeps espanso's directory semantics (default.yml + app-specific configs in
 * `config/`, `includes`/`excludes` globs relative to the config file, relative
 * `imports` between match files) without needing a disk.
 */

/** Normalize a path: forward slashes, no leading "./", "." and ".." resolved. */
export function normalizePath(path) {
  const isAbsolute = path.startsWith('/');
  const parts = [];
  for (const part of String(path).replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop();
      else if (!isAbsolute) parts.push('..');
      continue;
    }
    parts.push(part);
  }
  return (isAbsolute ? '/' : '') + parts.join('/');
}

export function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  if (index < 0) return '';
  if (index === 0) return '/';
  return normalized.slice(0, index);
}

export function basename(path) {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function extname(path) {
  const base = basename(path);
  const index = base.lastIndexOf('.');
  return index <= 0 ? '' : base.slice(index + 1).toLowerCase();
}

export function joinPath(...parts) {
  const filtered = parts.filter((p) => p !== '' && p !== undefined && p !== null);
  return normalizePath(filtered.join('/'));
}

const ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\/)/;

export function isAbsolutePath(path) {
  return ABSOLUTE_PATH.test(path);
}

/** Resolve `path` relative to the directory `baseDir` (absolute paths are kept). */
export function resolvePath(baseDir, path) {
  if (isAbsolutePath(path)) return normalizePath(path);
  return joinPath(baseDir, path);
}

/**
 * An in-memory file system. Keys are normalized on insertion.
 */
export class VirtualFS {
  constructor(files = {}) {
    this.files = new Map();
    const entries = files instanceof Map ? files.entries() : Object.entries(files);
    for (const [path, content] of entries) {
      this.files.set(normalizePath(path), String(content));
    }
  }

  exists(path) {
    return this.files.has(normalizePath(path));
  }

  read(path) {
    const key = normalizePath(path);
    if (!this.files.has(key)) {
      throw new Error(`file not found: ${key}`);
    }
    return this.files.get(key);
  }

  /** All file paths directly inside `dir` (non-recursive). */
  listDir(dir) {
    const prefix = normalizePath(dir);
    const result = [];
    for (const path of this.files.keys()) {
      if (dirname(path) === prefix) result.push(path);
    }
    return result.sort();
  }

  paths() {
    return [...this.files.keys()].sort();
  }
}
