/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * `createEngine`, without registering a YAML parser or a markdown renderer, so
 * that builds which only need JSON configuration (the auto-loader) stay small.
 * `core.js` and `index.js` re-export it with js-yaml and marked registered.
 */

import { VirtualFS } from './config/vfs.js';
import { ConfigStore } from './config/config.js';
import { MatchStore } from './matches/store.js';
import { convertMatchGroup } from './matches/loader.js';
import { Engine } from './engine/engine.js';

/** A match kind that the configuration disables (regex, image). */
export class DisabledMatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DisabledMatchError';
  }
}

/**
 * Create an espanso engine.
 *
 * @param {object} options
 * @param {Record<string, string>|Map<string, string>} [options.files]
 *        A virtual espanso config directory: paths → YAML contents, e.g.
 *        `{ 'config/default.yml': '...', 'match/base.yml': '...' }`.
 * @param {string} [options.yaml]  shortcut for `files: { 'match/base.yml': yaml }`
 * @param {object} [options.config]  default config as an object (same keys as
 *        default.yml); replaces `config/default.yml`
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

  const { store: configStore, errors: configErrors } = ConfigStore.load(vfs, configDir, {
    defaultConfig: options.config,
  });
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

  // Match kinds disabled by the (global) default config are dropped at load
  const defaultConfig = configStore.default();
  if (!defaultConfig.regex || !defaultConfig.richText) {
    for (const [path, group] of matchStore.groups) {
      group.matches = group.matches.filter((m) => {
        if (!defaultConfig.regex && m.cause.type === 'regex') {
          errors.push({ path, level: 'error', error: new DisabledMatchError('regex matches are disabled (regex: false); match dropped') });
          return false;
        }
        if (!defaultConfig.richText && m.effect.type === 'image') {
          errors.push({ path, level: 'error', error: new DisabledMatchError('image matches are disabled (rich_text: false); match dropped') });
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
