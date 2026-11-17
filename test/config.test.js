// Ports of the espanso-config unit tests (yaml loader, match store, config resolution)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/config/yaml-default.js';
import { parseYaml } from '../src/config/yaml.js';
import { lenientFlowQuote } from '../src/config/yaml-lenient.js';
import { convertMatch } from '../src/matches/loader.js';
import { MatchStore } from '../src/matches/store.js';
import { ConfigStore } from '../src/config/config.js';
import { VirtualFS, normalizePath } from '../src/config/vfs.js';
import { globToRegExp } from '../src/config/glob.js';

const create = (yaml) => {
  const { match, warnings } = convertMatch(parseYaml(yaml));
  return { m: match, warnings };
};

test('yaml: BOM, empty documents and lenient flow values (#2748)', () => {
  assert.deepEqual(parseYaml('﻿a: 1'), { a: 1 });
  assert.deepEqual(parseYaml(''), {});
  assert.deepEqual(parseYaml('# just a comment\n\n'), {});
  assert.deepEqual(parseYaml('matches:\n  - triggers: [:->,:>-]\n    replace: smile\n').matches[0].triggers, [':->', ':>-']);
  assert.deepEqual(parseYaml('matches:\n  - triggers: [:-), :-D]\n    replace: smile\n').matches[0].triggers, [':-)', ':-D']);
  const block = parseYaml('matches:\n  - triggers: [:-)]\n    replace: |\n      if [ :>x ]; then echo hi; fi\n');
  assert.equal(block.matches[0].replace, 'if [ :>x ]; then echo hi; fi\n');
  assert.equal(lenientFlowQuote("a: ['quoted', :x]"), "a: ['quoted', ':x']");
  // dates stay strings, like serde
  assert.deepEqual(parseYaml('a: 2021-01-01'), { a: '2021-01-01' });
});

test('match: basic, triggers and word options', () => {
  let { m } = create('trigger: "Hello"\nreplace: "world"');
  assert.deepEqual(m.cause, {
    type: 'trigger', triggers: ['Hello'], leftWord: false, rightWord: false, propagateCase: false, uppercaseStyle: 'uppercase',
  });
  assert.deepEqual(m.effect, { type: 'text', replace: 'world', vars: [], format: 'plain', forceMode: null });

  ({ m } = create('triggers: ["Hello", "john"]\nreplace: "world"'));
  assert.deepEqual(m.cause.triggers, ['Hello', 'john']);

  ({ m } = create('trigger: "Hello"\nreplace: "world"\nword: true'));
  assert.equal(m.cause.leftWord, true);
  assert.equal(m.cause.rightWord, true);

  ({ m } = create('trigger: "Hello"\nreplace: "world"\nleft_word: true'));
  assert.equal(m.cause.leftWord, true);
  assert.equal(m.cause.rightWord, false);

  ({ m } = create('trigger: "Hello"\nreplace: "world"\nright_word: true'));
  assert.equal(m.cause.rightWord, true);
});

test('match: propagate_case and uppercase_style', () => {
  let { m, warnings } = create('trigger: "Hello"\nreplace: "world"\npropagate_case: true\nuppercase_style: capitalize_words');
  assert.equal(m.cause.propagateCase, true);
  assert.equal(m.cause.uppercaseStyle, 'capitalize_words');
  assert.equal(warnings.length, 0);

  ({ warnings } = create('trigger: "Hello"\nreplace: "world"\nuppercase_style: capitalize'));
  assert.match(warnings[0].message, /without 'propagate_case'/);

  ({ m, warnings } = create('trigger: "Hello"\nreplace: "world"\npropagate_case: true\nuppercase_style: invalid'));
  assert.equal(m.cause.uppercaseStyle, 'uppercase');
  assert.match(warnings[0].message, /unrecognized uppercase_style/);
});

test('match: empty triggers are removed with a warning', () => {
  const { m, warnings } = create('triggers: ["", "  ", "ok"]\nreplace: "x"');
  assert.deepEqual(m.cause.triggers, ['ok']);
  assert.match(warnings[0].message, /empty triggers/);
});

test('match: vars, regex, formats, force mode, image, label', () => {
  let { m } = create(`
trigger: ":t"
replace: "{{x}}"
vars:
  - name: x
    type: echo
    params:
      echo: hi
    inject_vars: false
    depends_on: [y]
`);
  assert.deepEqual(m.effect.vars.map(({ id, ...rest }) => rest), [
    { name: 'x', type: 'echo', params: { echo: 'hi' }, injectVars: false, dependsOn: ['y'] },
  ]);

  ({ m } = create('regex: "hello\\\\d"\nreplace: "x"'));
  assert.deepEqual(m.cause, { type: 'regex', regex: 'hello\\d' });

  ({ m } = create('trigger: ":t"\nmarkdown: "**x**"'));
  assert.equal(m.effect.format, 'markdown');
  ({ m } = create('trigger: ":t"\nhtml: "<b>x</b>"'));
  assert.equal(m.effect.format, 'html');

  ({ m } = create('trigger: ":t"\nreplace: "x"\nforce_clipboard: true'));
  assert.equal(m.effect.forceMode, 'clipboard');
  ({ m } = create('trigger: ":t"\nreplace: "x"\nforce_mode: keys'));
  assert.equal(m.effect.forceMode, 'keys');

  ({ m } = create('trigger: ":t"\nimage_path: "$CONFIG/images/a.png"'));
  assert.deepEqual(m.effect, { type: 'image', path: '$CONFIG/images/a.png' });

  ({ m } = create('trigger: ":t"\nreplace: "x"\nlabel: "My label"\nsearch_terms: [a, b]'));
  assert.equal(m.label, 'My label');
  assert.deepEqual(m.searchTerms, ['a', 'b']);
});

