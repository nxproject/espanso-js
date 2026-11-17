/*! espanso-js - a JavaScript port of espanso (https://github.com/espanso/espanso). GPL-3.0-or-later */

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

// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException) return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark) return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += "\n\n" + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
  if (hasRequiredSnippet) return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
      // relative position
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo - i],
        lineEnds[foundLineNo - i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
        maxLineLength
      );
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo + i],
        lineEnds[foundLineNo + i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
        maxLineLength
      );
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType) return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr) return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe) return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
    "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore) return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  const YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = {};
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
      Object.defineProperty(objectKeys, pairKey, { value: true });
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var _default;
var hasRequired_default;
function require_default() {
  if (hasRequired_default) return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader) return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "\x85";
      case 95:
        return "\xA0";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(
      (c - 65536 >> 10) + 55296,
      (c - 65536 & 1023) + 56320
    );
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      // omit trailing \0
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    chargeMergeWork(state);
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      chargeMergeWork(state);
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        if (valueNode.length > 100) {
          throwError(state, "abnormal merge sequence size");
        }
        for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat("\n", emptyLines);
        }
      } else {
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
            state,
            propertyStart,
            propertyStart.position - propertyStart.lineStart,
            flowIndent
          )) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper) return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null) return {};
    const result = {};
    const keys = Object.keys(map2);
    for (let index = 0, length = keys.length; index < length; index += 1) {
      let tag = keys[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && // - b-char
    c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (
      // ns-plain-safe
      (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
      c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
      c !== CHAR_SHARP && // false on '#'
      !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
      isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
      prev === CHAR_COLON && cIsNsChar
    );
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
    c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || // No block styles in flow mode.
      state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
        state.quotingType,
        state.forceQuotes && !iskey,
        inblock
      )) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(
          state.tag[0] === "!" ? state.tag.slice(1) : state.tag
        ).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i = 0, length = object.length; i < length; i += 1) {
            inspectNode(object[i], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml) return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYamlExports = requireJsYaml();
var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
var {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
} = yaml;

// src/config/yaml.js
var SCHEMA = yaml.CORE_SCHEMA.extend({ implicit: [yaml.types.merge] });
function isYamlEmpty(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#") && trimmed !== "") return false;
  }
  return true;
}
function parseYaml(text) {
  const source = String(text ?? "").replace(/^﻿+/, "");
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
  if (doc === null || doc === void 0) return {};
  if (typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("invalid YAML document: expected a mapping at the top level");
  }
  return doc;
}
var LENIENT_FLOW_VALUE_FIRST_CHARS = /* @__PURE__ */ new Set([":", ">", "|"]);
var isWs = (c) => c === " " || c === "	" || c === "\n" || c === "\r";
function lenientFlowQuote(input) {
  const chars = Array.from(input);
  const n = chars.length;
  let out = "";
  let depth = 0;
  let scalarStartPending = true;
  let i = 0;
  while (i < n) {
    if ((i === 0 || chars[i - 1] === "\n") && depth === 0) {
      const resume = blockScalarSpan(chars, i);
      if (resume !== null) {
        out += chars.slice(i, resume).join("");
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
    if (c === "[" || c === "{") {
      depth += 1;
      out += c;
      scalarStartPending = true;
      i += 1;
      continue;
    }
    if (c === "]" || c === "}") {
      depth = Math.max(depth - 1, 0);
      out += c;
      scalarStartPending = false;
      i += 1;
      continue;
    }
    if (c === "#" && commentStartsHere(chars, i)) {
      while (i < n && chars[i] !== "\n") {
        out += chars[i];
        i += 1;
      }
      continue;
    }
    if (depth > 0) {
      if (c === ",") {
        out += c;
        scalarStartPending = true;
        i += 1;
        continue;
      }
      if (c === ":" && isValueIndicator(chars, i)) {
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
      if (c === "\\") {
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
  if (next === void 0) return true;
  return [" ", "	", "\n", "\r", ",", "]", "}"].includes(next);
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
    if ([",", "[", "]", "{", "}", "\n", "\r"].includes(c)) break;
    if (c === "#" && commentStartsHere(chars, j)) break;
    if (c === ":" && isValueIndicator(chars, j)) break;
    j += 1;
  }
  const raw = chars.slice(start, j);
  let end = raw.length;
  while (end > 0 && (raw[end - 1] === " " || raw[end - 1] === "	")) end -= 1;
  return {
    resumeAt: j,
    value: raw.slice(0, end).join(""),
    trailing: raw.slice(end).join("")
  };
}
function blockScalarSpan(chars, lineStart) {
  const n = chars.length;
  let pos = lineStart;
  let parentIndent = 0;
  while (pos < n && (chars[pos] === " " || chars[pos] === "	")) {
    parentIndent += 1;
    pos += 1;
  }
  if (!isBlockScalarHeader(chars, pos)) return null;
  let cur = pos;
  while (cur < n && chars[cur] !== "\n") cur += 1;
  for (; ; ) {
    if (cur >= n) break;
    cur += 1;
    if (cur >= n) break;
    let content = cur;
    let lineIndent = 0;
    while (content < n && (chars[content] === " " || chars[content] === "	")) {
      lineIndent += 1;
      content += 1;
    }
    let scan = content;
    let blank = true;
    while (scan < n && chars[scan] !== "\n") {
      if (![" ", "	", "\r"].includes(chars[scan])) {
        blank = false;
        break;
      }
      scan += 1;
    }
    if (blank || lineIndent > parentIndent) {
      while (cur < n && chars[cur] !== "\n") cur += 1;
      continue;
    }
    break;
  }
  return cur;
}
function isBlockScalarHeader(chars, start) {
  const n = chars.length;
  let eol = start;
  while (eol < n && chars[eol] !== "\n") eol += 1;
  let indicator = -1;
  for (let idx = eol - 1; idx >= start; idx -= 1) {
    if (chars[idx] === "|" || chars[idx] === ">") {
      indicator = idx;
      break;
    }
  }
  if (indicator < 0) return false;
  let after = indicator + 1;
  while (after < eol && (chars[after] === "+" || chars[after] === "-" || /[0-9]/.test(chars[after]))) {
    after += 1;
  }
  while (after < eol && (chars[after] === " " || chars[after] === "	")) after += 1;
  if (after < eol && chars[after] === "#") return true;
  return after === eol;
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
  "filter_url"
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
  const raw = parseYaml(text);
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
  static load(vfs, configDir = "config") {
    const yml = resolvePath(configDir, "default.yml");
    const yaml2 = resolvePath(configDir, "default.yaml");
    const defaultFile = vfs.exists(yml) ? yml : vfs.exists(yaml2) ? yaml2 : null;
    const errors = [];
    let defaultConfig;
    if (defaultFile) {
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
      warnings.forEach((w2) => errors.push({ level: "warning", error: w2 }));
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
    let resolvedReplace = formLayout.replace(FORM_CONTROL_REGEX, (_2, name) => `{{form1.${name}}}`);
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
    for (const [k, v2] of Object.entries(value)) out[k] = cloneValue(v2);
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
        for (const v2 of group.globalVars) {
          if (!visitedVars.has(v2.id)) {
            globalVars.push(v2);
            visitedVars.add(v2.id);
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
  const mapFor = (it2) => {
    if (it2.kind === "key") return [node.keys, it2.key];
    if (it2.kind === "char") return [node.chars, it2.char];
    return [node.charsInsensitive, foldCase(it2.char)];
  };
  if (rest.length === 0) {
    if (item.kind === "wordSeparator") {
      const matches = node.wordSeparators?.matches ? [...node.wordSeparators.matches] : [];
      matches.push(id);
      node.wordSeparators = { matches };
      return;
    }
    const [map3, k2] = mapFor(item);
    const entry2 = map3.get(k2);
    if (entry2?.matches) entry2.matches.push(id);
    else map3.set(k2, { matches: [id] });
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
  const [map2, k] = mapFor(item);
  const entry = map2.get(k);
  if (entry) {
    if (entry.node) insertItems(id, entry.node, rest);
  } else {
    const next = createNode();
    insertItems(id, next, rest);
    map2.set(k, { node: next });
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
    value.forEach((v2) => collectValueVariableNames(v2, names));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((v2) => collectValueVariableNames(v2, names));
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
  if (Array.isArray(value)) return value.map((v2) => injectIntoValue(v2, scope));
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v2] of Object.entries(value)) out[k] = injectIntoValue(v2, scope);
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
  /** @param {Array<{name: string, calculate: Function}>} extensions */
  constructor(extensions = []) {
    this.extensions = /* @__PURE__ */ new Map();
    for (const ext of extensions) this.extensions.set(ext.name, ext);
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
      let localVariables = template.vars;
      if (template.vars.some((v2) => v2.type === "global")) {
        const globals = new Map(context.globalVars.map((v2) => [v2.name, v2]));
        localVariables = template.vars.map((v2) => v2.type === "global" ? globals.get(v2.name) : v2).filter(Boolean);
      }
      const variables = resolveEvaluationOrder(template.body, localVariables, context.globalVars);
      const scope = /* @__PURE__ */ new Map();
      for (const variable of variables) {
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
          for (const [k, v2] of Object.entries(output)) multiple[k] = String(v2 ?? "");
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
  const utc = (y2, m, d, h = 12) => new Date(Date.UTC(y2, m, d, h));
  const part = (options, date, type2) => {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).formatToParts(date);
    return parts.find((p) => p.type === type2)?.value ?? "";
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
    const name = parts.find((x2) => x2.type === "timeZoneName")?.value;
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
function causedBy(sourceId, type2, payload = {}) {
  return { sourceId, type: type2, ...payload };
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

// node_modules/marked/lib/marked.esm.js
function G() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var S = G();
function ue(l3) {
  S = l3;
}
var q = { exec: () => null };
function D(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), r = e[n];
    return r || (r = l3(n), e[n] = r), r;
  };
}
function g(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (r, s) => {
    let o = typeof s == "string" ? s : s.source;
    return o = o.replace(O.caret, "$1"), t = t.replace(r, o), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var _e = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var O = { codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm, listInterruptsParagraph: /^ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, endingSpaceTabChar: /[ \t]$/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, leadingSpaceTab: /^[ \t]+/, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, blockquoteMarkerWhitespace: /^( {0,3}>)(\t[ \t]*)/gm, nestedBlockMarker: /^ {0,3}(?:(?:[*+-]|\d{1,9}[.)])(?: |$)|> ?)/, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\][ \t]+\S/, listReplaceTask: /^\[[ xX]\][ \t]+/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/, numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: D((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: D((l3) => new RegExp(`^ {0,${l3}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)), fencesBeginRegex: D((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: D((l3) => new RegExp(`^ {0,${l3}}#{1,6}(?:\\s|$)`)), pedanticHeadingBeginRegex: D((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: D((l3) => new RegExp(`^ {0,${l3}}(?:</?(?:${he})(?:[ \\t]+|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, "i")), blockquoteBeginRegex: D((l3) => new RegExp(`^ {0,${l3}}>`)), nestedContainerMarkers: /^(?: {0,3}(?:(?:[*+-]|\d{1,9}[.)])[ \t]+|>[ \t]?))+/ };
var Ge = /^(?:[ \t]*(?:\n|$))+/;
var Ne = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var Fe = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
var V = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Qe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var ce = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var he = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var J = g(" {0,3}(?:</?(?:tag)(?:[ \\t]+|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)").replace("tag", he).getRegex();
var $e = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;
var Le = g($e).replace(/bull/g, ce).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/\|table/g, "").replace(/html/g, J).getRegex();
var We = g($e).replace(/bull/g, ce).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).replace(/html/g, J).getRegex();
var de = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
var Ue = /^[^\n]+/;
var ge = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/;
var Ke = g(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<(?:\\.|[^\n<>\\])*>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", ge).replace("title", /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/).getRegex();
var Xe = g(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, ce).getRegex();
var ke = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Ve = g("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*?[ \\t]*/?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ke).replace("tag", he).replace("attribute", /[ \t]+[a-zA-Z:_][\w.:-]*(?:[ \t]*=[ \t]*"[^"\n]*"|[ \t]*=[ \t]*'[^'\n]*'|[ \t]*=[ \t]*[^\s"'=<>`]+)?/).getRegex();
var Ce = (l3) => g(de).replace("hr", V).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", l3).replace("html", J).getRegex();
var Je = Ce(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var Ye = Ce(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
var et = g(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/).replace("paragraph", Ye).getRegex();
var fe = { blockquote: et, code: Ne, def: Ke, fences: Fe, heading: Qe, hr: V, html: Ve, lheading: Le, list: Xe, newline: Ge, paragraph: Je, table: q, text: Ue };
var Pe = g("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", V).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", J).getRegex();
var tt = { ...fe, lheading: We, table: Pe, paragraph: g(de).replace("hr", V).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", Pe).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", J).getRegex() };
var nt = { ...fe, html: g(`^ *(?:comment(?: *\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1>(?: *\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?>(?: *\\n{2,}|\\s*$))`).replace("comment", ke).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: q, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: g(de).replace("hr", V).replace("heading", ` *#{1,6} *[^
]`).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").replace("lheading", Le).getRegex() };
var rt = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var st = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var Ie = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
var it = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var L = /[\p{P}\p{S}]/u;
var N = /[\s\p{P}\p{S}]/u;
var Y = /[^\s\p{P}\p{S}]/u;
var ot = g(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, N).getRegex();
var at = /[\p{Pi}\p{Ps}"']/u;
var Ae = /(?!~)[\p{P}\p{S}]/u;
var lt = /(?!~)[\s\p{P}\p{S}]/u;
var ut = /(?:[^\s\p{P}\p{S}]|~)/u;
var pt = g(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", _e ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var Ee = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var ct = g(Ee, "u").replace(/punct/g, L).getRegex();
var ht = g(Ee, "u").replace(/punct/g, Ae).getRegex();
var dt = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
var gt = g(dt, "u").replace(/openQuote/g, at).replace(/punct/g, L).getRegex();
var ze = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var kt = g(ze, "gu").replace(/notPunctSpace/g, Y).replace(/punctSpace/g, N).replace(/punct/g, L).getRegex();
var ft = g(ze, "gu").replace(/notPunctSpace/g, ut).replace(/punctSpace/g, lt).replace(/punct/g, Ae).getRegex();
var mt = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)";
var xt = g(mt, "gu").replace(/notPunctSpace/g, Y).replace(/punctSpace/g, N).replace(/punct/g, L).getRegex();
var bt = g("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, Y).replace(/punctSpace/g, N).replace(/punct/g, L).getRegex();
var Rt = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)";
var Tt = g(Rt, "gu").replace(/notPunctSpace/g, Y).replace(/punctSpace/g, N).replace(/punct/g, L).getRegex();
var Ot = g(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, L).getRegex();
var wt = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var Pt = g(wt, "gu").replace(/notPunctSpace/g, Y).replace(/punctSpace/g, N).replace(/punct/g, L).getRegex();
var yt = g(/\\(punct)/, "gu").replace(/punct/g, L).getRegex();
var St = g(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, "gu").replace(/punct/g, L).getRegex();
var _t = g(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var $t = g(ke).replace("(?:-->|$)", "-->").getRegex();
var Lt = g("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", $t).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var Me = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
var ie = g(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", Me).getRegex();
var Ct = g(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", ie).replace("href", /<(?:\\.|[^\n<>\\])*>|(?!<)[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/).getRegex();
var It = g(/^!?\[(label)\]\[(ref)\]/).replace("label", ie).replace("ref", ge).getRegex();
var At = g(/^!?\[(ref)\](?:\[\])?/).replace("ref", ge).getRegex();
var ye = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
var Et = g(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", Me).getRegex();
var zt = g("reflink|nolink(?!\\()", "g").replace("reflink", g(/^!?\[(label)\]\[(ref)\]/).replace("label", Et).replace("ref", ye).getRegex()).replace("nolink", g(/^!?\[(ref)\](?:\[\])?/).replace("ref", ye).getRegex()).getRegex();
var Se = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var Mt = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
var Bt = g(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, Mt).getRegex();
var me = { _backpedal: q, anyPunctuation: yt, anyPunctuationOutsideCode: St, autolink: _t, blockSkip: pt, br: Ie, code: st, del: q, delLDelim: q, delRDelim: q, emStrongLDelim: ct, emStrongRDelimAst: kt, emStrongRDelimUnd: bt, escape: rt, link: Ct, nolink: At, punctuation: ot, reflink: It, reflinkSearch: zt, tag: Lt, text: it, url: q };
var Dt = { ...me, emStrongLDelim: gt, emStrongRDelimAst: xt, emStrongRDelimUnd: Tt, link: g(/^!?\[(label)\]\((.*?)\)/).replace("label", ie).getRegex(), reflink: g(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", ie).getRegex() };
var pe = { ...me, emStrongRDelimAst: ft, emStrongLDelim: ht, delLDelim: Ot, delRDelim: Pt, url: g(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", Bt).replace("protocol", Se).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: g(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", Se).replace(/emailProtocol/g, /(?:mailto|xmpp):/).replace("wwwStart", _e ? "(?<![^\\s*_~(])www\\." : "www\\.").getRegex() };
var qt = { ...pe, br: g(Ie).replace("{2,}", "*").getRegex(), text: g(pe.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var ee = { normal: fe, gfm: tt, pedantic: nt };
var F = { normal: me, gfm: pe, breaks: qt, pedantic: Dt };
var vt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var Be = (l3) => vt[l3];
function y(l3, e) {
  if (e) {
    if (O.escapeTest.test(l3)) return l3.replace(O.escapeReplace, Be);
  } else if (O.escapeTestNoEncode.test(l3)) return l3.replace(O.escapeReplaceNoEncode, Be);
  return l3;
}
function De(l3) {
  return O.numericCharacterReference.test(l3) ? l3.replace(O.numericCharacterReferenceOrAmpersand, (e, t, n) => {
    if (t === void 0 && n === void 0) return "&amp;";
    let r = t === void 0 ? Number.parseInt(n, 16) : Number.parseInt(t, 10);
    return r === 0 || r > 1114111 || r >= 55296 && r <= 57343 ? "\uFFFD" : r === 38 ? "&amp;" : String.fromCodePoint(r);
  }) : l3;
}
function xe(l3) {
  try {
    l3 = encodeURI(l3).replace(O.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function be(l3, e) {
  let t = l3.replace(O.findPipe, (s, o, i) => {
    let a = false, c = o;
    for (; --c >= 0 && i[c] === "\\"; ) a = !a;
    return a ? "|" : " |";
  }), n = t.split(O.splitPipe), r = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; r < n.length; r++) n[r] = n[r].trim().replace(O.slashPipe, "|");
  return n;
}
function C(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let r = 0;
  for (; r < n; ) {
    let s = l3.charAt(n - r - 1);
    if (s === e && !t) r++;
    else if (s !== e && t) r++;
    else break;
  }
  return l3.slice(0, n - r);
}
function Re(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && O.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function W(l3) {
  return l3.trim().replace(O.multipleSpaceGlobal, " ").toLowerCase().toUpperCase().toLowerCase();
}
function Te(l3, e) {
  if (l3.indexOf(e[0]) === -1 && l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
var Q = /* @__PURE__ */ new WeakMap();
function Oe(l3) {
  let e = { "*": -1, _: -1 }, t = -1, n = l3.length;
  for (let r = 0; r < n; r++) {
    let s = l3[r];
    if (s !== "*" && s !== "_" && s !== "~") continue;
    let o = r === 0 ? `
` : l3[r - 1], i = r + 1;
    for (; i < n && l3[i] === s; ) i++;
    o !== " " && o !== "	" && o !== `
` && o !== "\r" && o !== "\f" && (s === "~" ? t = r : e[s] = r), r = i - 1;
  }
  return { maskedSrc: l3, lastPossibleEmStrongCloserIndex: e, lastPossibleDelCloserIndex: t };
}
function qe(l3, e) {
  let t = Oe(e), n = Q.get(l3);
  n ? n.push(t) : Q.set(l3, [t]);
}
function ve(l3) {
  let e = Q.get(l3);
  e && (e.pop(), e.length === 0 && Q.delete(l3));
}
function oe(l3, e, t) {
  let n = Q.get(l3)?.at(-1);
  return n && n.maskedSrc === e ? n.lastPossibleEmStrongCloserIndex[t] : Oe(e).lastPossibleEmStrongCloserIndex[t];
}
function ae(l3, e) {
  let t = Q.get(l3)?.at(-1);
  return t && t.maskedSrc === e ? t.lastPossibleDelCloserIndex : Oe(e).lastPossibleDelCloserIndex;
}
function te(l3, e = 0) {
  let t = e, n = "";
  for (let r of l3) if (r === "	") {
    let s = 4 - t % 4;
    n += " ".repeat(s), t += s;
  } else n += r, t++;
  return n;
}
function Ht(l3, e) {
  let t = "";
  for (let n = 0; n < l3.length; n++) {
    if (l3[n] === "`") {
      let r = e.inline.code.exec(l3.slice(n));
      if (r) {
        t += r[0], n += r[0].length - 1;
        continue;
      }
    }
    if (l3[n] === "\\" && (l3[n + 1] === "[" || l3[n + 1] === "]")) {
      t += l3[n + 1], n++;
      continue;
    }
    t += l3[n];
  }
  return t;
}
function He(l3, e, t, n, r) {
  let s = e.href, o = e.title || null, i = Ht(l3[1], r), a = l3[0].charAt(0) === "!", c = n.state.inLink, u = n.state.linkEmitted, d = n.state.inRawBlock;
  n.state.inLink = true, n.state.linkEmitted = false;
  let h = n.inlineTokens(i), p = n.state.linkEmitted;
  if (n.state.linkEmitted = u, n.state.inLink = c, !a) {
    if (p) {
      n.state.inRawBlock = d;
      return;
    }
    n.state.linkEmitted = true;
  }
  return { type: a ? "image" : "link", raw: t, href: s, title: o, text: i, tokens: h };
}
function Zt(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let r = n[1];
  return e.split(`
`).map((s) => {
    let o = s.match(t.other.beginningSpace);
    if (o === null) return s;
    let [i] = o;
    return s.slice(Math.min(i.length, r.length));
  }).join(`
`);
}
function Ze(l3, e, t, n) {
  if (!e.includes("<")) return false;
  for (let r = 0; r < e.length; r++) {
    if (e[r] === "\\") {
      r++;
      continue;
    }
    if (e[r] === "`") {
      let i = n.inline.code.exec(e.slice(r));
      if (i) {
        r += i[0].length - 1;
        continue;
      }
    }
    if (e[r] !== "<") continue;
    let s = l3.slice(t + r), o = n.inline.tag.exec(s) || n.inline.autolink.exec(s);
    if (o) {
      if (o[0].length > e.length - r) return true;
      r += o[0].length - 1;
    }
  }
  return false;
}
var _ = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || S;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : Re(t[0]), r = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: r };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], r = Zt(n, t[3] || "", this.rules);
      return t[3] !== void 0 && (r === "" || r.endsWith(`
`)) && (r += `
`), { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: r };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let r = C(n, "#");
        (this.options.pedantic || !r || this.rules.other.endingSpaceTabChar.test(r)) && (n = r.trim());
      }
      return { type: "heading", raw: C(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: C(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = C(t[0], `
`).split(`
`), r = "", s = "", o = [];
      for (; n.length > 0; ) {
        let i = false, a = [], c;
        for (c = 0; c < n.length; c++) if (this.rules.other.blockquoteStart.test(n[c])) a.push(n[c]), i = true;
        else if (!i) a.push(n[c]);
        else break;
        n = n.slice(c);
        let u = a.join(`
`), d = u.replace(this.rules.other.blockquoteMarkerWhitespace, (k, m, b) => b.startsWith(" ") ? m + " " + b.slice(1) : m + te(b, m.length)).replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        r = r ? `${r}
${u}` : u, s = s ? `${s}
${d}` : d;
        let h = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(d, o, true), this.lexer.state.top = h, n.length === 0) break;
        let p = o.at(-1);
        if (p?.type === "code" || p?.type === "heading" || p?.type === "hr" || p?.type === "html" || p?.type === "table") break;
        if (p?.type === "blockquote") {
          let k = p, m = n.join(`
`), b = k.raw + `
` + m.replace(this.rules.other.blockquoteSetextReplace2, ""), f = this.blockquote(b);
          o[o.length - 1] = f;
          let R = b.substring(f.raw.length).replace(/^\n/, ""), E = R ? R.split(`
`).length : 0, T = E ? n.slice(0, -E) : n;
          if (T.length > 0 && (r = `${r}
${T.join(`
`)}`), s = s.substring(0, s.length - k.text.length) + f.text, n = n.slice(T.length), n.length > 0 && this.rules.other.blockquoteStart.test(n[0])) continue;
          break;
        } else if (p?.type === "list") {
          let k = p, m = k.raw + `
` + n.join(`
`), b = this.list(m);
          o[o.length - 1] = b;
          let f = b.raw.length > k.raw.length ? m.slice(k.raw.length + 1, b.raw.length).split(`
`).length : 0;
          if (f > 0) {
            let R = n.slice(0, f).join(`
`);
            r = `${r}
${R}`, s = `${s}
${R}`;
          }
          if (n = n.slice(f), n.length > 0 && !this.rules.other.blockquoteStart.test(n[0])) break;
          continue;
        }
      }
      return { type: "blockquote", raw: r, tokens: o, text: s };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      if (!this.options.pedantic && this.lexer.state.lastToken?.type === "text" && !this.rules.other.listInterruptsParagraph.test(e)) return;
      let n = e, r = () => n.length - e.length, s = t[1].trim(), o = s.length > 1, i = { type: "list", raw: "", ordered: o, start: o ? +s.slice(0, -1) : "", loose: false, items: [] };
      s = o ? `\\d{1,9}\\${s.slice(-1)}` : `\\${s}`, this.options.pedantic && (s = o ? s : "[*+-]");
      let a = this.rules.other.listItemRegex(s), c = false;
      for (; e; ) {
        let h = false, p = "";
        if (!(t = a.exec(e)) || this.rules.block.hr.test(e)) break;
        let k = r();
        e = e.substring(t[0].length);
        let m = t[2].split(`
`, 1)[0], b = t[1].length, f = this.options.pedantic ? te(m, b) : m.replace(this.rules.other.leadingSpaceTab, (H) => te(H, b)), R = e.split(`
`, 1)[0], E = !f.trim(), T = 0;
        if (this.options.pedantic ? (T = 2, p = f.trimStart()) : E ? T = b + 1 : (T = f.search(this.rules.other.nonSpaceChar), T = T > 4 ? 1 : T, p = f.slice(T), T += b), E && this.rules.other.blankLine.test(R) && (e = e.substring(R.length + 1), h = true), !h) {
          let H = this.rules.other.nextBulletRegex(T), K = this.rules.other.hrRegex(T), re = this.rules.other.fencesBeginRegex(T), B = this.options.pedantic ? this.rules.other.pedanticHeadingBeginRegex(T) : this.rules.other.headingBeginRegex(T), X = this.rules.other.htmlBeginRegex(T), se = this.rules.other.blockquoteBeginRegex(T), le = false;
          for (; e; ) {
            let we = e.split(`
`, 1)[0], Z;
            if (R = we, this.options.pedantic ? (R = R.replace(this.rules.other.listReplaceNesting, "  "), Z = R) : Z = R.replace(this.rules.other.leadingSpaceTab, ($) => te($)), re.test(R) || B.test(R) || X.test(R) || se.test(R) || H.test(R) || K.test(R)) break;
            if (Z.search(this.rules.other.nonSpaceChar) >= T || !R.trim()) p += `
` + Z.slice(T), le = false;
            else {
              if (E) break;
              let $ = f;
              if (!this.options.pedantic && !p.includes(`
`) && !f.includes("	")) {
                let j;
                for (; !K.test($) && (j = this.rules.other.nestedBlockMarker.exec($)); ) $ = $.slice(j[0].length);
                if (!$.trim()) break;
              }
              if ($.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || re.test($) || B.test($) || X.test($) || K.test($)) break;
              if (!this.options.pedantic && !le) {
                let j = f.replace(this.rules.other.nestedContainerMarkers, "");
                if (this.rules.block.fences.test(j) || this.rules.block.heading.test(j) || this.rules.block.hr.test(j)) break;
              }
              let je = !this.options.pedantic && /^ {0,3}(?:=+|-+) *$/.test(R) && this.rules.block.lheading.test(`${f}
${R}`) ? `    ${Z.replace(/^ {0,3}/, "")}` : R;
              p += `
` + je, le = true;
            }
            E = !R.trim(), e = e.substring(we.length + 1), f = Z.slice(T);
          }
        }
        let U = n.slice(k, r());
        i.loose || (c ? i.loose = true : this.rules.other.doubleBlankLine.test(U) && (c = true)), i.items.push({ type: "list_item", raw: U, task: !!this.options.gfm && this.rules.other.listIsTask.test(p), loose: false, text: p, tokens: [] });
      }
      let u = i.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      i.raw = n.slice(0, r()).trimEnd();
      let d = [];
      for (let h of i.items) if (this.lexer.state.top = false, d.push(this.lexer.inlineQueue.length), h.tokens = this.lexer.blockTokens(h.text, []), !i.loose) {
        let p = h.tokens.filter((m) => m.type === "space"), k = p.length > 0 && p.some((m) => this.rules.other.anyLine.test(m.raw));
        i.loose = k;
      }
      for (let h = 0; h < i.items.length; h++) {
        let p = i.items[h], k = p.tokens[0];
        if (p.task && (k?.type === "text" || k?.type === "paragraph")) {
          p.text = p.text.replace(this.rules.other.listReplaceTask, ""), k.raw = k.raw.replace(this.rules.other.listReplaceTask, ""), k.text = k.text.replace(this.rules.other.listReplaceTask, "");
          let m = this.lexer.inlineQueue;
          for (let f = d[h]; f < m.length; f++) if (m[f].tokens === k.tokens) {
            m[f].src = m[f].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let b = this.rules.other.listTaskCheckbox.exec(p.raw);
          if (b) {
            let f = { type: "checkbox", raw: b[0] + " ", checked: b[0] !== "[ ]" };
            p.checked = f.checked, i.loose ? p.tokens[0] && ["paragraph", "text"].includes(p.tokens[0].type) && "tokens" in p.tokens[0] && p.tokens[0].tokens ? (p.tokens[0].raw = f.raw + p.tokens[0].raw, p.tokens[0].text = f.raw + p.tokens[0].text, p.tokens[0].tokens.unshift(f)) : p.tokens.unshift({ type: "paragraph", raw: f.raw, text: f.raw, tokens: [f] }) : p.tokens.unshift(f);
          }
        } else p.task && (p.task = false);
      }
      if (i.loose) for (let h of i.items) {
        h.loose = true;
        for (let p of h.tokens) p.type === "text" && (p.type = "paragraph");
      }
      return i;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      if (this.lexer.state.lastToken?.type === "paragraph" && !this.rules.other.htmlBeginRegex(4).test(e)) return;
      let n = Re(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      if (!this.rules.other.startAngleBracket.test(t[2]) && Te(t[2], "()") !== -1) return;
      let n = W(t[1]), r = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", s = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: C(t[0], `
`), href: r, title: s };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = be(t[1]), r = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], o = { type: "table", raw: C(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === r.length) {
      for (let i of r) this.rules.other.tableAlignRight.test(i) ? o.align.push("right") : this.rules.other.tableAlignCenter.test(i) ? o.align.push("center") : this.rules.other.tableAlignLeft.test(i) ? o.align.push("left") : o.align.push(null);
      for (let i = 0; i < n.length; i++) o.header.push({ text: n[i], tokens: this.lexer.inline(n[i]), header: true, align: o.align[i] });
      for (let i of s) o.rows.push(be(i, o.header.length).map((a, c) => ({ text: a, tokens: this.lexer.inline(a), header: false, align: o.align[c] })));
      return o;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: C(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    if (e.charCodeAt(0) !== 92) return;
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    if (e.charCodeAt(0) !== 60) return;
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    if (this.lexer.state.linkParenPossible === false) return;
    let t = e.charCodeAt(0);
    if (t !== 91 && t !== 33) return;
    let n = this.rules.inline.link.exec(e);
    if (n) {
      let r = n[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && Ze(e, n[1], r, this.rules)) return;
      let s = n[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(s)) {
        if (!this.rules.other.endAngleBracket.test(s)) return;
        let c = C(s.slice(0, -1), "\\");
        if ((s.length - c.length) % 2 === 0) return;
      } else {
        let c = Te(n[2], "()");
        if (c === -2) return;
        if (c > -1) {
          let d = (n[0].indexOf("!") === 0 ? 5 : 4) + n[1].length + c;
          n[2] = n[2].substring(0, c), n[0] = n[0].substring(0, d).trim(), n[3] = "";
        }
      }
      let o = C(n[0].slice(0, -1), "\\");
      if ((n[0].length - o.length) % 2 === 0) return;
      let i = n[2], a = "";
      if (this.options.pedantic) {
        let c = this.rules.other.pedanticHrefTitle.exec(i);
        c && (i = c[1], a = c[3]);
      } else a = n[3] ? n[3].slice(1, -1) : "";
      return i = i.trim(), this.rules.other.startAngleBracket.test(i) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(s) ? i = i.slice(1) : i = i.slice(1, -1)), He(n, { href: i && i.replace(this.rules.inline.anyPunctuation, "$1"), title: a && a.replace(this.rules.inline.anyPunctuation, "$1") }, n[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n = e.charCodeAt(0);
    if (n !== 91 && n !== 33) return;
    let r;
    if ((r = this.rules.inline.reflink.exec(e)) || (r = this.rules.inline.nolink.exec(e))) {
      let s = r[0].charAt(0) === "!" ? 2 : 1;
      if (!this.options.pedantic && Ze(e, r[1], s, this.rules)) return;
      let o = t[W(r[2] || r[1])];
      if (!o) {
        let i = r[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return He(r, o, r[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let r = this.rules.inline.emStrongLDelim.exec(e);
    if (!r || !r[1] && !r[2] && !r[3] && !r[4]) return;
    let s = r[0][0], o = n === s, i = t.length - e.length, a = i;
    for (; !this.options.pedantic && a > 0 && t[a - 1] === s; ) a--;
    let c = [...t.slice(Math.max(0, a - 2), a)].at(-1) ?? "", u = c === "*" || c === "_" || !!this.rules.inline.punctuation.exec(c);
    a < i && (n = c);
    let d = a < i ? u : n === "*" || n === "_" || !!this.rules.inline.punctuation.exec(n);
    if (r[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    let h = r[1] || r[3] || "";
    if (!h || !n || d) {
      let p = [...r[0]].length - 1, k, m, b = p, f = 0, R = i - a + p, E = !this.options.pedantic && !!c.trim() && (!!h || s === "*" && !u);
      if (s !== "*" && s !== "_") return;
      let T = s === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd, U = oe(this, t, s), H = t.length - e.length + p;
      if (U < H) return;
      t = t.slice(-1 * e.length + p);
      let K = U - H;
      for (T.lastIndex = 0; (r = T.exec(t)) !== null && !(r.index > K); ) {
        if (k = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !k) continue;
        if (m = [...k].length, r[3] || r[4]) {
          b += m;
          continue;
        } else if ((r[5] || r[6] || E) && R % 3 && !((R + m) % 3)) {
          if (o && (r[5] || r[6])) break;
          f += m;
          continue;
        }
        if (b -= m, b > 0) continue;
        m = Math.min(m, m + b + f);
        let re = [...r[0]][0].length, B = e.slice(0, p + r.index + re + m);
        if (Math.min(p, m) % 2) {
          let se = B.slice(1, -1);
          return { type: "em", raw: B, text: se, tokens: this.lexer.inlineTokens(se) };
        }
        let X = B.slice(2, -2);
        return { type: "strong", raw: B, text: X, tokens: this.lexer.inlineTokens(X) };
      }
    }
  }
  codespan(e) {
    if (e.charCodeAt(0) !== 96) return;
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), r = this.rules.other.nonSpaceChar.test(n), s = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return r && s && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = e.charCodeAt(0);
    if (t !== 32 && t !== 92 && t !== 10) return;
    let n = this.rules.inline.br.exec(e);
    if (n) return { type: "br", raw: n[0] };
  }
  del(e, t, n = "") {
    if (e.charCodeAt(0) !== 126) return;
    let r = this.rules.inline.delLDelim.exec(e);
    if (!r) return;
    if (!(r[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let o = [...r[0]].length - 1, i, a, c = o, u = this.rules.inline.delRDelim, d = ae(this, t), h = t.length - e.length + o;
      if (d < h) return;
      t = t.slice(-1 * e.length + o);
      let p = d - h;
      for (u.lastIndex = 0; (r = u.exec(t)) !== null && !(r.index > p); ) {
        if (i = r[1] || r[2] || r[3] || r[4] || r[5] || r[6], !i || (a = [...i].length, a !== o)) continue;
        if (r[3] || r[4]) {
          c += a;
          continue;
        }
        if (c -= a, c > 0) continue;
        a = Math.min(a, a + c);
        let k = [...r[0]][0].length, m = e.slice(0, o + r.index + k + a), b = m.slice(o, -o);
        return { type: "del", raw: m, text: b, tokens: this.lexer.inlineTokens(b) };
      }
    }
  }
  autolink(e) {
    if (e.charCodeAt(0) !== 60) return;
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, r;
      return t[2] === "@" ? (n = t[1], r = "mailto:" + n) : (n = t[1], r = n), { type: "link", raw: t[0], text: n, href: r, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, r;
      if (t[2] === "@") n = t[0], r = "mailto:" + n;
      else {
        let s;
        do
          s = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (s !== t[0]);
        n = t[0], t[1] === "www." ? r = "http://" + t[0] : r = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: r, autolink: true, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: n ? t[0] : De(t[0]), escaped: n };
    }
  }
};
var w = class l {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || S, this.options.tokenizer = this.options.tokenizer || new _(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true };
    let t = { other: O, block: ee.normal, inline: F.normal };
    this.options.pedantic ? (t.block = ee.pedantic, t.inline = F.pedantic) : this.options.gfm && (t.block = ee.gfm, this.options.breaks ? t.inline = F.breaks : t.inline = F.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: ee, inline: F };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(O.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.state.inRawBlock = false, this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this;
    let r = this.state.lastToken;
    this.options.pedantic && (e = e.replace(O.tabCharGlobal, "    ").replace(O.spaceLine, ""));
    let s = 1 / 0, o, i = this.options.gfm && !this.options.pedantic && this.tokenizer.paragraph === _.prototype.paragraph;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      this.state.lastToken = t.at(-1);
      let a;
      if (this.options.extensions?.block?.some((u) => (a = u.call({ lexer: this }, e, t)) ? (e = e.substring(a.raw.length), t.push(a), true) : false)) continue;
      if (a = this.tokenizer.space(e)) {
        e = e.substring(a.raw.length);
        let u = t.at(-1);
        a.raw.length === 1 && u !== void 0 ? u.raw += `
` : t.push(a);
        continue;
      }
      if (a = this.tokenizer.code(e)) {
        e = e.substring(a.raw.length);
        let u = t.at(-1);
        u?.type === "paragraph" || u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + a.raw, u.text += `
` + a.text, this.inlineQueue.at(-1).src = u.text) : t.push(a);
        continue;
      }
      if (a = this.tokenizer.fences(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.heading(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.hr(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.blockquote(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.list(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.html(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.def(e)) {
        e = e.substring(a.raw.length);
        let u = t.at(-1);
        u?.type === "paragraph" || u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + a.raw, u.text += `
` + a.raw, this.inlineQueue.at(-1).src = u.text) : (this.tokens.links[a.tag] || (this.tokens.links[a.tag] = { href: a.href, title: a.title }), t.push(a));
        continue;
      }
      if (a = this.tokenizer.table(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.lheading(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      let c = e;
      if (this.options.extensions?.startBlock) {
        let u = 1 / 0, d = e.slice(1), h;
        this.options.extensions.startBlock.forEach((p) => {
          h = p.call({ lexer: this }, d), typeof h == "number" && h >= 0 && (u = Math.min(u, h));
        }), u < 1 / 0 && u >= 0 && (c = e.substring(0, u + 1));
      }
      if (this.state.top && (a = this.tokenizer.paragraph(c))) {
        let u = t.at(-1);
        (n || u === o && i) && u?.type === "paragraph" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + a.raw, u.text += `
` + a.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = u.text, o = u) : (t.push(a), o = a), n = c.length !== e.length, e = e.substring(a.raw.length);
        continue;
      }
      if (a = this.tokenizer.text(e)) {
        e = e.substring(a.raw.length);
        let u = t.at(-1);
        u?.type === "text" ? (u.raw += (u.raw.endsWith(`
`) ? "" : `
`) + a.raw, u.text += `
` + a.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = u.text) : t.push(a);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, this.state.lastToken = r, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  linkInText(e) {
    if (!e.includes("[")) return false;
    let t = this.tokenizer.rules.inline.link;
    for (let n of e.matchAll(this.tokenizer.rules.inline.blockSkip)) if (t.test(n[0]) && e.charAt(n.index - 1) !== "!") return true;
    for (let n of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      let r = n[0], s = r.lastIndexOf("[");
      if (!(r.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, W(r.slice(s + 1, -1)))) && !(s > 1 && this.linkInText(r.slice(1, s - 1)))) return true;
    }
    return false;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = this.state.linkParenPossible;
    this.state.linkParenPossible = e.includes(")");
    try {
      return this.#t(e, t);
    } finally {
      this.state.linkParenPossible = n;
    }
  }
  #t(e, t) {
    let n = e.includes("*") || e.includes("_") || e.includes("~"), r = n || this.options.hooks?.emStrongMask || this.tokenizer.emStrong !== _.prototype.emStrong || this.tokenizer.del !== _.prototype.del ? this.#r(e) : e;
    if (!n) return this.#e(e, r, t);
    qe(this.tokenizer, r);
    try {
      return this.#e(e, r, t);
    } finally {
      ve(this.tokenizer);
    }
  }
  #e(e, t, n) {
    let r = false, s = "", o = 1 / 0;
    for (; e; ) {
      if (e.length < o) o = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      r || (s = ""), r = false;
      let i;
      if (this.options.extensions?.inline?.some((u) => (i = u.call({ lexer: this }, e, n)) ? (e = e.substring(i.raw.length), n.push(i), true) : false)) continue;
      if (i = this.tokenizer.escape(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.tag(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.link(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(i.raw.length);
        let u = n.at(-1);
        i.type === "text" && u?.type === "text" ? (u.raw += i.raw, u.text += i.text) : n.push(i);
        continue;
      }
      let a = e[0];
      if (a === "*" || a === "_") {
        let u = t.length - e.length;
        if (oe(this.tokenizer, t, a) <= u) {
          let h = 1;
          for (; h < e.length && e.charCodeAt(h) === a.charCodeAt(0); ) h++;
          let p = e.substring(0, h), k = n.at(-1);
          k?.type === "text" && !k.escaped ? (k.raw += p, k.text += p) : n.push({ type: "text", raw: p, text: p, escaped: false }), e = e.substring(h), s = a, r = true;
          continue;
        }
      } else if (a === "~") {
        let u = t.length - e.length;
        if (ae(this.tokenizer, t) <= u) {
          let h = 1;
          for (; h < e.length && e.charCodeAt(h) === 126; ) h++;
          let p = e.substring(0, h), k = n.at(-1);
          k?.type === "text" && !k.escaped ? (k.raw += p, k.text += p) : n.push({ type: "text", raw: p, text: p, escaped: false }), e = e.substring(h), s = a, r = true;
          continue;
        }
      }
      if (i = this.tokenizer.emStrong(e, t, s)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.codespan(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.br(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.del(e, t, s)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (i = this.tokenizer.autolink(e)) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      if (!this.state.inLink && (i = this.tokenizer.url(e))) {
        e = e.substring(i.raw.length), n.push(i);
        continue;
      }
      let c = e;
      if (this.options.extensions?.startInline) {
        let u = 1 / 0, d = e.slice(1), h;
        this.options.extensions.startInline.forEach((p) => {
          h = p.call({ lexer: this }, d), typeof h == "number" && h >= 0 && (u = Math.min(u, h));
        }), u < 1 / 0 && u >= 0 && (c = e.substring(0, u + 1));
      }
      if (i = this.tokenizer.inlineText(c)) {
        e = e.substring(i.raw.length), i.raw.slice(-1) !== "_" && (s = i.raw.slice(-1)), r = true;
        let u = n.at(-1);
        u?.type === "text" ? (u.raw += i.raw, u.text += i.text) : n.push(i);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return n;
  }
  #n(e) {
    let { blockSkip: t, tag: n, autolink: r } = this.tokenizer.rules.inline, s = "", o = 0, i;
    for (t.lastIndex = 0; i = t.exec(e); ) {
      let a = i.index + (i[2] ? i[2].length : 0), c = i.index + i[0].length;
      if (e.charAt(a) === "<") {
        let u = e.slice(a), d = n.exec(u) || r.exec(u);
        if (!d) {
          t.lastIndex = a + 1;
          continue;
        }
        c = a + d[0].length, t.lastIndex = c;
      }
      s += e.slice(o, a) + "[" + "a".repeat(c - a - 2) + "]", o = c;
    }
    return s + e.slice(o);
  }
  #r(e) {
    let t = e;
    if (this.tokens.links && e.includes("[")) {
      let n = this.tokenizer.rules.inline.reflinkSearch, r = (s) => {
        let o = s.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, W(s.slice(o + 1, -1)))) return s;
        if (o > 1 && s.charAt(0) !== "!") {
          let i = s.slice(1, o - 1);
          if (this.linkInText(i)) return "[" + i.replace(n, r) + "][" + "a".repeat(s.length - o - 2) + "]";
        }
        return "[" + "a".repeat(s.length - 2) + "]";
      };
      t = t.replace(n, r);
    }
    return t = t.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (n, r, s) => s ? "+".repeat(n.length) : r ? r + n.slice(r.length, -r.length).replace(/`/g, "+") + r : n), t = this.#n(t), t = this.options.hooks?.emStrongMask?.call({ lexer: this }, t) ?? t, t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var I = class {
  options;
  parser;
  constructor(e) {
    this.options = e || S;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let r = (t || "").match(O.notSpaceStart)?.[0], s = e ? e.replace(O.endingNewline, "") + `
` : "";
    return r ? '<pre><code class="language-' + y(r) + '">' + (n ? s : y(s, true)) + `</code></pre>
` : "<pre><code>" + (n ? s : y(s, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, r = "";
    for (let i = 0; i < e.items.length; i++) {
      let a = e.items[i];
      r += this.listitem(a);
    }
    let s = t ? "ol" : "ul", o = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + s + o + `>
` + r + "</" + s + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let s = 0; s < e.header.length; s++) n += this.tablecell(e.header[s]);
    t += this.tablerow({ text: n });
    let r = "";
    for (let s = 0; s < e.rows.length; s++) {
      let o = e.rows[s];
      n = "";
      for (let i = 0; i < o.length; i++) n += this.tablecell(o[i]);
      r += this.tablerow({ text: n });
    }
    return r && (r = `<tbody>${r}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + r + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${y(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, text: n, tokens: r, autolink: s }) {
    let o = s ? y(n, true) : this.parser.parseInline(r), i = xe(e);
    if (i === null) return o;
    e = y(i, s);
    let a = '<a href="' + e + '"';
    return t && (a += ' title="' + y(t) + '"'), a += ">" + o + "</a>", a;
  }
  image({ href: e, title: t, text: n, tokens: r }) {
    r && (n = this.parser.parseInline(r, this.parser.textRenderer));
    let s = xe(e);
    if (s === null) return y(n);
    e = s;
    let o = `<img src="${y(e)}" alt="${y(n)}"`;
    return t && (o += ` title="${y(t)}"`), o += ">", o;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : y(e.text);
  }
};
var z = class {
  parser;
  strong({ text: e, tokens: t }) {
    return t ? this.parser.parseInline(t, this) : e;
  }
  em({ text: e, tokens: t }) {
    return t ? this.parser.parseInline(t, this) : e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e, tokens: t }) {
    return t ? this.parser.parseInline(t, this) : e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e, tokens: t }) {
    return t ? this.parser.parseInline(t, this) : e;
  }
  image({ text: e, tokens: t }) {
    return t ? this.parser.parseInline(t, this) : e;
  }
  br() {
    return `
`;
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var P = class l2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || S, this.options.renderer = this.options.renderer || new I(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new z(), this.textRenderer.parser = this;
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let r = e[n];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = r, i = this.options.extensions.renderers[o.type].call({ parser: this }, o);
        if (i !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(o.type)) {
          t += i === false ? "" : i ?? "";
          continue;
        }
      }
      let s = r;
      switch (s.type) {
        case "space": {
          t += this.renderer.space(s);
          break;
        }
        case "hr": {
          t += this.renderer.hr(s);
          break;
        }
        case "heading": {
          t += this.renderer.heading(s);
          break;
        }
        case "code": {
          t += this.renderer.code(s);
          break;
        }
        case "table": {
          t += this.renderer.table(s);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(s);
          break;
        }
        case "list": {
          t += this.renderer.list(s);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(s);
          break;
        }
        case "html": {
          t += this.renderer.html(s);
          break;
        }
        case "def": {
          t += this.renderer.def(s);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(s);
          break;
        }
        case "text": {
          t += this.renderer.text(s);
          break;
        }
        default: {
          let o = 'Token with "' + s.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let r = 0; r < e.length; r++) {
      let s = e[r];
      if (this.options.extensions?.renderers?.[s.type]) {
        let i = this.options.extensions.renderers[s.type].call({ parser: this }, s);
        if (i !== false || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(s.type)) {
          n += i === false ? "" : i ?? "";
          continue;
        }
      }
      let o = s;
      switch (o.type) {
        case "escape": {
          n += t.text(o);
          break;
        }
        case "html": {
          n += t.html(o);
          break;
        }
        case "link": {
          n += t.link(o);
          break;
        }
        case "image": {
          n += t.image(o);
          break;
        }
        case "checkbox": {
          n += t.checkbox(o);
          break;
        }
        case "strong": {
          n += t.strong(o);
          break;
        }
        case "em": {
          n += t.em(o);
          break;
        }
        case "codespan": {
          n += t.codespan(o);
          break;
        }
        case "br": {
          n += t.br(o);
          break;
        }
        case "del": {
          n += t.del(o);
          break;
        }
        case "text": {
          n += t.text(o);
          break;
        }
        default: {
          let i = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return n;
  }
};
var A = class {
  options;
  block;
  constructor(e) {
    this.options = e || S;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? w.lex : w.lexInline;
  }
  provideParser(e = this.block) {
    return e ? P.parse : P.parseInline;
  }
};
function M(l3, e) {
  if (Array.isArray(e)) for (let t = 0; t < e.length; t++) l3.push(e[t]);
  else l3.push(e);
}
var ne = class {
  defaults = G();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = P;
  Renderer = I;
  TextRenderer = z;
  Lexer = w;
  Tokenizer = _;
  Hooks = A;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let r of e) switch (M(n, t.call(this, r)), r.type) {
      case "table": {
        let s = r;
        for (let o of s.header) M(n, this.walkTokens(o.tokens, t));
        for (let o of s.rows) for (let i of o) M(n, this.walkTokens(i.tokens, t));
        break;
      }
      case "list": {
        let s = r;
        M(n, this.walkTokens(s.items, t));
        break;
      }
      default: {
        let s = r;
        this.defaults.extensions?.childTokens?.[s.type] ? this.defaults.extensions.childTokens[s.type].forEach((o) => {
          let i = s[o].flat(1 / 0);
          M(n, this.walkTokens(i, t));
        }) : s.tokens && M(n, this.walkTokens(s.tokens, t));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: /* @__PURE__ */ Object.create(null), childTokens: /* @__PURE__ */ Object.create(null) };
    return e.forEach((n) => {
      let r = { ...n };
      if (r.async = this.defaults.async || r.async || false, n.extensions && (n.extensions.forEach((s) => {
        if (!s.name) throw new Error("extension name required");
        if ("renderer" in s) {
          let o = t.renderers[s.name];
          o ? t.renderers[s.name] = function(...i) {
            let a = s.renderer.apply(this, i);
            return a === false && (a = o.apply(this, i)), a;
          } : t.renderers[s.name] = s.renderer;
        }
        if ("tokenizer" in s) {
          if (!s.level || s.level !== "block" && s.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let o = t[s.level];
          o ? o.unshift(s.tokenizer) : t[s.level] = [s.tokenizer], s.start && (s.level === "block" ? t.startBlock ? t.startBlock.push(s.start) : t.startBlock = [s.start] : s.level === "inline" && (t.startInline ? t.startInline.push(s.start) : t.startInline = [s.start]));
        }
        "childTokens" in s && s.childTokens && (t.childTokens[s.name] = s.childTokens);
      }), r.extensions = t), n.renderer) {
        let s = this.defaults.renderer || new I(this.defaults);
        for (let o in n.renderer) {
          if (!(o in s)) throw new Error(`renderer '${o}' does not exist`);
          if (["options", "parser"].includes(o)) continue;
          let i = o, a = n.renderer[i], c = s[i];
          s[i] = (...u) => {
            let d = a.apply(s, u);
            return d === false && (d = c.apply(s, u)), d === false ? "" : d ?? "";
          };
        }
        r.renderer = s;
      }
      if (n.tokenizer) {
        let s = this.defaults.tokenizer || new _(this.defaults);
        for (let o in n.tokenizer) {
          if (!(o in s)) throw new Error(`tokenizer '${o}' does not exist`);
          if (["options", "rules", "lexer"].includes(o)) continue;
          let i = o, a = n.tokenizer[i], c = s[i];
          s[i] = (...u) => {
            let d = a.apply(s, u);
            return d === false && (d = c.apply(s, u)), d;
          };
        }
        r.tokenizer = s;
      }
      if (n.hooks) {
        let s = this.defaults.hooks || new A();
        for (let o in n.hooks) {
          if (!(o in s)) throw new Error(`hook '${o}' does not exist`);
          if (["options", "block"].includes(o)) continue;
          let i = o, a = n.hooks[i], c = s[i];
          A.passThroughHooks.has(o) ? s[i] = (u) => {
            if (s.options.async && A.passThroughHooksRespectAsync.has(o)) return (async () => {
              let h = await a.call(s, u);
              return c.call(s, h);
            })();
            let d = a.call(s, u);
            return c.call(s, d);
          } : s[i] = (...u) => {
            if (s.options.async) return (async () => {
              let h = await a.apply(s, u);
              return h === false && (h = await c.apply(s, u)), h;
            })();
            let d = a.apply(s, u);
            return d === false && (d = c.apply(s, u)), d;
          };
        }
        r.hooks = s;
      }
      if (n.walkTokens) {
        let s = this.defaults.walkTokens, o = n.walkTokens;
        r.walkTokens = function(i) {
          let a = [];
          return M(a, o.call(this, i)), s && M(a, s.call(this, i)), a;
        };
      }
      this.defaults = { ...this.defaults, ...r };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return w.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return P.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, r) => {
      let s = { ...r }, o = { ...this.defaults, ...s }, i = this.onError(!!o.silent, !!o.async);
      if (this.defaults.async === true && s.async === false) return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return i(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return i(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (o.hooks && (o.hooks.options = o, o.hooks.block = e), o.async) return (async () => {
        let a = o.hooks ? await o.hooks.preprocess(n) : n, u = await (o.hooks ? await o.hooks.provideLexer(e) : e ? w.lex : w.lexInline)(a, o), d = o.hooks ? await o.hooks.processAllTokens(u) : u;
        o.walkTokens && await Promise.all(this.walkTokens(d, o.walkTokens));
        let p = await (o.hooks ? await o.hooks.provideParser(e) : e ? P.parse : P.parseInline)(d, o);
        return o.hooks ? await o.hooks.postprocess(p) : p;
      })().catch(i);
      try {
        o.hooks && (n = o.hooks.preprocess(n));
        let c = (o.hooks ? o.hooks.provideLexer(e) : e ? w.lex : w.lexInline)(n, o);
        o.hooks && (c = o.hooks.processAllTokens(c)), o.walkTokens && this.walkTokens(c, o.walkTokens);
        let d = (o.hooks ? o.hooks.provideParser(e) : e ? P.parse : P.parseInline)(c, o);
        return o.hooks && (d = o.hooks.postprocess(d)), d;
      } catch (a) {
        return i(a);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let r = "<p>An error occurred:</p><pre>" + y(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(r) : r;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var v = new ne();
function x(l3, e) {
  return v.parse(l3, e);
}
x.options = x.setOptions = function(l3) {
  return v.setOptions(l3), x.defaults = v.defaults, ue(x.defaults), x;
};
x.getDefaults = G;
x.defaults = S;
function jt(...l3) {
  return v.use(...l3), x.defaults = v.defaults, ue(x.defaults), x;
}
x.use = jt;
x.walkTokens = function(l3, e) {
  return v.walkTokens(l3, e);
};
x.parseInline = v.parseInline;
x.Parser = P;
x.parser = P.parse;
x.Renderer = I;
x.TextRenderer = z;
x.Lexer = w;
x.lexer = w.lex;
x.Tokenizer = _;
x.Hooks = A;
x.parse = x;
var En = x.options;
var zn = x.setOptions;
var Mn = x.walkTokens;
var Bn = x.parseInline;
var qn = P.parse;
var vn = w.lex;

// src/engine/middleware.js
var graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
function graphemeCount(text) {
  if (graphemeSegmenter) {
    let count = 0;
    for (const _2 of graphemeSegmenter.segment(text)) count += 1;
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
      if (this.errorText) {
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
   */
  constructor(matchInfo, sequence) {
    this.matchInfo = matchInfo;
    this.sequence = sequence;
  }
  next(event, dispatch) {
    switch (event.type) {
      case EventType.Rendered:
      case EventType.ImageResolved: {
        dispatch(causedBy(event.sourceId, EventType.MatchInjected));
        dispatch(causedBy(event.sourceId, EventType.DiscardPrevious, {
          minimumSourceId: this.sequence.getNextId()
        }));
        if (event.type === EventType.ImageResolved) {
          return causedBy(event.sourceId, EventType.ImageInject, { imagePath: event.imagePath });
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
function removeParagraphTagIfSingleOccurrence(html) {
  const count = html.split("<p>").length - 1;
  if (count > 1) return html;
  let out = html;
  while (out.startsWith("<p>")) out = out.slice(3);
  while (out.endsWith("</p>")) out = out.slice(0, -4);
  return out;
}
function markdownToHtml(markdown) {
  const html = x.parse(markdown, { async: false }).trim();
  return removeParagraphTagIfSingleOccurrence(html);
}
var MarkdownMiddleware = class {
  name = "markdown";
  next(event) {
    if (event.type !== EventType.MarkdownInject) return event;
    return causedBy(event.sourceId, EventType.HtmlInject, { html: markdownToHtml(event.markdown) });
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
   * @param {(error: Error) => void} [options.onError]
   */
  constructor(options) {
    this.options = options;
    this.injector = options.injector ?? nullInjector;
    this.listeners = /* @__PURE__ */ new Map();
    this.queue = Promise.resolve();
    this.lastSourceId = 0;
    this.onError = options.onError ?? ((error) => console.error("[espanso]", error));
    this.configManager = new ConfigManager(options.configStore, options.matchStore, options.getAppInfo);
    this.renderer = new Renderer([
      createEchoExtension(),
      createRandomExtension(),
      createDateExtension(options.dateOptions),
      createChoiceExtension(options.choiceSelector),
      createFormExtension(options.formProvider),
      createClipboardExtension(options.clipboardProvider),
      createUnsupportedExtension("shell"),
      createUnsupportedExtension("script"),
      ...options.extensions ?? []
    ]);
    this.renderer.logger = { error: (msg) => this.onError(new Error(msg)) };
    this.rendererAdapter = new RendererAdapter(this.configManager, this.renderer);
    const defaultConfig = this.configManager.default();
    const { rolling, regex } = convertMatches(this.configManager.allMatches);
    this.matchers = [
      new RollingMatcher(rolling, { charWordSeparators: defaultConfig.wordSeparators }),
      new RegexMatcher(regex, {
        maxBufferSize: defaultConfig.maxRegexBufferSize,
        onError: (error) => this.onError(error)
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
        onError: (error) => this.onError(error),
        errorText: options.renderingErrorText
      }),
      new ImageResolverMiddleware(options.configDir ?? ""),
      new CursorHintMiddleware(),
      new UndoMiddleware(() => this.configManager.default().undoBackspace),
      new ActionMiddleware(this.configManager, sequence),
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
  on(type2, listener) {
    if (!this.listeners.has(type2)) this.listeners.set(type2, /* @__PURE__ */ new Set());
    this.listeners.get(type2).add(listener);
    return () => this.off(type2, listener);
  }
  off(type2, listener) {
    this.listeners.get(type2)?.delete(listener);
  }
  emit(type2, event) {
    for (const listener of this.listeners.get(type2) ?? []) {
      try {
        listener(event);
      } catch (error) {
        this.onError(error);
      }
    }
  }
  enqueue(event) {
    const run = this.queue.then(async () => {
      const produced = await this.processor.process(event);
      for (const e of produced) await this.dispatch(e);
      return produced;
    });
    this.queue = run.catch((error) => this.onError(error));
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
      this.onError(error);
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

// src/core.js
function createEngine(options = {}) {
  const files = { ...options.files instanceof Map ? Object.fromEntries(options.files) : options.files };
  if (options.yaml != null) files["match/base.yml"] = options.yaml;
  const vfs = new VirtualFS(files);
  const configDir = options.configDir ?? "config";
  const errors = [];
  const { store: configStore, errors: configErrors } = ConfigStore.load(vfs, configDir);
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
    const type2 = (el.getAttribute("type") || "").toLowerCase();
    if (TEXT_INPUT_TYPES.has(type2)) return "input";
    if (type2 === "password" && includePasswordFields) return "input";
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
function htmlToText(html, doc) {
  if (doc?.createElement) {
    const container = doc.createElement("div");
    container.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "$&\n");
    return container.textContent.replace(/\n+$/, "");
  }
  return html.replace(/<[^>]*>/g, "");
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
      if (editableKind(el, this.editableOptions) === "contenteditable") this.insertHtml(el, html);
      else this.insertText(el, htmlToText(html, this.doc));
    });
  }
  injectImage(path) {
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
  replaceRange(el, text, start, end, inputType) {
    if (typeof el.setRangeText === "function" && el.selectionStart != null) {
      el.setRangeText(text, start, end, "end");
    } else {
      el.value = el.value.slice(0, start) + text + el.value.slice(end);
    }
    this.fireInput(el, inputType, text || null);
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
  const editableOptions = { includePasswordFields: options.includePasswordFields ?? false };
  const shouldHandle = options.shouldHandle ?? (() => true);
  let lastTarget = null;
  const injector = options.injector ?? new DomInjector({ doc, getTarget: () => lastTarget, editableOptions });
  injector.editableOptions = editableOptions;
  engine.injector = injector;
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
  const listeners = [
    ["input", onInput],
    ["compositionend", onCompositionEnd],
    ["keydown", onKeyDown],
    ["keyup", onKeyUp],
    ["mousedown", onPointerDown],
    ["focusin", onFocusIn]
  ];
  for (const [type2, fn] of listeners) root.addEventListener(type2, fn, true);
  return {
    injector,
    detach() {
      for (const [type2, fn] of listeners) root.removeEventListener(type2, fn, true);
      if (engine.injector === injector) engine.injector = nullInjector;
    }
  };
}
function browserAppInfo() {
  if (typeof document === "undefined") return {};
  return {
    title: document.title,
    url: typeof location !== "undefined" ? location.href : void 0
  };
}

// src/index.js
function createEspanso(options = {}) {
  const { engine, errors } = createEngine({ getAppInfo: browserAppInfo, ...options });
  let attachment = null;
  return {
    engine,
    errors,
    attach(attachOptions = {}) {
      attachment?.detach();
      attachment = attach(engine, attachOptions);
      return this;
    },
    detach() {
      attachment?.detach();
      attachment = null;
      return this;
    },
    expand: (trigger, args) => engine.expand(trigger, args),
    exec: (trigger, execOptions) => engine.exec(trigger, execOptions),
    enable: () => engine.enable(),
    disable: () => engine.disable(),
    toggle: () => engine.toggle(),
    on: (type2, listener) => engine.on(type2, listener)
  };
}
async function fetchFiles(urls, fetchImpl = globalThis.fetch) {
  const entries = await Promise.all(
    Object.entries(urls).map(async ([path, url]) => {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`unable to fetch ${url}: HTTP ${response.status}`);
      return [path, await response.text()];
    })
  );
  return Object.fromEntries(entries);
}
export {
  CasingStyle,
  ConfigStore,
  DEFAULT_WORD_SEPARATORS,
  DomInjector,
  Engine,
  EventType,
  Key,
  MatchStore,
  RegexMatcher,
  RenderAbortedError,
  Renderer,
  ResolvedConfig,
  RollingMatcher,
  Status,
  VirtualFS,
  attach,
  browserAppInfo,
  compileRegex,
  convertMatch,
  convertMatchGroup,
  convertVariable,
  createChoiceExtension,
  createClipboardExtension,
  createDateExtension,
  createEchoExtension,
  createEngine,
  createEspanso,
  createFormExtension,
  createRandomExtension,
  deepActiveElement,
  editableKind,
  fetchFiles,
  getFormControls,
  lenientFlowQuote,
  markdownToHtml,
  normalizePath,
  nullInjector,
  parseChoices,
  parseYaml,
  rollingMatchFromString,
  strftime
};
//# sourceMappingURL=espanso.esm.js.map
