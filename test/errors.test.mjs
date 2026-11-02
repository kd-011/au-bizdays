import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { run } from './helpers.mjs';

const RANGE = '2025-01-01 to 2028-12-31';

describe('usage errors exit 2', () => {
  const cases = [
    ['unknown state', ['is', '2026-06-01', '--state', 'XX']],
    ['New Zealand is not a state', ['is', '2026-06-01', '--state', 'NZ']],
    ['missing --state', ['is', '2026-06-01']],
    ['empty --state', ['is', '2026-06-01', '--state', '']],
    ['missing --from', ['add', '3', '--state', 'WA']],
    ['non-numeric n', ['add', 'abc', '--from', '2026-06-01', '--state', 'WA']],
    ['fractional n', ['add', '1.5', '--from', '2026-06-01', '--state', 'WA']],
    ['impossible date', ['is', '2026-02-30', '--state', 'WA']],
    ['month 13', ['is', '2026-13-01', '--state', 'WA']],
    ['not ISO', ['is', '1/6/2026', '--state', 'WA']],
    ['a timestamp is not a date', ['is', '2026-06-01T10:00:00Z', '--state', 'WA']],
    ['missing date argument', ['is', '--state', 'WA']],
    ['bad roll direction', ['roll', '2026-06-01', '--direction', 'sideways', '--state', 'WA']],
    ['missing roll direction', ['roll', '2026-06-01', '--state', 'WA']],
    ['bad --roll value', ['add-calendar', '3', '--from', '2026-06-01', '--roll', 'maybe', '--state', 'WA']],
    ['holidays needs --year', ['holidays', '--state', 'WA']],
    ['non-numeric year', ['holidays', '--year', 'next', '--state', 'WA']],
    ['unknown command', ['frobnicate', '--state', 'WA']],
    ['unknown option', ['is', '2026-06-01', '--state', 'WA', '--colour']],
    ['no arguments', []],
  ];
  for (const [name, args] of cases) {
    test(name, () => {
      const r = run(args);
      assert.equal(r.code, 2, `${name}: ${r.stdout}${r.stderr}`);
      assert.equal(r.stdout, '', 'nothing on stdout for a usage error without --json');
      assert.match(r.stderr, /\S/);
    });
  }

  test('the unknown-state message lists the valid states', () => {
    const r = run(['is', '2026-06-01', '--state', 'XX']);
    assert.match(r.stderr, /ACT.*NSW.*NT.*QLD.*SA.*TAS.*VIC.*WA/s);
  });

  test('--json puts the error on stdout in a stable shape', () => {
    const r = run(['is', '2026-06-01', '--state', 'XX', '--json']);
    assert.equal(r.code, 2);
    assert.equal(r.json.schema, 'au-bizdays/v1');
    assert.equal(r.json.error.code, 'usage');
    assert.equal(r.json.error.exit_code, 2);
    assert.match(r.json.error.message, /state/i);
    assert.equal(r.json.result, undefined);
  });
});

describe('state names are case-insensitive', () => {
  for (const s of ['wa', 'Wa', 'WA']) {
    test(s, () => {
      const r = run(['is', '2026-06-01', '--state', s, '--json']);
      assert.equal(r.code, 0);
      assert.equal(r.json.state, 'WA');
    });
  }
});

describe('dates outside the bundled data exit 3 and name the range', () => {
  const cases = [
    ['is, after the end', ['is', '2029-01-01', '--state', 'WA']],
    ['is, before the start', ['is', '2024-12-31', '--state', 'WA']],
    ['holidays for an uncovered year', ['holidays', '--year', '2029', '--state', 'VIC']],
    ['holidays for an earlier year', ['holidays', '--year', '2024', '--state', 'NSW']],
    ['next from the last covered Friday needs 2029', ['next', '2028-12-29', '--state', 'WA']],
    ['add that walks off the end', ['add', '2', '--from', '2028-12-28', '--state', 'QLD']],
    ['add that walks off the start', ['add', '-1', '--from', '2025-01-02', '--state', 'SA']],
    ['diff with an end outside', ['diff', '2028-12-20', '2029-01-05', '--state', 'TAS']],
    ['diff with a start outside', ['diff', '2024-12-30', '2025-01-02', '--state', 'NT']],
    ['roll forward off the end', ['roll', '2028-12-30', '--direction', 'forward', '--state', 'ACT']],
    ['roll back off the start', ['roll', '2025-01-01', '--direction', 'back', '--state', 'WA']],
    ['add-calendar past the end', ['add-calendar', '30', '--from', '2028-12-15', '--roll', 'none', '--state', 'NSW']],
  ];
  for (const [name, args] of cases) {
    test(name, () => {
      const r = run(args);
      assert.equal(r.code, 3, `${name}: ${r.stdout}${r.stderr}`);
      assert.equal(r.stdout, '');
      assert.ok(r.stderr.includes(RANGE), r.stderr);
    });
  }

  test('the last covered business day still works', () => {
    const r = run(['add', '1', '--from', '2028-12-28', '--state', 'WA', '--json']);
    assert.equal(r.code, 0);
    assert.equal(r.json.result.date, '2028-12-29');
  });

  test('the last covered day of the data answers is, and the day after does not', () => {
    assert.equal(run(['is', '2028-12-31', '--state', 'WA']).code, 0);
    assert.equal(run(['is', '2025-01-01', '--state', 'WA']).code, 0);
    assert.equal(run(['is', '2029-01-01', '--state', 'WA']).code, 3);
  });

  test('--json error shape', () => {
    const r = run(['is', '2029-01-01', '--state', 'WA', '--json']);
    assert.equal(r.code, 3);
    assert.equal(r.json.error.code, 'out_of_coverage');
    assert.equal(r.json.error.exit_code, 3);
    assert.ok(r.json.error.message.includes(RANGE));
    assert.deepEqual(r.json.error.coverage, { from: '2025-01-01', to: '2028-12-31' });
    assert.equal(r.json.result, undefined);
  });
});

describe('help', () => {
  test('--help exits 0 and explains the conventions', () => {
    const r = run(['--help']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /add <n>/);
    assert.match(r.stdout, /ACT, NSW, NT, QLD, SA, TAS, VIC, WA/);
    assert.match(r.stdout, /exit/i);
  });
  test('add --help says the start day does not count', () => {
    const r = run(['add', '--help']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /does not count/i);
    assert.match(r.stdout, /negative/i);
  });
  test('diff --help says which ends are counted', () => {
    const r = run(['diff', '--help']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /exclud/i);
    assert.match(r.stdout, /--inclusive/);
  });
  test('--version prints a version', () => {
    const r = run(['--version']);
    assert.equal(r.code, 0);
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
  });
});
