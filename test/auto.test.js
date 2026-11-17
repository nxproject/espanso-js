// Auto-loader, declarative config keys, `dom` variable and DOM events (jsdom).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

let window;
let document;

function setupDom(html = '', url = 'https://example.org/page') {
  const dom = new JSDOM(`<!doctype html><title>Test page</title><body>${html}</body>`, { url });
  window = dom.window;
  document = window.document;
  globalThis.document = document;
  globalThis.location = window.location;
  return dom;
}
beforeEach(() => setupDom());

const { startAutoLoader, errorName } = await import('../src/auto/loader.js');
const { createEspanso } = await import('../src/index.js');
const { createDomExtension, walkJsonPath } = await import('../src/render/extensions/dom.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function typeInto(el, text) {
  el.focus();
  for (const c of text) {
    el.setRangeText(c, el.selectionStart, el.selectionEnd, 'end');
    el.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }));
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
}

async function typeIntoRich(el, text) {
  el.focus();
  const sel = window.getSelection();
  if (sel.rangeCount === 0) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.addRange(r);
  }
  for (const c of text) {
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;
    if (node.nodeType !== 3) {
      const textNode = document.createTextNode('');
      range.insertNode(textNode);
      node = textNode;
      offset = 0;
    }
    node.insertData(offset, c);
    const r = document.createRange();
    r.setStart(node, offset + c.length);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    el.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }));
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
}

/** Record espanso:* events dispatched on the document. */
function recordEvents() {
  const events = [];
  for (const type of ['espanso:ready', 'espanso:error']) {
    document.addEventListener(type, (e) => events.push({ type, detail: e.detail, bubbles: e.bubbles }));
  }
  return events;
}

function scriptWith(attributes) {
  const script = document.createElement('script');
  for (const [k, v] of Object.entries(attributes)) script.setAttribute(k, v);
  document.body.appendChild(script);
  return script;
}

function configElement(json, id = 'espanso-config') {
  const el = document.createElement('script');
  el.type = 'application/x-espanso+json';
  el.id = id;
  el.textContent = JSON.stringify(json);
  document.body.appendChild(el);
  return el;
}

const BASIC = { matches: [{ trigger: ';hi', replace: 'Hello!' }, { trigger: ';bye', replace: 'Goodbye' }] };

// ---------------------------------------------------------------------------
// Config sources

test('auto: inline config via data-config selector', async () => {
  document.body.innerHTML = '<input id="f">';
  const events = recordEvents();
  configElement(BASIC, 'cfg');
  const loader = startAutoLoader({ script: scriptWith({ 'data-config': '#cfg' }), document });
  await loader.ready;
  assert.deepEqual(events, [{ type: 'espanso:ready', detail: { matchCount: 2 }, bubbles: false }]);

  const input = document.getElementById('f');
  await typeInto(input, 'x ;hi');
  assert.equal(input.value, 'x Hello!');
  loader.stop();
});

test('auto: falls back to the first application/x-espanso+json element', async () => {
  document.body.innerHTML = '<input id="f">';
  configElement(BASIC);
  const events = recordEvents();
  const loader = startAutoLoader({ script: scriptWith({}), document });
  await loader.ready;
  assert.deepEqual(events[0].detail, { matchCount: 2 });
  loader.stop();
});

test('auto: same-origin data-config-url is fetched with same-origin credentials and no-store', async () => {
  document.body.innerHTML = '<input id="f">';
  const calls = [];
  const fetchStub = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify(BASIC) };
  };
  const events = recordEvents();
  const loader = startAutoLoader({ script: scriptWith({ 'data-config-url': '/api/snippets' }), document, fetch: fetchStub });
  await loader.ready;
  assert.deepEqual(calls, [{ url: 'https://example.org/api/snippets', init: { credentials: 'same-origin', cache: 'no-store' } }]);
  assert.deepEqual(events[0].detail, { matchCount: 2 });
  loader.stop();
});

