/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of the glue code in espanso/src/cli/worker/
 *   (engine/process/middleware/{matcher/convert.rs, render/mod.rs, multiplex.rs},
 *    config.rs, match_cache.rs)
 */

import { rollingMatchFromString } from '../match/rolling.js';
import { CasingStyle } from '../render/renderer.js';
import { EventType, detectedMatch } from './events.js';

/** Collect the rolling (trigger) and regex matches out of a match set. */
export function convertMatches(matches) {
  const rolling = [];
  const regex = [];
  for (const m of matches) {
    if (m.cause.type === 'trigger') {
      for (const trigger of m.cause.triggers) {
        rolling.push(rollingMatchFromString(m.id, trigger, {
          caseInsensitive: m.cause.propagateCase,
          leftWord: m.cause.leftWord,
          rightWord: m.cause.rightWord,
        }));
      }
    } else if (m.cause.type === 'regex') {
      regex.push({ id: m.id, regex: m.cause.regex });
    }
  }
  return { rolling, regex };
}

/** Convert a match into a render template (only text matches have one). */
export function convertToTemplate(m) {
  if (m.effect.type !== 'text') return null;
  return {
    ids: m.cause.type === 'trigger' ? [...m.cause.triggers] : [],
    body: m.effect.replace,
    vars: m.effect.vars,
  };
}

const isAlphabetic = (c) => /\p{Alphabetic}/u.test(c);
const isUppercase = (c) => /\p{Uppercase}/u.test(c);

/** Decide how to propagate the case of the typed trigger to the replacement. */
export function calculateCasingStyle(trigger, uppercaseStyle) {
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
    return uppercaseStyle === 'capitalize_words' ? CasingStyle.CapitalizeWords : CasingStyle.Capitalize;
  }
  if (!isUppercase(first)) return CasingStyle.None;
  if (uppercaseStyle === 'capitalize') return CasingStyle.Capitalize;
  if (uppercaseStyle === 'capitalize_words') return CasingStyle.CapitalizeWords;
  return CasingStyle.Uppercase;
}

/**
 * Everything the engine needs to know about the loaded configuration,
 * resolved against the "current app" (in a browser: the page title and URL).
 */
export class ConfigManager {
  /**
   * @param {import('../config/config.js').ConfigStore} configStore
   * @param {import('../matches/store.js').MatchStore} matchStore
   * @param {() => {title?: string, url?: string, class?: string, exec?: string}} getAppInfo
   */
  constructor(configStore, matchStore, getAppInfo = () => ({})) {
    this.configStore = configStore;
    this.matchStore = matchStore;
    this.getAppInfo = getAppInfo;

    // Cache match sets per config
    this.matchSets = new Map();
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
    return this.allMatches
      .filter((m) => m.cause.type === 'trigger' && m.cause.triggers.includes(trigger))
      .map((m) => detectedMatch({ id: m.id, trigger }));
  }

  /** MatchInfoProvider */
  getForceMode(matchId) {
    const m = this.getMatch(matchId);
    return m?.effect.type === 'text' ? m.effect.forceMode : null;
  }

  /** Multiplexer */
  convert(detected) {
    const m = this.getMatch(detected.id);
    if (!m) return null;
    if (m.effect.type === 'text') {
      return {
        type: EventType.RenderingRequested,
        matchId: detected.id,
        trigger: detected.trigger,
        leftSeparator: detected.leftSeparator,
        rightSeparator: detected.rightSeparator,
        triggerArgs: detected.args,
        format: m.effect.format,
      };
    }
    if (m.effect.type === 'image') {
      return {
        type: EventType.ImageRequested,
        matchId: detected.id,
        imagePath: m.effect.path,
        trigger: detected.trigger,
      };
    }
    return null;
  }
}

/** Port of RendererAdapter: renders a match by id, in the active context. */
export class RendererAdapter {
  /**
   * @param {ConfigManager} configManager
   * @param {import('../render/renderer.js').Renderer} renderer
   */
  constructor(configManager, renderer) {
    this.configManager = configManager;
    this.renderer = renderer;
    this.templates = new Map();
    for (const m of configManager.allMatches) {
      this.templates.set(m.id, convertToTemplate(m));
    }
    this.contextCache = new Map();
  }

  contextFor(config) {
    if (!this.contextCache.has(config.id)) {
      const matchSet = this.configManager.matchSets.get(config.id);
      this.contextCache.set(config.id, {
        templates: matchSet.matches.map((m) => this.templates.get(m.id)).filter(Boolean),
        globalVars: matchSet.globalVars,
      });
    }
    return this.contextCache.get(config.id);
  }

  async render(matchId, trigger, triggerArgs = {}) {
    const template = this.templates.get(matchId);
    if (!template) throw new Error('match not found');

    const context = this.contextFor(this.configManager.active());
    const raw = this.configManager.getMatch(matchId);
    const propagateCase = raw?.cause.type === 'trigger' && raw.cause.propagateCase;
    const uppercaseStyle = raw?.cause.type === 'trigger' ? raw.cause.uppercaseStyle : null;

    const casingStyle = propagateCase && trigger != null
      ? calculateCasingStyle(trigger, uppercaseStyle)
      : CasingStyle.None;

    // If some trigger vars are specified (regex named groups, exec args),
    // augment the template with them as `echo` variables.
    let effective = template;
    const entries = Object.entries(triggerArgs ?? {});
    if (entries.length > 0) {
      const vars = [...template.vars];
      for (const [name, value] of entries) {
        vars.unshift({
          id: 0,
          name,
          type: 'echo',
          params: { echo: String(value) },
          injectVars: false,
          dependsOn: [],
        });
      }
      effective = { ...template, vars };
    }

    return this.renderer.render(effective, context, { casingStyle });
  }
}
