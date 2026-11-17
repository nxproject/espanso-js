/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-config/src/config/{parse,resolve,store}.rs
 */

import { parseYaml } from './yaml.js';
import { glob } from './glob.js';
import { dirname, resolvePath, basename, extname } from './vfs.js';
import { nextId } from '../matches/counter.js';
import { compileRegex } from '../match/regex.js';

export const STANDARD_INCLUDES = ['../match/**/[!_]*.yml', '../match/**/[!_]*.yaml'];

export const DEFAULT_WORD_SEPARATORS = [
  ' ', ',', ';', ':', '.', '?', '!', '(', ')', '{', '}', '[', ']', '<', '>', "'", '"',
  '\r', '\t', '\n', '\x0c' /* form feed */, '\u00A0' /* non-breaking space */,
];

export const DEFAULT_MAX_REGEX_BUFFER_SIZE = 30;

/**
 * All the options espanso understands. They are all parsed (and inherited from
 * default.yml) so that existing configuration files load unchanged, even though
 * many of them (backend, delays, clipboard, X11/Win32 tweaks...) have no meaning
 * inside a browser.
 */
const CONFIG_FIELDS = [
  'label', 'backend', 'enable', 'clipboard_threshold', 'auto_restart', 'pre_paste_delay',
  'preserve_clipboard', 'restore_clipboard_delay', 'paste_shortcut', 'apply_patch',
  'paste_shortcut_event_delay', 'disable_x11_fast_inject', 'toggle_key', 'inject_delay',
  'key_delay', 'backspace_delay', 'evdev_modifier_delay', 'word_separators', 'backspace_limit',
  'keyboard_layout', 'search_trigger', 'search_shortcut', 'undo_backspace', 'show_icon',
  'show_notifications', 'secure_input_notification', 'emulate_alt_codes', 'post_form_delay',
  'max_form_width', 'max_form_height', 'max_regex_buffer_size', 'post_search_delay',
  'win32_exclude_orphan_events', 'win32_keyboard_layout_cache_interval',
  'x11_use_xclip_backend', 'x11_use_xdotool_backend', 'includes', 'excludes',
  'extra_includes', 'extra_excludes', 'use_standard_includes', 'filter_title', 'filter_class',
  'filter_exec', 'filter_os', 'stats',
  // espanso-js only: match the page URL (location.href) in app-specific configs
  'filter_url',
  // espanso-js only: declarative browser settings
  'exclude_selector', 'include_password_fields', 'rich_text', 'regex', 'disabled_var_types',
  'rendering_error_text',
];

// Keys for which an explicit `null` is meaningful (kept instead of dropped)
const NULLABLE_FIELDS = new Set(['rendering_error_text']);

const VALID_TOGGLE_KEYS = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  right_ctrl: 'RightCtrl',
  right_alt: 'RightAlt',
  right_shift: 'RightShift',
  right_meta: 'RightMeta',
  right_cmd: 'RightMeta',
  left_ctrl: 'LeftCtrl',
  left_alt: 'LeftAlt',
  left_shift: 'LeftShift',
  left_meta: 'LeftMeta',
  left_cmd: 'LeftMeta',
  off: null,
};

/** Parse the raw text of a config file into a "parsed config" (only known fields). */
export function parseConfig(text) {
  return normalizeConfig(parseYaml(text));
}

/** Keep only the known config fields of an already parsed object (YAML or JSON). */
export function normalizeConfig(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('invalid config: expected a mapping');
  }
  const parsed = {};
  for (const field of CONFIG_FIELDS) {
    if (raw[field] !== undefined && raw[field] !== null) parsed[field] = raw[field];
    else if (raw[field] === null && NULLABLE_FIELDS.has(field)) parsed[field] = null;
  }
  return parsed;
}

export function currentOs() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const platform = (
    nav?.userAgentData?.platform ||
    nav?.platform ||
    (typeof process !== 'undefined' ? process.platform : '') ||
    ''
  ).toLowerCase();
  if (platform.startsWith('win')) return 'windows';
  if (platform.startsWith('mac') || platform === 'darwin' || platform.includes('iphone') || platform.includes('ipad')) return 'macos';
  if (platform.includes('linux') || platform.includes('android') || platform.includes('cros')) return 'linux';
  return platform;
}

