/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Registers js-yaml as the YAML parser (side-effect module). Like espanso, parse
 * strictly first; only if that fails, retry once on a leniently re-quoted copy, and
 * if the retry fails too, throw the original error.
 */

import yaml from 'js-yaml';
import { setYamlLoader } from './yaml.js';
import { lenientFlowQuote } from './yaml-lenient.js';

// YAML 1.2 core schema (dates stay strings, like serde_norway) plus merge keys (<<).
const SCHEMA = yaml.CORE_SCHEMA.extend({ implicit: [yaml.types.merge] });

setYamlLoader((text) => {
  try {
    return yaml.load(text, { schema: SCHEMA });
  } catch (original) {
    try {
      return yaml.load(lenientFlowQuote(text), { schema: SCHEMA });
    } catch {
      throw original;
    }
  }
});
