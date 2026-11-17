// Real-browser end-to-end tests: drives the demo page in an installed Chrome/Edge
// with genuine keystrokes (so the native execCommand injection path is exercised).
//
//   npm run build && npm run test:browser
//
// Set BROWSER_PATH to pick a specific Chromium-based browser executable.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.js';

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = CANDIDATES.find((p) => existsSync(p));

let server;
let browser;
let page;
const PORT = 8765;

before(async () => {
  if (!executablePath) return;
  server = await startServer(PORT);
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e));
  await page.goto(`http://127.0.0.1:${PORT}/demo/`);
  await page.waitForSelector('body[data-ready="true"]');
});

after(async () => {
  await browser?.close();
  server?.close();
});

const opts = { skip: executablePath ? false : 'no Chromium-based browser found' };

async function fresh(selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if ('value' in el) el.value = '';
    else el.innerHTML = '';
    el.blur();
  }, selector);
  await page.click(selector);
}

const value = (selector) => page.$eval(selector, (el) => ('value' in el ? el.value : el.innerHTML));
const caret = (selector) => page.$eval(selector, (el) => el.selectionStart);

test('no load errors', opts, async () => {
  assert.equal(await page.$eval('#errors', (el) => el.textContent), '');
});

test('input: simple, nested, regex and word triggers', opts, async () => {
  await fresh('#input');
  await page.keyboard.type('Say :espanso');
  assert.equal(await value('#input'), 'Say Hi there!');

  await fresh('#input');
  await page.keyboard.type(':intro');
  assert.equal(await value('#input'), "Hi there! I'm Jane Doe.");

  await fresh('#input');
  await page.keyboard.type(':hello(Ana)');
  assert.equal(await value('#input'), 'Hello Ana, nice to meet you!');

  await fresh('#input');
  await page.keyboard.type('Alh, it works. pitalh ');
  assert.equal(await value('#input'), 'Although, it works. pitalh ');
});

test('input: native undo stack contains the expansion', opts, async () => {
  await fresh('#input');
  await page.keyboard.type(':espanso');
  assert.equal(await value('#input'), 'Hi there!');
  await page.keyboard.press('Control+z');
  assert.notEqual(await value('#input'), 'Hi there!');
});

test('textarea: cursor hint, multi-line and backspace undo', opts, async () => {
  await fresh('#textarea');
  await page.keyboard.type(':div');
  assert.equal(await value('#textarea'), '<div></div>');
  assert.equal(await caret('#textarea'), 5);
  await page.keyboard.type('x');
  assert.equal(await value('#textarea'), '<div>x</div>');

  await fresh('#textarea');
  await page.keyboard.type(':sig');
  assert.equal(await value('#textarea'), 'Best regards,\nJane Doe\n');

  await fresh('#textarea');
  await page.keyboard.type(':espanso');
  await page.keyboard.press('Backspace');
  assert.equal(await value('#textarea'), ':espanso');
});

test('contenteditable: text, markdown and html', opts, async () => {
  await fresh('#editor');
  await page.keyboard.type('Hey :espanso');
  assert.equal(await page.$eval('#editor', (el) => el.textContent), 'Hey Hi there!');

  await fresh('#editor');
  await page.keyboard.type(':bold');
  const html = await value('#editor');
  assert.match(html, /<(b|strong)>bold<\/(b|strong)>/);
  assert.match(html, /<(i|em)>italic<\/(i|em)>/);

  await fresh('#editor');
  await page.keyboard.type(':link');
  assert.match(await value('#editor'), /<a href="https:\/\/espanso\.org">espanso<\/a>/);

  await fresh('#editor');
  await page.keyboard.type(':div');
  await page.keyboard.type('y');
  assert.equal(await page.$eval('#editor', (el) => el.textContent), '<div>y</div>');
});

test('toggle key (double Alt) disables expansion', opts, async () => {
  await fresh('#input');
  await page.keyboard.press('Alt');
  await page.keyboard.press('Alt');
  assert.equal(await page.$eval('#status', (el) => el.textContent), 'disabled');
  await page.keyboard.type(':espanso');
  assert.equal(await value('#input'), ':espanso');
  await page.click('#toggle');
  assert.equal(await page.$eval('#status', (el) => el.textContent), 'enabled');
});

test('works with a React-style controlled input', opts, async () => {
  // Simulates a framework that re-renders from its own state on every input event
  await page.evaluate(() => {
    const el = document.createElement('input');
    el.id = 'controlled';
    let state = '';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.addEventListener('input', () => {
      state = el.value;
      setter.call(el, state);
    });
    el.dataset.state = '';
    el.addEventListener('input', () => { el.dataset.state = state; });
    document.body.appendChild(el);
  });
  await page.click('#controlled');
  await page.keyboard.type(':espanso');
  assert.equal(await page.$eval('#controlled', (el) => el.dataset.state), 'Hi there!');
});

// --- Auto-loader pages (the host never calls the library) ---------------------

