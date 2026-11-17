// Ports of the espanso-match unit tests (rolling/matcher.rs, regex/mod.rs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RollingMatcher, rollingMatchFromString } from '../src/match/rolling.js';
import { RegexMatcher, compileRegex } from '../src/match/regex.js';

function matchesAfter(string, matcher) {
  let state = null;
  let results = [];
  for (const c of string) {
    ({ state, results } = matcher.process(state, { type: 'key', key: 'Other', chars: c }));
  }
  return results;
}

const r = (id, trigger, left = null, right = null, args = {}) => ({
  id, trigger, leftSeparator: left, rightSeparator: right, args,
});

test('rolling: simple strings', () => {
  const matcher = new RollingMatcher([
    rollingMatchFromString(1, 'hi'),
    rollingMatchFromString(2, 'hey'),
    rollingMatchFromString(3, 'my'),
    rollingMatchFromString(4, 'myself'),
    rollingMatchFromString(5, 'hi'),
  ]);
  assert.deepEqual(matchesAfter('hi', matcher), [r(1, 'hi'), r(5, 'hi')]);
  assert.deepEqual(matchesAfter('my', matcher), [r(3, 'my')]);
  assert.deepEqual(matchesAfter('mmy', matcher), [r(3, 'my')]);
  assert.deepEqual(matchesAfter('invalid', matcher), []);
});

test('rolling: word matches', () => {
  const matcher = new RollingMatcher(
    [rollingMatchFromString(1, 'hi', { leftWord: true, rightWord: true }), rollingMatchFromString(2, 'hey')],
    { charWordSeparators: ['.', ','] },
  );
  assert.deepEqual(matchesAfter('hi', matcher), []);
  // Word matches also trigger without a left separator when it's a new state
  assert.deepEqual(matchesAfter('hi,', matcher), [r(1, 'hi,', null, ',')]);
  assert.deepEqual(matchesAfter('.hi,', matcher), [r(1, '.hi,', '.', ',')]);
  assert.deepEqual(matchesAfter('ohi,', matcher), []);
});

test('rolling: case insensitive', () => {
  const matcher = new RollingMatcher(
    [
      rollingMatchFromString(1, 'hi', { caseInsensitive: true }),
      rollingMatchFromString(2, 'hey'),
      rollingMatchFromString(3, 'arty', { caseInsensitive: true }),
    ],
    { charWordSeparators: ['.', ','] },
  );
  assert.deepEqual(matchesAfter('hi', matcher), [r(1, 'hi')]);
  assert.deepEqual(matchesAfter('Hi', matcher), [r(1, 'Hi')]);
  assert.deepEqual(matchesAfter('HI', matcher), [r(1, 'HI')]);
  assert.deepEqual(matchesAfter('arTY', matcher), [r(3, 'arTY')]);
  assert.deepEqual(matchesAfter('ARTY', matcher), [r(3, 'ARTY')]);
  assert.deepEqual(matchesAfter('HEY', matcher), []);
});

test('rolling: unicode triggers', () => {
  const matcher = new RollingMatcher([rollingMatchFromString(1, ':é😀')]);
  assert.deepEqual(matchesAfter('x:é😀', matcher), [r(1, ':é😀')]);
});

test('regex: simple matches', () => {
  const matcher = new RegexMatcher([{ id: 1, regex: 'hello' }, { id: 2, regex: 'num\\d{1,3}s' }]);
  assert.deepEqual(matchesAfter('hi', matcher), []);
  assert.deepEqual(matchesAfter('hello', matcher), [r(1, 'hello')]);
  assert.deepEqual(matchesAfter('say hello', matcher), [r(1, 'hello')]);
  assert.deepEqual(matchesAfter('num1s', matcher), [r(2, 'num1s')]);
  assert.deepEqual(matchesAfter('num134s', matcher), [r(2, 'num134s')]);
  assert.deepEqual(matchesAfter('nums', matcher), []);
});

test('regex: named groups become variables', () => {
  const matcher = new RegexMatcher([
    { id: 1, regex: 'hello\\((?P<name>.*?)\\)' },
    { id: 2, regex: 'multi\\((?P<name1>.*?),(?P<name2>.*?)\\)' },
  ]);
  assert.deepEqual(matchesAfter('hi', matcher), []);
  assert.deepEqual(matchesAfter('say hello(mary)', matcher), [r(1, 'hello(mary)', null, null, { name: 'mary' })]);
  assert.deepEqual(matchesAfter('multi(mary,jane)', matcher), [
    r(2, 'multi(mary,jane)', null, null, { name1: 'mary', name2: 'jane' }),
  ]);
});

test('regex: max buffer size', () => {
  const matcher = new RegexMatcher(
    [{ id: 1, regex: 'hello\\((?P<name>.*?)\\)' }],
    { maxBufferSize: 15 },
  );
  assert.deepEqual(matchesAfter('say hello(mary)', matcher), [r(1, 'hello(mary)', null, null, { name: 'mary' })]);
  assert.deepEqual(matchesAfter('hello(very long name over buffer)', matcher), []);
});

test('regex: Rust syntax is translated', () => {
  assert.equal(compileRegex('(?i)hello').test('HeLLo'), true);
  assert.equal(compileRegex('\\Afoo\\z').test('foo'), true);
  assert.equal(compileRegex('[[:digit:]]+').test('42'), true);
  assert.equal(compileRegex('\\p{Lu}').test('É'), true);
  const invalid = [];
  const matcher = new RegexMatcher([{ id: 1, regex: '(' }], { onError: (e) => invalid.push(e) });
  assert.equal(invalid.length, 1);
  assert.deepEqual(matchesAfter('(', matcher), []);
});
