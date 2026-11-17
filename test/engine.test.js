// End-to-end engine tests with an in-memory "text field"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/core.js';

/** A fake text field: a string plus a caret, driven by the injector. */
function createField() {
  const field = {
    text: '',
    caret: 0,
    type(chars) {
      field.text = field.text.slice(0, field.caret) + chars + field.text.slice(field.caret);
      field.caret += chars.length;
    },
    backspace() {
      const chars = Array.from(field.text.slice(0, field.caret));
      chars.pop();
      const before = chars.join('');
      field.text = before + field.text.slice(field.caret);
      field.caret = before.length;
    },
  };
  field.injector = {
    injectKeys(keys) {
      for (const key of keys) {
        if (key === 'Backspace') field.backspace();
        else if (key === 'ArrowLeft') field.caret = Math.max(0, field.caret - 1);
      }
    },
    injectText(text) { field.type(text); },
    injectHtml(html) { field.type(`<html>${html}</html>`); },
    injectImage(path) { field.type(`<img ${path}>`); },
  };
  return field;
}

const BASE = `
global_vars:
  - name: who
    type: echo
    params: { echo: World }
matches:
  - trigger: ":brb"
    replace: "be right back"
  - trigger: ":hi"
    replace: "Hello {{who}}!"
  - trigger: ":cur"
    replace: "<$|$>"
  - trigger: "alh"
    replace: "although"
    propagate_case: true
    word: true
  - trigger: "ty"
    replace: "thank you"
    word: true
  - regex: '[:]add\\((?P<a>\\d+),(?P<b>\\d+)\\)'
    replace: "{{a}}+{{b}}"
  - trigger: ":md"
    markdown: "**bold**"
  - trigger: ":nest"
    replace: "[{{inner}}]"
    vars:
      - name: inner
        type: match
        params: { trigger: ":brb" }
  - trigger: ":img"
    image_path: "$CONFIG/a.png"
  - trigger: ":broken"
    replace: "{{missing}}"
  - trigger: ":dup"
    replace: "first"
  - trigger: ":dup"
    replace: "second"
  - trigger: ":pick"
    replace: "{{c}}"
    vars:
      - name: c
        type: choice
        params:
          values: [red, green]
`;

function setup(extra = {}) {
  const field = createField();
  const errors = [];
  const { files = {}, ...options } = extra;
  const { engine, errors: loadErrors } = createEngine({
    injector: field.injector,
    configDir: 'config',
    onError: (e) => errors.push(e),
    ...options,
    files: { 'match/base.yml': BASE, ...files },
  });
  assert.deepEqual(loadErrors, []);
  // Simulates the browser: the field changes, then the engine sees the input event
  const type = async (text) => {
    for (const c of text) {
      field.type(c);
      // eslint-disable-next-line no-await-in-loop
      await engine.handleInput({ type: 'keyboard', key: c === ' ' ? 'Space' : 'Other', value: c });
    }
  };
  const backspace = async () => {
    field.backspace();
    await engine.handleInput({ type: 'keyboard', key: 'Backspace' });
  };
  return { engine, field, type, backspace, errors };
}

test('expands a simple trigger', async () => {
  const { field, type } = setup();
  await type('hello :brb');
  assert.equal(field.text, 'hello be right back');
});

test('global variables', async () => {
  const { field, type } = setup();
  await type(':hi');
  assert.equal(field.text, 'Hello World!');
});

test('cursor hint moves the caret', async () => {
  const { field, type } = setup();
  await type(':cur');
  assert.equal(field.text, '<>');
  assert.equal(field.caret, 1);
});

test('word triggers and propagate case', async () => {
  const { field, type } = setup();
  await type('ty ');
  assert.equal(field.text, 'thank you ');
  field.text = ''; field.caret = 0;
  await type('pity ');
  assert.equal(field.text, 'pity ');
  field.text = ''; field.caret = 0;
  await type('Alh, ALH. alh ');
  assert.equal(field.text, 'Although, ALTHOUGH. although ');
});

test('regex triggers with named groups', async () => {
  const { field, type } = setup();
  await type('sum :add(12,30)');
  assert.equal(field.text, 'sum 12+30');
});