test('auto: a cross-origin data-config-url is refused and never fetched', async () => {
  let fetched = false;
  const events = recordEvents();
  const loader = startAutoLoader({
    script: scriptWith({ 'data-config-url': 'https://evil.example.com/snippets.json' }),
    document,
    fetch: async () => { fetched = true; },
  });
  await loader.ready;
  assert.equal(fetched, false);
  assert.deepEqual(events, [
    { type: 'espanso:error', detail: { kind: 'config', errorName: 'CrossOriginConfigError', count: 1 }, bubbles: false },
    { type: 'espanso:ready', detail: { matchCount: 0 }, bubbles: false },
  ]);
  loader.stop();
});

test('auto: HTTP errors and invalid JSON are config errors', async () => {
  const events = recordEvents();
  let loader = startAutoLoader({
    script: scriptWith({ 'data-config-url': '/missing' }),
    document,
    fetch: async () => ({ ok: false, status: 404, text: async () => '' }),
  });
  await loader.ready;
  loader.stop();
  const el = document.createElement('div');
  el.id = 'bad';
  el.textContent = '{ not json';
  document.body.appendChild(el);
  loader = startAutoLoader({ script: scriptWith({ 'data-config': '#bad' }), document });
  await loader.ready;
  loader.stop();
  assert.deepEqual(events.filter((e) => e.type === 'espanso:error').map((e) => e.detail), [
    { kind: 'config', errorName: 'ConfigSourceError', count: 1 },
    { kind: 'config', errorName: 'SyntaxError', count: 1 },
  ]);
});

test('auto: no config or no enabled matches attaches nothing', async () => {
  const added = [];
  const original = document.addEventListener.bind(document);
  document.addEventListener = (type, ...rest) => {
    added.push(type);
    return original(type, ...rest);
  };
  const events = recordEvents();
  added.length = 0;

  let loader = startAutoLoader({ script: scriptWith({}), document });
  await loader.ready;
  loader.stop();
  configElement({ config: { enable: false }, matches: BASIC.matches });
  loader = startAutoLoader({ script: scriptWith({}), document });
  await loader.ready;
  loader.stop();
  configElement({ matches: [] }, 'empty');
  loader = startAutoLoader({ script: scriptWith({ 'data-config': '#empty' }), document });
  await loader.ready;
  loader.stop();

  assert.deepEqual(events.map((e) => e.detail), [{ matchCount: 0 }, { matchCount: 0 }, { matchCount: 0 }]);
  // Only the espanso:reload listener: no input/keyboard/mouse listeners
  assert.deepEqual([...new Set(added)], ['espanso:reload']);
});

test('auto: espanso:reload re-reads the config and fires ready again', async () => {
  document.body.innerHTML = '<input id="f">';
  const cfg = configElement({ matches: [{ trigger: ';a', replace: 'first' }] }, 'cfg');
  const events = recordEvents();
  const loader = startAutoLoader({ script: scriptWith({ 'data-config': '#cfg' }), document });
  await loader.ready;

  cfg.textContent = JSON.stringify({ matches: [{ trigger: ';a', replace: 'second' }, { trigger: ';b', replace: 'b' }] });
  document.dispatchEvent(new window.CustomEvent('espanso:reload'));
  await loader.reload(); // wait for the queued reload (and one more, harmless)

  assert.deepEqual(events.map((e) => e.detail.matchCount), [1, 2, 2]);
  const input = document.getElementById('f');
  await typeInto(input, ';a');
  assert.equal(input.value, 'second');
  loader.stop();
});