test('match: form syntax becomes a form variable', () => {
  const { m } = create(`
trigger: ":form"
form: "Hey [[name]], how are you? \\\\{ok\\\\}"
form_fields:
  name:
    type: choice
    values: [John, Bob]
`);
  assert.equal(m.effect.replace, 'Hey {{form1.name}}, how are you? { ok }');
  const [formVar] = m.effect.vars;
  assert.equal(formVar.type, 'form');
  assert.equal(formVar.name, 'form1');
  assert.equal(formVar.params.layout, 'Hey [[name]], how are you? \\{ok\\}');
  assert.deepEqual(formVar.params.fields, { name: { type: 'choice', values: ['John', 'Bob'] } });
});

test('match: no effect is an error', () => {
  assert.throws(() => create('trigger: "Hello"'), /does not produce any effect/);
});

test('vfs and glob', () => {
  assert.equal(normalizePath('./config/../match//base.yml'), 'match/base.yml');
  assert.equal(normalizePath('C:\\espanso\\match\\a.yml'), 'C:/espanso/match/a.yml');
  const re = globToRegExp('match/**/[!_]*.yml');
  assert.equal(re.test('match/base.yml'), true);
  assert.equal(re.test('match/sub/deep/x.yml'), true);
  assert.equal(re.test('match/_hidden.yml'), false);
  assert.equal(re.test('match/base.yaml'), false);
});

test('match store: imports and query de-duplication', () => {
  const vfs = new VirtualFS({
    'match/base.yml': 'imports: ["sub/sub.yml", "../other/missing.yml"]\nmatches:\n  - trigger: hello\n    replace: world\n',
    'match/sub/sub.yml': 'imports: ["../base.yml"]\nglobal_vars:\n  - name: v\n    type: echo\n    params: {echo: x}\nmatches:\n  - trigger: sub\n    replace: s\n',
    'match/_private.yml': 'matches:\n  - trigger: private\n    replace: p\n',
  });
  const { store, errors } = MatchStore.load(vfs, ['match/base.yml']);
  assert.deepEqual(store.loadedPaths().sort(), ['match/base.yml', 'match/sub/sub.yml']);
  assert.equal(errors.length, 1);
  assert.match(errors[0].error.message, /unable to resolve import/);

  const { matches, globalVars } = store.query(['match/base.yml', 'match/sub/sub.yml']);
  assert.deepEqual(matches.map((m) => m.cause.triggers[0]), ['sub', 'hello']);
  assert.deepEqual(globalVars.map((g) => g.name), ['v']);
});

test('config store: includes/excludes, inheritance and app filters', () => {
  const vfs = new VirtualFS({
    'config/default.yml': 'backspace_limit: 7\nexcludes: ["../match/excluded.yml"]\n',
    'config/mail.yml': 'filter_title: "Mail"\nextra_includes: ["../extra/*.yml"]\nundo_backspace: false\n',
    'config/site.yml': 'filter_url: "example\\\\.com"\nenable: false\nuse_standard_includes: false\nincludes: ["../only/*.yml"]\n',
    'match/base.yml': 'matches: []',
    'match/sub/nested.yaml': 'matches: []',
    'match/_ignored.yml': 'matches: []',
    'match/excluded.yml': 'matches: []',
    'extra/mail.yml': 'matches: []',
    'only/one.yml': 'matches: []',
  });
  const { store, errors } = ConfigStore.load(vfs);
  assert.deepEqual(errors, []);

  const def = store.default();
  assert.equal(def.backspaceLimit, 7);
  assert.deepEqual(def.matchPaths, ['match/base.yml', 'match/sub/nested.yaml']);

  const mail = store.active({ title: 'Inbox - Mail' });
  assert.equal(mail.sourcePath, 'config/mail.yml');
  assert.equal(mail.backspaceLimit, 7); // inherited
  assert.equal(mail.undoBackspace, false);
  // excludes are inherited from default.yml too
  assert.deepEqual(mail.matchPaths, ['extra/mail.yml', 'match/base.yml', 'match/sub/nested.yaml']);

  const site = store.active({ title: 'x', url: 'https://example.com/page' });
  assert.equal(site.sourcePath, 'config/site.yml');
  assert.equal(site.enable, false);
  assert.deepEqual(site.matchPaths, ['only/one.yml']);

  assert.equal(store.active({ title: 'other' }), def);
  assert.equal(def.isMatch({ title: 'Mail' }), false); // no filters => never matches
});
