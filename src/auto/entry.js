/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Entry point of dist/espanso-auto(.min).js. It captures its own <script>
 * element synchronously and starts the loader. Nothing is exported or exposed.
 *
 * No YAML parser and no markdown renderer are registered in this build: the
 * configuration is JSON, and markdown replacements are inserted as plain text.
 */

import { startAutoLoader } from './loader.js';

if (typeof document !== 'undefined') {
  const script = document.currentScript;
  startAutoLoader({ script, document: script?.ownerDocument ?? document });
}
