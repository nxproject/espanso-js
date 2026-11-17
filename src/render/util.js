/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-render/src/renderer/util.rs
 */

export const VAR_REGEX = /\{\{\s*((?<name>\w+)(\.(?<subname>(\w+)))?)\s*\}\}/g;

export class RendererError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'RendererError';
    this.kind = kind; // 'missingVariable' | 'missingSubMatch' | 'circularDependency'
  }
}

export function getBodyVariableNames(body) {
  const names = new Set();
  for (const m of String(body).matchAll(VAR_REGEX)) names.add(m.groups.name);
  return names;
}

export function getParamsVariableNames(params) {
  const names = new Set();
  for (const value of Object.values(params ?? {})) {
    collectValueVariableNames(value, names);
  }
  return names;
}

function collectValueVariableNames(value, names) {
  if (typeof value === 'string') {
    getBodyVariableNames(value).forEach((n) => names.add(n));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectValueVariableNames(v, names));
  } else if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((v) => collectValueVariableNames(v, names));
  }
}

/**
 * Replace `{{var}}` / `{{var.sub}}` occurrences with values from the scope.
 * Scope values are either strings (single output) or objects (multiple outputs).
 */
export function renderVariables(body, scope) {
  let error = null;
  const output = String(body).replace(VAR_REGEX, (...args) => {
    const groups = args[args.length - 1];
    const { name, subname } = groups;
    if (!scope.has(name)) {
      error = new RendererError('missingVariable', `variable '${name}' is missing`);
      return '';
    }
    const value = scope.get(name);
    if (typeof value === 'string') return value;
    if (subname !== undefined) {
      return Object.prototype.hasOwnProperty.call(value, subname) ? String(value[subname]) : '';
    }
    error = new RendererError(
      'missingVariable',
      `nested name missing from multi-value variable: ${name}`,
    );
    return '';
  });

  if (error) throw error;
  return unescapeVariableInjections(output);
}

export function unescapeVariableInjections(body) {
  return body.replaceAll('\\{\\{', '{{').replaceAll('\\}\\}', '}}');
}

/** Return a copy of params where every string has its `{{vars}}` rendered. */
export function injectVariablesIntoParams(params, scope) {
  const out = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    out[key] = injectIntoValue(value, scope);
  }
  return out;
}

function injectIntoValue(value, scope) {
  if (typeof value === 'string') return renderVariables(value, scope);
  if (Array.isArray(value)) return value.map((v) => injectIntoValue(v, scope));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = injectIntoValue(v, scope);
    return out;
  }
  return value;
}
