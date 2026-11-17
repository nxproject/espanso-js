# espanso-js

A JavaScript port of [espanso](https://github.com/espanso/espanso), the cross-platform text expander, that runs **inside a web page**. Type `:date` in a text field and it becomes `Tuesday, 17 November 2026`.

It reads the same YAML match and config files as desktop espanso, and expands triggers in `<input>`, `<textarea>` and `contenteditable` editors.

Ported from espanso commit `80d9e353` (2026-10-24).

## Quick start

```html
<script type="module">
  import { createEspanso } from './dist/espanso.esm.js';

  const espanso = createEspanso({
    yaml: `
matches:
  - trigger: ":hi"
    replace: "Hello there!"
  - trigger: ":date"
    replace: "{{today}}"
    vars:
      - name: today
        type: date
        params: { format: "%d/%m/%Y" }
`,
  });

  espanso.attach(); // expand in every text field of the page
</script>
```

With a classic `<script>` tag, use `dist/espanso.js` (or `espanso.min.js`). It exposes a global `Espanso`, so call `Espanso.createEspanso(...)`.

### Demo

```sh
npm install
npm run demo        # builds, then serves http://localhost:8080/demo/
```

## Loading a full espanso config

Browsers have no file system, so you pass the espanso config directory as a map of paths to file contents. Directory semantics work the same as on desktop:

- `config/default.yml`
- app-specific configs in `config/`
- `includes` / `excludes` globs
- relative `imports` between match files
- files starting with `_` are ignored

```js
import { createEspanso, fetchFiles } from 'espanso-js';

const files = await fetchFiles({
  'config/default.yml': '/espanso/config/default.yml',
  'match/base.yml': '/espanso/match/base.yml',
  'match/emoji.yml': '/espanso/match/emoji.yml',
});

const espanso = createEspanso({ files });
espanso.errors.forEach((e) => console.warn(e.path, e.error.message));
espanso.attach();
```

You can also pass inline matches, in the same shape as the YAML:

```js
createEspanso({ matches: [{ trigger: ';;sig', replace: 'Best,\nJane' }] });
```

## What is supported

| espanso feature | Status |
| --- | --- |
| `trigger` / `triggers`, `word`, `left_word`, `right_word` | ✅ |
| `propagate_case`, `uppercase_style` | ✅ |
| `regex` triggers with named groups | ✅ Rust syntax translated (`(?P<x>)`, `(?i)`, `[[:digit:]]`, `\A`, `\z`) |
| `replace`, `markdown`, `html` | ✅ rich formats are kept in `contenteditable`, flattened to text elsewhere |
| `image_path` | ✅ inserts an `<img>` in `contenteditable`; the path is used as URL (`$CONFIG` → `configDir` option) |
| Cursor hint `$|$` | ✅ |
| Undo with Backspace (`undo_backspace`) | ✅ |
| `toggle_key` (double tap) | ✅ |
| `backspace_limit`, `word_separators`, `max_regex_buffer_size`, `enable` | ✅ |
| `imports`, `global_vars`, `includes`/`excludes`/`extra_*`, `use_standard_includes` | ✅ |
| App-specific configs | ✅ `filter_title` matches `document.title`; `filter_os` matches the OS; **new:** `filter_url` matches `location.href` |
| Variables: `echo`, `random`, `date`, `match` (nested), `global`, `inject_vars`, `depends_on` | ✅ |
| `date`: `format`, `offset`, `locale`, `tz` | ✅ chrono strftime syntax, implemented with `Intl` |
| `clipboard` variable | ✅ via `navigator.clipboard.readText()` (the browser asks for permission) |
| `choice` / `form` variables | ⚠️ no built-in GUI: the first choice / the fields' `default` values are used. Supply your own UI with `choiceSelector` / `formProvider` |
| Several matches with the same trigger | ⚠️ the first one is used. Supply `matchSelector` to let the user choose |
| `shell` / `script` variables | ❌ a web page cannot run programs; they fail with an explanatory error. Register a custom extension with the same name to replace them |
| Search bar, tray icon, notifications, package manager, CLI, daemon | ❌ desktop only |
| Injection options (`backend`, delays, clipboard/paste settings, X11/Win32/evdev options) | Parsed for compatibility, ignored |

`filter_exec` and `filter_class` are parsed too. They only match if your `getAppInfo` returns `exec` / `class` values.

## API

### `createEspanso(options)` (browser)

Returns `{ engine, errors, attach(opts), detach(), expand(trigger), exec(trigger), enable(), disable(), toggle(), on(type, fn) }`.

Options (all optional):

| Option | Description |
| --- | --- |
| `files` | Virtual config directory `{ path: yaml }` |
| `yaml` | Shortcut for `files: { 'match/base.yml': yaml }` |
| `matches`, `globalVars` | Inline matches / global vars (YAML shape), active in every config |
| `configDir` | Directory containing `default.yml` (default `config`) |
| `getAppInfo` | `() => ({ title, url, class, exec })`, used to pick app-specific configs. Defaults to the page title and URL |
| `extensions` | Extra or overriding variable types: `[{ name, calculate(context, scope, params) }]`. `calculate` returns (or resolves to) a string, or an object for multi-value outputs. Throw `RenderAbortedError` to cancel the expansion |
| `choiceSelector` | `{ show(choices: {id,label}[]) => Promise<id \| null> }` (`null` cancels) |
| `formProvider` | `{ show(layout, fields) => Promise<{field: value} \| null> }` |
| `clipboardProvider` | `{ getText() => Promise<string \| null> }` |
| `matchSelector` | `{ select(matches: {id,label,triggers}[]) => Promise<id \| null> }` |
| `dateOptions` | `{ now: () => Date, getLocale: () => string }` |
| `renderingErrorText` | Text inserted when rendering fails (espanso's message by default; `null` inserts nothing) |
| `onError` | `(error) => void` (default `console.error`) |

`attach({ root, includePasswordFields, shouldHandle })`:
- `root` is the node to listen on (default `document`; pass a shadow root or an iframe's document to cover those).
- Password fields are skipped unless `includePasswordFields: true`.
- `shouldHandle(el)` lets you exclude specific fields.

`expand(trigger, args?)` renders a match and returns the text without inserting it. `exec(trigger)` inserts it at the caret, like `espanso match exec`.

Events for `on(type, fn)`: `enabled`, `disabled`, `renderingError`, `textInject`, `htmlInject`, `keySequenceInject`, `imageInject`, `matchInjected`, or `*` for everything.

### `createEngine(options)` (no DOM)

`import { createEngine } from 'espanso-js/core'` gives you the platform-independent engine for Node, workers or custom editors. Feed it input with `engine.handleInput({ type: 'keyboard', key, value })` / `{ type: 'mouse' }`, and provide an `injector`:

```js
{
  injectKeys(keys) {},      // 'Backspace' / 'ArrowLeft' sequences
  injectText(text) {},
  injectHtml(html) {},
  injectImage(path) {},
}
```

The lower-level pieces are exported too: `RollingMatcher`, `RegexMatcher`, `Renderer`, `strftime`, `parseYaml`, `ConfigStore`, `MatchStore`, etc.

## How it maps to espanso

| espanso (Rust) | espanso-js |
| --- | --- |
| `espanso-config` | `src/config/`, `src/matches/` |
| `espanso-match` | `src/match/` |
| `espanso-render` | `src/render/` |
| `espanso-engine` + worker glue | `src/engine/` |
| `espanso-detect` + `espanso-inject` (OS hooks) | `src/browser/dom.js` (DOM events + `execCommand`/`setRangeText`/Range) |
| `espanso-clipboard` | `navigator.clipboard` |
| `espanso-ui`, `espanso-modulo`, `espanso-ipc`, `espanso-package`, CLI | not ported |

Rendering is asynchronous in the port (`await`able extensions). Otherwise the middleware pipeline, matching and rendering logic follow the Rust code closely, and most Rust unit tests are ported in `test/`.

## Development

```sh
npm test               # unit + jsdom tests
npm run build          # dist/ bundles (esbuild)
npm run test:browser   # end-to-end in an installed Chrome/Edge (BROWSER_PATH to override)
```

## License

espanso-js is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

### Origin and modifications

This is a **modified version** of espanso, as required by section 5(a) of the GPL:

- **Original work:** [espanso](https://github.com/espanso/espanso), Copyright (C) 2019-2021 Federico Terzi and the espanso contributors, licensed GPL-3.0. Ported from commit [`80d9e353`](https://github.com/espanso/espanso/commit/80d9e353e3c0a58c77feb72671cec4a61958366f).
- **Modifications:** translated from Rust to JavaScript by Jose E Gonzalez Jr (nxproject) on 2026-11-17. OS keyboard hooks and injection were replaced by DOM-based detection and injection. The desktop-only components listed above were removed. The `filter_url` option and the `expand` / `exec` APIs were added.

Bundled third-party dependencies: [js-yaml](https://github.com/nodeca/js-yaml) (MIT) and [marked](https://github.com/markedjs/marked) (MIT). Their notices are kept in the `dist/` bundles.
