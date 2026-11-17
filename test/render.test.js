// Ports of the espanso-render unit tests (renderer/mod.rs, extension/*.rs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, RenderAbortedError, CasingStyle } from '../src/render/renderer.js';
import { createDateExtension, strftime } from '../src/render/extensions/date.js';
import {
  createEchoExtension,
  createRandomExtension,
  createChoiceExtension,
  createFormExtension,
  parseChoices,
} from '../src/render/extensions/basic.js';

const mock = {
  name: 'mock',
  calculate(_context, scope, params) {
    if (typeof params.echo === 'string') return params.echo;
    if (typeof params.name === 'string' && typeof params.value === 'string') {
      return { [params.name]: params.value };
    }
    if (typeof params.read === 'string' && typeof scope.get(params.read) === 'string') {
      return scope.get(params.read);
    }
    if ('abort' in params) throw new RenderAbortedError();
    if ('error' in params) throw new Error('mock error');
    throw new RenderAbortedError();
  },
};

const renderer = () => new Renderer([mock]);
const v = (name, params, extra = {}) => ({ name, type: 'mock', params, injectVars: true, dependsOn: [], ...extra });
const tpl = (body, vars = []) => ({ ids: ['id'], body, vars });
const echoVars = (pairs) => pairs.map(([name, value]) => v(name, { echo: value }));
const ctx = (globalVars = [], templates = []) => ({ globalVars, templates });

test('no variable, no styling', async () => {
  assert.equal(await renderer().render(tpl('plain body'), ctx()), 'plain body');
});

test('casing styles', async () => {
  const r = renderer();
  assert.equal(await r.render(tpl('plain body'), ctx(), { casingStyle: CasingStyle.Capitalize }), 'Plain body');
  assert.equal(
    await r.render(tpl('ordinary least squares, with other.punctuation !Marks'), ctx(), {
      casingStyle: CasingStyle.CapitalizeWords,
    }),
    'Ordinary Least Squares, With Other.Punctuation !Marks',
  );
  assert.equal(await r.render(tpl('plain body'), ctx(), { casingStyle: CasingStyle.Uppercase }), 'PLAIN BODY');
  assert.equal(await r.render(tpl(''), ctx(), { casingStyle: CasingStyle.Capitalize }), '');
});

test('basic and dict variables', async () => {
  const r = renderer();
  assert.equal(await r.render(tpl('hello {{var}}', echoVars([['var', 'world']])), ctx()), 'hello world');
  assert.equal(
    await r.render(tpl('hello {{var.nested}}', [v('var', { name: 'nested', value: 'dict' })]), ctx()),
    'hello dict',
  );
  assert.equal(await r.render(tpl('hello {{ var }}', echoVars([['var', 'spaces']])), ctx()), 'hello spaces');
});

test('missing variable is an error', async () => {
  await assert.rejects(renderer().render(tpl('hello {{var}}'), ctx()));
});

test('global variables', async () => {
  const r = renderer();
  assert.equal(await r.render(tpl('hello {{var}}'), ctx([v('var', { echo: 'world' })])), 'hello world');
  assert.equal(
    await r.render(tpl('hello {{var.nested}}'), ctx([v('var', { name: 'nested', value: 'dict' })])),
    'hello dict',
  );
});

test('global variable explicit ordering', async () => {
  const template = tpl('hello {{var}} {{local}}', [
    v('local', { echo: 'Bob' }),
    { name: 'var', type: 'global', params: {}, injectVars: true, dependsOn: [] },
  ]);
  const globals = [v('var', { read: 'local' })];
  assert.equal(await renderer().render(template, ctx(globals)), 'hello Bob Bob');
});

test('nested global variable and circular dependency', async () => {
  const r = renderer();
  assert.equal(
    await r.render(tpl('hello {{var2}}'), ctx([v('var', { echo: 'world' }), v('var2', { echo: '{{var}}' })])),
    'hello world',
  );
  await assert.rejects(
    r.render(tpl('hello {{var}}'), ctx([
      v('var', { echo: '{{var2}}' }),
      v('var2', { echo: '{{var3}}' }),
      v('var3', { echo: '{{var}}' }),
    ])),
    /circular dependency/,
  );
});