test('auto: error events never carry messages or user text', async () => {
  const MARKER = 'SECRETMARKER4242';
  document.body.innerHTML = '<input id="f">';
  configElement({
    matches: [
      { regex: `(${MARKER}`, replace: 'x' }, // invalid regex: config error quoting the pattern
      { trigger: ';leak', replace: `{{${MARKER}}}` }, // missing variable: render error naming it
    ],
  });
  const raw = [];
  document.addEventListener('espanso:error', (e) => raw.push(e));
  const loader = startAutoLoader({ script: scriptWith({}), document });
  await loader.ready;
  const input = document.getElementById('f');
  await typeInto(input, ';leak');

  assert.ok(raw.length >= 2);
  for (const event of raw) {
    assert.deepEqual(Object.keys(event.detail).sort(), ['count', 'errorName', 'kind']);
    assert.equal(JSON.stringify(event.detail).includes(MARKER), false);
    assert.equal(event.bubbles, false);
  }
  assert.deepEqual(raw.map((e) => e.detail.kind).sort(), ['config', 'render']);
  loader.stop();
});

test('auto: errorName only returns identifier-like class names', () => {
  assert.equal(errorName(new TypeError('x')), 'TypeError');
  assert.equal(errorName(null), 'Error');
  assert.equal(errorName({ constructor: { name: 'has spaces and text' } }), 'Error');
  // `name` wins (minification renames constructors), but only if identifier-like
  class Mangled extends Error { constructor() { super('m'); this.name = 'RealName'; } }
  assert.equal(errorName(new Mangled()), 'RealName');
  const odd = new RangeError('x');
  odd.name = 'user text with spaces';
  assert.equal(errorName(odd), 'RangeError');
});

test('auto: the built bundle exposes nothing on window', { skip: !existsSync('dist/espanso-auto.min.js') && 'run npm run build first' }, async () => {
  const dom = new JSDOM(
    '<!doctype html><body><input id="f"><script type="application/x-espanso+json">{"matches":[{"trigger":";hi","replace":"Hello!"}]}</script></body>',
    { url: 'https://example.org/', runScripts: 'dangerously' },
  );
  const win = dom.window;
  const before = new Set(Object.getOwnPropertyNames(win));
  const ready = new Promise((resolve) => win.document.addEventListener('espanso:ready', (e) => resolve(e.detail)));
  const script = win.document.createElement('script');
  script.textContent = readFileSync('dist/espanso-auto.min.js', 'utf8');
  win.document.body.appendChild(script);
  assert.equal(JSON.stringify(await ready), '{"matchCount":1}');
  const added = Object.getOwnPropertyNames(win).filter((k) => !before.has(k));
  assert.deepEqual(added, []);
});

// ---------------------------------------------------------------------------
// Declarative config keys (honored by createEspanso too)

test('config: exclude_selector, and an invalid selector is reported, not thrown', async () => {
  document.body.innerHTML = '<input id="a"><div class="no-expand"><input id="b"></div>';
  const espanso = createEspanso({ config: { exclude_selector: '.no-expand' }, matches: BASIC.matches }).attach();
  await typeInto(document.getElementById('a'), ';hi');
  await typeInto(document.getElementById('b'), ';hi');
  assert.equal(document.getElementById('a').value, 'Hello!');
  assert.equal(document.getElementById('b').value, ';hi');
  espanso.detach();

  const errors = [];
  const bad = createEspanso({ config: { exclude_selector: '[[[' }, matches: BASIC.matches, onError: (e, kind) => errors.push([kind, e.name]) });
  bad.attach();
  document.getElementById('a').value = '';
  await typeInto(document.getElementById('a'), ';bye');
  assert.equal(document.getElementById('a').value, 'Goodbye');
  assert.deepEqual(errors, [['config', 'InvalidSelectorError']]);
  bad.detach();
});

test('config: include_password_fields', async () => {
  document.body.innerHTML = '<input id="pw" type="password">';
  const espanso = createEspanso({ config: { include_password_fields: true }, matches: BASIC.matches }).attach();
  await typeInto(document.getElementById('pw'), ';hi');
  assert.equal(document.getElementById('pw').value, 'Hello!');
  espanso.detach();
});