test('markdown, nested matches and images', async () => {
  const { field, type } = setup({ configDir: 'cfg' });
  await type(':md');
  assert.equal(field.text, '<html><strong>bold</strong></html>');
  field.text = ''; field.caret = 0;
  await type(':nest');
  assert.equal(field.text, '[be right back]');
  field.text = ''; field.caret = 0;
  await type(':img');
  assert.equal(field.text, '<img cfg/a.png>');
});

test('backspace right after an expansion undoes it', async () => {
  const { field, type, backspace } = setup();
  await type(':brb');
  assert.equal(field.text, 'be right back');
  await backspace();
  assert.equal(field.text, ':brb');
});

test('backspace while typing rewinds the matcher', async () => {
  const { field, type, backspace } = setup();
  await type(':brx');
  await backspace();
  await type('b');
  assert.equal(field.text, 'be right back');
});

test('navigation keys and clicks reset the buffer', async () => {
  const { engine, field, type } = setup();
  await type(':b');
  await engine.handleInput({ type: 'keyboard', key: 'ArrowLeft' });
  await type('rb');
  assert.equal(field.text, ':brb');
  field.text = ''; field.caret = 0;
  await type(':br');
  await engine.handleInput({ type: 'mouse' });
  await type('b');
  assert.equal(field.text, ':brb');
});

test('rendering errors are reported and injected', async () => {
  const { field, type, errors } = setup();
  await type(':broken');
  assert.match(field.text, /An error occurred during rendering/);
  assert.match(errors[0].message, /missing/);
});

test('multiple matches use the match selector', async () => {
  let offered;
  const { field, type } = setup({
    matchSelector: {
      select: async (matches) => {
        offered = matches.map((m) => m.label);
        return matches[1].id;
      },
    },
  });
  await type(':dup');
  assert.deepEqual(offered, ['first', 'second']);
  assert.equal(field.text, 'second');
});

test('choice uses the configured selector', async () => {
  const { field, type } = setup({ choiceSelector: { show: async (choices) => choices[1].id } });
  await type(':pick');
  assert.equal(field.text, 'green');
});

test('enable / disable / toggle key', async () => {
  const { engine, field, type } = setup({ files: { 'config/default.yml': 'toggle_key: ALT' } });
  await engine.disable();
  await type(':brb');
  assert.equal(field.text, ':brb');
  await engine.enable();
  field.text = ''; field.caret = 0;
  await type(':brb');
  assert.equal(field.text, 'be right back');

  const events = [];
  engine.on('disabled', (e) => events.push(e.type));
  await engine.handleInput({ type: 'keyboard', key: 'Alt', status: 'released' });
  await engine.handleInput({ type: 'keyboard', key: 'Alt', status: 'released' });
  assert.deepEqual(events, ['disabled']);
  assert.equal(engine.enabled, false);
});

test('app-specific configs (filter_url, enable: false)', async () => {
  let url = 'https://other.org';
  const { field, type } = setup({
    getAppInfo: () => ({ url }),
    files: {
      'config/default.yml': '',
      'config/off.yml': 'filter_url: "secret\\\\.com"\nenable: false\n',
    },
  });
  await type(':brb');
  assert.equal(field.text, 'be right back');
  url = 'https://secret.com/x';
  field.text = ''; field.caret = 0;
  await type(':brb');
  assert.equal(field.text, ':brb');
});

test('exec and expand APIs', async () => {
  const { engine, field } = setup();
  assert.equal(await engine.expand(':hi'), 'Hello World!');
  assert.equal(await engine.expand(':cur'), '<>');
  assert.equal(await engine.expand(':nope'), null);
  field.type('x');
  await engine.exec(':brb');
  assert.equal(field.text, 'xbe right back');
});

test('inline matches', async () => {
  const field = createField();
  const { engine } = createEngine({
    injector: field.injector,
    matches: [{ trigger: ';;sig', replace: 'Best,\nMe' }],
  });
  for (const c of ';;sig') {
    field.type(c);
    // eslint-disable-next-line no-await-in-loop
    await engine.handleInput({ type: 'keyboard', key: 'Other', value: c });
  }
  assert.equal(field.text, 'Best,\nMe');
});
