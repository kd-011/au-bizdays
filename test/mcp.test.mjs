import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { call, connect, ok, root, run, textOf } from './helpers.mjs';

const TOOLS = [
  'add_business_days',
  'add_calendar_days',
  'business_days_between',
  'is_business_day',
  'list_holidays',
  'next_business_day',
  'previous_business_day',
  'roll_to_business_day',
];

describe('au-bizdays-mcp over stdio', () => {
  let c;
  before(async () => { c = await connect(); });
  after(() => c.close());

  test('lists the tools, all read-only, each with a real description and a required state', async () => {
    const { tools } = await c.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS);
    for (const t of tools) {
      assert.equal(t.annotations?.readOnlyHint, true, `${t.name} readOnlyHint`);
      assert.ok(t.description.length > 80, `${t.name} needs a description written for a model`);
      assert.ok(t.inputSchema.required.includes('state'), `${t.name} requires state`);
      assert.ok(t.inputSchema.properties.state.description, `${t.name} documents state`);
      assert.ok(t.outputSchema, `${t.name} has an output schema`);
    }
  });

  test('add_business_days returns the same envelope as the CLI, plus a one-line summary', async () => {
    const r = await call(c.client, 'add_business_days', { n: 10, from: '2026-12-18', state: 'WA' });
    assert.ok(!r.isError, textOf(r));
    assert.deepEqual(r.structuredContent, ok(['add', '10', '--from', '2026-12-18', '--state', 'WA']));
    const text = textOf(r);
    assert.ok(!text.includes('\n'), 'one line');
    assert.match(text, /2027-01-06/);
  });

  test('every tool answers a normal call', async () => {
    const calls = {
      add_business_days: { n: 1, from: '2026-12-24', state: 'NSW' },
      add_calendar_days: { n: 14, from: '2026-12-14', roll: 'forward', state: 'WA' },
      business_days_between: { from: '2026-12-18', to: '2027-01-06', state: 'WA' },
      is_business_day: { date: '2026-12-28', state: 'VIC' },
      list_holidays: { year: 2026, state: 'SA' },
      next_business_day: { date: '2026-12-24', state: 'WA' },
      previous_business_day: { date: '2026-12-29', state: 'WA' },
      roll_to_business_day: { date: '2026-12-26', direction: 'forward', state: 'WA' },
    };
    for (const [name, args] of Object.entries(calls)) {
      const r = await call(c.client, name, args);
      assert.ok(!r.isError, `${name}: ${textOf(r)}`);
      assert.equal(r.structuredContent.schema, 'au-bizdays/v1', name);
      assert.ok(textOf(r).length > 0 && !textOf(r).includes('\n'), `${name} one-line text`);
    }
    const v = await call(c.client, 'is_business_day', calls.is_business_day);
    assert.equal(v.structuredContent.result.is_business_day, false);
  });

  test('state is case-insensitive', async () => {
    const r = await call(c.client, 'is_business_day', { date: '2026-12-28', state: 'vic' });
    assert.ok(!r.isError);
    assert.equal(r.structuredContent.state, 'VIC');
  });

  test('errors come back as tool errors with the CLI message', async () => {
    const cases = [
      ['is_business_day', { date: '2029-01-01', state: 'WA' }, ['is', '2029-01-01', '--state', 'WA']],
      ['is_business_day', { date: '2026-02-30', state: 'WA' }, ['is', '2026-02-30', '--state', 'WA']],
      ['is_business_day', { date: '2026-06-01', state: 'XX' }, ['is', '2026-06-01', '--state', 'XX']],
      ['add_business_days', { n: 2, from: '2028-12-28', state: 'QLD' }, ['add', '2', '--from', '2028-12-28', '--state', 'QLD']],
      ['list_holidays', { year: 2024, state: 'NSW' }, ['holidays', '--year', '2024', '--state', 'NSW']],
      // Arguments that do not fit the advertised schema reach the same checks as the CLI's.
      ['is_business_day', { date: '2026-06-01' }, ['is', '2026-06-01']],
      ['is_business_day', { state: 'WA' }, ['is', '--state', 'WA']],
      ['roll_to_business_day', { date: '2026-06-01', direction: 'sideways', state: 'WA' }, ['roll', '2026-06-01', '--direction', 'sideways', '--state', 'WA']],
      ['roll_to_business_day', { date: '2026-06-01', state: 'WA' }, ['roll', '2026-06-01', '--state', 'WA']],
      ['add_calendar_days', { n: 3, from: '2026-06-01', roll: 'maybe', state: 'WA' }, ['add-calendar', '3', '--from', '2026-06-01', '--roll', 'maybe', '--state', 'WA']],
      ['add_business_days', { n: 'abc', from: '2026-06-01', state: 'WA' }, ['add', 'abc', '--from', '2026-06-01', '--state', 'WA']],
      ['add_business_days', { from: '2026-06-01', state: 'WA' }, ['add', '--from', '2026-06-01', '--state', 'WA']],
      ['list_holidays', { state: 'WA' }, ['holidays', '--state', 'WA']],
    ];
    for (const [tool, args, cli] of cases) {
      const r = await call(c.client, tool, args);
      assert.equal(r.isError, true, `${tool} ${JSON.stringify(args)}`);
      const want = run([...cli, '--json']).json.error.message;
      assert.equal(textOf(r), want);
    }
  });

  test('inclusive must be a boolean, so a string is an error and not a silent false', async () => {
    for (const inclusive of ['true', 1, 'yes']) {
      const r = await call(c.client, 'business_days_between', { from: '2026-06-15', to: '2026-06-19', inclusive, state: 'NSW' });
      assert.equal(r.isError, true, `inclusive ${JSON.stringify(inclusive)}`);
      assert.match(textOf(r), /inclusive must be true or false/);
    }
    const ok = await call(c.client, 'business_days_between', { from: '2026-06-15', to: '2026-06-19', inclusive: true, state: 'NSW' });
    assert.equal(ok.structuredContent.result.business_days, 5);
  });

  test('a non-integer n is rejected', async () => {
    const r = await call(c.client, 'add_business_days', { n: 1.5, from: '2026-06-01', state: 'WA' });
    assert.equal(r.isError, true);
  });
});

describe('the server reads nothing and calls nothing outside its own data', () => {
  const dist = join(root, 'dist');
  const files = () => readdirSync(dist).filter((f) => f.endsWith('.js'));

  test('no network modules anywhere in dist', () => {
    for (const f of files()) {
      const src = readFileSync(join(dist, f), 'utf8');
      assert.doesNotMatch(src, /node:(http|https|net|dgram|tls|dns|child_process)|\bfetch\(|XMLHttpRequest|WebSocket/, f);
    }
  });

  test('only the data loader touches the filesystem', () => {
    const users = files().filter((f) => /node:fs|from 'fs'/.test(readFileSync(join(dist, f), 'utf8')));
    assert.deepEqual(users.sort(), ['data.js', 'server.js'].filter((f) => users.includes(f)).sort());
    assert.ok(users.includes('data.js'));
  });
});
