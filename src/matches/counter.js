/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-config/src/counter.rs: unique ids for matches, variables and configs.
 */

let counter = 0;

export function nextId() {
  counter += 1;
  return counter;
}