test('config: rich_text false flattens html/markdown and never inserts HTML or images', async () => {
  document.body.innerHTML = '<div id="ed" contenteditable="true"></div>';
  const commands = [];
  document.execCommand = (cmd) => { commands.push(cmd); return false; };
  const RangeProto = window.Range.prototype;
  let fragments = 0;
  const originalFragment = RangeProto.createContextualFragment;
  RangeProto.createContextualFragment = function patched(...args) { fragments += 1; return originalFragment.apply(this, args); };

  const errors = [];
  const espanso = createEspanso({
    config: { rich_text: false },
    matches: [
      { trigger: ';h', html: '<b>bold</b> &amp; <i>it</i><br>next' },
      { trigger: ';m', markdown: '**strong** text' },
      { trigger: ';img', image_path: '/a.png' },
    ],
    onError: (e, kind) => errors.push([kind, e.name]),
  });
  assert.deepEqual(espanso.errors.map((e) => e.error.name), ['DisabledMatchError']);
  const injected = [];
  espanso.engine.on('*', (e) => injected.push(e.type));
  espanso.attach();

  const ed = document.getElementById('ed');
  await typeIntoRich(ed, ';h');
  assert.equal(ed.textContent, 'bold & itnext');
  assert.equal(ed.innerHTML.includes('<b>'), false);
  await typeIntoRich(ed, ' ;m');
  assert.equal(ed.textContent.endsWith(' strong text'), true);
  await typeIntoRich(ed, ' ;img');
  assert.equal(ed.textContent.endsWith(' ;img'), true);

  assert.equal(commands.includes('insertHTML'), false);
  assert.equal(fragments, 0);
  assert.equal(injected.includes('htmlInject'), false);
  assert.equal(injected.includes('imageInject'), false);
  RangeProto.createContextualFragment = originalFragment;
  espanso.detach();
});

test('config: regex false drops regex matches at load', async () => {
  document.body.innerHTML = '<input id="f">';
  const espanso = createEspanso({
    config: { regex: false },
    matches: [{ regex: ';n(?P<x>\\d)', replace: 'n{{x}}' }, ...BASIC.matches],
  }).attach();
  assert.deepEqual(espanso.errors.map((e) => [e.level, e.error.name]), [['error', 'DisabledMatchError']]);
  assert.equal(espanso.engine.activeMatches().length, 2);
  await typeInto(document.getElementById('f'), ';n5');
  assert.equal(document.getElementById('f').value, ';n5');
  espanso.detach();
});

test('config: disabled_var_types blocks the match and inserts nothing', async () => {
  document.body.innerHTML = '<input id="f">';
  const errors = [];
  const espanso = createEspanso({
    config: { disabled_var_types: ['clipboard', 'date'] },
    globalVars: [{ name: 'today', type: 'date', params: { format: '%Y' } }],
    matches: [
      { trigger: ';d', replace: '{{x}}', vars: [{ name: 'x', type: 'date', params: { format: '%Y' } }] },
      { trigger: ';g', replace: 'year {{today}}' },
      { trigger: ';ok', replace: 'fine' },
    ],
    onError: (e, kind) => errors.push([kind, e.name]),
  }).attach();
  const input = document.getElementById('f');
  await typeInto(input, ';d');
  assert.equal(input.value, ';d');
  await typeInto(input, ' ;g');
  assert.equal(input.value, ';d ;g');
  await typeInto(input, ' ;ok');
  assert.equal(input.value, ';d ;g fine');
  assert.deepEqual(errors, [['render', 'DisabledVariableTypeError'], ['render', 'DisabledVariableTypeError']]);
  espanso.detach();
});

// ---------------------------------------------------------------------------
// `dom` variable

