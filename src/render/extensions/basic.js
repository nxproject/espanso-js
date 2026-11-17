/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-render/src/extension/{echo,random,choice,form,clipboard}.rs
 * plus browser stubs for the desktop-only `shell` and `script` extensions.
 */

import { RenderAbortedError } from '../renderer.js';

/** `echo`: outputs the `echo` param (numbers and booleans are stringified). */
export function createEchoExtension(alias = 'echo') {
  return {
    name: alias,
    calculate(_context, _scope, params) {
      const echo = params.echo;
      if (typeof echo === 'string') return echo;
      if (typeof echo === 'number' || typeof echo === 'boolean') return String(echo);
      throw new Error("missing 'echo' parameter");
    },
  };
}

/** `random`: picks one of the `choices` at random. */
export function createRandomExtension(random = Math.random) {
  return {
    name: 'random',
    calculate(_context, _scope, params) {
      if (!Array.isArray(params.choices)) throw new Error("missing 'choices' parameter");
      const choices = params.choices.filter((c) => typeof c === 'string');
      if (choices.length === 0) throw new Error('could not select a choice randomly');
      return choices[Math.floor(random() * choices.length)];
    },
  };
}

/**
 * Parse the `values` param of a choice variable into [{id, label}].
 * `values` can be a multi-line string, or a list of strings / {id, label} objects.
 */
export function parseChoices(values) {
  if (typeof values === 'string') {
    return values
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => ({ id: line, label: line }));
  }
  if (Array.isArray(values)) {
    return values.map((value) => {
      if (typeof value === 'string') return { id: value, label: value };
      if (value !== null && typeof value === 'object') {
        if (typeof value.id !== 'string' || typeof value.label !== 'string') {
          throw new Error(
            "values contain object items, but they are missing either the 'id' or 'label' fields",
          );
        }
        return { id: value.id, label: value.label };
      }
      throw new Error('values contain an invalid item type. items can only be strings or objects');
    });
  }
  throw new Error('missing values parameter');
}

/** Default choice selector (no GUI): picks the first choice. */
export const firstChoiceSelector = {
  async show(choices) {
    return choices.length > 0 ? choices[0].id : null;
  },
};

/**
 * `choice`: asks the user to pick one of the values.
 * @param {{show(choices: Array<{id: string, label: string}>): Promise<string|null>}} selector
 *        resolves to the chosen id, or null to abort the expansion.
 */
export function createChoiceExtension(selector = firstChoiceSelector) {
  return {
    name: 'choice',
    async calculate(_context, _scope, params) {
      const choices = parseChoices(params.values);
      const chosen = await selector.show(choices);
      if (chosen == null) throw new RenderAbortedError('choice aborted');
      return String(chosen);
    },
  };
}

/** Extract the control names used in a form layout: [[name]] */
export function getFormControls(layout) {
  const names = [];
  for (const m of String(layout).matchAll(/\[\[\s*(\w+)(\.\w+)?\s*\]\]/g)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/**
 * Default form provider (no GUI): fills every control with its `default`
 * value from `form_fields`, or an empty string.
 */
export const defaultValuesFormProvider = {
  async show(layout, fields) {
    const values = {};
    for (const name of getFormControls(layout)) {
      const field = fields?.[name];
      if (field && field.default != null) values[name] = String(field.default);
      else values[name] = '';
    }
    return values;
  },
};

/**
 * `form`: shows a form and returns the values of its controls.
 * @param {{show(layout: string, fields: object, options: object): Promise<object|null>}} provider
 *        resolves to `{controlName: value}`, or null to abort the expansion.
 */
export function createFormExtension(provider = defaultValuesFormProvider) {
  return {
    name: 'form',
    async calculate(_context, _scope, params) {
      if (typeof params.layout !== 'string') throw new Error('missing layout parameter');
      const fields = params.fields !== null && typeof params.fields === 'object' ? params.fields : {};
      const values = await provider.show(params.layout, fields, {});
      if (values == null) throw new RenderAbortedError('form aborted');
      return values;
    },
  };
}

/** Clipboard provider backed by the async Clipboard API (needs user permission). */
export const browserClipboardProvider = {
  async getText() {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null;
    try {
      return await navigator.clipboard.readText();
    } catch {
      return null;
    }
  },
};

/** `clipboard`: outputs the current clipboard content. */
export function createClipboardExtension(provider = browserClipboardProvider) {
  return {
    name: 'clipboard',
    async calculate() {
      const text = await provider.getText();
      if (text == null) throw new Error('clipboard provider returned error');
      return text;
    },
  };
}

/**
 * `shell` and `script` run local programs on desktop espanso. That is not
 * possible from a web page, so they fail with an explanatory error. Register
 * your own extension with the same name to provide an alternative.
 */
export function createUnsupportedExtension(name) {
  return {
    name,
    calculate() {
      throw new Error(`the '${name}' extension is not available in the browser`);
    },
  };
}
