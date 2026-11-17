/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-match/src/rolling/{mod,tree,matcher,util}.rs
 *
 * The rolling matcher builds a trie out of all the triggers. While the user types,
 * it keeps a set of "paths" (partial matches) through the trie, advancing each of
 * them with every new key and starting a new one from the root.
 */

/** Rolling items: what each trie edge can match. */
export const RollingItem = Object.freeze({
  wordSeparator: () => ({ kind: 'wordSeparator' }),
  key: (key) => ({ kind: 'key', key }),
  char: (char) => ({ kind: 'char', char }),
  charInsensitive: (char) => ({ kind: 'charInsensitive', char }),
});

/** Unicode-aware case folding, the equivalent of Rust's `UniCase`. */
export function foldCase(s) {
  return s.toLowerCase().toUpperCase().toLowerCase();
}

/**
 * Build a rolling match from a trigger string.
 * @param {any} id
 * @param {string} string
 * @param {{caseInsensitive?: boolean, leftWord?: boolean, rightWord?: boolean}} [opt]
 */
export function rollingMatchFromString(id, string, opt = {}) {
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
    wordSeparators: null, // NodeRef | null
    keys: new Map(), // key -> NodeRef
    chars: new Map(), // char -> NodeRef
    charsInsensitive: new Map(), // folded char -> NodeRef
  };
}

// A NodeRef is either { matches: id[] } or { node: Node }

function insertItems(id, node, items) {
  if (items.length === 0) return;
  const [item, ...rest] = items;

  const mapFor = (it) => {
    if (it.kind === 'key') return [node.keys, it.key];
    if (it.kind === 'char') return [node.chars, it.char];
    return [node.charsInsensitive, foldCase(it.char)];
  };

  if (rest.length === 0) {
    if (item.kind === 'wordSeparator') {
      const matches = node.wordSeparators?.matches ? [...node.wordSeparators.matches] : [];
      matches.push(id);
      node.wordSeparators = { matches };
      return;
    }
    const [map, k] = mapFor(item);
    const entry = map.get(k);
    if (entry?.matches) entry.matches.push(id);
    else map.set(k, { matches: [id] });
    return;
  }

  if (item.kind === 'wordSeparator') {
    if (node.wordSeparators?.node) {
      insertItems(id, node.wordSeparators.node, rest);
    } else if (!node.wordSeparators) {
      const next = createNode();
      insertItems(id, next, rest);
      node.wordSeparators = { node: next };
    }
    return;
  }

  const [map, k] = mapFor(item);
  const entry = map.get(k);
  if (entry) {
    if (entry.node) insertItems(id, entry.node, rest);
  } else {
    const next = createNode();
    insertItems(id, next, rest);
    map.set(k, { node: next });
  }
}

export function buildTree(matches) {
  const root = createNode();
  for (const m of matches) insertItems(m.id, root, m.items);
  return root;
}

export class RollingMatcher {
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
          args: {},
        }));
        // Reset the state and return the matches
        return { state: { paths: [] }, results };
      }
      nextPaths.push({ node: ref.node, events });
    }

    return { state: { paths: nextPaths }, results: [] };
  }

  findRefs(node, event, hasPreviousState) {
    const refs = [];

    if (event.type === 'key') {
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

    // If there is no previous state, we handle it as a word separator,
    // exploring a step forward in the state.
    if (!hasPreviousState && node.wordSeparators?.node) {
      refs.push(...this.findRefs(node.wordSeparators.node, event, true));
    }

    return refs;
  }

  isWordSeparator(event) {
    if (event.type === 'virtualSeparator') return true;
    if (this.keyWordSeparators.has(event.key)) return true;
    return event.chars != null && this.charWordSeparators.has(event.chars);
  }
}

export function extractStringFromEvents(events) {
  let trigger = '';
  let leftSeparator = null;
  let rightSeparator = null;

  events.forEach(([event, isWordSeparator], i) => {
    if (event.type === 'key' && event.chars != null) {
      trigger += event.chars;
      if (isWordSeparator) {
        if (i === 0) leftSeparator = event.chars;
        else if (i === events.length - 1) rightSeparator = event.chars;
      }
    }
  });

  return { trigger, leftSeparator, rightSeparator };
}
