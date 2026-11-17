/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Registers `marked` as the markdown renderer (side-effect module).
 */

import { marked } from 'marked';
import { setMarkdownRenderer } from './markdown.js';

setMarkdownRenderer((markdown) => marked.parse(markdown, { async: false }));
