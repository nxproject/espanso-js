// Bundles the library for direct use in browsers:
//   dist/espanso.esm.js  - ES module (import { createEspanso } from './espanso.esm.js')
//   dist/espanso.js      - classic <script>, exposes a global `Espanso`
//   dist/espanso.min.js  - same, minified
import { build } from 'esbuild';

const common = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2022'],
  platform: 'browser',
  sourcemap: true,
  legalComments: 'eof',
  banner: {
    js: '/*! espanso-js - a JavaScript port of espanso (https://github.com/espanso/espanso). GPL-3.0-or-later */',
  },
};

await build({ ...common, format: 'esm', outfile: 'dist/espanso.esm.js' });
await build({ ...common, format: 'iife', globalName: 'Espanso', outfile: 'dist/espanso.js' });
await build({ ...common, format: 'iife', globalName: 'Espanso', minify: true, outfile: 'dist/espanso.min.js' });
console.log('built dist/espanso.esm.js, dist/espanso.js, dist/espanso.min.js');
