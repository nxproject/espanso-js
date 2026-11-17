// Browser layer tests (detection + injection) on jsdom.
// jsdom has no execCommand / Selection.modify, so this exercises the fallback paths;
// real browsers are covered by the demo page (see README).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let dom;
let window;
let document;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><title>Test page</title><body></body>', { url: 'https://example.org/' });
  window = dom.window;
  document = window.document;
  globalThis.document = document;
  globalThis.location = window.location;
});

const { createEspanso, editableKind } = await import('../src/index.js');

const YAML = `
matches:
  - trigger: ":brb"
    replace: "be right back"
  - trigger: ":cur"
    replace: "[$|$]"
  - trigger: ":html"
    html: "<b>bold</b> text"
  - trigger: "ty"
    replace: "thank you"
    word: true
`;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Simulate typing in an <input>/<textarea>: update the value, then fire `input`. */
async function typeInto(el, text) {
  for (const c of text) {
    const start = el.selectionStart;
    el.setRangeText(c, start, el.selectionEnd, 'end');
    el.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }));
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
}

/** Simulate typing in a contenteditable element (caret in a text node). */
async function typeIntoRich(el, text) {
  const sel = window.getSelection();
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

test('editableKind', () => {
  document.body.innerHTML = `
    <input id="t"><input id="p" type="password"><input id="c" type="checkbox">
    <textarea id="ta"></textarea><div id="ce" contenteditable="true"><span id="inner">x</span></div>
    <input id="ro" readonly>`;
  const $ = (id) => document.getElementById(id);
  assert.equal(editableKind($('t')), 'input');
  assert.equal(editableKind($('p')), null);
  assert.equal(editableKind($('p'), { includePasswordFields: true }), 'input');
  assert.equal(editableKind($('c')), null);
  assert.equal(editableKind($('ta')), 'input');
  assert.equal(editableKind($('ce')), 'contenteditable');
  assert.equal(editableKind($('inner')), 'contenteditable');
  assert.equal(editableKind($('ro')), null);
});

test('expands in an <input> and notifies listeners', async () => {
  document.body.innerHTML = '<input id="field">';
  const input = document.getElementById('field');
  input.focus();
  const espanso = createEspanso({ yaml: YAML }).attach();
  let inputEvents = 0;
  input.addEventListener('input', () => { inputEvents += 1; });

  await typeInto(input, 'see you :brb');
  assert.equal(input.value, 'see you be right back');
  assert.equal(input.selectionStart, input.value.length);
  // 12 typed chars + 1 delete + 1 insert dispatched by the injector
  assert.equal(inputEvents, 14);
  espanso.detach();
});

test('cursor hint and textarea', async () => {
  document.body.innerHTML = '<textarea id="field">line 1\n</textarea>';
  const textarea = document.getElementById('field');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  const espanso = createEspanso({ yaml: YAML }).attach();

  await typeInto(textarea, ':cur');
  assert.equal(textarea.value, 'line 1\n[]');
  assert.equal(textarea.selectionStart, 8);
  espanso.detach();
});

test('word triggers keep the separator', async () => {
  document.body.innerHTML = '<input id="field">';
  const input = document.getElementById('field');
  input.focus();
  const espanso = createEspanso({ yaml: YAML }).attach();
  await typeInto(input, 'ok ty.');
  assert.equal(input.value, 'ok thank you.');
  await typeInto(input, ' pity ');
  assert.equal(input.value, 'ok thank you. pity ');
  espanso.detach();
});

test('expands in a contenteditable, including HTML', async () => {
  document.body.innerHTML = '<div id="editor" contenteditable="true">Hi </div>';
  const editor = document.getElementById('editor');
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild, 3);
  range.collapse(true);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  const espanso = createEspanso({ yaml: YAML }).attach();
  await typeIntoRich(editor, ':brb');
  assert.equal(editor.textContent, 'Hi be right back');

  await typeIntoRich(editor, ' :html');
  assert.equal(editor.innerHTML, 'Hi be right back <b>bold</b> text');
  espanso.detach();
});

test('html matches are flattened to text in plain fields', async () => {
  document.body.innerHTML = '<input id="field">';
  const input = document.getElementById('field');
  input.focus();
  const espanso = createEspanso({ yaml: YAML }).attach();
  await typeInto(input, ':html');
  assert.equal(input.value, 'bold text');
  espanso.detach();
});

test('clicks and password fields', async () => {
  document.body.innerHTML = '<input id="field"><input id="pw" type="password">';
  const input = document.getElementById('field');
  const pw = document.getElementById('pw');
  const espanso = createEspanso({ yaml: YAML }).attach();

  input.focus();
  await typeInto(input, ':b');
  input.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  await typeInto(input, 'rb');
  assert.equal(input.value, ':brb');

  pw.focus();
  await typeInto(pw, ':brb');
  assert.equal(pw.value, ':brb');
  espanso.detach();
});

test('detach stops expanding; app info comes from the page', async () => {
  document.body.innerHTML = '<input id="field">';
  const input = document.getElementById('field');
  input.focus();
  const espanso = createEspanso({
    files: {
      'match/base.yml': YAML,
      'config/test.yml': 'filter_title: "Test page"\nenable: false\n',
    },
  });
  espanso.attach();
  await typeInto(input, ':brb');
  assert.equal(input.value, ':brb'); // disabled on this page by the app-specific config

  document.title = 'Another';
  input.value = '';
  await typeInto(input, ':brb');
  assert.equal(input.value, 'be right back');

  espanso.detach();
  input.value = '';
  await typeInto(input, ':brb');
  assert.equal(input.value, ':brb');
});
