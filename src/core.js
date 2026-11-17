/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Platform-independent entry point (no DOM). Works in browsers, workers and Node.
 * Registers js-yaml (YAML configs) and marked (markdown matches).
 */

import './config/yaml-default.js';
import './engine/markdown-default.js';

export { createEngine, DisabledMatchError } from './create.js';
export { VirtualFS, normalizePath } from './config/vfs.js';
export { parseYaml, setYamlLoader } from './config/yaml.js';
export { lenientFlowQuote } from './config/yaml-lenient.js';
export { ConfigStore, ResolvedConfig, DEFAULT_WORD_SEPARATORS } from './config/config.js';
export { MatchStore } from './matches/store.js';
export { convertMatch, convertVariable, convertMatchGroup } from './matches/loader.js';
export { RollingMatcher, rollingMatchFromString } from './match/rolling.js';
export { RegexMatcher, compileRegex } from './match/regex.js';
export { Renderer, RenderAbortedError, DisabledVariableTypeError, CasingStyle } from './render/renderer.js';
export { strftime, createDateExtension } from './render/extensions/date.js';
export { createDomExtension, DomVariableError } from './render/extensions/dom.js';
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
export { markdownToHtml, setMarkdownRenderer } from './engine/markdown.js';
export { htmlToText } from './engine/html-text.js';
