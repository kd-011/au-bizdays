import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ok, run } from './helpers.mjs';

const ENVELOPE = ['assumptions', 'caveats', 'command', 'input', 'result', 'schema', 'state'];
const ASSUMPTIONS = ['coverage', 'data_source', 'data_version', 'holidays_counted', 'part_day_holidays', 'regional_holidays', 'weekend'];

const COMMANDS = [
  ['add', ['add', '10', '--from', '2026-12-18', '--state', 'WA'], { n: 10, from: '2026-12-18' }, ['date', 'from', 'n', 'skipped_holidays', 'weekday']],
  ['diff', ['diff', '2026-12-18', '2027-01-06', '--state', 'WA'], { from: '2026-12-18', to: '2027-01-06', inclusive: false }, ['business_days', 'from', 'inclusive', 'to']],
  ['is', ['is', '2026-12-28', '--state', 'WA'], { date: '2026-12-28' }, ['date', 'is_business_day', 'reasons', 'weekday']],
  ['next', ['next', '2026-12-24', '--state', 'WA'], { date: '2026-12-24' }, ['date', 'from', 'weekday']],
  ['prev', ['prev', '2026-12-29', '--state', 'WA'], { date: '2026-12-29' }, ['date', 'from', 'weekday']],
  ['roll', ['roll', '2026-12-26', '--direction', 'forward', '--state', 'WA'], { date: '2026-12-26', direction: 'forward' }, ['date', 'direction', 'from', 'moved', 'weekday']],
  ['add-calendar', ['add-calendar', '14', '--from', '2026-12-14', '--roll', 'forward', '--state', 'WA'], { n: 14, from: '2026-12-14', roll: 'forward' }, ['calendar_date', 'date', 'from', 'n', 'roll', 'rolled', 'weekday']],
  ['holidays', ['holidays', '--year', '2026', '--state', 'WA'], { year: 2026 }, ['holidays', 'retrieved_on', 'source_url', 'year']],
];

describe('--json schema (au-bizdays/v1)', () => {
  for (const [command, args, input, resultKeys] of COMMANDS) {
    test(`${command}: envelope, input echo and result keys`, () => {
      const out = ok(args);
      assert.deepEqual(Object.keys(out).sort(), ENVELOPE);
      assert.equal(out.schema, 'au-bizdays/v1');
      assert.equal(out.command, command);
      assert.equal(out.state, 'WA');
      assert.deepEqual(out.input, input);
      assert.deepEqual(Object.keys(out.result).sort(), [...resultKeys].sort());
      assert.deepEqual(Object.keys(out.assumptions).sort(), ASSUMPTIONS);
      assert.ok(Array.isArray(out.caveats) && out.caveats.every((c) => typeof c === 'string'));
    });
  }

  test('assumptions state the definition and the data', () => {
    const a = ok(['is', '2026-06-01', '--state', 'NSW']).assumptions;
    assert.deepEqual(a.weekend, ['Saturday', 'Sunday']);
    assert.equal(a.holidays_counted, 'statewide');
    assert.match(a.part_day_holidays, /not counted/);
    assert.match(a.regional_holidays, /not counted/);
    assert.match(a.data_version, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(a.coverage, { from: '2025-01-01', to: '2028-12-31' });
    assert.equal(a.data_source.length, 4);
    for (const s of a.data_source) {
      assert.match(s.url, /^https:\/\//);
      assert.match(s.retrieved_on, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Number.isInteger(s.year));
    }
  });

  test('every result carries the standing caveats', () => {
    for (const [, args] of COMMANDS) {
      const c = ok(args).caveats.join('\n');
      assert.match(c, /not legal advice/i);
      assert.match(c, /contract|legislation|court/i);
      assert.match(c, /regional|local/i);
    }
  });

  test('output is deterministic: the same call twice gives identical bytes', () => {
    for (const [, args] of COMMANDS) {
      assert.equal(run([...args, '--json']).stdout, run([...args, '--json']).stdout);
    }
  });
});

describe('caveats', () => {
  test('an estimated holiday that the result touches is called out', () => {
    // VIC 2027 Friday before the AFL Grand Final: the page says "subject to AFL schedule".
    const touched = ok(['add', '1', '--from', '2027-09-23', '--state', 'VIC']);
    assert.equal(touched.result.date, '2027-09-27');
    assert.ok(touched.caveats.some((c) => /estimated/i.test(c) && /2027-09-24/.test(c)), touched.caveats.join('\n'));
    const clear = ok(['add', '1', '--from', '2027-06-01', '--state', 'VIC']);
    assert.ok(!clear.caveats.some((c) => /estimated/i.test(c)));
  });

  test('all of NSW 2028 is estimated, so any NSW 2028 answer says so', () => {
    const out = ok(['is', '2028-06-12', '--state', 'NSW']);
    assert.ok(out.caveats.some((c) => /estimated/i.test(c)));
    assert.ok(!ok(['is', '2027-06-14', '--state', 'NSW']).caveats.some((c) => /estimated/i.test(c)));
  });

  test('the holidays command flags estimated entries too', () => {
    const out = ok(['holidays', '--year', '2028', '--state', 'WA']);
    assert.ok(out.caveats.some((c) => /estimated/i.test(c) && /2028-09-25/.test(c)));
  });

  test('a range that avoids the estimated date has no estimated caveat', () => {
    const out = ok(['add', '1', '--from', '2027-09-27', '--state', 'VIC']);
    assert.ok(!out.caveats.some((c) => /estimated/i.test(c)));
  });

  test('within 60 days of the end of the data, results say when coverage ends', () => {
    const near = ok(['is', '2026-06-01', '--state', 'WA'], { AU_BIZDAYS_TODAY: '2028-11-01' });
    assert.ok(near.caveats.some((c) => /coverage ends on 2028-12-31/i.test(c)), near.caveats.join('\n'));
    const far = ok(['is', '2026-06-01', '--state', 'WA'], { AU_BIZDAYS_TODAY: '2028-10-31' });
    assert.ok(!far.caveats.some((c) => /coverage ends/i.test(c)));
    const now = ok(['is', '2026-06-01', '--state', 'WA'], { AU_BIZDAYS_TODAY: '2026-11-02' });
    assert.ok(!now.caveats.some((c) => /coverage ends/i.test(c)));
  });
});

describe('human output', () => {
  test('add is short plain English', () => {
    const r = run(['add', '10', '--from', '2026-12-18', '--state', 'WA']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /2027-01-06/);
    assert.match(r.stdout, /Wednesday/);
    assert.match(r.stdout, /Boxing Day/);
    assert.ok(r.stdout.trim().split('\n').length <= 8, r.stdout);
    assert.ok(!r.stdout.includes(String.fromCharCode(0x2014)));
  });
  test('is says why', () => {
    assert.match(run(['is', '2026-12-28', '--state', 'VIC']).stdout, /not a business day.*Boxing Day/is);
    assert.match(run(['is', '2026-12-27', '--state', 'VIC']).stdout, /not a business day.*weekend/is);
    assert.match(run(['is', '2026-12-29', '--state', 'VIC']).stdout, /is a business day/i);
  });
  test('holidays lists date, name and scope', () => {
    const out = run(['holidays', '--year', '2026', '--state', 'SA']).stdout;
    assert.match(out, /2026-12-24.*Christmas Eve.*part-day/);
    assert.match(out, /2026-03-09.*Adelaide Cup/);
  });
});
