/*! espanso-js 0.2.0 — https://github.com/nxproject/espanso-js (tag v0.2.0) — port of espanso (https://github.com/espanso/espanso) — GPL-3.0-or-later */
(() => {
  // src/config/vfs.js
  function normalizePath(path) {
    const isAbsolute = path.startsWith("/");
    const parts = [];
    for (const part of String(path).replace(/\\/g, "/").split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
        else if (!isAbsolute) parts.push("..");
        continue;
      }
      parts.push(part);
    }
    return (isAbsolute ? "/" : "") + parts.join("/");
  }
  function dirname(path) {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf("/");
    if (index < 0) return "";
    if (index === 0) return "/";
    return normalized.slice(0, index);
  }
  function basename(path) {
    const normalized = normalizePath(path);
    return normalized.slice(normalized.lastIndexOf("/") + 1);
  }
  function extname(path) {
    const base = basename(path);
    const index = base.lastIndexOf(".");
    return index <= 0 ? "" : base.slice(index + 1).toLowerCase();
  }
  function joinPath(...parts) {
    const filtered = parts.filter((p) => p !== "" && p !== void 0 && p !== null);
    return normalizePath(filtered.join("/"));
  }
  var ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\/)/;
  function isAbsolutePath(path) {
    return ABSOLUTE_PATH.test(path);
  }
  function resolvePath(baseDir, path) {
    if (isAbsolutePath(path)) return normalizePath(path);
    return joinPath(baseDir, path);
  }
  var VirtualFS = class {
    constructor(files = {}) {
      this.files = /* @__PURE__ */ new Map();
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
  };

  // src/config/yaml.js
  var yamlLoader = null;
  function load(text) {
    if (!yamlLoader) {
      throw new Error("YAML support is not available in this build; provide the configuration as JSON objects");
    }
    return yamlLoader(text);
  }
  function isYamlEmpty(text) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("#") && trimmed !== "") return false;
    }
    return true;
  }
  function parseYaml(text) {
    const source = String(text ?? "").replace(/^\uFEFF+/, "");
    if (isYamlEmpty(source)) return {};
    const doc = load(source);
    if (doc === null || doc === void 0) return {};
    if (typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error("invalid YAML document: expected a mapping at the top level");
    }
    return doc;
  }

  // src/config/glob.js
  var cache = /* @__PURE__ */ new Map();
  function globToRegExp(pattern) {
    const normalized = normalizePath(pattern);
    if (cache.has(normalized)) return cache.get(normalized);
    const parts = normalized.split("/");
    let source = "";
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      if (part === "**") {
        source += isLast ? ".*" : "(?:[^/]*/)*";
        return;
      }
      source += componentToRegExp(part);
      if (!isLast) source += "/";
    });
    const regex = new RegExp(`^${source}$`);
    cache.set(normalized, regex);
    return regex;
  }
  function componentToRegExp(component) {
    let out = "";
    for (let i = 0; i < component.length; i += 1) {
      const c = component[i];
      if (c === "*") {
        out += "[^/]*";
      } else if (c === "?") {
        out += "[^/]";
      } else if (c === "[") {
        const end = component.indexOf("]", i + 2);
        if (end < 0) {
          out += "\\[";
          continue;
        }
        let body = component.slice(i + 1, end);
        let negate = false;
        if (body.startsWith("!")) {
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
  function glob(pattern, allPaths) {
    const regex = globToRegExp(pattern);
    return allPaths.filter((path) => regex.test(path));
  }

  // src/matches/counter.js
  var counter = 0;
  function nextId() {
    counter += 1;
    return counter;
  }

  // src/match/regex.js
  var POSIX_CLASSES = {
    alnum: "0-9A-Za-z",
    alpha: "A-Za-z",
    ascii: "\\x00-\\x7F",
    blank: "\\t ",
    cntrl: "\\x00-\\x1F\\x7F",
    digit: "0-9",
    graph: "!-~",
    lower: "a-z",
    print: " -~",
    punct: "!-\\/:-@\\[-`{-~",
    space: "\\t\\n\\v\\f\\r ",
    upper: "A-Z",
    word: "0-9A-Za-z_",
    xdigit: "0-9A-Fa-f"
  };
  function compileRegex(pattern, extraFlags = "") {
    let source = String(pattern);
    const flags = new Set(extraFlags.split("").filter(Boolean));
    for (; ; ) {
      const m = /^\(\?([imsxU]+)\)/.exec(source);
      if (!m) break;
      for (const f of m[1]) {
        if (f === "i" || f === "m" || f === "s") flags.add(f);
      }
      source = source.slice(m[0].length);
    }
    source = source.replace(/\(\?P<(\w+)>/g, "(?<$1>").replace(/\(\?P=(\w+)\)/g, "\\k<$1>").replace(/\\A/g, "^").replace(/\\z/g, "$").replace(/\[:(\^?)(\w+):\]/g, (whole, negate, name) => {
      const cls = POSIX_CLASSES[name];
      if (!cls) return whole;
      return negate ? whole : cls;
    });
    if (/\\[pP]\{/.test(source)) flags.add("u");
    const flagString = [...flags].join("");
    try {
      return new RegExp(source, flagString);
    } catch (error) {
      if (flags.has("u")) {
        flags.delete("u");
        return new RegExp(source, [...flags].join(""));
      }
      throw error;
    }
  }
  var RegexMatcher = class {
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
      let buffer = prevState ? prevState.buffer : "";
      if (event.type === "key" && event.chars != null) {
        buffer += event.chars;
      }
      if (Array.from(buffer).length > this.maxBufferSize) {
        buffer = Array.from(buffer).slice(1).join("");
      }
      const results = [];
      for (const { id, regex } of this.entries) {
        regex.lastIndex = 0;
        const captures = regex.exec(buffer);
        if (captures && captures[0] !== "") {
          const args = {};
          if (captures.groups) {
            for (const [name, value] of Object.entries(captures.groups)) {
              if (value !== void 0) args[name] = value;
            }
          }
          results.push({
            id,
            trigger: captures[0],
            leftSeparator: null,
            rightSeparator: null,
            args
          });
        }
      }
      if (results.length > 0) {
        return { state: { buffer: "" }, results };
      }
      return { state: { buffer }, results: [] };
    }
  };

  // src/config/config.js
  var STANDARD_INCLUDES = ["../match/**/[!_]*.yml", "../match/**/[!_]*.yaml"];
  var DEFAULT_WORD_SEPARATORS = [
    " ",
    ",",
    ";",
    ":",
    ".",
    "?",
    "!",
    "(",
    ")",
    "{",
    "}",
    "[",
    "]",
    "<",
    ">",
    "'",
    '"',
    "\r",
    "	",
    "\n",
    "\f",
    "\xA0"
  ];
  var DEFAULT_MAX_REGEX_BUFFER_SIZE = 30;
  var CONFIG_FIELDS = [
    "label",
    "backend",
    "enable",
    "clipboard_threshold",
    "auto_restart",
    "pre_paste_delay",
    "preserve_clipboard",
    "restore_clipboard_delay",
    "paste_shortcut",
    "apply_patch",
    "paste_shortcut_event_delay",
    "disable_x11_fast_inject",
    "toggle_key",
    "inject_delay",
    "key_delay",
    "backspace_delay",
    "evdev_modifier_delay",
    "word_separators",
    "backspace_limit",
    "keyboard_layout",
    "search_trigger",
    "search_shortcut",
    "undo_backspace",
    "show_icon",
    "show_notifications",
    "secure_input_notification",
    "emulate_alt_codes",
    "post_form_delay",
    "max_form_width",
    "max_form_height",
    "max_regex_buffer_size",
    "post_search_delay",
    "win32_exclude_orphan_events",
    "win32_keyboard_layout_cache_interval",
    "x11_use_xclip_backend",
    "x11_use_xdotool_backend",
    "includes",
    "excludes",
    "extra_includes",
    "extra_excludes",
    "use_standard_includes",
    "filter_title",
    "filter_class",
    "filter_exec",
    "filter_os",
    "stats",
    // espanso-js only: match the page URL (location.href) in app-specific configs
    "filter_url",
    // espanso-js only: declarative browser settings
    "exclude_selector",
    "include_password_fields",
    "rich_text",
    "regex",
    "disabled_var_types"
  ];
  var VALID_TOGGLE_KEYS = {
    ctrl: "Ctrl",
    alt: "Alt",
    shift: "Shift",
    meta: "Meta",
    cmd: "Meta",
    right_ctrl: "RightCtrl",
    right_alt: "RightAlt",
    right_shift: "RightShift",
    right_meta: "RightMeta",
    right_cmd: "RightMeta",
    left_ctrl: "LeftCtrl",
    left_alt: "LeftAlt",
    left_shift: "LeftShift",
    left_meta: "LeftMeta",
    left_cmd: "LeftMeta",
    off: null
  };
  function parseConfig(text) {
    return normalizeConfig(parseYaml(text));
  }
  function normalizeConfig(raw) {
    if (raw == null) return {};
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("invalid config: expected a mapping");
    }
    const parsed = {};
    for (const field of CONFIG_FIELDS) {
      if (raw[field] !== void 0 && raw[field] !== null) parsed[field] = raw[field];
    }
    return parsed;
  }
  function currentOs() {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const platform = (nav?.userAgentData?.platform || nav?.platform || (typeof process !== "undefined" ? process.platform : "") || "").toLowerCase();
    if (platform.startsWith("win")) return "windows";
    if (platform.startsWith("mac") || platform === "darwin" || platform.includes("iphone") || platform.includes("ipad")) return "macos";
    if (platform.includes("linux") || platform.includes("android") || platform.includes("cros")) return "linux";
    return platform;
  }
  var ResolvedConfig = class _ResolvedConfig {
    /**
     * @param {object} parsed  parsed config fields
     * @param {string|null} sourcePath  path of the config file inside the virtual FS
     * @param {string[]} allPaths  all paths of the virtual FS (to evaluate globs)
     */
    constructor(parsed, sourcePath, allPaths) {
      this.parsed = parsed;
      this.sourcePath = sourcePath;
      this.id = nextId();
      const baseDir = sourcePath ? dirname(sourcePath) : "";
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
          if (parsed[field] === void 0 && parent.parsed[field] !== void 0) {
            parsed[field] = parent.parsed[field];
          }
        }
      }
      return new _ResolvedConfig(parsed, path, vfs.paths());
    }
    get label() {
      if (this.parsed.label) return this.parsed.label;
      return this.sourcePath ?? "Unlabeled config";
    }
    get enable() {
      return this.parsed.enable ?? true;
    }
    get wordSeparators() {
      const separators = this.parsed.word_separators;
      return Array.isArray(separators) ? separators.map(String) : DEFAULT_WORD_SEPARATORS;
    }
    get backspaceLimit() {
      return this.parsed.backspace_limit ?? 5;
    }
    get undoBackspace() {
      return this.parsed.undo_backspace ?? true;
    }
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
      if (trigger == null || trigger === "OFF" || trigger === "off") return null;
      return String(trigger);
    }
    /** CSS selector of fields where nothing is expanded ("" = none). */
    get excludeSelector() {
      const selector = this.parsed.exclude_selector;
      return typeof selector === "string" ? selector.trim() : "";
    }
    get includePasswordFields() {
      return this.parsed.include_password_fields === true;
    }
    /** When false, html/markdown are inserted as plain text and image matches are dropped. */
    get richText() {
      return this.parsed.rich_text !== false;
    }
    /** When false, regex matches are dropped at load. */
    get regex() {
      return this.parsed.regex !== false;
    }
    /** Variable types that make a match fail to render (nothing is inserted). */
    get disabledVarTypes() {
      const types = this.parsed.disabled_var_types;
      return Array.isArray(types) ? types.map(String) : [];
    }
    get showNotifications() {
      return this.parsed.show_notifications ?? true;
    }
    get postFormDelay() {
      return this.parsed.post_form_delay ?? 200;
    }
    /** Returns true if this (app-specific) config should be active for the given app. */
    isMatch(app = {}) {
      const p = this.parsed;
      if (p.filter_os == null && p.filter_title == null && p.filter_exec == null && p.filter_class == null && p.filter_url == null) {
        return false;
      }
      const isOsMatch = p.filter_os != null ? osMatches(String(p.filter_os)) : true;
      const test = (regex, value) => regex ? value != null && regex.test(value) : true;
      return isOsMatch && test(this.filterTitle, app.title) && test(this.filterExec, app.exec) && test(this.filterClass, app.class) && test(this.filterUrl, app.url);
    }
  };
  function osMatches(os) {
    const current = currentOs();
    return String(os).toLowerCase() === current;
  }
  function aggregateIncludes(config) {
    const includes = /* @__PURE__ */ new Set();
    if (config.use_standard_includes == null || config.use_standard_includes) {
      STANDARD_INCLUDES.forEach((i) => includes.add(i));
    }
    (config.includes ?? []).forEach((i) => includes.add(String(i)));
    (config.extra_includes ?? []).forEach((i) => includes.add(String(i)));
    return includes;
  }
  function aggregateExcludes(config) {
    const excludes = /* @__PURE__ */ new Set();
    (config.excludes ?? []).forEach((e) => excludes.add(String(e)));
    (config.extra_excludes ?? []).forEach((e) => excludes.add(String(e)));
    return excludes;
  }
  function calculatePaths(baseDir, patterns, allPaths) {
    const result = /* @__PURE__ */ new Set();
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
  var ConfigStore = class _ConfigStore {
    constructor(defaultConfig, customs) {
      this.defaultConfig = defaultConfig;
      this.customs = customs;
    }
    /**
     * @param {import('./vfs.js').VirtualFS} vfs
     * @param {string} configDir
     * @returns {{store: ConfigStore, errors: Array<{path: string, error: Error}>}}
     */
    static load(vfs, configDir = "config", options = {}) {
      const yml = resolvePath(configDir, "default.yml");
      const yaml = resolvePath(configDir, "default.yaml");
      const defaultFile = vfs.exists(yml) ? yml : vfs.exists(yaml) ? yaml : null;
      const errors = [];
      let defaultConfig;
      if (options.defaultConfig != null) {
        defaultConfig = new ResolvedConfig(normalizeConfig(options.defaultConfig), `${configDir}/default.yml`, vfs.paths());
      } else if (defaultFile) {
        defaultConfig = ResolvedConfig.load(vfs, defaultFile, null);
      } else {
        defaultConfig = new ResolvedConfig({}, `${configDir}/default.yml`, vfs.paths());
      }
      const customs = [];
      for (const path of vfs.listDir(configDir)) {
        const ext = extname(path);
        if (path === defaultFile || ext !== "yml" && ext !== "yaml") continue;
        if (basename(path).startsWith("default.")) continue;
        try {
          customs.push(ResolvedConfig.load(vfs, path, defaultConfig));
        } catch (error) {
          errors.push({ path, error });
        }
      }
      return { store: new _ConfigStore(defaultConfig, customs), errors };
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
  };

  // src/matches/loader.js
  var FORM_CONTROL_REGEX = /\[\[\s*(\w+)(\.\w+)?\s*\]\]/g;
  function loadMatchGroup(vfs, path) {
    const raw = parseYaml(vfs.read(path));
    return convertMatchGroup(raw, { vfs, path });
  }
  function convertMatchGroup(raw, { vfs = null, path = null } = {}) {
    const errors = [];
    const globalVars = [];
    for (const yamlVar of asArray(raw.global_vars)) {
      try {
        globalVars.push(convertVariable(yamlVar));
      } catch (error) {
        errors.push({ level: "error", error });
      }
    }
    const matches = [];
    for (const yamlMatch of asArray(raw.matches)) {
      try {
        const { match, warnings } = convertMatch(yamlMatch);
        matches.push(match);
        warnings.forEach((w) => errors.push({ level: "warning", error: w }));
      } catch (error) {
        errors.push({ level: "error", error });
      }
    }
    const imports = [];
    if (raw.imports != null) {
      const currentDir = path ? dirname(path) : "";
      for (const imp of asArray(raw.imports)) {
        const fullPath = resolvePath(currentDir, String(imp));
        if (vfs && vfs.exists(fullPath)) {
          imports.push(fullPath);
        } else {
          errors.push({ level: "error", error: new Error(`unable to resolve import at path: ${fullPath}`) });
        }
      }
    }
    return { group: { imports, globalVars, matches }, errors };
  }
  function asArray(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(`expected a list, got: ${JSON.stringify(value)}`);
    return value;
  }
  function optString(value, field) {
    if (value == null) return null;
    if (typeof value === "object") throw new Error(`invalid type for field '${field}': expected a string`);
    return String(value);
  }
  function optBool(value, field) {
    if (value == null) return null;
    if (typeof value !== "boolean") throw new Error(`invalid type for field '${field}': expected a boolean`);
    return value;
  }
  function convertMatch(yamlMatch) {
    if (yamlMatch == null || typeof yamlMatch !== "object" || Array.isArray(yamlMatch)) {
      throw new Error(`invalid match definition: ${JSON.stringify(yamlMatch)}`);
    }
    const warnings = [];
    const m = yamlMatch;
    const uppercaseStyleRaw = optString(m.uppercase_style, "uppercase_style");
    const propagateCaseRaw = optBool(m.propagate_case, "propagate_case");
    if (uppercaseStyleRaw != null && propagateCaseRaw == null) {
      warnings.push(new Error("specifying the 'uppercase_style' option without 'propagate_case' has no effect"));
    }
    let triggers = null;
    if (m.trigger != null) {
      triggers = [optString(m.trigger, "trigger")];
    } else if (m.triggers != null) {
      triggers = asArray(m.triggers).map((t) => optString(t, "triggers"));
    }
    if (triggers) {
      const originalLength = triggers.length;
      triggers = triggers.filter((t) => t != null && t.trim() !== "");
      if (triggers.length < originalLength) {
        warnings.push(new Error("empty triggers are not allowed and have been ignored"));
      }
      if (triggers.length === 0) triggers = null;
    }
    let uppercaseStyle = "uppercase";
    if (uppercaseStyleRaw != null) {
      const style = uppercaseStyleRaw.toLowerCase();
      if (["uppercase", "capitalize", "capitalize_words"].includes(style)) {
        uppercaseStyle = style;
      } else {
        warnings.push(new Error(`unrecognized uppercase_style: "${style}", falling back to the default`));
      }
    }
    const word = optBool(m.word, "word");
    let cause;
    if (triggers) {
      cause = {
        type: "trigger",
        triggers,
        leftWord: optBool(m.left_word, "left_word") ?? word ?? false,
        rightWord: optBool(m.right_word, "right_word") ?? word ?? false,
        propagateCase: propagateCaseRaw ?? false,
        uppercaseStyle
      };
    } else if (m.regex != null) {
      cause = { type: "regex", regex: optString(m.regex, "regex") };
    } else {
      cause = { type: "none" };
    }
    let forceMode = null;
    if (optBool(m.force_clipboard, "force_clipboard") === true) {
      forceMode = "clipboard";
    } else if (m.force_mode != null) {
      const mode = String(m.force_mode).toLowerCase();
      if (mode === "clipboard" || mode === "keys") forceMode = mode;
    }
    let effect;
    if (m.replace != null || m.markdown != null || m.html != null) {
      let replace;
      let format;
      if (m.replace != null) {
        replace = optString(m.replace, "replace");
        format = "plain";
      } else if (m.markdown != null) {
        replace = optString(m.markdown, "markdown");
        format = "markdown";
      } else {
        replace = optString(m.html, "html");
        format = "html";
      }
      const vars = [];
      for (const yamlVar of asArray(m.vars)) {
        try {
          vars.push(convertVariable(yamlVar));
        } catch (error) {
          throw new Error(`failed to load variable: ${JSON.stringify(yamlVar)}: ${error.message}`);
        }
      }
      effect = { type: "text", replace, vars, format, forceMode };
    } else if (m.form != null) {
      const formLayout = optString(m.form, "form");
      let resolvedReplace = formLayout.replace(FORM_CONTROL_REGEX, (_, name) => `{{form1.${name}}}`);
      resolvedReplace = resolvedReplace.replaceAll("\\{", "{ ").replaceAll("\\}", " }");
      const params = { layout: formLayout };
      if (m.form_fields != null) {
        if (typeof m.form_fields !== "object" || Array.isArray(m.form_fields)) {
          throw new Error("'form_fields' must be a mapping");
        }
        params.fields = cloneValue(m.form_fields);
      }
      effect = {
        type: "text",
        replace: resolvedReplace,
        vars: [{ id: nextId(), name: "form1", type: "form", params, injectVars: true, dependsOn: [] }],
        format: "plain",
        forceMode
      };
    } else if (m.image_path != null) {
      effect = { type: "image", path: optString(m.image_path, "image_path") };
    } else {
      effect = { type: "none" };
    }
    if (effect.type === "none") {
      throw new Error(
        `match triggered by ${causeLongDescription(cause)} does not produce any effect. Did you forget the 'replace' field?`
      );
    }
    return {
      match: {
        id: nextId(),
        cause,
        effect,
        label: optString(m.label, "label"),
        searchTerms: m.search_terms != null ? asArray(m.search_terms).map(String) : []
      },
      warnings
    };
  }
  function convertVariable(yamlVar) {
    if (yamlVar == null || typeof yamlVar !== "object" || Array.isArray(yamlVar)) {
      throw new Error(`invalid variable definition: ${JSON.stringify(yamlVar)}`);
    }
    if (yamlVar.name == null) throw new Error("missing field 'name'");
    if (yamlVar.type == null) throw new Error("missing field 'type'");
    const params = yamlVar.params ?? {};
    if (typeof params !== "object" || Array.isArray(params)) {
      throw new Error("'params' must be a mapping");
    }
    return {
      id: nextId(),
      name: String(yamlVar.name),
      type: String(yamlVar.type),
      params: cloneValue(params),
      injectVars: yamlVar.inject_vars ?? true,
      dependsOn: yamlVar.depends_on != null ? asArray(yamlVar.depends_on).map(String) : []
    };
  }
  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value !== null && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v);
      return out;
    }
    return value;
  }
  function causeLongDescription(cause) {
    if (cause.type === "trigger") return `triggers: ${JSON.stringify(cause.triggers)}`;
    if (cause.type === "regex") return `regex: ${JSON.stringify(cause.regex)}`;
    return "No description available";
  }
  function matchDescription(m) {
    if (m.label) return m.label;
    if (m.effect.type === "text") return m.effect.replace;
    if (m.effect.type === "image") return "Image content";
    return "No description available for this match";
  }

  // src/matches/store.js
  var MatchStore = class _MatchStore {
    constructor(groups = /* @__PURE__ */ new Map()) {
      this.groups = groups;
    }
    /**
     * Load the given match files (and, recursively, everything they import).
     * @returns {{store: MatchStore, errors: Array<{path, level, error}>}}
     */
    static load(vfs, paths) {
      const groups = /* @__PURE__ */ new Map();
      const errors = [];
      loadRecursively(vfs, groups, paths, errors);
      return { store: new _MatchStore(groups), errors };
    }
    /** Add an already converted group under a synthetic path. */
    addGroup(path, group) {
      this.groups.set(path, group);
    }
    /**
     * Collect the matches and global vars reachable from the given paths
     * (imports first, de-duplicated).
     */
    query(paths) {
      const matches = [];
      const globalVars = [];
      const visitedPaths = /* @__PURE__ */ new Set();
      const visitedMatches = /* @__PURE__ */ new Set();
      const visitedVars = /* @__PURE__ */ new Set();
      const visit = (list) => {
        for (const path of list) {
          if (visitedPaths.has(path)) continue;
          visitedPaths.add(path);
          const group = this.groups.get(path);
          if (!group) continue;
          visit(group.imports);
          for (const m of group.matches) {
            if (!visitedMatches.has(m.id)) {
              matches.push(m);
              visitedMatches.add(m.id);
            }
          }
          for (const v of group.globalVars) {
            if (!visitedVars.has(v.id)) {
              globalVars.push(v);
              visitedVars.add(v.id);
            }
          }
        }
      };
      visit(paths);
      return { matches, globalVars };
    }
    loadedPaths() {
      return [...this.groups.keys()];
    }
  };
  function loadRecursively(vfs, groups, paths, errors) {
    for (const path of paths) {
      if (groups.has(path)) continue;
      try {
        const { group, errors: groupErrors } = loadMatchGroup(vfs, path);
        groups.set(path, group);
        groupErrors.forEach((e) => errors.push({ path, ...e }));
        loadRecursively(vfs, groups, group.imports, errors);
      } catch (error) {
        errors.push({ path, level: "error", error: new Error(`unable to load match group ${path}: ${error.message}`) });
      }
    }
  }

  // src/match/rolling.js
  var RollingItem = Object.freeze({
    wordSeparator: () => ({ kind: "wordSeparator" }),
    key: (key) => ({ kind: "key", key }),
    char: (char) => ({ kind: "char", char }),
    charInsensitive: (char) => ({ kind: "charInsensitive", char })
  });
  function foldCase(s) {
    return s.toLowerCase().toUpperCase().toLowerCase();
  }
  function rollingMatchFromString(id, string, opt = {}) {
    const items = [];
    if (opt.leftWord) items.push(RollingItem.wordSeparator());
    for (const c of string) {
      items.push(opt.caseInsensitive ? RollingItem.charInsensitive(c) : RollingItem.char(c));
    }
    if (opt.rightWord) items.push(RollingItem.wordSeparator());
    return { id, items };
  }
  function createNode() {
    return {
      wordSeparators: null,
      // NodeRef | null
      keys: /* @__PURE__ */ new Map(),
      // key -> NodeRef
      chars: /* @__PURE__ */ new Map(),
      // char -> NodeRef
      charsInsensitive: /* @__PURE__ */ new Map()
      // folded char -> NodeRef
    };
  }
  function insertItems(id, node, items) {
    if (items.length === 0) return;
    const [item, ...rest] = items;
    const mapFor = (it) => {
      if (it.kind === "key") return [node.keys, it.key];
      if (it.kind === "char") return [node.chars, it.char];
      return [node.charsInsensitive, foldCase(it.char)];
    };
    if (rest.length === 0) {
      if (item.kind === "wordSeparator") {
        const matches = node.wordSeparators?.matches ? [...node.wordSeparators.matches] : [];
        matches.push(id);
        node.wordSeparators = { matches };
        return;
      }
      const [map2, k2] = mapFor(item);
      const entry2 = map2.get(k2);
      if (entry2?.matches) entry2.matches.push(id);
      else map2.set(k2, { matches: [id] });
      return;
    }
    if (item.kind === "wordSeparator") {
      if (node.wordSeparators?.node) {
        insertItems(id, node.wordSeparators.node, rest);
      } else if (!node.wordSeparators) {
        const next = createNode();
        insertItems(id, next, rest);
        node.wordSeparators = { node: next };
      }
      return;
    }
    const [map, k] = mapFor(item);
    const entry = map.get(k);
    if (entry) {
      if (entry.node) insertItems(id, entry.node, rest);
    } else {
      const next = createNode();
      insertItems(id, next, rest);
      map.set(k, { node: next });
    }
  }
  function buildTree(matches) {
    const root = createNode();
    for (const m of matches) insertItems(m.id, root, m.items);
    return root;
  }
  var RollingMatcher = class {
    /**
     * @param {Array<{id: any, items: object[]}>} matches
     * @param {{charWordSeparators?: string[], keyWordSeparators?: string[]}} [options]
     */
    constructor(matches, options = {}) {
      this.root = buildTree(matches);
      this.charWordSeparators = new Set(options.charWordSeparators ?? []);
      this.keyWordSeparators = new Set(options.keyWordSeparators ?? []);
    }
    process(prevState, event) {
      const nextRefs = [];
      if (prevState) {
        for (const path of prevState.paths) {
          for (const [ref, isSep] of this.findRefs(path.node, event, true)) {
            nextRefs.push([ref, [...path.events, [event, isSep]]]);
          }
        }
      }
      for (const [ref, isSep] of this.findRefs(this.root, event, prevState != null)) {
        nextRefs.push([ref, [[event, isSep]]]);
      }
      const nextPaths = [];
      for (const [ref, events] of nextRefs) {
        if (ref.matches) {
          const { trigger, leftSeparator, rightSeparator } = extractStringFromEvents(events);
          const results = ref.matches.map((id) => ({
            id,
            trigger,
            leftSeparator,
            rightSeparator,
            args: {}
          }));
          return { state: { paths: [] }, results };
        }
        nextPaths.push({ node: ref.node, events });
      }
      return { state: { paths: nextPaths }, results: [] };
    }
    findRefs(node, event, hasPreviousState) {
      const refs = [];
      if (event.type === "key") {
        const keyRef = node.keys.get(event.key);
        if (keyRef) refs.push([keyRef, false]);
        if (event.chars != null) {
          const charRef = node.chars.get(event.chars);
          if (charRef) refs.push([charRef, false]);
          const insensitiveRef = node.charsInsensitive.get(foldCase(event.chars));
          if (insensitiveRef) refs.push([insensitiveRef, false]);
        }
      }
      if (this.isWordSeparator(event) && node.wordSeparators) {
        refs.push([node.wordSeparators, true]);
      }
      if (!hasPreviousState && node.wordSeparators?.node) {
        refs.push(...this.findRefs(node.wordSeparators.node, event, true));
      }
      return refs;
    }
    isWordSeparator(event) {
      if (event.type === "virtualSeparator") return true;
      if (this.keyWordSeparators.has(event.key)) return true;
      return event.chars != null && this.charWordSeparators.has(event.chars);
    }
  };
  function extractStringFromEvents(events) {
    let trigger = "";
    let leftSeparator = null;
    let rightSeparator = null;
    events.forEach(([event, isWordSeparator], i) => {
      if (event.type === "key" && event.chars != null) {
        trigger += event.chars;
        if (isWordSeparator) {
          if (i === 0) leftSeparator = event.chars;
          else if (i === events.length - 1) rightSeparator = event.chars;
        }
      }
    });
    return { trigger, leftSeparator, rightSeparator };
  }

  // src/render/util.js
  var VAR_REGEX = /\{\{\s*((?<name>\w+)(\.(?<subname>(\w+)))?)\s*\}\}/g;
  var RendererError = class extends Error {
    constructor(kind, message) {
      super(message);
      this.name = "RendererError";
      this.kind = kind;
    }
  };
  function getBodyVariableNames(body) {
    const names = /* @__PURE__ */ new Set();
    for (const m of String(body).matchAll(VAR_REGEX)) names.add(m.groups.name);
    return names;
  }
  function getParamsVariableNames(params) {
    const names = /* @__PURE__ */ new Set();
    for (const value of Object.values(params ?? {})) {
      collectValueVariableNames(value, names);
    }
    return names;
  }
  function collectValueVariableNames(value, names) {
    if (typeof value === "string") {
      getBodyVariableNames(value).forEach((n) => names.add(n));
    } else if (Array.isArray(value)) {
      value.forEach((v) => collectValueVariableNames(v, names));
    } else if (value !== null && typeof value === "object") {
      Object.values(value).forEach((v) => collectValueVariableNames(v, names));
    }
  }
  function renderVariables(body, scope) {
    let error = null;
    const output = String(body).replace(VAR_REGEX, (...args) => {
      const groups = args[args.length - 1];
      const { name, subname } = groups;
      if (!scope.has(name)) {
        error = new RendererError("missingVariable", `variable '${name}' is missing`);
        return "";
      }
      const value = scope.get(name);
      if (typeof value === "string") return value;
      if (subname !== void 0) {
        return Object.prototype.hasOwnProperty.call(value, subname) ? String(value[subname]) : "";
      }
      error = new RendererError(
        "missingVariable",
        `nested name missing from multi-value variable: ${name}`
      );
      return "";
    });
    if (error) throw error;
    return unescapeVariableInjections(output);
  }
  function unescapeVariableInjections(body) {
    return body.replaceAll("\\{\\{", "{{").replaceAll("\\}\\}", "}}");
  }
  function injectVariablesIntoParams(params, scope) {
    const out = {};
    for (const [key, value] of Object.entries(params ?? {})) {
      out[key] = injectIntoValue(value, scope);
    }
    return out;
  }
  function injectIntoValue(value, scope) {
    if (typeof value === "string") return renderVariables(value, scope);
    if (Array.isArray(value)) return value.map((v) => injectIntoValue(v, scope));
    if (value !== null && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = injectIntoValue(v, scope);
      return out;
    }
    return value;
  }

  // src/render/resolve.js
  var BODY_NODE = "__match_body";
  function resolveEvaluationOrder(body, localVars, globalVars) {
    const nodeMap = generateNodes(body, localVars, globalVars);
    const bodyNode = nodeMap.get(BODY_NODE);
    const evalOrder = [];
    const resolved = /* @__PURE__ */ new Set();
    const seen = /* @__PURE__ */ new Set();
    resolveDependencies(bodyNode, nodeMap, evalOrder, resolved, seen);
    const ordered = [];
    for (const name of evalOrder) {
      const node = nodeMap.get(name);
      if (!node) throw new Error(`could not find dependency node for variable: ${name}`);
      if (node.variable) ordered.push(node.variable);
    }
    return ordered;
  }
  function generateNodes(body, localVars, globalVars) {
    const localNodes = localVars.map((variable, index) => {
      const dependencies = /* @__PURE__ */ new Set();
      if (variable.injectVars) {
        getParamsVariableNames(variable.params).forEach((n) => dependencies.add(n));
      }
      variable.dependsOn.forEach((n) => dependencies.add(n));
      if (index > 0) dependencies.add(localVars[index - 1].name);
      return { name: variable.name, variable, dependencies };
    });
    const globalNodes = globalVars.map((variable) => {
      let dependencies = null;
      if (variable.injectVars || variable.dependsOn.length > 0) {
        dependencies = /* @__PURE__ */ new Set();
        if (variable.injectVars) {
          getParamsVariableNames(variable.params).forEach((n) => dependencies.add(n));
        }
        variable.dependsOn.forEach((n) => dependencies.add(n));
      }
      return { name: variable.name, variable, dependencies };
    });
    const bodyDependencies = new Set(localNodes.map((n) => n.name));
    getBodyVariableNames(body).forEach((n) => bodyDependencies.add(n));
    const nodeMap = /* @__PURE__ */ new Map();
    nodeMap.set(BODY_NODE, { name: BODY_NODE, variable: null, dependencies: bodyDependencies });
    globalNodes.forEach((n) => nodeMap.set(n.name, n));
    localNodes.forEach((n) => nodeMap.set(n.name, n));
    return nodeMap;
  }
  function resolveDependencies(node, nodeMap, evalOrder, resolved, seen) {
    seen.add(node.name);
    if (node.dependencies) {
      for (const dependency of node.dependencies) {
        if (resolved.has(dependency)) continue;
        if (seen.has(dependency)) {
          throw new RendererError(
            "circularDependency",
            `circular dependency: \`${node.name}\` -> \`${dependency}\``
          );
        }
        const dependencyNode = nodeMap.get(dependency);
        if (!dependencyNode) {
          let message = `missing variable: \`${dependency}\``;
          if (node.variable?.type === "form") message += `
${FORM_SYNTAX_TIP}`;
          throw new RendererError("missingVariable", message);
        }
        resolveDependencies(dependencyNode, nodeMap, evalOrder, resolved, seen);
      }
    }
    evalOrder.push(node.name);
    resolved.add(node.name);
  }
  var FORM_SYNTAX_TIP = "TIP: since version 2.1.0-alpha, espanso uses [[control]] (square brackets) instead of {{control}} to define form controls.";

  // src/render/renderer.js
  var RenderAbortedError = class extends Error {
    constructor(message = "rendering aborted") {
      super(message);
      this.name = "RenderAbortedError";
    }
  };
  var DisabledVariableTypeError = class extends Error {
    constructor(type) {
      super(`variable type '${type}' is disabled`);
      this.name = "DisabledVariableTypeError";
      this.variableType = type;
    }
  };
  var CasingStyle = Object.freeze({
    None: "none",
    Capitalize: "capitalize",
    CapitalizeWords: "capitalize_words",
    Uppercase: "uppercase"
  });
  var WORD_REGEX = /[\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\p{Join_Control}]+/gu;
  function capitalizeFirst(text) {
    const chars = Array.from(text);
    if (chars.length === 0) return text;
    chars[0] = Array.from(chars[0].toUpperCase())[0];
    return chars.join("");
  }
  var Renderer = class {
    /**
     * @param {Array<{name: string, calculate: Function}>} extensions
     * @param {{disabledTypes?: Iterable<string>}} [options]
     */
    constructor(extensions = [], options = {}) {
      this.extensions = /* @__PURE__ */ new Map();
      for (const ext of extensions) this.extensions.set(ext.name, ext);
      this.disabledTypes = new Set(options.disabledTypes ?? []);
      this.logger = console;
    }
    registerExtension(extension) {
      this.extensions.set(extension.name, extension);
    }
    /**
     * @param {{ids: string[], body: string, vars: object[]}} template
     * @param {{globalVars: object[], templates: object[]}} context
     * @param {{casingStyle?: string}} [options]
     * @returns {Promise<string>}  throws RenderAbortedError / RendererError / extension errors
     */
    async render(template, context, options = {}) {
      let body;
      VAR_REGEX.lastIndex = 0;
      if (VAR_REGEX.test(template.body)) {
        VAR_REGEX.lastIndex = 0;
        for (const variable of template.vars) {
          if (this.disabledTypes.has(variable.type)) throw new DisabledVariableTypeError(variable.type);
        }
        let localVariables = template.vars;
        if (template.vars.some((v) => v.type === "global")) {
          const globals = new Map(context.globalVars.map((v) => [v.name, v]));
          localVariables = template.vars.map((v) => v.type === "global" ? globals.get(v.name) : v).filter(Boolean);
        }
        const variables = resolveEvaluationOrder(template.body, localVariables, context.globalVars);
        const scope = /* @__PURE__ */ new Map();
        for (const variable of variables) {
          if (this.disabledTypes.has(variable.type)) {
            throw new DisabledVariableTypeError(variable.type);
          }
          if (variable.type === "match") {
            const subTemplate = getMatchingTemplate(variable, context.templates);
            if (!subTemplate) {
              throw new RendererError("missingSubMatch", `missing sub match: ${variable.params?.trigger}`);
            }
            scope.set(variable.name, await this.render(subTemplate, context, options));
            continue;
          }
          const extension = this.extensions.get(variable.type);
          if (!extension) {
            this.logger?.error?.(`[espanso] no extension found for variable type: ${variable.type}`);
            continue;
          }
          let params = variable.params;
          if (variable.injectVars) {
            try {
              params = injectVariablesIntoParams(variable.params, scope);
            } catch (error) {
              if (variable.type === "form" && error instanceof RendererError) {
                error.message += `
${FORM_SYNTAX_TIP}`;
              }
              throw error;
            }
          }
          const output = await extension.calculate(context, scope, params);
          if (typeof output === "string") {
            scope.set(variable.name, output);
          } else if (output !== null && typeof output === "object") {
            const multiple = {};
            for (const [k, v] of Object.entries(output)) multiple[k] = String(v ?? "");
            scope.set(variable.name, multiple);
          } else {
            throw new Error(
              `extension '${variable.type}' on var '${variable.name}' returned an invalid output`
            );
          }
        }
        body = renderVariables(template.body, scope);
      } else {
        body = template.body;
      }
      body = unescapeVariableInjections(body);
      switch (options.casingStyle ?? CasingStyle.None) {
        case CasingStyle.Uppercase:
          return body.toUpperCase();
        case CasingStyle.Capitalize:
          return capitalizeFirst(body);
        case CasingStyle.CapitalizeWords:
          return body.replace(WORD_REGEX, (word) => capitalizeFirst(word));
        default:
          return body;
      }
    }
  };
  function getMatchingTemplate(variable, templates) {
    const id = variable.params?.trigger;
    if (typeof id !== "string") return null;
    return templates.find((t) => t.ids.includes(id)) ?? null;
  }

  // src/render/extensions/basic.js
  function createEchoExtension(alias = "echo") {
    return {
      name: alias,
      calculate(_context, _scope, params) {
        const echo = params.echo;
        if (typeof echo === "string") return echo;
        if (typeof echo === "number" || typeof echo === "boolean") return String(echo);
        throw new Error("missing 'echo' parameter");
      }
    };
  }
  function createRandomExtension(random = Math.random) {
    return {
      name: "random",
      calculate(_context, _scope, params) {
        if (!Array.isArray(params.choices)) throw new Error("missing 'choices' parameter");
        const choices = params.choices.filter((c) => typeof c === "string");
        if (choices.length === 0) throw new Error("could not select a choice randomly");
        return choices[Math.floor(random() * choices.length)];
      }
    };
  }
  function parseChoices(values) {
    if (typeof values === "string") {
      return values.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "").map((line) => ({ id: line, label: line }));
    }
    if (Array.isArray(values)) {
      return values.map((value) => {
        if (typeof value === "string") return { id: value, label: value };
        if (value !== null && typeof value === "object") {
          if (typeof value.id !== "string" || typeof value.label !== "string") {
            throw new Error(
              "values contain object items, but they are missing either the 'id' or 'label' fields"
            );
          }
          return { id: value.id, label: value.label };
        }
        throw new Error("values contain an invalid item type. items can only be strings or objects");
      });
    }
    throw new Error("missing values parameter");
  }
  var firstChoiceSelector = {
    async show(choices) {
      return choices.length > 0 ? choices[0].id : null;
    }
  };
  function createChoiceExtension(selector = firstChoiceSelector) {
    return {
      name: "choice",
      async calculate(_context, _scope, params) {
        const choices = parseChoices(params.values);
        const chosen = await selector.show(choices);
        if (chosen == null) throw new RenderAbortedError("choice aborted");
        return String(chosen);
      }
    };
  }
  function getFormControls(layout) {
    const names = [];
    for (const m of String(layout).matchAll(/\[\[\s*(\w+)(\.\w+)?\s*\]\]/g)) {
      if (!names.includes(m[1])) names.push(m[1]);
    }
    return names;
  }
  var defaultValuesFormProvider = {
    async show(layout, fields) {
      const values = {};
      for (const name of getFormControls(layout)) {
        const field = fields?.[name];
        if (field && field.default != null) values[name] = String(field.default);
        else values[name] = "";
      }
      return values;
    }
  };
  function createFormExtension(provider = defaultValuesFormProvider) {
    return {
      name: "form",
      async calculate(_context, _scope, params) {
        if (typeof params.layout !== "string") throw new Error("missing layout parameter");
        const fields = params.fields !== null && typeof params.fields === "object" ? params.fields : {};
        const values = await provider.show(params.layout, fields, {});
        if (values == null) throw new RenderAbortedError("form aborted");
        return values;
      }
    };
  }
  var browserClipboardProvider = {
    async getText() {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return null;
      try {
        return await navigator.clipboard.readText();
      } catch {
        return null;
      }
    }
  };
  function createClipboardExtension(provider = browserClipboardProvider) {
    return {
      name: "clipboard",
      async calculate() {
        const text = await provider.getText();
        if (text == null) throw new Error("clipboard provider returned error");
        return text;
      }
    };
  }
  function createUnsupportedExtension(name) {
    return {
      name,
      calculate() {
        throw new Error(`the '${name}' extension is not available in the browser`);
      }
    };
  }

  // src/render/extensions/date.js
  var DateFormatError = class extends Error {
    constructor(format) {
      super(`invalid date format: \`${format}\``);
      this.name = "DateFormatError";
    }
  };
  var DEFAULT_LOCALE = "en-US";
  function getSystemLocale() {
    if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  }
  function normalizeLocale(locale) {
    if (typeof locale !== "string" || locale.trim() === "") return null;
    const tag = locale.trim().replace(/_/g, "-").replace(/\..*$/, "");
    try {
      const supported = Intl.DateTimeFormat.supportedLocalesOf([tag]);
      return supported.length > 0 ? supported[0] : null;
    } catch {
      return null;
    }
  }
  function isValidTimeZone(tz) {
    if (typeof tz !== "string" || tz === "") return false;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }
  function getDateParts(date, timeZone = null) {
    if (!timeZone) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
        millisecond: date.getMilliseconds(),
        weekday: date.getDay(),
        offsetMinutes: -date.getTimezoneOffset(),
        timeZone: null
      };
    }
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
      era: "short"
    });
    const parts = {};
    for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
    let year = Number(parts.year);
    if (parts.era === "BC" || parts.era === "B") year = 1 - year;
    const result = {
      year,
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour) % 24,
      minute: Number(parts.minute),
      second: Number(parts.second),
      millisecond: date.getUTCMilliseconds(),
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
      timeZone
    };
    const asUtc = Date.UTC(result.year, result.month - 1, result.day, result.hour, result.minute, result.second, result.millisecond);
    result.offsetMinutes = Math.round((asUtc - date.getTime()) / 6e4);
    return result;
  }
  var nameCache = /* @__PURE__ */ new Map();
  function localizedNames(locale) {
    if (nameCache.has(locale)) return nameCache.get(locale);
    const utc = (y, m, d, h = 12) => new Date(Date.UTC(y, m, d, h));
    const part = (options, date, type) => {
      const parts = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).formatToParts(date);
      return parts.find((p) => p.type === type)?.value ?? "";
    };
    const monthsLong = [];
    const monthsShort = [];
    for (let m = 0; m < 12; m += 1) {
      const date = utc(2021, m, 15);
      monthsLong.push(part({ day: "numeric", month: "long" }, date, "month"));
      monthsShort.push(part({ day: "numeric", month: "short" }, date, "month"));
    }
    const weekdaysLong = [];
    const weekdaysShort = [];
    for (let d = 0; d < 7; d += 1) {
      const date = utc(2021, 0, 3 + d);
      weekdaysLong.push(part({ weekday: "long" }, date, "weekday"));
      weekdaysShort.push(part({ weekday: "short" }, date, "weekday"));
    }
    let am = part({ hour: "numeric", hour12: true }, utc(2021, 0, 1, 9), "dayPeriod");
    let pm = part({ hour: "numeric", hour12: true }, utc(2021, 0, 1, 21), "dayPeriod");
    if (locale.startsWith("en")) {
      am = "AM";
      pm = "PM";
    }
    const names = { monthsLong, monthsShort, weekdaysLong, weekdaysShort, am, pm };
    nameCache.set(locale, names);
    return names;
  }
  function dayOfYear(p) {
    return Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 864e5) + 1;
  }
  function isoWeek(p) {
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const weekday = (p.weekday + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday + 3);
    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    firstThursday.setUTCDate(firstThursday.getUTCDate() - (firstThursday.getUTCDay() + 6) % 7 + 3);
    const week = 1 + Math.round((date - firstThursday) / (7 * 864e5));
    return { isoYear, week };
  }
  function weekOfYear(p, firstDay) {
    const yday = dayOfYear(p) - 1;
    const wday = (p.weekday - firstDay + 7) % 7;
    return Math.floor((yday + 7 - wday) / 7);
  }
  function pad(value, width, padChar) {
    const negative = value < 0;
    let s = String(Math.abs(value));
    while (s.length < width) s = padChar + s;
    return negative ? `-${s}` : s;
  }
  function formatOffset(minutes, withColon, withSeconds = false, hoursOnly = false) {
    const sign = minutes < 0 ? "-" : "+";
    const abs = Math.abs(minutes);
    const hh = pad(Math.floor(abs / 60), 2, "0");
    const mm = pad(abs % 60, 2, "0");
    if (hoursOnly) return `${sign}${hh}`;
    if (withSeconds) return `${sign}${hh}:${mm}:00`;
    return withColon ? `${sign}${hh}:${mm}` : `${sign}${hh}${mm}`;
  }
  function timeZoneName(p, date) {
    if (!p.timeZone) return formatOffset(p.offsetMinutes, true);
    if (p.timeZone === "UTC" || p.timeZone === "Etc/UTC") return "UTC";
    for (const locale of ["en-US", "en-GB"]) {
      const parts = new Intl.DateTimeFormat(locale, { timeZone: p.timeZone, timeZoneName: "short" }).formatToParts(date);
      const name = parts.find((x) => x.type === "timeZoneName")?.value;
      if (name && !/^(GMT|UTC)[+-]/.test(name)) return name;
    }
    return formatOffset(p.offsetMinutes, true);
  }
  function strftime(date, format, options = {}) {
    const locale = normalizeLocale(options.locale) ?? DEFAULT_LOCALE;
    const p = getDateParts(date, options.timeZone ?? null);
    const names = localizedNames(locale);
    const isEnUs = locale === "en-US" || locale === "en";
    const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
    const fraction = (digits) => pad(p.millisecond, 3, "0").padEnd(digits, "0").slice(0, digits);
    let out = "";
    let i = 0;
    const chars = Array.from(format);
    const numeric = (value, width, defaultPad, padMode) => {
      if (padMode === "-") return String(value);
      const padChar = padMode === "_" ? " " : padMode === "0" ? "0" : defaultPad;
      return pad(value, width, padChar);
    };
    const localizedDate = () => isEnUs ? `${pad(p.month, 2, "0")}/${pad(p.day, 2, "0")}/${pad((p.year % 100 + 100) % 100, 2, "0")}` : new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.UTC(p.year, p.month - 1, p.day, 12)));
    const localizedTime = () => isEnUs ? `${pad(hour12, 2, "0")}:${pad(p.minute, 2, "0")}:${pad(p.second, 2, "0")} ${names.pm && p.hour >= 12 ? names.pm : names.am}` : new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(Date.UTC(2e3, 0, 1, p.hour, p.minute, p.second)));
    const ampm = () => p.hour >= 12 ? names.pm : names.am;
    const spec = (c, padMode) => {
      switch (c) {
        // Date
        case "Y":
          return p.year >= 0 && p.year <= 9999 ? numeric(p.year, 4, "0", padMode) : p.year > 9999 ? `+${p.year}` : String(p.year);
        case "C":
          return numeric(Math.floor(p.year / 100), 2, "0", padMode);
        case "y":
          return numeric((p.year % 100 + 100) % 100, 2, "0", padMode);
        case "q":
          return String(Math.floor((p.month - 1) / 3) + 1);
        case "m":
          return numeric(p.month, 2, "0", padMode);
        case "b":
        case "h":
          return names.monthsShort[p.month - 1];
        case "B":
          return names.monthsLong[p.month - 1];
        case "d":
          return numeric(p.day, 2, "0", padMode);
        case "e":
          return numeric(p.day, 2, " ", padMode);
        case "a":
          return names.weekdaysShort[p.weekday];
        case "A":
          return names.weekdaysLong[p.weekday];
        case "w":
          return String(p.weekday);
        case "u":
          return String(p.weekday === 0 ? 7 : p.weekday);
        case "U":
          return numeric(weekOfYear(p, 0), 2, "0", padMode);
        case "W":
          return numeric(weekOfYear(p, 1), 2, "0", padMode);
        case "G":
          return numeric(isoWeek(p).isoYear, 4, "0", padMode);
        case "g":
          return numeric((isoWeek(p).isoYear % 100 + 100) % 100, 2, "0", padMode);
        case "V":
          return numeric(isoWeek(p).week, 2, "0", padMode);
        case "j":
          return numeric(dayOfYear(p), 3, "0", padMode);
        case "D":
          return `${spec("m")}/${spec("d")}/${spec("y")}`;
        case "x":
          return localizedDate();
        case "F":
          return `${spec("Y")}-${spec("m")}-${spec("d")}`;
        case "v":
          return `${spec("e")}-${spec("b")}-${spec("Y")}`;
        // Time
        case "H":
          return numeric(p.hour, 2, "0", padMode);
        case "k":
          return numeric(p.hour, 2, " ", padMode);
        case "I":
          return numeric(hour12, 2, "0", padMode);
        case "l":
          return numeric(hour12, 2, " ", padMode);
        case "P":
          return ampm().toLowerCase();
        case "p":
          return ampm();
        case "M":
          return numeric(p.minute, 2, "0", padMode);
        case "S":
          return numeric(p.second, 2, "0", padMode);
        case "f":
          return fraction(9);
        case "R":
          return `${spec("H")}:${spec("M")}`;
        case "T":
          return `${spec("H")}:${spec("M")}:${spec("S")}`;
        case "X":
          return localizedTime();
        case "r":
          return `${spec("I")}:${spec("M")}:${spec("S")} ${spec("p")}`;
        // Time zone
        case "Z":
          return timeZoneName(p, date);
        case "z":
          return formatOffset(p.offsetMinutes, false);
        // Date & time
        case "c":
          return isEnUs ? `${spec("a")} ${spec("d")} ${spec("b")} ${spec("Y")} ${spec("r")} ${spec("Z")}` : `${localizedDate()} ${localizedTime()}`;
        case "+": {
          const frac = p.millisecond ? `.${fraction(3)}` : "";
          return `${spec("F")}T${spec("T")}${frac}${formatOffset(p.offsetMinutes, true)}`;
        }
        case "s":
          return String(Math.floor(date.getTime() / 1e3));
        // Special
        case "t":
          return "	";
        case "n":
          return "\n";
        case "%":
          return "%";
        default:
          return null;
      }
    };
    while (i < chars.length) {
      const c = chars[i];
      if (c !== "%") {
        out += c;
        i += 1;
        continue;
      }
      let j = i + 1;
      let padMode = null;
      if (["-", "_", "0"].includes(chars[j])) {
        padMode = chars[j];
        j += 1;
      }
      const rest = chars.slice(j, j + 5).join("");
      let m;
      if (m = /^\.([369])f/.exec(rest)) {
        out += `.${fraction(Number(m[1]))}`;
        i = j + m[0].length;
        continue;
      }
      if (rest.startsWith(".f")) {
        out += p.millisecond ? `.${fraction(3)}` : "";
        i = j + 2;
        continue;
      }
      if (m = /^([369])f/.exec(rest)) {
        out += fraction(Number(m[1]));
        i = j + 2;
        continue;
      }
      if (rest.startsWith(":::z")) {
        out += formatOffset(p.offsetMinutes, true, false, true);
        i = j + 4;
        continue;
      }
      if (rest.startsWith("::z")) {
        out += formatOffset(p.offsetMinutes, true, true);
        i = j + 3;
        continue;
      }
      if (rest.startsWith(":z")) {
        out += formatOffset(p.offsetMinutes, true);
        i = j + 2;
        continue;
      }
      const specifier = chars[j];
      const value = specifier === void 0 ? null : spec(specifier, padMode);
      if (value === null) throw new DateFormatError(format);
      out += value;
      i = j + 1;
    }
    return out;
  }
  function toRfc2822(date, timeZone = null) {
    return strftime(date, "%a, %-d %b %Y %H:%M:%S %z", { locale: "en-US", timeZone });
  }
  function createDateExtension(options = {}) {
    const now = options.now ?? (() => /* @__PURE__ */ new Date());
    const getLocale = options.getLocale ?? getSystemLocale;
    return {
      name: "date",
      calculate(_context, _scope, params) {
        let date = new Date(now().getTime());
        const offset = params.offset;
        let offsetSeconds = null;
        if (typeof offset === "number" && Number.isInteger(offset)) offsetSeconds = offset;
        else if (typeof offset === "string" && /^[+-]?\d+$/.test(offset.trim())) offsetSeconds = Number(offset.trim());
        if (offsetSeconds !== null) date = new Date(date.getTime() + offsetSeconds * 1e3);
        const tz = typeof params.tz === "string" && isValidTimeZone(params.tz) ? params.tz : null;
        const locale = typeof params.locale === "string" ? params.locale : getLocale();
        if (typeof params.format === "string") {
          return strftime(date, params.format, { locale, timeZone: tz });
        }
        return toRfc2822(date, tz);
      }
    };
  }

  // src/render/extensions/dom.js
  var DomVariableError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "DomVariableError";
    }
  };
  var FORM_CONTROLS = /* @__PURE__ */ new Set(["INPUT", "TEXTAREA", "SELECT"]);
  function walkJsonPath(value, path) {
    let current = value;
    for (const segment of String(path).split(".")) {
      if (segment === "") continue;
      if (current === null || typeof current !== "object") return void 0;
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return void 0;
      current = current[segment];
    }
    return current;
  }
  function stringify(value) {
    if (value === void 0 || value === null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }
  function createDomExtension(options = {}) {
    const getDocument = options.getDocument ?? (() => typeof document !== "undefined" ? document : null);
    return {
      name: "dom",
      calculate(_context, _scope, params) {
        if (typeof params.selector !== "string" || params.selector.trim() === "") {
          throw new DomVariableError("missing 'selector' parameter");
        }
        const fallback = params.default == null ? "" : String(params.default);
        const doc = getDocument();
        if (!doc) return fallback;
        let element;
        try {
          element = doc.querySelector(params.selector);
        } catch {
          throw new DomVariableError("invalid selector");
        }
        if (!element) return fallback;
        let value;
        if (params.json_path != null) {
          let data;
          try {
            data = JSON.parse(element.textContent ?? "");
          } catch {
            throw new DomVariableError("the element does not contain valid JSON");
          }
          value = stringify(walkJsonPath(data, params.json_path));
        } else if (params.attribute != null) {
          value = element.getAttribute(String(params.attribute));
        } else if (FORM_CONTROLS.has(element.tagName)) {
          value = element.value;
        } else {
          value = element.textContent;
        }
        if (value == null || String(value).trim() === "") return fallback;
        return String(value);
      }
    };
  }

  // src/engine/events.js
  var EventType = Object.freeze({
    NOOP: "noop",
    // Inputs
    Keyboard: "keyboard",
    // { key, value, status, variant }
    Mouse: "mouse",
    // { status, button }
    // External requests
    MatchExecRequest: "matchExecRequest",
    // { trigger, args, compensate }
    // Internal
    MatchesDetected: "matchesDetected",
    // { matches: DetectedMatch[], isSearch }
    MatchSelected: "matchSelected",
    // { chosen }
    CauseCompensatedMatch: "causeCompensatedMatch",
    // { m }
    RenderingRequested: "renderingRequested",
    // { matchId, trigger, leftSeparator, rightSeparator, triggerArgs, format }
    ImageRequested: "imageRequested",
    // { matchId, imagePath, trigger }
    Rendered: "rendered",
    // { matchId, body, format }
    ImageResolved: "imageResolved",
    // { imagePath }
    MatchInjected: "matchInjected",
    DiscardPrevious: "discardPrevious",
    // { minimumSourceId }
    DiscardBetween: "discardBetween",
    // { startId, endId }
    Undo: "undo",
    // { matchId, trigger, replace }
    RenderingError: "renderingError",
    // { error }
    Disabled: "disabled",
    Enabled: "enabled",
    DisableRequest: "disableRequest",
    EnableRequest: "enableRequest",
    ToggleRequest: "toggleRequest",
    // Effects
    TriggerCompensation: "triggerCompensation",
    // { trigger, leftSeparator }
    CursorHintCompensation: "cursorHintCompensation",
    // { cursorHintBackCount }
    KeySequenceInject: "keySequenceInject",
    // { keys }
    TextInject: "textInject",
    // { text, forceMode }
    MarkdownInject: "markdownInject",
    // { markdown }
    HtmlInject: "htmlInject",
    // { html }
    ImageInject: "imageInject"
    // { imagePath }
  });
  var Key = Object.freeze({
    // Modifiers
    Alt: "Alt",
    CapsLock: "CapsLock",
    Control: "Control",
    Meta: "Meta",
    NumLock: "NumLock",
    Shift: "Shift",
    // Whitespace
    Enter: "Enter",
    Tab: "Tab",
    Space: "Space",
    // Navigation
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    ArrowUp: "ArrowUp",
    End: "End",
    Home: "Home",
    PageDown: "PageDown",
    PageUp: "PageUp",
    // UI
    Escape: "Escape",
    // Editing
    Backspace: "Backspace",
    // Others
    Other: "Other"
  });
  var MODIFIER_KEYS = /* @__PURE__ */ new Set([
    Key.Alt,
    Key.Shift,
    Key.CapsLock,
    Key.Meta,
    Key.NumLock,
    Key.Control
  ]);
  var Status = Object.freeze({ Pressed: "pressed", Released: "released" });
  function causedBy(sourceId, type, payload = {}) {
    return { sourceId, type, ...payload };
  }
  function detectedMatch({
    id,
    trigger = null,
    leftSeparator = null,
    rightSeparator = null,
    args = {},
    compensate = true
  }) {
    return { id, trigger, leftSeparator, rightSeparator, args, compensate };
  }

  // src/engine/processor.js
  var Processor = class {
    /** @param {Array<{name: string, next: Function}>} middleware */
    constructor(middleware) {
      this.middleware = middleware;
      this.eventQueue = [];
      this.trace = null;
    }
    /**
     * Run an event through the middleware chain. Events dispatched by middlewares
     * are processed afterwards, in order.
     * @returns {Promise<object[]>} the processed events, in order
     */
    async process(event) {
      this.eventQueue.unshift(event);
      const processed = [];
      while (this.eventQueue.length > 0) {
        processed.push(await this.processOne());
      }
      return processed;
    }
    async processOne() {
      let current = this.eventQueue.pop();
      const dispatched = [];
      const dispatch = (e) => dispatched.unshift(e);
      for (const middleware of this.middleware) {
        this.trace?.("in", middleware.name, current);
        current = await middleware.next(current, dispatch);
        this.trace?.("out", middleware.name, current);
        if (current.type === EventType.NOOP) break;
      }
      while (dispatched.length > 0) this.eventQueue.unshift(dispatched.pop());
      return current;
    }
  };

  // src/engine/adapters.js
  function convertMatches(matches) {
    const rolling = [];
    const regex = [];
    for (const m of matches) {
      if (m.cause.type === "trigger") {
        for (const trigger of m.cause.triggers) {
          rolling.push(rollingMatchFromString(m.id, trigger, {
            caseInsensitive: m.cause.propagateCase,
            leftWord: m.cause.leftWord,
            rightWord: m.cause.rightWord
          }));
        }
      } else if (m.cause.type === "regex") {
        regex.push({ id: m.id, regex: m.cause.regex });
      }
    }
    return { rolling, regex };
  }
  function convertToTemplate(m) {
    if (m.effect.type !== "text") return null;
    return {
      ids: m.cause.type === "trigger" ? [...m.cause.triggers] : [],
      body: m.effect.replace,
      vars: m.effect.vars
    };
  }
  var isAlphabetic = (c) => /\p{Alphabetic}/u.test(c);
  var isUppercase = (c) => /\p{Uppercase}/u.test(c);
  function calculateCasingStyle(trigger, uppercaseStyle) {
    let first = null;
    let second = null;
    for (const c of trigger) {
      if (isAlphabetic(c)) {
        if (first === null) first = c;
        else if (second === null) second = c;
        else break;
      }
    }
    if (first === null) return CasingStyle.None;
    if (second !== null) {
      if (!isUppercase(first)) return CasingStyle.None;
      if (isUppercase(second)) return CasingStyle.Uppercase;
      return uppercaseStyle === "capitalize_words" ? CasingStyle.CapitalizeWords : CasingStyle.Capitalize;
    }
    if (!isUppercase(first)) return CasingStyle.None;
    if (uppercaseStyle === "capitalize") return CasingStyle.Capitalize;
    if (uppercaseStyle === "capitalize_words") return CasingStyle.CapitalizeWords;
    return CasingStyle.Uppercase;
  }
  var ConfigManager = class {
    /**
     * @param {import('../config/config.js').ConfigStore} configStore
     * @param {import('../matches/store.js').MatchStore} matchStore
     * @param {() => {title?: string, url?: string, class?: string, exec?: string}} getAppInfo
     */
    constructor(configStore, matchStore, getAppInfo = () => ({})) {
      this.configStore = configStore;
      this.matchStore = matchStore;
      this.getAppInfo = getAppInfo;
      this.matchSets = /* @__PURE__ */ new Map();
      for (const config of configStore.configs()) {
        this.matchSets.set(config.id, matchStore.query(config.matchPaths));
      }
      const all = matchStore.query(configStore.getAllMatchPaths());
      this.allMatches = all.matches;
      this.allGlobalVars = all.globalVars;
      this.matchById = new Map(this.allMatches.map((m) => [m.id, m]));
    }
    default() {
      return this.configStore.default();
    }
    active() {
      return this.configStore.active(this.getAppInfo() ?? {});
    }
    activeMatchSet() {
      return this.matchSets.get(this.active().id);
    }
    getMatch(id) {
      return this.matchById.get(id) ?? null;
    }
    /** MatchFilter: keep only the matches active in the current context. */
    filterActive(ids) {
      const active = new Set(this.activeMatchSet().matches.map((m) => m.id));
      return ids.filter((id) => active.has(id));
    }
    /** MatchResolver */
    findMatchesFromTrigger(trigger) {
      return this.allMatches.filter((m) => m.cause.type === "trigger" && m.cause.triggers.includes(trigger)).map((m) => detectedMatch({ id: m.id, trigger }));
    }
    /** MatchInfoProvider */
    getForceMode(matchId) {
      const m = this.getMatch(matchId);
      return m?.effect.type === "text" ? m.effect.forceMode : null;
    }
    /** Multiplexer */
    convert(detected) {
      const m = this.getMatch(detected.id);
      if (!m) return null;
      if (m.effect.type === "text") {
        return {
          type: EventType.RenderingRequested,
          matchId: detected.id,
          trigger: detected.trigger,
          leftSeparator: detected.leftSeparator,
          rightSeparator: detected.rightSeparator,
          triggerArgs: detected.args,
          format: m.effect.format
        };
      }
      if (m.effect.type === "image") {
        return {
          type: EventType.ImageRequested,
          matchId: detected.id,
          imagePath: m.effect.path,
          trigger: detected.trigger
        };
      }
      return null;
    }
  };
  var RendererAdapter = class {
    /**
     * @param {ConfigManager} configManager
     * @param {import('../render/renderer.js').Renderer} renderer
     */
    constructor(configManager, renderer) {
      this.configManager = configManager;
      this.renderer = renderer;
      this.templates = /* @__PURE__ */ new Map();
      for (const m of configManager.allMatches) {
        this.templates.set(m.id, convertToTemplate(m));
      }
      this.contextCache = /* @__PURE__ */ new Map();
    }
    contextFor(config) {
      if (!this.contextCache.has(config.id)) {
        const matchSet = this.configManager.matchSets.get(config.id);
        this.contextCache.set(config.id, {
          templates: matchSet.matches.map((m) => this.templates.get(m.id)).filter(Boolean),
          globalVars: matchSet.globalVars
        });
      }
      return this.contextCache.get(config.id);
    }
    async render(matchId, trigger, triggerArgs = {}) {
      const template = this.templates.get(matchId);
      if (!template) throw new Error("match not found");
      const context = this.contextFor(this.configManager.active());
      const raw = this.configManager.getMatch(matchId);
      const propagateCase = raw?.cause.type === "trigger" && raw.cause.propagateCase;
      const uppercaseStyle = raw?.cause.type === "trigger" ? raw.cause.uppercaseStyle : null;
      const casingStyle = propagateCase && trigger != null ? calculateCasingStyle(trigger, uppercaseStyle) : CasingStyle.None;
      let effective = template;
      const entries = Object.entries(triggerArgs ?? {});
      if (entries.length > 0) {
        const vars = [...template.vars];
        for (const [name, value] of entries) {
          vars.unshift({
            id: 0,
            name,
            type: "echo",
            params: { echo: String(value) },
            injectVars: false,
            dependsOn: []
          });
        }
        effective = { ...template, vars };
      }
      return this.renderer.render(effective, context, { casingStyle });
    }
  };

  // src/engine/markdown.js
  var markdownRenderer = null;
  function removeParagraphTagIfSingleOccurrence(html) {
    const count = html.split("<p>").length - 1;
    if (count > 1) return html;
    let out = html;
    while (out.startsWith("<p>")) out = out.slice(3);
    while (out.endsWith("</p>")) out = out.slice(0, -4);
    return out;
  }
  function markdownToHtml(markdown) {
    if (!markdownRenderer) return null;
    return removeParagraphTagIfSingleOccurrence(String(markdownRenderer(markdown)).trim());
  }

  // src/engine/html-text.js
  var NAMED_ENTITIES = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    copy: "\xA9",
    reg: "\xAE",
    trade: "\u2122",
    hellip: "\u2026",
    mdash: "\u2014",
    ndash: "\u2013",
    lsquo: "\u2018",
    rsquo: "\u2019",
    ldquo: "\u201C",
    rdquo: "\u201D",
    laquo: "\xAB",
    raquo: "\xBB",
    euro: "\u20AC",
    pound: "\xA3",
    yen: "\xA5",
    cent: "\xA2",
    sect: "\xA7",
    deg: "\xB0",
    middot: "\xB7",
    bull: "\u2022"
  };
  function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code >= 0 && code <= 1114111 ? String.fromCodePoint(code) : whole;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
    });
  }
  function htmlToText(html) {
    return decodeEntities(
      String(html).replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)\s*>/gi, "\n").replace(/<[^>]*>/g, "")
    ).replace(/\n+$/, "");
  }

  // src/engine/middleware.js
  var graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
  function graphemeCount(text) {
    if (graphemeSegmenter) {
      let count = 0;
      for (const _ of graphemeSegmenter.segment(text)) count += 1;
      return count;
    }
    return Array.from(text).length;
  }
  function charCount(text) {
    return Array.from(text).length;
  }
  var EventsDiscardMiddleware = class {
    name = "discard";
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
  };
  var DisableMiddleware = class {
    name = "disable";
    /**
     * @param {{toggleKey?: string|null, toggleKeyVariant?: 'left'|'right'|null,
     *          toggleKeyMaximumWindow?: number, now?: () => number}} options
     */
    constructor(options = {}) {
      this.enabled = true;
      this.lastTogglePress = null;
      this.options = { toggleKeyMaximumWindow: 1e3, now: () => Date.now(), ...options };
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
  };
  function isEventOfInterest(event) {
    if (event.type === EventType.Keyboard) {
      return event.status === Status.Pressed && !MODIFIER_KEYS.has(event.key);
    }
    if (event.type === EventType.Mouse) return event.status === Status.Pressed;
    return event.type === EventType.MatchInjected;
  }
  function convertToMatcherEvent(event) {
    if (event.type === EventType.Keyboard) return { type: "key", key: event.key, chars: event.value ?? null };
    if (event.type === EventType.Mouse || event.type === EventType.MatchInjected) {
      return { type: "virtualSeparator" };
    }
    return null;
  }
  var INVALIDATING_KEYS = /* @__PURE__ */ new Set([
    Key.ArrowDown,
    Key.ArrowLeft,
    Key.ArrowRight,
    Key.ArrowUp,
    Key.End,
    Key.Home,
    Key.PageDown,
    Key.PageUp,
    Key.Escape
  ]);
  function isInvalidatingEvent(event) {
    if (event.type === EventType.Keyboard) return INVALIDATING_KEYS.has(event.key);
    return event.type === EventType.Mouse;
  }
  var MatcherMiddleware = class {
    name = "matcher";
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
            args: r.args
          })),
          isSearch: false
        });
      }
      return event;
    }
  };
  var MatchExecRequestMiddleware = class {
    name = "match_exec_request";
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
  };
  var SuppressMiddleware = class {
    name = "suppress";
    constructor(isConfigEnabled) {
      this.isConfigEnabled = isConfigEnabled;
    }
    next(event) {
      if (event.type === EventType.MatchesDetected && !this.isConfigEnabled()) {
        return causedBy(event.sourceId, EventType.NOOP);
      }
      return event;
    }
  };
  var MatchSelectMiddleware = class {
    name = "match_select";
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
        return chosen ? causedBy(event.sourceId, EventType.MatchSelected, { chosen }) : causedBy(event.sourceId, EventType.NOOP);
      }
      const startId = this.sequence.getNextId();
      const selectedId = await this.matchSelector.select(validIds, event.isSearch);
      let next = causedBy(event.sourceId, EventType.NOOP);
      if (selectedId != null) {
        const chosen = event.matches.find((m) => m.id === selectedId);
        if (chosen) next = causedBy(event.sourceId, EventType.MatchSelected, { chosen });
      }
      const endId = this.sequence.getNextId();
      dispatch(causedBy(event.sourceId, EventType.DiscardBetween, { startId, endId }));
      return next;
    }
  };
  var CauseCompensateMiddleware = class {
    name = "cause_compensate";
    next(event, dispatch) {
      if (event.type !== EventType.MatchSelected) return event;
      const { chosen } = event;
      const compensated = causedBy(event.sourceId, EventType.CauseCompensatedMatch, { m: chosen });
      if (chosen.trigger != null && chosen.compensate !== false) {
        dispatch(compensated);
        return causedBy(event.sourceId, EventType.TriggerCompensation, {
          trigger: chosen.trigger,
          leftSeparator: chosen.leftSeparator
        });
      }
      return compensated;
    }
  };
  var MultiplexMiddleware = class {
    name = "multiplex";
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
  };
  var RENDERING_ERROR_TEXT = "[Espanso]: An error occurred during rendering, please examine the logs for more information.";
  var RenderMiddleware = class {
    name = "render";
    /**
     * @param {{render(matchId, trigger, triggerArgs): Promise<string>}} renderer
     * @param {{onError?: (error: Error) => void, errorText?: string|null}} [options]
     */
    constructor(renderer, options = {}) {
      this.renderer = renderer;
      this.onError = options.onError ?? ((error) => console.error("[espanso] error during rendering:", error));
      this.errorText = options.errorText === void 0 ? RENDERING_ERROR_TEXT : options.errorText;
    }
    async next(event, dispatch) {
      if (event.type !== EventType.RenderingRequested) return event;
      try {
        let body = await this.renderer.render(event.matchId, event.trigger, event.triggerArgs);
        if (event.rightSeparator != null) body += event.rightSeparator;
        return causedBy(event.sourceId, EventType.Rendered, {
          matchId: event.matchId,
          body,
          format: event.format
        });
      } catch (error) {
        if (error?.name === "RenderAbortedError") return causedBy(event.sourceId, EventType.NOOP);
        this.onError(error);
        if (this.errorText && error?.name !== "DisabledVariableTypeError") {
          dispatch(causedBy(event.sourceId, EventType.TextInject, { text: this.errorText, forceMode: null }));
        }
        return causedBy(event.sourceId, EventType.RenderingError, { error });
      }
    }
  };
  var ImageResolverMiddleware = class {
    name = "image_resolve";
    constructor(configDir = "") {
      this.configDir = configDir;
    }
    next(event) {
      if (event.type !== EventType.ImageRequested) return event;
      const imagePath = event.imagePath.replace("$CONFIG", this.configDir);
      return causedBy(event.sourceId, EventType.ImageResolved, { imagePath });
    }
  };
  function processCursorHint(body) {
    const index = body.indexOf("$|$");
    if (index < 0) return { body, cursorHintBackCount: null };
    const charIndex = graphemeCount(body.slice(0, index));
    const totalSize = graphemeCount(body);
    const newBody = body.replaceAll("$|$", "");
    return { body: newBody, cursorHintBackCount: totalSize - charIndex - 3 };
  }
  var CursorHintMiddleware = class {
    name = "cursor_hint";
    next(event, dispatch) {
      if (event.type !== EventType.Rendered) return event;
      const { body, cursorHintBackCount } = processCursorHint(event.body);
      if (cursorHintBackCount !== null) {
        dispatch(causedBy(event.sourceId, EventType.CursorHintCompensation, { cursorHintBackCount }));
      }
      return { ...event, body };
    }
  };
  var UndoMiddleware = class {
    name = "undo";
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
          if (event.format === "plain" && this.record && this.record.id === event.sourceId) {
            this.record.injectedText = event.body;
            this.record.matchId = event.matchId;
          }
          break;
        case EventType.Keyboard:
          if (event.status === Status.Pressed) {
            const record = this.record;
            this.record = null;
            if (event.key === Key.Backspace && record && record.trigger != null && record.injectedText != null && record.matchId != null && this.isUndoEnabled()) {
              return causedBy(event.sourceId, EventType.Undo, {
                matchId: record.matchId,
                trigger: record.trigger,
                replace: record.injectedText
              });
            }
          }
          break;
        case EventType.Mouse:
        case EventType.CursorHintCompensation:
          this.record = null;
          break;
        default:
          break;
      }
      return event;
    }
  };
  var ActionMiddleware = class {
    name = "action";
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
            minimumSourceId: this.sequence.getNextId()
          }));
          const richText = this.isRichTextEnabled();
          if (event.type === EventType.ImageResolved) {
            if (!richText) return causedBy(event.sourceId, EventType.NOOP);
            return causedBy(event.sourceId, EventType.ImageInject, { imagePath: event.imagePath });
          }
          if (!richText && (event.format === "html" || event.format === "markdown")) {
            let text = event.body;
            if (event.format === "html") {
              text = htmlToText(event.body);
            } else {
              const html = markdownToHtml(event.body);
              if (html !== null) text = htmlToText(html);
            }
            return causedBy(event.sourceId, EventType.TextInject, { text, forceMode: null });
          }
          if (event.format === "html") return causedBy(event.sourceId, EventType.HtmlInject, { html: event.body });
          if (event.format === "markdown") {
            return causedBy(event.sourceId, EventType.MarkdownInject, { markdown: event.body });
          }
          return causedBy(event.sourceId, EventType.TextInject, {
            text: event.body,
            forceMode: this.matchInfo.getForceMode(event.matchId)
          });
        }
        case EventType.CursorHintCompensation:
          dispatch(causedBy(event.sourceId, EventType.DiscardPrevious, {
            minimumSourceId: this.sequence.getNextId()
          }));
          return causedBy(event.sourceId, EventType.KeySequenceInject, {
            keys: Array(event.cursorHintBackCount).fill(Key.ArrowLeft)
          });
        case EventType.TriggerCompensation: {
          let count = charCount(event.trigger);
          if (event.leftSeparator != null) count -= charCount(event.leftSeparator);
          return causedBy(event.sourceId, EventType.KeySequenceInject, {
            keys: Array(Math.max(count, 0)).fill(Key.Backspace)
          });
        }
        case EventType.Undo: {
          const count = Math.max(charCount(event.replace) - 1, 0);
          dispatch(causedBy(event.sourceId, EventType.TextInject, {
            text: event.trigger,
            forceMode: this.matchInfo.getForceMode(event.matchId)
          }));
          return causedBy(event.sourceId, EventType.KeySequenceInject, {
            keys: Array(count).fill(Key.Backspace)
          });
        }
        default:
          return event;
      }
    }
  };
  var MarkdownMiddleware = class {
    name = "markdown";
    next(event) {
      if (event.type !== EventType.MarkdownInject) return event;
      const html = markdownToHtml(event.markdown);
      if (html === null) {
        return causedBy(event.sourceId, EventType.TextInject, { text: event.markdown, forceMode: null });
      }
      return causedBy(event.sourceId, EventType.HtmlInject, { html });
    }
  };

  // src/engine/engine.js
  var TOGGLE_KEY_MAP = {
    Ctrl: ["Control", null],
    Alt: ["Alt", null],
    Shift: ["Shift", null],
    Meta: ["Meta", null],
    RightCtrl: ["Control", "right"],
    RightAlt: ["Alt", "right"],
    RightShift: ["Shift", "right"],
    RightMeta: ["Meta", "right"],
    LeftCtrl: ["Control", "left"],
    LeftAlt: ["Alt", "left"],
    LeftShift: ["Shift", "left"],
    LeftMeta: ["Meta", "left"]
  };
  var nullInjector = {
    injectKeys() {
    },
    injectText() {
    },
    injectHtml() {
    },
    injectImage() {
    }
  };
  var Engine = class {
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
     * @param {string|null} [options.renderingErrorText]  text injected on error (null = nothing)
     * @param {string} [options.configDir]  substituted for $CONFIG in image paths
     * @param {(error: Error, kind: string) => void} [options.onError]
     *        kind is 'config' | 'render' | 'inject' | 'attach'; errors are also emitted
     *        as an `error` event with `{ kind, error }`
     * @param {() => Document|null} [options.getDocument]  document read by `dom` variables
     */
    constructor(options) {
      this.options = options;
      this.injector = options.injector ?? nullInjector;
      this.listeners = /* @__PURE__ */ new Map();
      this.queue = Promise.resolve();
      this.lastSourceId = 0;
      this.onError = options.onError ?? ((error) => console.error("[espanso]", error));
      this.documentProvider = options.getDocument ?? null;
      this.configManager = new ConfigManager(options.configStore, options.matchStore, options.getAppInfo);
      const defaultConfig = this.configManager.default();
      this.renderer = new Renderer([
        createEchoExtension(),
        createRandomExtension(),
        createDateExtension(options.dateOptions),
        createChoiceExtension(options.choiceSelector),
        createFormExtension(options.formProvider),
        createClipboardExtension(options.clipboardProvider),
        createUnsupportedExtension("shell"),
        createUnsupportedExtension("script"),
        createDomExtension({ getDocument: () => this.getDocument() }),
        ...options.extensions ?? []
      ], { disabledTypes: defaultConfig.disabledVarTypes });
      this.renderer.logger = { error: (msg) => this.reportError("render", new Error(msg)) };
      this.rendererAdapter = new RendererAdapter(this.configManager, this.renderer);
      const { rolling, regex } = convertMatches(this.configManager.allMatches);
      this.matchers = [
        new RollingMatcher(rolling, { charWordSeparators: defaultConfig.wordSeparators }),
        new RegexMatcher(regex, {
          maxBufferSize: defaultConfig.maxRegexBufferSize,
          onError: (error) => this.reportError("config", error)
        })
      ];
      const sequence = { getNextId: () => this.nextSourceId() };
      const toggle = TOGGLE_KEY_MAP[defaultConfig.toggleKey] ?? [null, null];
      this.matcherMiddleware = new MatcherMiddleware(this.matchers, {
        maxHistorySize: defaultConfig.backspaceLimit
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
          onError: (error) => this.reportError("render", error),
          errorText: options.renderingErrorText
        }),
        new ImageResolverMiddleware(options.configDir ?? ""),
        new CursorHintMiddleware(),
        new UndoMiddleware(() => this.configManager.default().undoBackspace),
        new ActionMiddleware(this.configManager, sequence, {
          isRichTextEnabled: () => this.configManager.default().richText
        }),
        new MarkdownMiddleware()
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
              triggers: m?.cause.type === "trigger" ? m.cause.triggers : [],
              match: m
            };
          });
          return selector.select(matches, isSearch);
        }
      };
    }
    /** The document `dom` variables read from (set by the DOM layer when attached). */
    getDocument() {
      return this.documentProvider?.() ?? (typeof document !== "undefined" ? document : null);
    }
    /** Report an error of the given kind ('config' | 'render' | 'inject' | 'attach'). */
    reportError(kind, error) {
      try {
        this.onError(error, kind);
      } catch {
      }
      this.emit("error", { kind, error });
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
        ...input
      });
      return this.enqueue(event);
    }
    /** Convenience: simulate typing a string, one key event per character. */
    async type(text) {
      const produced = [];
      for (const c of text) {
        produced.push(...await this.handleInput({ type: "keyboard", key: keyForChar(c), value: c }));
      }
      return produced;
    }
    /** Clear the matcher state (e.g. when the focus moves to another field). */
    resetState() {
      this.matcherMiddleware.reset();
    }
    enable() {
      return this.enqueue(causedBy(this.nextSourceId(), EventType.EnableRequest));
    }
    disable() {
      return this.enqueue(causedBy(this.nextSourceId(), EventType.DisableRequest));
    }
    toggle() {
      return this.enqueue(causedBy(this.nextSourceId(), EventType.ToggleRequest));
    }
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
        compensate: options.compensate ?? false
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
      if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
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
          try {
            this.onError(error, "listener");
          } catch {
          }
        }
      }
    }
    enqueue(event) {
      const run = this.queue.then(async () => {
        const produced = await this.processor.process(event);
        const blocked = new Set(produced.filter((e) => e.type === EventType.RenderingError && e.error?.name === "DisabledVariableTypeError").map((e) => e.sourceId));
        for (const e of produced) {
          if (blocked.has(e.sourceId) && e.type === EventType.KeySequenceInject) continue;
          await this.dispatch(e);
        }
        return produced;
      });
      this.queue = run.catch((error) => this.reportError("render", error));
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
        this.reportError("inject", error);
      }
      this.emit(event.type, event);
      this.emit("*", event);
    }
  };
  function keyForChar(c) {
    if (c === " ") return "Space";
    if (c === "\n" || c === "\r") return "Enter";
    if (c === "	") return "Tab";
    return "Other";
  }

  // src/create.js
  var DisabledMatchError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "DisabledMatchError";
    }
  };
  function createEngine(options = {}) {
    const files = { ...options.files instanceof Map ? Object.fromEntries(options.files) : options.files };
    if (options.yaml != null) files["match/base.yml"] = options.yaml;
    const vfs = new VirtualFS(files);
    const configDir = options.configDir ?? "config";
    const errors = [];
    const { store: configStore, errors: configErrors } = ConfigStore.load(vfs, configDir, {
      defaultConfig: options.config
    });
    configErrors.forEach((e) => errors.push({ level: "error", ...e }));
    const { store: matchStore, errors: matchErrors } = MatchStore.load(vfs, configStore.getAllMatchPaths());
    errors.push(...matchErrors);
    if (options.matches || options.globalVars) {
      const inlinePath = "<inline>";
      const { group, errors: inlineErrors } = convertMatchGroup({
        matches: options.matches ?? [],
        global_vars: options.globalVars ?? []
      });
      inlineErrors.forEach((e) => errors.push({ path: inlinePath, ...e }));
      matchStore.addGroup(inlinePath, group);
      for (const config of configStore.configs()) config.matchPaths.push(inlinePath);
    }
    const defaultConfig = configStore.default();
    if (!defaultConfig.regex || !defaultConfig.richText) {
      for (const [path, group] of matchStore.groups) {
        group.matches = group.matches.filter((m) => {
          if (!defaultConfig.regex && m.cause.type === "regex") {
            errors.push({ path, level: "error", error: new DisabledMatchError("regex matches are disabled (regex: false); match dropped") });
            return false;
          }
          if (!defaultConfig.richText && m.effect.type === "image") {
            errors.push({ path, level: "error", error: new DisabledMatchError("image matches are disabled (rich_text: false); match dropped") });
            return false;
          }
          return true;
        });
      }
    }
    errors.forEach((e) => options.onLoadError?.(e));
    const engine = new Engine({ ...options, configStore, matchStore });
    return { engine, errors };
  }

  // src/browser/dom.js
  var TEXT_INPUT_TYPES = /* @__PURE__ */ new Set(["text", "search", "url", "tel", "email", ""]);
  var NAVIGATION_KEYS = /* @__PURE__ */ new Set([
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "End",
    "Home",
    "PageDown",
    "PageUp",
    "Escape"
  ]);
  var MODIFIER_KEYS2 = /* @__PURE__ */ new Set(["Alt", "Control", "Shift", "Meta", "CapsLock", "NumLock", "AltGraph"]);
  var graphemeSegmenter2 = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
  function deepActiveElement(doc = document) {
    let el = doc.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }
  function editableKind(el, { includePasswordFields = false } = {}) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return el.readOnly || el.disabled ? null : "input";
    if (tag === "INPUT") {
      if (el.readOnly || el.disabled) return null;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (TEXT_INPUT_TYPES.has(type)) return "input";
      if (type === "password" && includePasswordFields) return "input";
      return null;
    }
    if (el.isContentEditable) return "contenteditable";
    if (el.isContentEditable === void 0) {
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const attr = node.getAttribute("contenteditable");
        if (attr === "" || attr === "true" || attr === "plaintext-only") return "contenteditable";
        if (attr === "false") return null;
      }
    }
    return null;
  }
  function eventTarget(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return path[0] ?? event.target;
  }
  function editableRoot(el, options) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const kind = editableKind(node, options);
      if (kind === "input") return node;
      if (kind === "contenteditable") {
        let host = node;
        while (host.parentElement && editableKind(host.parentElement, options) === "contenteditable") {
          host = host.parentElement;
        }
        return host;
      }
    }
    return null;
  }
  function backByCodePoints(text, index, count) {
    let i = index;
    for (let n = 0; n < count && i > 0; n += 1) {
      const low = text.charCodeAt(i - 1);
      i -= 1;
      if (low >= 56320 && low <= 57343 && i > 0) {
        const high = text.charCodeAt(i - 1);
        if (high >= 55296 && high <= 56319) i -= 1;
      }
    }
    return i;
  }
  function backByGraphemes(text, index, count) {
    if (!graphemeSegmenter2) return backByCodePoints(text, index, count);
    const boundaries = [];
    for (const { index: start } of graphemeSegmenter2.segment(text.slice(0, index))) boundaries.push(start);
    const position = boundaries.length - count;
    return position <= 0 ? 0 : boundaries[position];
  }
  function escapeAttribute(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  var DomInjector = class {
    /**
     * @param {{doc?: Document, getTarget?: () => Element|null, useExecCommand?: boolean}} [options]
     */
    constructor(options = {}) {
      this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);
      this.getFallbackTarget = options.getTarget ?? (() => null);
      this.useExecCommand = options.useExecCommand ?? true;
      this.injecting = false;
      this.editableOptions = options.editableOptions ?? {};
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
      if (!this.useExecCommand || typeof this.doc?.execCommand !== "function") return false;
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
          if (key === "Backspace") {
            if (lefts) flush();
            backspaces += 1;
          } else if (key === "ArrowLeft") {
            if (backspaces) flush();
            lefts += 1;
          } else if (key === "ArrowRight") {
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
        if (this.richText && editableKind(el, this.editableOptions) === "contenteditable") this.insertHtml(el, html);
        else this.insertText(el, htmlToText(html));
      });
    }
    injectImage(path) {
      if (!this.richText) return;
      const el = this.target();
      if (!el || editableKind(el, this.editableOptions) !== "contenteditable") return;
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
      }
    }
    fireInput(el, inputType, data = null) {
      const view = this.doc?.defaultView;
      const InputEventCtor = view?.InputEvent ?? (typeof InputEvent !== "undefined" ? InputEvent : null);
      const EventCtor = view?.Event ?? Event;
      const event = InputEventCtor ? new InputEventCtor("input", { bubbles: true, inputType, data }) : new EventCtor("input", { bubbles: true });
      el.dispatchEvent(event);
    }
    fireChange(el) {
      const EventCtor = this.doc?.defaultView?.Event ?? Event;
      el.dispatchEvent(new EventCtor("change", { bubbles: true }));
    }
    /**
     * Fallback edit of an <input>/<textarea> (when execCommand is unavailable).
     * A programmatic edit gets no native `change` on blur, so fire it here too:
     * pages that commit a field's value on `change` would otherwise lose the text.
     */
    replaceRange(el, text, start, end, inputType) {
      if (typeof el.setRangeText === "function" && el.selectionStart != null) {
        el.setRangeText(text, start, end, "end");
      } else {
        el.value = el.value.slice(0, start) + text + el.value.slice(end);
      }
      this.fireInput(el, inputType, text || null);
      this.fireChange(el);
    }
    deleteBackward(el, count) {
      if (editableKind(el, this.editableOptions) === "contenteditable") {
        this.deleteBackwardRich(el, count);
        return;
      }
      const { start, end } = this.caret(el);
      if (start !== end) {
        this.replaceRange(el, "", start, end, "deleteContentBackward");
        count -= 1;
      }
      const caret = this.caret(el).start;
      const from = backByCodePoints(el.value, caret, count);
      if (from === caret) return;
      this.setSelection(el, from, caret);
      if (!(this.isFocused(el) && this.execCommand("delete"))) {
        this.replaceRange(el, "", from, caret, "deleteContentBackward");
      }
    }
    insertText(el, text) {
      if (editableKind(el, this.editableOptions) === "contenteditable") {
        this.insertTextRich(el, text);
        return;
      }
      if (this.isFocused(el) && this.execCommand("insertText", text)) return;
      const { start, end } = this.caret(el);
      this.replaceRange(el, text, start, end, "insertText");
    }
    moveLeft(el, count) {
      if (editableKind(el, this.editableOptions) === "contenteditable") {
        this.moveRich(el, "backward", count);
        return;
      }
      const { start } = this.caret(el);
      const position = backByGraphemes(el.value, start, count);
      this.setSelection(el, position, position);
    }
    moveRight(el, count) {
      if (editableKind(el, this.editableOptions) === "contenteditable") {
        this.moveRich(el, "forward", count);
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
      if (root && typeof root.getSelection === "function" && root !== this.doc) {
        const shadowSelection = root.getSelection();
        if (shadowSelection) return shadowSelection;
      }
      return (this.doc?.defaultView ?? globalThis).getSelection?.() ?? null;
    }
    deleteBackwardRich(el, count) {
      const sel = this.selection(el);
      if (!sel || sel.rangeCount === 0) return;
      if (!sel.isCollapsed) {
        if (!this.execCommand("delete")) sel.deleteFromDocument();
        count -= 1;
      }
      if (count <= 0) return;
      if (typeof sel.modify === "function") {
        for (let i = 0; i < count; i += 1) sel.modify("extend", "backward", "character");
      } else {
        this.extendBackwardManually(sel, count);
      }
      if (!this.execCommand("delete")) {
        sel.deleteFromDocument();
        this.fireInput(el, "deleteContentBackward");
      }
    }
    /** Fallback for engines without Selection.modify: walk back through text nodes. */
    extendBackwardManually(sel, count) {
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
      let offset = range.startOffset;
      if (node.nodeType !== 3) {
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
      if (this.execCommand("insertText", text)) return;
      const sel = this.selection(el);
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const doc = el.ownerDocument;
      const fragment = doc.createDocumentFragment();
      text.split("\n").forEach((line, i) => {
        if (i > 0) fragment.appendChild(doc.createElement("br"));
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
      this.fireInput(el, "insertText", text);
    }
    insertHtml(el, html) {
      if (this.execCommand("insertHTML", html)) return;
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
      this.fireInput(el, "insertHTML");
    }
    moveRich(el, direction, count) {
      const sel = this.selection(el);
      if (!sel) return;
      if (typeof sel.modify === "function") {
        for (let i = 0; i < count; i += 1) sel.modify("move", direction, "character");
        return;
      }
      if (sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === 3) {
        const offset = direction === "backward" ? backByGraphemes(node.data, range.startOffset, count) : Math.min(node.data.length, range.startOffset + count);
        range.setStart(node, offset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };
  function previousTextNode(node) {
    let current = node;
    for (; ; ) {
      while (current && !current.previousSibling) {
        current = current.parentNode;
        if (!current || current.nodeType === 1 && current.isContentEditable === true && !current.parentElement?.isContentEditable) {
          return null;
        }
      }
      if (!current) return null;
      current = current.previousSibling;
      while (current && current.nodeType !== 3 && current.lastChild) current = current.lastChild;
      if (current && current.nodeType === 3) return current;
    }
  }
  function keyEventVariant(event) {
    if (event.location === 1) return "left";
    if (event.location === 2) return "right";
    return null;
  }
  function normalizeModifier(key) {
    return key === "AltGraph" ? "Alt" : key;
  }
  function keyForChar2(c) {
    if (c === " ") return "Space";
    if (c === "\n") return "Enter";
    if (c === "	") return "Tab";
    return "Other";
  }
  function attach(engine, options = {}) {
    const root = options.root ?? document;
    const doc = root.ownerDocument ?? (root.nodeType === 9 ? root : document);
    const config = engine.configManager?.default();
    const reportError = (kind, error) => engine.reportError ? engine.reportError(kind, error) : console.error(error);
    const editableOptions = {
      includePasswordFields: options.includePasswordFields ?? config?.includePasswordFields ?? false
    };
    const excludeSelector = validSelector(options.excludeSelector ?? config?.excludeSelector ?? "", doc, reportError);
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
    const previousDocumentProvider = engine.documentProvider;
    engine.documentProvider = () => injector.target()?.ownerDocument ?? doc;
    const resolveField = (event) => {
      const el = editableRoot(eventTarget(event), editableOptions);
      if (!el || !shouldHandle(el)) return null;
      return el;
    };
    const sendChars = (text) => {
      for (const c of text) {
        engine.handleInput({ type: "keyboard", key: keyForChar2(c), value: c, status: "pressed" });
      }
    };
    const invalidate = () => engine.handleInput({ type: "mouse", status: "pressed", button: "left" });
    const onInput = (event) => {
      if (injector.injecting) return;
      const el = resolveField(event);
      if (!el) return;
      if (el !== lastTarget) {
        lastTarget = el;
      }
      if (event.isComposing) return;
      switch (event.inputType) {
        case "insertText":
          if (event.data != null) sendChars(event.data);
          break;
        case "insertLineBreak":
        case "insertParagraph":
          engine.handleInput({ type: "keyboard", key: "Enter", value: "\n", status: "pressed" });
          break;
        case "deleteContentBackward":
          engine.handleInput({ type: "keyboard", key: "Backspace", value: null, status: "pressed" });
          break;
        case "insertCompositionText":
        case "insertFromComposition":
        // Safari, after compositionend
        case "deleteCompositionText":
          break;
        case void 0:
        case "":
          if (event.data != null) sendChars(event.data);
          else invalidate();
          break;
        default:
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
      if (MODIFIER_KEYS2.has(event.key)) {
        engine.handleInput({
          type: "keyboard",
          key: normalizeModifier(event.key),
          value: null,
          status: "pressed",
          variant: keyEventVariant(event)
        });
        return;
      }
      if (!resolveField(event)) return;
      if (NAVIGATION_KEYS.has(event.key)) {
        engine.handleInput({ type: "keyboard", key: event.key, value: null, status: "pressed" });
      }
    };
    const onKeyUp = (event) => {
      if (injector.injecting) return;
      const key = MODIFIER_KEYS2.has(event.key) ? normalizeModifier(event.key) : "Other";
      engine.handleInput({ type: "keyboard", key, value: null, status: "released", variant: keyEventVariant(event) });
    };
    const onPointerDown = () => invalidate();
    const onFocusIn = (event) => {
      const el = resolveField(event);
      if (el && el !== lastTarget) {
        lastTarget = el;
        engine.resetState();
      }
    };
    const safe = (fn) => (event) => {
      try {
        fn(event);
      } catch (error) {
        reportError("attach", error);
      }
    };
    const listeners = [
      ["input", onInput],
      ["compositionend", onCompositionEnd],
      ["keydown", onKeyDown],
      ["keyup", onKeyUp],
      ["mousedown", onPointerDown],
      ["focusin", onFocusIn]
    ].map(([type, fn]) => [type, safe(fn)]);
    for (const [type, fn] of listeners) root.addEventListener(type, fn, true);
    return {
      injector,
      detach() {
        for (const [type, fn] of listeners) root.removeEventListener(type, fn, true);
        if (engine.injector === injector) engine.injector = nullInjector;
        engine.documentProvider = previousDocumentProvider ?? null;
      }
    };
  }
  var InvalidSelectorError = class extends Error {
    constructor() {
      super("exclude_selector is not a valid CSS selector; it is ignored");
      this.name = "InvalidSelectorError";
    }
  };
  function validSelector(selector, doc, reportError) {
    if (typeof selector !== "string" || selector.trim() === "") return "";
    try {
      doc.createDocumentFragment().querySelector(selector);
      return selector;
    } catch {
      reportError("config", new InvalidSelectorError());
      return "";
    }
  }

  // src/auto/loader.js
  var CONFIG_MIME = "application/x-espanso+json";
  var ERROR_KINDS = /* @__PURE__ */ new Set(["config", "render", "inject", "attach"]);
  var ConfigSourceError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ConfigSourceError";
    }
  };
  var CrossOriginConfigError = class extends Error {
    constructor() {
      super("data-config-url must be same-origin; the configuration was not fetched");
      this.name = "CrossOriginConfigError";
    }
  };
  var InvalidConfigError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidConfigError";
    }
  };
  var IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;
  function errorName(error) {
    for (const name of [error?.name, error?.constructor?.name]) {
      if (typeof name === "string" && IDENTIFIER.test(name)) return name;
    }
    return "Error";
  }
  function startAutoLoader({ script, document: doc, fetch: fetchImpl }) {
    const view = doc.defaultView ?? globalThis;
    const doFetch = fetchImpl ?? view.fetch?.bind(view);
    const debug = script?.hasAttribute?.("data-debug") ?? false;
    const counts = { config: 0, render: 0, inject: 0, attach: 0 };
    let attachment = null;
    let stopped = false;
    const dispatch = (type, detail) => {
      const EventCtor = view.CustomEvent ?? CustomEvent;
      doc.dispatchEvent(new EventCtor(type, { detail, bubbles: false }));
    };
    const reportError = (kind, error) => {
      const k = ERROR_KINDS.has(kind) ? kind : "render";
      counts[k] += 1;
      if (debug) view.console?.warn?.("[espanso]", k, error);
      dispatch("espanso:error", { kind: k, errorName: errorName(error), count: counts[k] });
    };
    async function readConfig() {
      const selector = script?.getAttribute?.("data-config");
      if (selector != null) {
        let element2;
        try {
          element2 = doc.querySelector(selector);
        } catch {
          throw new ConfigSourceError("data-config is not a valid selector");
        }
        if (!element2) throw new ConfigSourceError("data-config element not found");
        return JSON.parse(element2.textContent ?? "");
      }
      const url = script?.getAttribute?.("data-config-url");
      if (url != null) {
        const base = doc.baseURI ?? doc.URL;
        let target;
        try {
          target = new URL(url, base);
        } catch {
          throw new ConfigSourceError("data-config-url is not a valid URL");
        }
        const pageOrigin = new URL(doc.URL).origin;
        if (pageOrigin === "null" || target.origin !== pageOrigin) throw new CrossOriginConfigError();
        if (!doFetch) throw new ConfigSourceError("fetch is not available");
        const response = await doFetch(target.href, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new ConfigSourceError(`configuration request failed (HTTP ${response.status})`);
        return JSON.parse(await response.text());
      }
      const element = doc.querySelector(`script[type="${CONFIG_MIME}"]`);
      if (!element) return null;
      return JSON.parse(element.textContent ?? "");
    }
    function buildEngine(json) {
      if (json === null || typeof json !== "object" || Array.isArray(json)) {
        throw new InvalidConfigError("the configuration must be a JSON object");
      }
      for (const key of ["matches", "global_vars"]) {
        if (json[key] != null && !Array.isArray(json[key])) throw new InvalidConfigError(`'${key}' must be an array`);
      }
      if (json.config != null && (typeof json.config !== "object" || Array.isArray(json.config))) {
        throw new InvalidConfigError("'config' must be an object");
      }
      const { engine, errors } = createEngine({
        config: json.config ?? {},
        matches: json.matches ?? [],
        globalVars: json.global_vars ?? [],
        getAppInfo: () => ({ title: doc.title, url: doc.URL }),
        getDocument: () => doc,
        onError: (error, kind) => reportError(kind, error)
      });
      for (const e of errors) reportError("config", e.error);
      return engine;
    }
    async function load2() {
      attachment?.detach();
      attachment = null;
      if (stopped) return;
      let json = null;
      try {
        json = await readConfig();
      } catch (error) {
        reportError("config", error);
      }
      let engine = null;
      if (json != null) {
        try {
          engine = buildEngine(json);
        } catch (error) {
          reportError("config", error);
        }
      }
      let matchCount = 0;
      if (engine) {
        const defaultConfig = engine.configManager.default();
        if (defaultConfig.enable) matchCount = engine.configManager.matchSets.get(defaultConfig.id).matches.length;
      }
      if (engine && matchCount > 0 && !stopped) {
        try {
          attachment = attach(engine, { root: doc });
        } catch (error) {
          reportError("attach", error);
          matchCount = 0;
        }
      }
      dispatch("espanso:ready", { matchCount: attachment ? matchCount : 0 });
    }
    let chain = Promise.resolve();
    const enqueue = () => {
      chain = chain.then(load2, load2);
      return chain;
    };
    const onReload = () => {
      enqueue();
    };
    doc.addEventListener("espanso:reload", onReload);
    const ready = new Promise((resolve) => {
      const start = () => enqueue().then(resolve);
      if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
      else start();
    });
    return {
      ready,
      reload: () => enqueue(),
      stop() {
        stopped = true;
        doc.removeEventListener("espanso:reload", onReload);
        attachment?.detach();
        attachment = null;
      }
    };
  }

  // src/auto/entry.js
  if (typeof document !== "undefined") {
    const script = document.currentScript;
    startAutoLoader({ script, document: script?.ownerDocument ?? document });
  }
})();
//# sourceMappingURL=espanso-auto.js.map
