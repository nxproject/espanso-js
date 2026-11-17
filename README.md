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

### Bundles

| File | What it is |
| --- | --- |
| `dist/espanso.esm.js` | ES module with the full API (`createEspanso`, `createEngine`, ...) |
| `dist/espanso.js`, `dist/espanso.min.js` | Same, as a classic script exposing the global `Espanso` |
| `dist/espanso-auto.js`, `dist/espanso-auto.min.js` | [Auto-loader](#auto-loader-no-javascript-on-the-page): starts by itself, JSON config only, exposes nothing. Built without js-yaml and marked (about 66 KB minified, 23 KB gzipped) |

Every file starts with a banner naming the espanso-js version, its repository and tag, and the upstream project. The source maps include the original sources.

### Demo

```sh
npm install
npm run demo        # builds, then serves http://localhost:8080/demo/
```

Then open `/demo/` (full API), `/demo/auto.html` (auto-loader with `data-config-url`) or `/demo/auto-inline.html` (auto-loader with inline config).

## Auto-loader (no JavaScript on the page)

The auto-loader lets a page use espanso-js **without calling it**. The page adds a script tag and publishes its snippets as JSON. The loader starts itself, reads the configuration as data, and reports back through DOM events. Nothing is exposed on `window`, so there is nothing for the page to call.

```html
<!-- configuration fetched from the same origin -->
<script src="/vendor/espanso-auto.min.js" data-config-url="/my-snippets.json" defer></script>

<!-- or embedded in the page -->
<script type="application/x-espanso+json" id="espanso-config">
  { "matches": [ { "trigger": ";sig", "replace": "Best,\nJane" } ] }
</script>
<script src="/vendor/espanso-auto.min.js" data-config="#espanso-config" defer></script>
```

**Configuration source** (first match wins):

1. `data-config="<selector>"`: the element's text, parsed as JSON.
2. `data-config-url="<url>"`: fetched with `credentials: 'same-origin'` and `cache: 'no-store'`. A **cross-origin URL is refused**: it is reported as a config error and never fetched.
3. Neither attribute: the first `<script type="application/x-espanso+json">` in the document.

**Configuration shape.** The keys are the same as espanso's YAML files:

```json
{
  "config":      { "backspace_limit": 5, "exclude_selector": ".no-expand", "rich_text": false,
                   "regex": false, "disabled_var_types": ["clipboard", "shell", "script", "form", "choice"] },
  "global_vars": [ { "name": "myname", "type": "echo", "params": { "echo": "Jane Doe" } } ],
  "matches":     [ { "trigger": ";sig", "replace": "Best,\n{{myname}}" } ]
}
```

- With no configuration, or no enabled matches, the loader attaches nothing to the page's fields. It still dispatches `espanso:ready` with `{ "matchCount": 0 }` and keeps listening for `espanso:reload`.
- It only attaches to the document its own script tag belongs to. Each frame that wants expansion includes its own tag.
- The auto-loader bundle has no YAML parser and no markdown renderer. A `markdown` replacement is inserted as its plain source text.
- Nothing is logged to the console unless the script tag has a `data-debug` attribute.
- **When a snippet fails to render** (e.g. a malformed `dom` selector), the field is left exactly as typed and an `espanso:error` with `kind: 'render'` is dispatched. Set `rendering_error_text` to a string to insert that text instead.

### DOM events

Dispatched on the document, with `bubbles: false`:

| Event | `detail` |
| --- | --- |
| `espanso:ready` | `{ matchCount }` |
| `espanso:error` | `{ kind: 'config' \| 'render' \| 'inject' \| 'attach', errorName, count }` |

`errorName` is the error's class name (e.g. `CrossOriginConfigError`, `DisabledVariableTypeError`, `SyntaxError`). `count` is how many errors of that kind have happened on the page so far. **The detail never contains an error message, a trigger, replacement text, variable values or field content**, so it is safe to forward to telemetry.

Listened for on the document:

| Event | Effect |
| --- | --- |
| `espanso:reload` | Re-read the configuration from the same source, rebuild, re-attach, then dispatch `espanso:ready` again |

## Browser-specific config keys

These keys are specific to espanso-js. They work in `default.yml`, in the auto-loader's `config` object, and in `createEspanso({ config })`. They are read from the default (global) configuration.

| Key | Default | Effect |
| --- | --- | --- |
| `exclude_selector` | `""` | Fields inside an element matching this CSS selector (`el.closest(selector)`) are ignored. An invalid selector is reported as a config error and ignored. |
| `include_password_fields` | `false` | Also expand in `<input type="password">` |
| `rich_text` | `true` | When `false`, `html` and `markdown` replacements are inserted as plain text, and `image_path` matches are dropped at load (config error). No HTML or image ever reaches the page. |
| `regex` | `true` | When `false`, `regex` matches are dropped at load (config error) |
| `disabled_var_types` | `[]` | A match that uses one of these variable types fails with a render error, and the field is left untouched: the trigger stays, and no error text is inserted. |
| `rendering_error_text` | espanso's message (`createEspanso`), `null` (auto-loader) | What replaces the trigger when rendering fails. A string is inserted as a literal (never rendered, never treated as HTML). `null` leaves the field untouched: the trigger stays as typed. In the auto-loader, anything other than a string means `null`. |
| `filter_url` | none | In an app-specific config: a regex matched against the page URL |

### `dom` variable

Reads a value that the page publishes in its DOM:

```yaml
- trigger: ";ref"
  replace: "Order {{ref}}"
  vars:
    - name: ref
      type: dom
      params:
        selector: "#page-context"   # required; looked up in the document of the field being typed in
        json_path: "order.ref"      # optional: parse the element's text as JSON, then follow this dotted path
        attribute: "data-ref"       # optional: read an attribute instead
        default: "n/a"              # optional: used when the value is missing, null or blank
```

- **Resolution order:** `json_path`, then `attribute`, then `.value` for form controls, then the element's text.
- **Missing values:** a missing element, path or value gives `default`, or `""` if there is none. That is not an error.
- **Errors:** a malformed selector or invalid JSON is a render error.
- **Read-only:** the variable never writes to the page, evaluates code or fetches a URL.

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
| Variables: `echo`, `random`, `date`, `match` (nested), `global`, `inject_vars`, `depends_on` | ✅ (plus the browser-only [`dom`](#dom-variable) variable) |
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
| `config` | Default config as an object (same keys as `default.yml`), instead of `config/default.yml` |
| `matches`, `globalVars` | Inline matches / global vars (YAML shape), active in every config |
| `configDir` | Directory containing `default.yml` (default `config`) |
| `getAppInfo` | `() => ({ title, url, class, exec })`, used to pick app-specific configs. Defaults to the page title and URL |
| `extensions` | Extra or overriding variable types: `[{ name, calculate(context, scope, params) }]`. `calculate` returns (or resolves to) a string, or an object for multi-value outputs. Throw `RenderAbortedError` to cancel the expansion |
| `choiceSelector` | `{ show(choices: {id,label}[]) => Promise<id \| null> }` (`null` cancels) |
| `formProvider` | `{ show(layout, fields) => Promise<{field: value} \| null> }` |
| `clipboardProvider` | `{ getText() => Promise<string \| null> }` |
| `matchSelector` | `{ select(matches: {id,label,triggers}[]) => Promise<id \| null> }` |
| `dateOptions` | `{ now: () => Date, getLocale: () => string }` |
| `renderingErrorText` | Text that replaces the trigger when rendering fails, inserted as a literal. Defaults to the `rendering_error_text` config key, then to espanso's message. `null` leaves the field untouched (the trigger stays) |
| `onError` | `(error, kind) => void` where `kind` is `config`, `render`, `inject` or `attach` (default `console.error`) |

`attach({ root, includePasswordFields, excludeSelector, richText, shouldHandle })`:
- `root` is the node to listen on (default `document`; pass a shadow root or an iframe's document to cover those).
- `includePasswordFields`, `excludeSelector` and `richText` override the config keys of the same name.
- `shouldHandle(el)` lets you exclude specific fields.

`expand(trigger, args?)` renders a match and returns the text without inserting it. `exec(trigger)` inserts it at the caret, like `espanso match exec`.

Events for `on(type, fn)`: `enabled`, `disabled`, `error` (`{ kind, error }`), `renderingError`, `textInject`, `htmlInject`, `keySequenceInject`, `imageInject`, `matchInjected`, or `*` for everything.

When a field is edited without `execCommand` (the fallback path), espanso-js fires `input` and also `change` on `<input>` / `<textarea>`, so pages that commit a value on `change` see the expansion.

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

The YAML parser and the markdown renderer are pluggable (`setYamlLoader`, `setMarkdownRenderer`). The `espanso-js` and `espanso-js/core` entry points register js-yaml and marked. If you import the internal modules directly, import `src/config/yaml-default.js` and `src/engine/markdown-default.js` yourself.

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
npm test               # unit + jsdom tests (the auto-loader bundle test needs a build first)
npm run build          # dist/ bundles (esbuild)
npm run test:browser   # end-to-end in an installed Chrome/Edge (BROWSER_PATH to override)
```

## License

espanso-js is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

### Origin and modifications

This is a **modified version** of espanso, as required by section 5(a) of the GPL:

- **Original work:** [espanso](https://github.com/espanso/espanso), Copyright (C) 2019-2021 Federico Terzi and the espanso contributors, licensed GPL-3.0. Ported from commit [`80d9e353`](https://github.com/espanso/espanso/commit/80d9e353e3c0a58c77feb72671cec4a61958366f).
- **Modifications:** translated from Rust to JavaScript by Jose E Gonzalez Jr (nxproject) on 2026-11-17. OS keyboard hooks and injection were replaced by DOM-based detection and injection. The desktop-only components listed above were removed. The `filter_url` option and the `expand` / `exec` APIs were added. Version 0.2.0 (2026-11-17) added the auto-loader, the browser-specific config keys, the `dom` variable and the DOM events. Version 0.2.1 (2026-11-17) leaves the field untouched when rendering fails in the auto-loader, and added `rendering_error_text`. See [CHANGELOG.md](CHANGELOG.md) for the full history.

Bundled third-party dependencies: [js-yaml](https://github.com/nodeca/js-yaml) (MIT) and [marked](https://github.com/markedjs/marked) (MIT). Their notices are kept in the `dist/` bundles.