test('depends_on forces evaluation (and aborts propagate)', async () => {
  await assert.rejects(
    renderer().render(tpl('hello {{var}}'), ctx([
      v('var', { echo: 'world' }, { dependsOn: ['var2'] }),
      v('var2', { abort: null }),
    ])),
    RenderAbortedError,
  );
  await assert.rejects(
    renderer().render(
      tpl('hello {{var}}', [v('var', { echo: 'something' }, { dependsOn: ['global'] })]),
      ctx([v('global', { abort: null })]),
    ),
    RenderAbortedError,
  );
});

test('nested matches', async () => {
  const nested = { ids: ['nested'], body: 'world', vars: [] };
  const template = tpl('hello {{var}}', [{ name: 'var', type: 'match', params: { trigger: 'nested' }, injectVars: true, dependsOn: [] }]);
  assert.equal(await renderer().render(template, ctx([], [nested])), 'hello world');
  await assert.rejects(renderer().render(template, ctx()), /missing sub match/);
});

test('extension abort and error propagate', async () => {
  await assert.rejects(renderer().render(tpl('hello {{var}}', [v('var', { abort: null })]), ctx()), RenderAbortedError);
  await assert.rejects(renderer().render(tpl('hello {{var}}', [v('var', { error: null })]), ctx()), /mock error/);
});

test('variable injection', async () => {
  const r = renderer();
  assert.equal(
    await r.render(tpl('hello {{fullname}}', [
      v('firstname', { echo: 'John' }),
      v('lastname', { echo: 'Snow' }),
      v('fullname', { echo: '{{firstname}} {{lastname}}' }),
    ]), ctx()),
    'hello John Snow',
  );
  assert.equal(
    await r.render(tpl('hello {{second}}', [
      v('first', { echo: 'one' }),
      v('second', { echo: '{{first}} two' }, { injectVars: false }),
    ]), ctx()),
    'hello {{first}} two',
  );
  assert.equal(
    await r.render(tpl('hello {{second}}', [
      v('first', { echo: 'one' }),
      v('second', { echo: '\\{\\{first\\}\\} two' }),
    ]), ctx()),
    'hello {{first}} two',
  );
  await assert.rejects(r.render(tpl('hello {{second}}', [v('second', { echo: 'the next is {{missing}}' })]), ctx()));
});

test('variable injection with global variable', async () => {
  assert.equal(
    await renderer().render(
      tpl('hello {{output}}', [v('output', { echo: '{{var}}' })]),
      ctx([v('var', { echo: 'global' })]),
    ),
    'hello global',
  );
});

// --- extensions ---

const fixed = () => new Date(2014, 6, 8, 9, 10, 11);

test('date: format, offset, locale, tz', () => {
  const ext = createDateExtension({ now: fixed, getLocale: () => 'en-US' });
  assert.equal(ext.calculate({}, new Map(), { format: '%H:%M:%S' }), '09:10:11');
  assert.equal(ext.calculate({}, new Map(), { format: '%H:%M:%S', offset: 3600 }), '10:10:11');
  assert.equal(ext.calculate({}, new Map(), { format: '%H:%M:%S', offset: '3600' }), '10:10:11');
  assert.equal(ext.calculate({}, new Map(), { format: '%H:%M:%S', offset: 'invalid' }), '09:10:11');
  assert.equal(ext.calculate({}, new Map(), { format: '%A', locale: 'it-IT' }), 'martedì');
  assert.equal(ext.calculate({}, new Map(), { format: '%H:%M:%S', tz: 'Invalid/Timezone' }), '09:10:11');
  assert.throws(() => ext.calculate({}, new Map(), { format: '%Y-%m-%dT%H:%i:%s%Q' }), /invalid date format/);

  const it = createDateExtension({ now: fixed, getLocale: () => 'it-IT' });
  assert.equal(it.calculate({}, new Map(), { format: '%A' }), 'martedì');
  const invalid = createDateExtension({ now: fixed, getLocale: () => 'invalid' });
  assert.equal(invalid.calculate({}, new Map(), { format: '%A' }), 'Tuesday');

  const utcNoon = () => new Date(Date.UTC(2014, 6, 8, 12, 0, 0));
  const tz = createDateExtension({ now: utcNoon });
  assert.equal(tz.calculate({}, new Map(), { format: '%Y-%m-%d %H:%M:%S', tz: 'UTC' }), '2014-07-08 12:00:00');
  assert.equal(tz.calculate({}, new Map(), { format: '%Y-%m-%d %H:%M:%S %z', tz: 'America/New_York' }), '2014-07-08 08:00:00 -0400');
  assert.equal(tz.calculate({}, new Map(), { tz: 'UTC' }), 'Tue, 8 Jul 2014 12:00:00 +0000');
});

