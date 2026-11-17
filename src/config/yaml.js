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
 *
 * The actual YAML parser is pluggable: `yaml-default.js` registers js-yaml, and the
 * full entry points (`index.js`, `core.js`) import it. The JSON-only auto-loader
 * does not, so js-yaml stays out of its bundle.
 */

let yamlLoader = null;

/**
 * Register the function used to parse YAML text: `(text) => value`.
 * It must throw on invalid input.
 */
export function setYamlLoader(loader) {
  yamlLoader = loader;
}

export function hasYamlLoader() {
  return yamlLoader !== null;
}

function load(text) {
  if (!yamlLoader) {
    throw new Error('YAML support is not available in this build; provide the configuration as JSON objects');
  }
  return yamlLoader(text);
}

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
 *  - the registered loader (see yaml-default.js) retries once on a leniently
 *    re-quoted copy if strict parsing fails (see `lenientFlowQuote`)
 */
export function parseYaml(text) {
  const source = String(text ?? '').replace(/^\uFEFF+/, '');
  if (isYamlEmpty(source)) return {};

  const doc = load(source);
  if (doc === null || doc === undefined) return {};
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('invalid YAML document: expected a mapping at the top level');
  }
  return doc;
}
