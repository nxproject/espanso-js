/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Platform-independent entry point (no DOM). Works in browsers, workers and Node.
 */

import { VirtualFS } from './config/vfs.js';
import { ConfigStore } from './config/config.js';
import { MatchStore } from './matches/store.js';
import { convertMatchGroup } from './matches/loader.js';
import { Engine } from './engine/engine.js';

export { VirtualFS, normalizePath } from './config/vfs.js';
export { parseYaml, lenientFlowQuote } from './config/yaml.js';
export { ConfigStore, ResolvedConfig, DEFAULT_WORD_SEPARATORS } from './config/config.js';
export { MatchStore } from './matches/store.js';
export { convertMatch, convertVariable, convertMatchGroup } from './matches/loader.js';
export { RollingMatcher, rollingMatchFromString } from './match/rolling.js';
export { RegexMatcher, compileRegex } from './match/regex.js';
export { Renderer, RenderAbortedError, CasingStyle } from './render/renderer.js';
export { strftime, createDateExtension } from './render/extensions/date.js';
export {
  createEchoExtension,
  createRandomExtension,
  createChoiceExtension,
  createFormExtension,
  createClipboardExtension,
  getFormControls,
  parseChoices,
} from './render/extensions/basic.js';
export { Engine, nullInjector } from './engine/engine.js';
export { EventType, Key, Status } from './engine/events.js';
export { markdownToHtml } from './engine/middleware.js';

/**
 * Create an espanso engine.
 *
 * @param {object} options
 * @param {Record<string, string>|Map<string, string>} [options.files]
 *        A virtual espanso config directory: paths → YAML contents, e.g.
 *        `{ 'config/default.yml': '...', 'match/base.yml': '...' }`.
 * @param {string} [options.yaml]  shortcut for `files: { 'match/base.yml': yaml }`
 * @param {object[]} [options.matches]  match objects in espanso's YAML shape,
 *        e.g. `[{ trigger: ':hi', replace: 'Hello!' }]` (always active)
 * @param {object[]} [options.globalVars]  global variables in espanso's YAML shape
 * @param {string} [options.configDir='config']
 * @param {(warning: {path, level, error}) => void} [options.onLoadError]
 * @returns {{engine: Engine, errors: Array<{path, level, error}>}}
 *
 * All other options are passed to the {@link Engine} constructor
 * (injector, getAppInfo, extensions, formProvider, choiceSelector, ...).
 */
export function createEngine(options = {}) {
  const files = { ...(options.files instanceof Map ? Object.fromEntries(options.files) : options.files) };
  if (options.yaml != null) files['match/base.yml'] = options.yaml;

  const vfs = new VirtualFS(files);
  const configDir = options.configDir ?? 'config';
  const errors = [];

  const { store: configStore, errors: configErrors } = ConfigStore.load(vfs, configDir);
  configErrors.forEach((e) => errors.push({ level: 'error', ...e }));

  const { store: matchStore, errors: matchErrors } = MatchStore.load(vfs, configStore.getAllMatchPaths());
  errors.push(...matchErrors);

  // Inline matches are made available to every config
  if (options.matches || options.globalVars) {
    const inlinePath = '<inline>';
    const { group, errors: inlineErrors } = convertMatchGroup({
      matches: options.matches ?? [],
      global_vars: options.globalVars ?? [],
    });
    inlineErrors.forEach((e) => errors.push({ path: inlinePath, ...e }));
    matchStore.addGroup(inlinePath, group);
    for (const config of configStore.configs()) config.matchPaths.push(inlinePath);
  }

  errors.forEach((e) => options.onLoadError?.(e));

  const engine = new Engine({ ...options, configStore, matchStore });
  return { engine, errors };
}