async function openAutoPage(path) {
  const p = await browser.newPage();
  p.on('pageerror', (e) => console.error('page error:', e));
  // Test harness only: record the espanso:* events the page receives
  await p.addInitScript(() => {
    window.__events = [];
    for (const type of ['espanso:ready', 'espanso:error']) {
      document.addEventListener(type, (e) => window.__events.push({ type, detail: e.detail }));
    }
  });
  await p.goto(`http://127.0.0.1:${PORT}/demo/${path}`);
  await p.waitForFunction(() => window.__events.some((e) => e.type === 'espanso:ready'));
  return p;
}

async function freshIn(p, selector) {
  await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if ('value' in el) el.value = '';
    else el.innerHTML = '';
    el.blur();
  }, selector);
  await p.click(selector);
}

test('auto (data-config-url): expansion, dom variable, rich_text:false, exclusions', opts, async () => {
  const p = await openAutoPage('auto.html');
  const events = await p.evaluate(() => window.__events);
  assert.deepEqual(events, [{ type: 'espanso:ready', detail: { matchCount: 7 } }]);
  // Nothing exposed by the library on window (only the harness' own __events)
  const globals = await p.evaluate(() => Object.keys(window).filter((k) => /espanso/i.test(k)));
  assert.deepEqual(globals, []);

  await freshIn(p, '#input');
  await p.keyboard.type('x ;hi');
  assert.equal(await p.$eval('#input', (el) => el.value), 'x Hello there!');

  await freshIn(p, '#textarea');
  await p.keyboard.type(';ref');
  assert.equal(await p.$eval('#textarea', (el) => el.value), 'Order AB-1042, due 2026-12-01');

  await freshIn(p, '#editor');
  await p.keyboard.type(';bold');
  assert.equal(await p.$eval('#editor', (el) => el.textContent), 'bold & italic');
  assert.equal(await p.$eval('#editor', (el) => el.querySelector('b, i') === null), true);

  await freshIn(p, '#excluded');
  await p.keyboard.type(';hi');
  assert.equal(await p.$eval('#excluded', (el) => el.value), ';hi');

  // clipboard is a disabled variable type: nothing changes, an error event is fired
  await freshIn(p, '#input');
  await p.keyboard.type(';paste');
  assert.equal(await p.$eval('#input', (el) => el.value), ';paste');
  const errors = await p.evaluate(() => window.__events.filter((e) => e.type === 'espanso:error'));
  assert.deepEqual(errors, [{ type: 'espanso:error', detail: { kind: 'render', errorName: 'DisabledVariableTypeError', count: 1 } }]);
  await p.close();
});

test('auto (inline config): dom attribute variable and espanso:reload', opts, async () => {
  const p = await openAutoPage('auto-inline.html');
  assert.deepEqual(await p.evaluate(() => window.__events), [{ type: 'espanso:ready', detail: { matchCount: 3 } }]);

  await freshIn(p, '#input');
  await p.keyboard.type(';who');
  assert.equal(await p.$eval('#input', (el) => el.value), 'Name: Ana');

  await freshIn(p, '#editor');
  await p.keyboard.type(';bold');
  assert.equal(await p.$eval('#editor', (el) => el.innerHTML), 'bold text');

  // The host publishes new data and asks for a reload
  await p.evaluate(() => {
    document.getElementById('espanso-config').textContent = JSON.stringify({
      matches: [{ trigger: ';hi', replace: 'Reloaded!' }],
    });
    document.dispatchEvent(new CustomEvent('espanso:reload'));
  });
  await p.waitForFunction(() => window.__events.filter((e) => e.type === 'espanso:ready').length === 2);
  assert.deepEqual((await p.evaluate(() => window.__events)).at(-1), { type: 'espanso:ready', detail: { matchCount: 1 } });

  await freshIn(p, '#input');
  await p.keyboard.type(';hi ;who');
  assert.equal(await p.$eval('#input', (el) => el.value), 'Reloaded! ;who');
  await p.close();
});

test('auto: a render failure leaves the field untouched (rendering_error_text defaults to null)', opts, async () => {
  const p = await openAutoPage('auto.html');
  await freshIn(p, '#input');
  await p.keyboard.type('Dear Ann ;broken');
  await p.waitForFunction(() => window.__events.some((e) => e.type === 'espanso:error'));
  assert.equal(await p.$eval('#input', (el) => el.value), 'Dear Ann ;broken');

  await freshIn(p, '#editor');
  await p.keyboard.type(';broken');
  await p.waitForFunction(() => window.__events.filter((e) => e.type === 'espanso:error').length === 2);
  assert.equal(await p.$eval('#editor', (el) => el.textContent), ';broken');

  const errors = await p.evaluate(() => window.__events.filter((e) => e.type === 'espanso:error'));
  assert.deepEqual(errors.map((e) => e.detail), [
    { kind: 'render', errorName: 'DomVariableError', count: 1 },
    { kind: 'render', errorName: 'DomVariableError', count: 2 },
  ]);

  // Still working afterwards
  await p.keyboard.type(' ;hi');
  assert.equal(await p.$eval('#editor', (el) => el.textContent), ';broken Hello there!');
  await p.close();
});