test('dom variable: resolution order, defaults and errors', () => {
  document.body.innerHTML = `
    <script type="application/json" id="ctx">{"dates":{"start":"2026-01-02","n":3},"list":["a","b"],"blank":"  "}</script>
    <div id="attr" data-ref="R-1">text content</div>
    <input id="ctl" value="from value">
    <select id="sel"><option value="one">One</option><option value="two" selected>Two</option></select>
    <p id="txt">  plain text  </p>
    <p id="empty">   </p>`;
  const ext = createDomExtension({ getDocument: () => document });
  const calc = (params) => ext.calculate({}, new Map(), params);

  assert.equal(calc({ selector: '#ctx', json_path: 'dates.start' }), '2026-01-02');
  assert.equal(calc({ selector: '#ctx', json_path: 'dates.n' }), '3');
  assert.equal(calc({ selector: '#ctx', json_path: 'list.1' }), 'b');
  assert.equal(calc({ selector: '#ctx', json_path: 'dates' }), '{"start":"2026-01-02","n":3}');
  assert.equal(calc({ selector: '#ctx', json_path: 'dates.missing', default: 'n/a' }), 'n/a');
  assert.equal(calc({ selector: '#ctx', json_path: 'blank', default: 'n/a' }), 'n/a');
  assert.equal(calc({ selector: '#attr', attribute: 'data-ref' }), 'R-1');
  assert.equal(calc({ selector: '#attr', attribute: 'data-nope' }), '');
  assert.equal(calc({ selector: '#ctl' }), 'from value');
  assert.equal(calc({ selector: '#sel' }), 'two');
  assert.equal(calc({ selector: '#txt' }), '  plain text  ');
  assert.equal(calc({ selector: '#empty', default: 'd' }), 'd');
  assert.equal(calc({ selector: '#nothing', default: 'd' }), 'd');
  assert.equal(calc({ selector: '#nothing' }), '');
  assert.throws(() => calc({ selector: '[[[' }), { name: 'DomVariableError' });
  assert.throws(() => calc({ selector: '#attr', json_path: 'x' }), { name: 'DomVariableError' });
  assert.throws(() => calc({}), { name: 'DomVariableError' });
  assert.equal(walkJsonPath({ a: { b: 1 } }, 'a.toString'), undefined);
});

test('dom variable: end to end, read from the page', async () => {
  document.body.innerHTML = `
    <script type="application/json" id="page-context">{"ref":"AB-12"}</script>
    <input id="f">`;
  const before = document.body.innerHTML;
  const espanso = createEspanso({
    matches: [{
      trigger: ';ref',
      replace: 'Ref: {{r}}',
      vars: [{ name: 'r', type: 'dom', params: { selector: '#page-context', json_path: 'ref' } }],
    }],
  }).attach();
  const input = document.getElementById('f');
  await typeInto(input, ';ref');
  assert.equal(input.value, 'Ref: AB-12');
  assert.equal(espanso.engine.getDocument(), document);
  // read-only: the page structure is untouched
  assert.equal(document.body.innerHTML.replace(/value="[^"]*"/, ''), before.replace(/value="[^"]*"/, ''));
  espanso.detach();
});

// ---------------------------------------------------------------------------
// `change` on the fallback insert path

test('fallback injection fires input and change on <input>/<textarea>', async () => {
  document.body.innerHTML = '<input id="f"><textarea id="t"></textarea>';
  assert.equal(typeof document.execCommand === 'function' && document.execCommand('insertText', false, 'x'), false);
  const espanso = createEspanso({ matches: BASIC.matches }).attach();
  for (const id of ['f', 't']) {
    const el = document.getElementById(id);
    let committed = null;
    let inputs = 0;
    el.addEventListener('change', () => { committed = el.value; });
    el.addEventListener('input', () => { inputs += 1; });
    // eslint-disable-next-line no-await-in-loop
    await typeInto(el, ';hi');
    assert.equal(committed, 'Hello!');
    assert.equal(inputs, 3 + 2); // 3 typed + delete + insert
  }
  espanso.detach();
});
