# Changelog

All notable changes to espanso-js. The project follows [semantic versioning](https://semver.org/).

## [0.2.0] - 2026-11-17

### Added

- **Auto-loader** (`dist/espanso-auto.js`, `dist/espanso-auto.min.js`). It starts by itself from a `<script>` tag, reads a JSON configuration, and exposes nothing on `window`.
  - The configuration comes from `data-config="<selector>"`, `data-config-url="<url>"` (same-origin only; cross-origin URLs are refused), or the first `<script type="application/x-espanso+json">`.
  - DOM events: `espanso:ready` `{ matchCount }` and `espanso:error` `{ kind, errorName, count }`, dispatched on the document with `bubbles: false`. The error detail never carries an error message or any user text.
  - The page can dispatch `espanso:reload` to re-read the configuration and re-attach.
  - Built without js-yaml and marked: JSON config only, and `markdown` replacements are inserted as plain source text.
- **Config keys** (also honored by `createEspanso`):
  - `exclude_selector`: fields inside a matching element are ignored.
  - `include_password_fields`: also expand in password fields.
  - `rich_text`: when `false`, html/markdown are flattened to plain text and image matches are dropped.
  - `regex`: when `false`, regex matches are dropped.
  - `disabled_var_types`: a match that uses a listed type fails and leaves the field untouched.
- **`dom` variable:** reads a value the page publishes in its DOM (`selector`, plus optional `json_path`, `attribute` and `default`). Read-only.
- `createEngine({ config })` accepts the default config as an object.
- `onError(error, kind)` and the engine's `error` event classify errors as `config`, `render`, `inject` or `attach`.
- The YAML parser and markdown renderer are pluggable (`setYamlLoader`, `setMarkdownRenderer`).
- `demo/auto.html` and `demo/auto-inline.html`, plus jsdom and browser tests for all of the above.

### Fixed

- Fallback injection (when `execCommand` is unavailable) now fires `change` as well as `input` on `<input>` and `<textarea>`. Before, pages that commit a value on `change` lost the expansion.

### Changed

- Every `dist` file starts with a banner naming the version, the repository and tag, and the upstream project.
- The lenient YAML retry (espanso issue #2748) moved into the js-yaml registration module. Behavior is unchanged.

## [0.1.0] - 2026-11-17

- First release: a JavaScript port of espanso (commit `80d9e353`) for the browser. It covers config/match loading, the rolling and regex matchers, the renderer and its extensions, the engine pipeline, and DOM detection and injection.

[0.2.0]: https://github.com/nxproject/espanso-js/compare/6394b30...v0.2.0
[0.1.0]: https://github.com/nxproject/espanso-js/commit/6394b30
