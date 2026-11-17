/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-config/src/matches/store/default.rs
 */

import { loadMatchGroup } from './loader.js';

export class MatchStore {
  constructor(groups = new Map()) {
    /** @type {Map<string, {imports: string[], globalVars: object[], matches: object[]}>} */
    this.groups = groups;
  }

  /**
   * Load the given match files (and, recursively, everything they import).
   * @returns {{store: MatchStore, errors: Array<{path, level, error}>}}
   */
  static load(vfs, paths) {
    const groups = new Map();
    const errors = [];
    loadRecursively(vfs, groups, paths, errors);
    return { store: new MatchStore(groups), errors };
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
    const visitedPaths = new Set();
    const visitedMatches = new Set();
    const visitedVars = new Set();

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
}

function loadRecursively(vfs, groups, paths, errors) {
  for (const path of paths) {
    if (groups.has(path)) continue;
    try {
      const { group, errors: groupErrors } = loadMatchGroup(vfs, path);
      groups.set(path, group);
      groupErrors.forEach((e) => errors.push({ path, ...e }));
      loadRecursively(vfs, groups, group.imports, errors);
    } catch (error) {
      errors.push({ path, level: 'error', error: new Error(`unable to load match group ${path}: ${error.message}`) });
    }
  }
}