export class ResolvedConfig {
  /**
   * @param {object} parsed  parsed config fields
   * @param {string|null} sourcePath  path of the config file inside the virtual FS
   * @param {string[]} allPaths  all paths of the virtual FS (to evaluate globs)
   */
  constructor(parsed, sourcePath, allPaths) {
    this.parsed = parsed;
    this.sourcePath = sourcePath;
    this.id = nextId();

    const baseDir = sourcePath ? dirname(sourcePath) : '';
    this.matchPaths = generateMatchPaths(parsed, baseDir, allPaths);

    this.filterTitle = parsed.filter_title != null ? compileRegex(String(parsed.filter_title)) : null;
    this.filterClass = parsed.filter_class != null ? compileRegex(String(parsed.filter_class)) : null;
    this.filterExec = parsed.filter_exec != null ? compileRegex(String(parsed.filter_exec)) : null;
    this.filterUrl = parsed.filter_url != null ? compileRegex(String(parsed.filter_url)) : null;
  }

  static load(vfs, path, parent = null) {
    const parsed = parseConfig(vfs.read(path));
    if (parent) {
      for (const field of CONFIG_FIELDS) {
        if (parsed[field] === undefined && parent.parsed[field] !== undefined) {
          parsed[field] = parent.parsed[field];
        }
      }
    }
    return new ResolvedConfig(parsed, path, vfs.paths());
  }

  get label() {
    if (this.parsed.label) return this.parsed.label;
    return this.sourcePath ?? 'Unlabeled config';
  }

  get enable() { return this.parsed.enable ?? true; }

  get wordSeparators() {
    const separators = this.parsed.word_separators;
    return Array.isArray(separators) ? separators.map(String) : DEFAULT_WORD_SEPARATORS;
  }

  get backspaceLimit() { return this.parsed.backspace_limit ?? 5; }

  get undoBackspace() { return this.parsed.undo_backspace ?? true; }

  get maxRegexBufferSize() {
    return this.parsed.max_regex_buffer_size ?? DEFAULT_MAX_REGEX_BUFFER_SIZE;
  }

  get toggleKey() {
    const key = this.parsed.toggle_key;
    if (key == null) return null;
    return VALID_TOGGLE_KEYS[String(key).toLowerCase()] ?? null;
  }

  get searchTrigger() {
    const trigger = this.parsed.search_trigger;
    if (trigger == null || trigger === 'OFF' || trigger === 'off') return null;
    return String(trigger);
  }

  /** CSS selector of fields where nothing is expanded ("" = none). */
  get excludeSelector() {
    const selector = this.parsed.exclude_selector;
    return typeof selector === 'string' ? selector.trim() : '';
  }

  get includePasswordFields() { return this.parsed.include_password_fields === true; }

  /** When false, html/markdown are inserted as plain text and image matches are dropped. */
  get richText() { return this.parsed.rich_text !== false; }

  /** When false, regex matches are dropped at load. */
  get regex() { return this.parsed.regex !== false; }

  /** Variable types that make a match fail to render (nothing is inserted). */
  get disabledVarTypes() {
    const types = this.parsed.disabled_var_types;
    return Array.isArray(types) ? types.map(String) : [];
  }

  /**
   * Text that replaces the trigger when rendering fails: a string (inserted as a
   * literal), `null` (leave the field untouched), or `undefined` when the key is
   * absent or invalid (the caller's default applies).
   */
  get renderingErrorText() {
    if (!Object.prototype.hasOwnProperty.call(this.parsed, 'rendering_error_text')) return undefined;
    const value = this.parsed.rendering_error_text;
    return value === null || typeof value === 'string' ? value : undefined;
  }

  get showNotifications() { return this.parsed.show_notifications ?? true; }

  get postFormDelay() { return this.parsed.post_form_delay ?? 200; }

