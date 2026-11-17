/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-render/src/{lib.rs,renderer/mod.rs}
 *
 * Differences from the Rust version:
 *   - rendering is asynchronous (extensions may need to wait for the user, the
 *     clipboard API, network...), so `render()` returns a Promise.
 *   - an extension is a plain object `{ name, calculate(context, scope, params) }`.
 *     `calculate` returns (or resolves to) a string for a single output, or an
 *     object of strings for multiple outputs (like forms). To abort the expansion,
 *     throw `new RenderAbortedError()`.
 */

import { resolveEvaluationOrder, FORM_SYNTAX_TIP } from './resolve.js';
import {
  VAR_REGEX,
  RendererError,
  renderVariables,
  injectVariablesIntoParams,
  unescapeVariableInjections,
} from './util.js';

export { RendererError } from './util.js';

export class RenderAbortedError extends Error {
  constructor(message = 'rendering aborted') {
    super(message);
    this.name = 'RenderAbortedError';
  }
}

export const CasingStyle = Object.freeze({
  None: 'none',
  Capitalize: 'capitalize',
  CapitalizeWords: 'capitalize_words',
  Uppercase: 'uppercase',
});

// Equivalent of Rust's Unicode-aware `\w`
const WORD_REGEX = /[\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\p{Join_Control}]+/gu;

function capitalizeFirst(text) {
  const chars = Array.from(text);
  if (chars.length === 0) return text;
  chars[0] = Array.from(chars[0].toUpperCase())[0];
  return chars.join('');
}

export class Renderer {
  /** @param {Array<{name: string, calculate: Function}>} extensions */
  constructor(extensions = []) {
    this.extensions = new Map();
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

      // Convert "global" variable type aliases when needed
      let localVariables = template.vars;
      if (template.vars.some((v) => v.type === 'global')) {
        const globals = new Map(context.globalVars.map((v) => [v.name, v]));
        localVariables = template.vars
          .map((v) => (v.type === 'global' ? globals.get(v.name) : v))
          .filter(Boolean);
      }

      // Dependency graph resolution to determine a valid evaluation order
      const variables = resolveEvaluationOrder(template.body, localVariables, context.globalVars);

      // Compute the variable outputs
      const scope = new Map();
      for (const variable of variables) {
        if (variable.type === 'match') {
          const subTemplate = getMatchingTemplate(variable, context.templates);
          if (!subTemplate) {
            throw new RendererError('missingSubMatch', `missing sub match: ${variable.params?.trigger}`);
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
            if (variable.type === 'form' && error instanceof RendererError) {
              error.message += `\n${FORM_SYNTAX_TIP}`;
            }
            throw error;
          }
        }

        const output = await extension.calculate(context, scope, params);
        if (typeof output === 'string') {
          scope.set(variable.name, output);
        } else if (output !== null && typeof output === 'object') {
          const multiple = {};
          for (const [k, v] of Object.entries(output)) multiple[k] = String(v ?? '');
          scope.set(variable.name, multiple);
        } else {
          throw new Error(
            `extension '${variable.type}' on var '${variable.name}' returned an invalid output`,
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
}

function getMatchingTemplate(variable, templates) {
  const id = variable.params?.trigger;
  if (typeof id !== 'string') return null;
  return templates.find((t) => t.ids.includes(id)) ?? null;
}
