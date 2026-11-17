// Bundles the library for direct use in browsers:
//   dist/espanso.esm.js       - ES module (import { createEspanso } from './espanso.esm.js')
//   dist/espanso.js           - classic <script>, exposes a global `Espanso`
//   dist/espanso.min.js       - same, minified
//   dist/espanso-auto.js      - self-starting loader (JSON config, DOM events, no global)
//   dist/espanso-auto.min.js  - same, minified
// Every file starts with a banner naming the version, repo/tag and upstream.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const REPO = 'https://github.com/nxproject/espanso-js';
const banner =
  `/*! espanso-js ${pkg.version} — ${REPO} (tag v${pkg.version}) — ` +
  'port of espanso (https://github.com/espanso/espanso) — GPL-3.0-or-later */';

const common = {
  bundle: true,
  target: ['es2022'],
  platform: 'browser',
  sourcemap: true, // includes sourcesContent
  legalComments: 'eof',
  banner: { js: banner },
};

const full = { ...common, entryPoints: ['src/index.js'] };
await build({ ...full, format: 'esm', outfile: 'dist/espanso.esm.js' });
await build({ ...full, format: 'iife', globalName: 'Espanso', outfile: 'dist/espanso.js' });
await build({ ...full, format: 'iife', globalName: 'Espanso', minify: true, outfile: 'dist/espanso.min.js' });

// The auto-loader exposes nothing: an IIFE without a global name.
const auto = { ...common, entryPoints: ['src/auto/entry.js'], format: 'iife', metafile: true };
const results = [
  await build({ ...auto, outfile: 'dist/espanso-auto.js' }),
  await build({ ...auto, minify: true, outfile: 'dist/espanso-auto.min.js' }),
];
for (const result of results) {
  const inputs = Object.keys(result.metafile.inputs);
  const leaked = inputs.filter((i) => /node_modules[\\/](js-yaml|marked)[\\/]/.test(i));
  if (leaked.length > 0) {
    throw new Error(`the auto-loader bundle must not contain js-yaml or marked: ${leaked.join(', ')}`);
  }
}

console.log(`built espanso-js ${pkg.version}: dist/espanso.esm.js, espanso.js, espanso.min.js, espanso-auto.js, espanso-auto.min.js`);
