/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-config/src/matches/group/loader/yaml/{mod,parse,util}.rs
 * and espanso-config/src/matches/group/path.rs
 *
 * Match model (plain objects):
 *
 *   Match = {
 *     id: number,
 *     cause: { type: 'none' }
 *          | { type: 'trigger', triggers: string[], leftWord, rightWord,
 *              propagateCase, uppercaseStyle: 'uppercase'|'capitalize'|'capitalize_words' }
 *          | { type: 'regex', regex: string },
 *     effect: { type: 'none' }
 *           | { type: 'text', replace: string, vars: Variable[],
 *               format: 'plain'|'markdown'|'html', forceMode: null|'keys'|'clipboard' }
 *           | { type: 'image', path: string },
 *     label: string|null,
 *     searchTerms: string[],
 *   }
 *
 *   Variable = { id, name, type, params: object, injectVars: boolean, dependsOn: string[] }
 */

import { parseYaml } from '../config/yaml.js';
import { dirname, resolvePath } from '../config/vfs.js';
import { nextId } from './counter.js';

const FORM_CONTROL_REGEX = /\[\[\s*(\w+)(\.\w+)?\s*\]\]/g;

/**
 * Load a single match group (a YAML match file).
 * @returns {{group: {imports: string[], globalVars: object[], matches: object[]}, errors: Array}}
 */
export function loadMatchGroup(vfs, path) {
  const raw = parseYaml(vfs.read(path));
  return convertMatchGroup(raw, { vfs, path });
}

/**
 * Convert an already-parsed YAML match group object.
 * `vfs` and `path` are only needed to resolve `imports`.
 */
