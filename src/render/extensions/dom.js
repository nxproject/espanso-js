/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * `dom` variable (espanso-js only): reads a value the page publishes in its DOM.
 *
 *   - name: ref
 *     type: dom
 *     params:
 *       selector: "#page-context"   # required
 *       json_path: "order.ref"      # optional: parse textContent as JSON, walk the dotted path
 *       attribute: "data-ref"       # optional: read an attribute instead
 *       default: "n/a"              # optional: used when the value is missing or blank
 *
 * Resolution: json_path, else attribute, else `.value` for form controls, else
 * textContent. A missing element, path or value gives `default` (or ""), which
 * is not an error. A malformed selector or invalid JSON is a render error.
 * Strictly read-only: it never writes to the DOM, evaluates code or fetches URLs.
 */

export class DomVariableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomVariableError';
  }
}

const FORM_CONTROLS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Walk a dotted path ("a.b.0.c") through parsed JSON. Returns undefined if absent. */
export function walkJsonPath(value, path) {
  let current = value;
  for (const segment of String(path).split('.')) {
    if (segment === '') continue;
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringify(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * @param {{getDocument?: () => Document|null}} [options]
 *        returns the document of the field being typed in
 */
export function createDomExtension(options = {}) {
  const getDocument = options.getDocument ?? (() => (typeof document !== 'undefined' ? document : null));

  return {
    name: 'dom',
    calculate(_context, _scope, params) {
      if (typeof params.selector !== 'string' || params.selector.trim() === '') {
        throw new DomVariableError("missing 'selector' parameter");
      }
      const fallback = params.default == null ? '' : String(params.default);
      const doc = getDocument();
      if (!doc) return fallback;

      let element;
      try {
        element = doc.querySelector(params.selector);
      } catch {
        throw new DomVariableError('invalid selector');
      }
      if (!element) return fallback;

      let value;
      if (params.json_path != null) {
        let data;
        try {
          data = JSON.parse(element.textContent ?? '');
        } catch {
          throw new DomVariableError('the element does not contain valid JSON');
        }
        value = stringify(walkJsonPath(data, params.json_path));
      } else if (params.attribute != null) {
        value = element.getAttribute(String(params.attribute));
      } else if (FORM_CONTROLS.has(element.tagName)) {
        value = element.value;
      } else {
        value = element.textContent;
      }

      if (value == null || String(value).trim() === '') return fallback;
      return String(value);
    },
  };
}