  /** Returns true if this (app-specific) config should be active for the given app. */
  isMatch(app = {}) {
    const p = this.parsed;
    if (p.filter_os == null && p.filter_title == null && p.filter_exec == null &&
        p.filter_class == null && p.filter_url == null) {
      return false;
    }
    const isOsMatch = p.filter_os != null ? osMatches(String(p.filter_os)) : true;
    const test = (regex, value) => (regex ? value != null && regex.test(value) : true);
    return isOsMatch &&
      test(this.filterTitle, app.title) &&
      test(this.filterExec, app.exec) &&
      test(this.filterClass, app.class) &&
      test(this.filterUrl, app.url);
  }
}

function osMatches(os) {
  const current = currentOs();
  return String(os).toLowerCase() === current;
}

function aggregateIncludes(config) {
  const includes = new Set();
  if (config.use_standard_includes == null || config.use_standard_includes) {
    STANDARD_INCLUDES.forEach((i) => includes.add(i));
  }
  (config.includes ?? []).forEach((i) => includes.add(String(i)));
  (config.extra_includes ?? []).forEach((i) => includes.add(String(i)));
  return includes;
}

function aggregateExcludes(config) {
  const excludes = new Set();
  (config.excludes ?? []).forEach((e) => excludes.add(String(e)));
  (config.extra_excludes ?? []).forEach((e) => excludes.add(String(e)));
  return excludes;
}

function calculatePaths(baseDir, patterns, allPaths) {
  const result = new Set();
  for (const pattern of patterns) {
    for (const path of glob(resolvePath(baseDir, pattern), allPaths)) result.add(path);
  }
  return result;
}

function generateMatchPaths(config, baseDir, allPaths) {
  const includes = calculatePaths(baseDir, aggregateIncludes(config), allPaths);
  const excludes = calculatePaths(baseDir, aggregateExcludes(config), allPaths);
  return [...includes].filter((p) => !excludes.has(p)).sort();
}

/**
 * Port of DefaultConfigStore: a default config plus app-specific ("custom") configs,
 * all living in the `config/` directory of the virtual FS.
 */
export class ConfigStore {
  constructor(defaultConfig, customs) {
    this.defaultConfig = defaultConfig;
    this.customs = customs;
  }

  /**
   * @param {import('./vfs.js').VirtualFS} vfs
   * @param {string} configDir
   * @returns {{store: ConfigStore, errors: Array<{path: string, error: Error}>}}
   */
  static load(vfs, configDir = 'config', options = {}) {
    const yml = resolvePath(configDir, 'default.yml');
    const yaml = resolvePath(configDir, 'default.yaml');
    const defaultFile = vfs.exists(yml) ? yml : vfs.exists(yaml) ? yaml : null;

    const errors = [];
    let defaultConfig;
    if (options.defaultConfig != null) {
      // A config object given directly (e.g. from JSON) replaces default.yml
      defaultConfig = new ResolvedConfig(normalizeConfig(options.defaultConfig), `${configDir}/default.yml`, vfs.paths());
    } else if (defaultFile) {
      defaultConfig = ResolvedConfig.load(vfs, defaultFile, null);
    } else {
      // Unlike desktop espanso, a missing default.yml is not fatal: use an empty one
      // so that a set of match files alone is enough to get started.
      defaultConfig = new ResolvedConfig({}, `${configDir}/default.yml`, vfs.paths());
    }

    const customs = [];
    for (const path of vfs.listDir(configDir)) {
      const ext = extname(path);
      if (path === defaultFile || (ext !== 'yml' && ext !== 'yaml')) continue;
      if (basename(path).startsWith('default.')) continue;
      try {
        customs.push(ResolvedConfig.load(vfs, path, defaultConfig));
      } catch (error) {
        errors.push({ path, error });
      }
    }
    return { store: new ConfigStore(defaultConfig, customs), errors };
  }

  default() {
    return this.defaultConfig;
  }

  active(app) {
    for (const custom of this.customs) {
      if (custom.isMatch(app)) return custom;
    }
    return this.defaultConfig;
  }

  configs() {
    return [this.defaultConfig, ...this.customs];
  }

  getAllMatchPaths() {
    const paths = new Set(this.defaultConfig.matchPaths);
    for (const custom of this.customs) custom.matchPaths.forEach((p) => paths.add(p));
    return [...paths];
  }
}