export function convertMatchGroup(raw, { vfs = null, path = null } = {}) {
  const errors = [];

  const globalVars = [];
  for (const yamlVar of asArray(raw.global_vars)) {
    try {
      globalVars.push(convertVariable(yamlVar));
    } catch (error) {
      errors.push({ level: 'error', error });
    }
  }

  const matches = [];
  for (const yamlMatch of asArray(raw.matches)) {
    try {
      const { match, warnings } = convertMatch(yamlMatch);
      matches.push(match);
      warnings.forEach((w) => errors.push({ level: 'warning', error: w }));
    } catch (error) {
      errors.push({ level: 'error', error });
    }
  }

  const imports = [];
  if (raw.imports != null) {
    const currentDir = path ? dirname(path) : '';
    for (const imp of asArray(raw.imports)) {
      const fullPath = resolvePath(currentDir, String(imp));
      if (vfs && vfs.exists(fullPath)) {
        imports.push(fullPath);
      } else {
        errors.push({ level: 'error', error: new Error(`unable to resolve import at path: ${fullPath}`) });
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
  if (typeof value === 'object') throw new Error(`invalid type for field '${field}': expected a string`);
  return String(value);
}

function optBool(value, field) {
  if (value == null) return null;
  if (typeof value !== 'boolean') throw new Error(`invalid type for field '${field}': expected a boolean`);
  return value;
}

/**
 * Port of try_convert_into_match.
 * @returns {{match: object, warnings: Error[]}}
 */
export function convertMatch(yamlMatch) {
  if (yamlMatch == null || typeof yamlMatch !== 'object' || Array.isArray(yamlMatch)) {
    throw new Error(`invalid match definition: ${JSON.stringify(yamlMatch)}`);
  }
  const warnings = [];
  const m = yamlMatch;

  const uppercaseStyleRaw = optString(m.uppercase_style, 'uppercase_style');
  const propagateCaseRaw = optBool(m.propagate_case, 'propagate_case');
  if (uppercaseStyleRaw != null && propagateCaseRaw == null) {
    warnings.push(new Error("specifying the 'uppercase_style' option without 'propagate_case' has no effect"));
  }

  let triggers = null;
  if (m.trigger != null) {
    triggers = [optString(m.trigger, 'trigger')];
  } else if (m.triggers != null) {
    triggers = asArray(m.triggers).map((t) => optString(t, 'triggers'));
  }

  if (triggers) {
    const originalLength = triggers.length;
    triggers = triggers.filter((t) => t != null && t.trim() !== '');
    if (triggers.length < originalLength) {
      warnings.push(new Error('empty triggers are not allowed and have been ignored'));
    }
    if (triggers.length === 0) triggers = null;
  }

  let uppercaseStyle = 'uppercase';
  if (uppercaseStyleRaw != null) {
    const style = uppercaseStyleRaw.toLowerCase();
    if (['uppercase', 'capitalize', 'capitalize_words'].includes(style)) {
      uppercaseStyle = style;
    } else {
      warnings.push(new Error(`unrecognized uppercase_style: "${style}", falling back to the default`));
    }
  }

  const word = optBool(m.word, 'word');
  let cause;
  if (triggers) {
    cause = {
      type: 'trigger',
      triggers,
      leftWord: optBool(m.left_word, 'left_word') ?? word ?? false,
      rightWord: optBool(m.right_word, 'right_word') ?? word ?? false,
      propagateCase: propagateCaseRaw ?? false,
      uppercaseStyle,
    };
  } else if (m.regex != null) {
    cause = { type: 'regex', regex: optString(m.regex, 'regex') };
  } else {
    cause = { type: 'none' };
  }

  let forceMode = null;
  if (optBool(m.force_clipboard, 'force_clipboard') === true) {
    forceMode = 'clipboard';
  } else if (m.force_mode != null) {
    const mode = String(m.force_mode).toLowerCase();
    if (mode === 'clipboard' || mode === 'keys') forceMode = mode;
  }

  let effect;
  if (m.replace != null || m.markdown != null || m.html != null) {
    let replace;
    let format;
    if (m.replace != null) {
      replace = optString(m.replace, 'replace');
      format = 'plain';
    } else if (m.markdown != null) {
      replace = optString(m.markdown, 'markdown');
      format = 'markdown';
    } else {
      replace = optString(m.html, 'html');
      format = 'html';
    }

    const vars = [];
    for (const yamlVar of asArray(m.vars)) {
      try {
        vars.push(convertVariable(yamlVar));
      } catch (error) {
        throw new Error(`failed to load variable: ${JSON.stringify(yamlVar)}: ${error.message}`);
      }
    }
    effect = { type: 'text', replace, vars, format, forceMode };
  } else if (m.form != null) {
    // Replace all the form fields with actual variables
    const formLayout = optString(m.form, 'form');
    let resolvedReplace = formLayout.replace(FORM_CONTROL_REGEX, (_, name) => `{{form1.${name}}}`);
    // Convert escaped brackets in forms
    resolvedReplace = resolvedReplace.replaceAll('\\{', '{ ').replaceAll('\\}', ' }');

    const params = { layout: formLayout };
    if (m.form_fields != null) {
      if (typeof m.form_fields !== 'object' || Array.isArray(m.form_fields)) {
        throw new Error("'form_fields' must be a mapping");
      }
      params.fields = cloneValue(m.form_fields);
    }

    effect = {
      type: 'text',
      replace: resolvedReplace,
      vars: [{ id: nextId(), name: 'form1', type: 'form', params, injectVars: true, dependsOn: [] }],
      format: 'plain',
      forceMode,
    };
  } else if (m.image_path != null) {
    effect = { type: 'image', path: optString(m.image_path, 'image_path') };
  } else {
    effect = { type: 'none' };
  }

  if (effect.type === 'none') {
    throw new Error(
      `match triggered by ${causeLongDescription(cause)} does not produce any effect. Did you forget the 'replace' field?`,
    );
  }

  return {
    match: {
      id: nextId(),
      cause,
      effect,
      label: optString(m.label, 'label'),
      searchTerms: m.search_terms != null ? asArray(m.search_terms).map(String) : [],
    },
    warnings,
  };
}

/** Port of try_convert_into_variable. */
export function convertVariable(yamlVar) {
  if (yamlVar == null || typeof yamlVar !== 'object' || Array.isArray(yamlVar)) {
    throw new Error(`invalid variable definition: ${JSON.stringify(yamlVar)}`);
  }
  if (yamlVar.name == null) throw new Error("missing field 'name'");
  if (yamlVar.type == null) throw new Error("missing field 'type'");

  const params = yamlVar.params ?? {};
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new Error("'params' must be a mapping");
  }

  return {
    id: nextId(),
    name: String(yamlVar.name),
    type: String(yamlVar.type),
    params: cloneValue(params),
    injectVars: yamlVar.inject_vars ?? true,
    dependsOn: yamlVar.depends_on != null ? asArray(yamlVar.depends_on).map(String) : [],
  };
}

/** Deep-clone a YAML value (keeps null/bool/number/string/array/object). */
export function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v);
    return out;
  }
  return value;
}

export function causeDescription(cause) {
  if (cause.type === 'trigger') return cause.triggers[0] ?? null;
  if (cause.type === 'regex') return cause.regex;
  return null;
}

export function causeLongDescription(cause) {
  if (cause.type === 'trigger') return `triggers: ${JSON.stringify(cause.triggers)}`;
  if (cause.type === 'regex') return `regex: ${JSON.stringify(cause.regex)}`;
  return 'No description available';
}

export function matchDescription(m) {
  if (m.label) return m.label;
  if (m.effect.type === 'text') return m.effect.replace;
  if (m.effect.type === 'image') return 'Image content';
  return 'No description available for this match';
}

export function matchSearchTerms(m) {
  const terms = [...m.searchTerms];
  if (m.cause.type === 'trigger') terms.push(...m.cause.triggers);
  return terms;
}
