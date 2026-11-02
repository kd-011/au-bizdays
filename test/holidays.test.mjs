import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COVERAGE, ESTIMATED, PART_DAY, STATEWIDE } from './expected.mjs';
import { STATES, ok } from './helpers.mjs';

const YEARS = [2025, 2026, 2027, 2028];

describe('bundled holiday data matches the official lists', () => {
  for (const state of STATES) {
    for (const year of YEARS) {
      test(`${state} ${year}: statewide dates`, () => {
        const out = ok(['holidays', '--year', String(year), '--state', state]);
        const got = out.result.holidays.filter((h) => h.scope === 'statewide').map((h) => h.date).sort();
        assert.deepEqual(got, [...STATEWIDE[state][year]].sort());
      });

      test(`${state} ${year}: part-day dates`, () => {
        const out = ok(['holidays', '--year', String(year), '--state', state]);
        const got = out.result.holidays.filter((h) => h.scope === 'part-day').map((h) => h.date.slice(5)).sort();
        assert.deepEqual(got, PART_DAY[state]?.[year] ?? []);
      });
    }
  }

  test('every entry has a name, a valid scope, a status and a weekday that matches its date', () => {
    for (const state of STATES) {
      for (const year of YEARS) {
        const out = ok(['holidays', '--year', String(year), '--state', state]);
        assert.equal(out.result.year, year);
        assert.match(out.result.source_url, /^https:\/\//);
        assert.match(out.result.retrieved_on, /^\d{4}-\d{2}-\d{2}$/);
        for (const h of out.result.holidays) {
          assert.ok(h.name.length > 2, `${state} ${h.date} has no name`);
          assert.ok(['statewide', 'regional', 'part-day'].includes(h.scope), `${state} ${h.date} scope ${h.scope}`);
          assert.ok(['confirmed', 'estimated'].includes(h.status), `${state} ${h.date} status ${h.status}`);
          const wd = new Date(`${h.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
          assert.equal(h.weekday, wd, `${state} ${h.date} weekday`);
          assert.ok(h.date.startsWith(String(year)));
        }
      }
    }
  });

  test('entries the sources have not fixed are marked estimated, and nothing else is', () => {
    for (const state of STATES) {
      const want = new Set(ESTIMATED[state] ?? []);
      const got = new Set();
      for (const year of YEARS) {
        const out = ok(['holidays', '--year', String(year), '--state', state]);
        for (const h of out.result.holidays) if (h.status === 'estimated') got.add(h.date);
      }
      assert.deepEqual([...got].sort(), [...want].sort(), `${state} estimated set`);
    }
  });
});

describe('holiday names and the substitute rules, per state', () => {
  const byDate = (state, year) => Object.fromEntries(ok(['holidays', '--year', String(year), '--state', state]).result.holidays.map((h) => [h.date, h]));

  test('Christmas Day 2026 is a Friday and Boxing Day a Saturday: Monday 28 December is a holiday in every state', () => {
    for (const state of STATES) {
      const h = byDate(state, 2026);
      assert.match(h['2026-12-25'].name, /Christmas Day/);
      // Tasmania's table lists only the substituted Monday, not the Saturday itself.
      if (state !== 'TAS') assert.match(h['2026-12-26'].name, /Boxing Day|Proclamation Day/);
      assert.ok(h['2026-12-28'], `${state} should have 2026-12-28`);
      assert.equal(h['2026-12-28'].weekday, 'Monday');
    }
  });

  test('ANZAC Day on a weekend differs by state', () => {
    // 2026: Saturday. Monday 27 April is a holiday in WA, NSW and ACT only.
    const monday2026 = { WA: true, NSW: true, ACT: true, VIC: false, QLD: false, SA: false, TAS: false, NT: false };
    for (const [state, has] of Object.entries(monday2026)) {
      assert.equal(Boolean(byDate(state, 2026)['2026-04-27']), has, `${state} 2026-04-27`);
    }
    // 2027: Sunday. Monday 26 April is a holiday in WA, NSW, QLD, NT and ACT; VIC, SA and TAS have no substitute.
    const monday2027 = { WA: true, NSW: true, ACT: true, QLD: true, NT: true, VIC: false, SA: false, TAS: false };
    for (const [state, has] of Object.entries(monday2027)) {
      assert.equal(Boolean(byDate(state, 2027)['2027-04-26']), has, `${state} 2027-04-26`);
    }
  });

  test('New Year\'s Day on a Saturday (2028) gets a Monday 3 January holiday everywhere', () => {
    for (const state of STATES) assert.ok(byDate(state, 2028)['2028-01-03'], `${state} 2028-01-03`);
  });

  test('Easter: Good Friday and Easter Monday everywhere; Easter Saturday and Sunday where the state has them', () => {
    const sat = { NSW: true, VIC: true, QLD: true, SA: true, NT: true, ACT: true, WA: false, TAS: false };
    for (const state of STATES) {
      const h = byDate(state, 2026);
      assert.match(h['2026-04-03'].name, /Good Friday/, state);
      assert.match(h['2026-04-06'].name, /Easter Monday/, state);
      assert.equal(Boolean(h['2026-04-04']), sat[state], `${state} Easter Saturday 2026`);
    }
    // WA makes Easter Saturday a holiday from 2028.
    assert.match(byDate('WA', 2028)['2028-04-15'].name, /Easter Saturday/);
  });

  test('state-specific holidays carry their own names', () => {
    assert.match(byDate('WA', 2026)['2026-03-02'].name, /Labour Day/);
    assert.match(byDate('WA', 2026)['2026-06-01'].name, /Western Australia Day/);
    assert.match(byDate('WA', 2026)['2026-09-28'].name, /King's Birthday/);
    assert.match(byDate('VIC', 2026)['2026-06-08'].name, /King's Birthday/);
    assert.match(byDate('VIC', 2026)['2026-09-25'].name, /Friday before the AFL Grand Final/);
    assert.match(byDate('VIC', 2026)['2026-11-03'].name, /Melbourne Cup/);
    assert.match(byDate('NT', 2026)['2026-08-03'].name, /Picnic Day/);
    assert.match(byDate('NT', 2026)['2026-05-04'].name, /May Day/);
    assert.match(byDate('ACT', 2026)['2026-06-01'].name, /Reconciliation Day/);
    assert.match(byDate('ACT', 2026)['2026-03-09'].name, /Canberra Day/);
    assert.match(byDate('SA', 2026)['2026-03-09'].name, /Adelaide Cup/);
    assert.match(byDate('TAS', 2026)['2026-03-09'].name, /Eight Hours Day/);
    assert.match(byDate('QLD', 2026)['2026-05-04'].name, /Labour Day/);
    assert.match(byDate('NSW', 2026)['2026-10-05'].name, /Labour Day/);
    assert.equal(byDate('SA', 2026)['2026-12-24'].scope, 'part-day');
    assert.equal(byDate('SA', 2026)['2026-12-31'].scope, 'part-day');
  });

  test('Tasmanian Easter Tuesday (public service only) and regional days are not statewide holidays', () => {
    assert.ok(!byDate('TAS', 2026)['2026-04-07'] || byDate('TAS', 2026)['2026-04-07'].scope !== 'statewide');
    assert.ok(!byDate('NSW', 2026)['2026-08-03'] || byDate('NSW', 2026)['2026-08-03'].scope !== 'statewide', 'NSW Bank Holiday is not a public holiday');
  });

  test('coverage is the same four years for every state', () => {
    for (const state of STATES) {
      const out = ok(['is', '2026-06-01', '--state', state]);
      assert.deepEqual(out.assumptions.coverage, COVERAGE);
    }
  });
});
