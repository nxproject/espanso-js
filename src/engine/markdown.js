/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Markdown support (port of espanso-engine/src/process/middleware/markdown.rs).
 *
 * The renderer is pluggable: `markdown-default.js` registers `marked`, and the full
 * entry points import it. Without a renderer (the slim auto-loader bundle), markdown
 * replacements are inserted as their plain source text.
 */

let markdownRenderer = null;

/** Register the markdown → HTML function: `(markdown) => html`. */
export function setMarkdownRenderer(renderer) {
  markdownRenderer = renderer;
}

/**
 * If the snippet is a single paragraph, remove the <p> tag so it is inlined
 * (espanso issue #811).
 */
export function removeParagraphTagIfSingleOccurrence(html) {
  const count = html.split('<p>').length - 1;
  if (count > 1) return html;
  let out = html;
  while (out.startsWith('<p>')) out = out.slice(3);
  while (out.endsWith('</p>')) out = out.slice(0, -4);
  return out;
}

/** Convert markdown to HTML, or return null if no markdown renderer is available. */
export function markdownToHtml(markdown) {
  if (!markdownRenderer) return null;
  return removeParagraphTagIfSingleOccurrence(String(markdownRenderer(markdown)).trim());
}