test('date: strftime specifiers', () => {
  const d = new Date(Date.UTC(2021, 0, 3, 15, 4, 5, 26)); // Sunday
  const f = (fmt) => strftime(d, fmt, { locale: 'en-US', timeZone: 'UTC' });
  assert.equal(f('%Y %C %y %m %b %B %h %d %e'), '2021 20 21 01 Jan January Jan 03  3');
  assert.equal(f('%a %A %w %u %U %W %G %g %V %j'), 'Sun Sunday 0 7 01 00 2020 20 53 003');
  assert.equal(f('%D %F %v'), '01/03/21 2021-01-03  3-Jan-2021');
  assert.equal(f('%H %k %I %l %P %p %M %S'), '15 15 03  3 pm PM 04 05');
  assert.equal(f('%f %.f %.3f %.6f %3f'), '026000000 .026 .026 .026000 026');
  assert.equal(f('%R %T %r'), '15:04 15:04:05 03:04:05 PM');
  assert.equal(f('%z %:z %::z %:::z %Z'), '+0000 +00:00 +00:00:00 +00 UTC');
  assert.equal(f('%+'), '2021-01-03T15:04:05.026+00:00');
  assert.equal(f('%s'), String(Math.floor(d.getTime() / 1000)));
  assert.equal(f('%-d %-m %_m %0e %%'), '3 1  1 03 %');
  assert.equal(f('a%tb%nc'), 'a\tb\nc');
  assert.equal(f('%x %X'), '01/03/21 03:04:05 PM');
});

test('echo extension coerces scalars', () => {
  const echo = createEchoExtension();
  assert.equal(echo.calculate({}, new Map(), { echo: 'x' }), 'x');
  assert.equal(echo.calculate({}, new Map(), { echo: 42 }), '42');
  assert.equal(echo.calculate({}, new Map(), { echo: true }), 'true');
  assert.throws(() => echo.calculate({}, new Map(), {}), /missing 'echo'/);
});

test('random extension', () => {
  const random = createRandomExtension(() => 0.99);
  assert.equal(random.calculate({}, new Map(), { choices: ['a', 'b', 'c'] }), 'c');
  assert.throws(() => random.calculate({}, new Map(), {}), /missing 'choices'/);
});

test('choice extension', async () => {
  assert.deepEqual(parseChoices('a\n  b  \n\nc'), [
    { id: 'a', label: 'a' }, { id: 'b', label: 'b' }, { id: 'c', label: 'c' },
  ]);
  assert.deepEqual(parseChoices(['x', { id: '1', label: 'One' }]), [{ id: 'x', label: 'x' }, { id: '1', label: 'One' }]);
  assert.throws(() => parseChoices([{ id: '1' }]), /missing either/);

  const first = createChoiceExtension();
  assert.equal(await first.calculate({}, new Map(), { values: ['a', 'b'] }), 'a');
  const picker = createChoiceExtension({ show: async (choices) => choices[1].id });
  assert.equal(await picker.calculate({}, new Map(), { values: ['a', 'b'] }), 'b');
  const aborted = createChoiceExtension({ show: async () => null });
  await assert.rejects(aborted.calculate({}, new Map(), { values: ['a'] }), RenderAbortedError);
});

test('form extension', async () => {
  const form = createFormExtension();
  assert.deepEqual(
    await form.calculate({}, new Map(), { layout: 'Hi [[name]], [[mood]]', fields: { mood: { default: 'happy' } } }),
    { name: '', mood: 'happy' },
  );
  const custom = createFormExtension({ show: async (layout, fields) => ({ name: `${layout}|${Object.keys(fields)}` }) });
  assert.deepEqual(await custom.calculate({}, new Map(), { layout: 'L', fields: { a: {} } }), { name: 'L|a' });
  await assert.rejects(form.calculate({}, new Map(), {}), /missing layout/);
});
