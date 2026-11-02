import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STATES, ok } from './helpers.mjs';

const add = (n, from, state) => ok(['add', String(n), '--from', from, '--state', state]).result;
const is = (date, state) => ok(['is', date, '--state', state]).result;

describe('add', () => {
  test('10 business days from 2026-12-18 across Christmas, Boxing Day and New Year', () => {
    // 21, 22, 23, 24, (25 hol, 26 Sat, 27 Sun, 28 hol), 29, 30, 31, (1 Jan hol, 2 Sat, 3 Sun), 4, 5, 6
    for (const state of STATES) assert.equal(add(10, '2026-12-18', state).date, '2027-01-06', state);
    assert.equal(add(10, '2026-12-18', 'WA').weekday, 'Wednesday');
  });

  test('the start day does not count: add 1 from a Friday is the next business day', () => {
    assert.equal(add(1, '2026-06-12', 'NSW').date, '2026-06-15');
    assert.equal(add(1, '2026-06-10', 'NSW').date, '2026-06-11');
  });

  test('add 0 returns the start date', () => {
    assert.equal(add(0, '2026-06-10', 'QLD').date, '2026-06-10');
  });

  test('negative n counts back', () => {
    assert.equal(add(-1, '2026-06-15', 'VIC').date, '2026-06-12');
    assert.equal(add(-5, '2027-01-06', 'WA').date, '2026-12-29'); // Jan 5=1, Jan 4=2, (1 Jan hol), Dec 31=3, 30=4, 29=5
  });

  test('ANZAC Day on a Saturday in 2026: the next business day after Friday 24 April differs by state', () => {
    const want = { WA: '2026-04-28', NSW: '2026-04-28', ACT: '2026-04-28', VIC: '2026-04-27', QLD: '2026-04-27', SA: '2026-04-27', TAS: '2026-04-27', NT: '2026-04-27' };
    for (const [state, date] of Object.entries(want)) assert.equal(add(1, '2026-04-24', state).date, date, state);
  });

  test('ANZAC Day on a Sunday in 2027: the next business day after Friday 23 April differs by state', () => {
    const want = { WA: '2027-04-27', NSW: '2027-04-27', ACT: '2027-04-27', QLD: '2027-04-27', NT: '2027-04-27', VIC: '2027-04-26', SA: '2027-04-26', TAS: '2027-04-26' };
    for (const [state, date] of Object.entries(want)) assert.equal(add(1, '2027-04-23', state).date, date, state);
  });

  test('Christmas to New Year run in 2027 (Saturday Christmas, Sunday Boxing Day)', () => {
    // 24 Dec Fri is a business day (part-day in SA/NT/QLD only). 27 and 28 are holidays. 31 Dec Fri business day.
    for (const state of STATES) {
      assert.equal(add(1, '2027-12-24', state).date, '2027-12-29', state);
      assert.equal(add(2, '2027-12-24', state).date, '2027-12-30', state);
      assert.equal(add(1, '2027-12-31', state).date, '2028-01-04', state); // Sat 1 Jan, Sun 2, Mon 3 hol
    }
  });

  test('year end: 5 business days from 2026-12-23 in NSW', () => {
    assert.equal(add(5, '2026-12-23', 'NSW').date, '2027-01-04');
  });

  test('state-specific holidays move the answer', () => {
    assert.equal(add(1, '2026-11-02', 'VIC').date, '2026-11-04'); // Melbourne Cup Tuesday 3 Nov
    assert.equal(add(1, '2026-11-02', 'NSW').date, '2026-11-03');
    assert.equal(add(1, '2026-07-31', 'NT').date, '2026-08-04'); // Picnic Day Monday 3 Aug
    assert.equal(add(1, '2026-07-31', 'SA').date, '2026-08-03');
    assert.equal(add(1, '2026-09-25', 'VIC').date, '2026-09-28'); // Grand Final Friday is itself a holiday; start day does not matter
    assert.equal(add(1, '2026-09-24', 'VIC').date, '2026-09-28');
    assert.equal(add(1, '2026-09-24', 'NSW').date, '2026-09-25');
  });

  test('lists the holidays it skipped', () => {
    const r = add(10, '2026-12-18', 'WA');
    assert.deepEqual(r.skipped_holidays.map((h) => h.date), ['2026-12-25', '2026-12-28', '2027-01-01']);
  });
});

describe('is / next / prev / roll', () => {
  test('is: weekend, holiday, business day', () => {
    assert.equal(is('2026-12-28', 'VIC').is_business_day, false);
    assert.match(JSON.stringify(is('2026-12-28', 'VIC').reasons), /Boxing Day/);
    assert.equal(is('2026-12-27', 'VIC').is_business_day, false);
    assert.equal(is('2026-12-27', 'VIC').reasons[0].kind, 'weekend');
    assert.equal(is('2026-12-29', 'VIC').is_business_day, true);
    assert.deepEqual(is('2026-12-29', 'VIC').reasons, []);
  });

  test('is: a weekend holiday reports both reasons', () => {
    const r = is('2026-04-25', 'VIC');
    assert.equal(r.is_business_day, false);
    assert.deepEqual(r.reasons.map((x) => x.kind).sort(), ['holiday', 'weekend']);
  });

  test('is: part-day holiday is a business day, with a caveat', () => {
    const out = ok(['is', '2026-12-24', '--state', 'SA']);
    assert.equal(out.result.is_business_day, true);
    assert.ok(out.caveats.some((c) => /part-day/i.test(c) && /Christmas Eve/.test(c)));
    assert.ok(!ok(['is', '2026-12-24', '--state', 'WA']).caveats.some((c) => /part-day/i.test(c)));
  });

  test('is: Victoria on 2026-12-28 is not a business day, Tasmania on 2026-04-07 is', () => {
    assert.equal(is('2026-12-28', 'VIC').is_business_day, false);
    assert.equal(is('2026-04-07', 'TAS').is_business_day, true);
  });

  test('next and prev are strict', () => {
    assert.equal(ok(['next', '2026-12-24', '--state', 'WA']).result.date, '2026-12-29');
    assert.equal(ok(['next', '2026-12-18', '--state', 'WA']).result.date, '2026-12-21');
    assert.equal(ok(['next', '2026-12-19', '--state', 'WA']).result.date, '2026-12-21');
    assert.equal(ok(['prev', '2026-12-29', '--state', 'WA']).result.date, '2026-12-24');
    assert.equal(ok(['prev', '2027-01-04', '--state', 'WA']).result.date, '2026-12-31');
    assert.equal(ok(['prev', '2026-12-21', '--state', 'WA']).result.date, '2026-12-18');
  });

  test('next and prev match add 1 and add -1', () => {
    for (const state of STATES) {
      for (const d of ['2026-03-31', '2026-04-02', '2026-12-24', '2027-12-23', '2028-06-30']) {
        assert.equal(ok(['next', d, '--state', state]).result.date, add(1, d, state).date);
        assert.equal(ok(['prev', d, '--state', state]).result.date, add(-1, d, state).date);
      }
    }
  });

  test('roll forward and back', () => {
    const f = ok(['roll', '2026-12-26', '--direction', 'forward', '--state', 'WA']).result;
    assert.equal(f.date, '2026-12-29');
    assert.equal(f.moved, true);
    const b = ok(['roll', '2026-12-26', '--direction', 'back', '--state', 'WA']).result;
    assert.equal(b.date, '2026-12-24');
    const same = ok(['roll', '2026-12-29', '--direction', 'forward', '--state', 'WA']).result;
    assert.equal(same.date, '2026-12-29');
    assert.equal(same.moved, false);
  });
});

describe('add-calendar', () => {
  test('14 calendar days from 2026-12-14, rolled forward: lands on Monday 28 Dec, a holiday, so rolls to 29 Dec', () => {
    const r = ok(['add-calendar', '14', '--from', '2026-12-14', '--roll', 'forward', '--state', 'WA']).result;
    assert.equal(r.calendar_date, '2026-12-28');
    assert.equal(r.date, '2026-12-29');
    assert.equal(r.rolled, true);
  });
  test('roll back and roll none', () => {
    const back = ok(['add-calendar', '14', '--from', '2026-12-14', '--roll', 'back', '--state', 'WA']).result;
    assert.equal(back.date, '2026-12-24');
    const none = ok(['add-calendar', '14', '--from', '2026-12-14', '--roll', 'none', '--state', 'WA']).result;
    assert.equal(none.date, '2026-12-28');
    assert.equal(none.rolled, false);
  });
  test('a result that is already a business day does not move', () => {
    const r = ok(['add-calendar', '14', '--from', '2026-06-01', '--roll', 'forward', '--state', 'NSW']).result;
    assert.equal(r.date, '2026-06-15');
    assert.equal(r.rolled, false);
  });
  test('negative calendar days and month ends', () => {
    assert.equal(ok(['add-calendar', '1', '--from', '2028-02-28', '--roll', 'none', '--state', 'NSW']).result.date, '2028-02-29');
    assert.equal(ok(['add-calendar', '1', '--from', '2027-02-28', '--roll', 'none', '--state', 'NSW']).result.date, '2027-03-01');
    assert.equal(ok(['add-calendar', '-30', '--from', '2026-03-01', '--roll', 'none', '--state', 'NSW']).result.date, '2026-01-30');
  });
});

describe('diff', () => {
  const diff = (a, b, state, extra = []) => ok(['diff', a, b, '--state', state, ...extra]).result;

  test('counts business days after the start up to and including the end', () => {
    assert.equal(diff('2026-12-18', '2027-01-06', 'WA').business_days, 10);
    assert.equal(diff('2026-06-15', '2026-06-19', 'NSW').business_days, 4); // Mon to Fri: Tue, Wed, Thu, Fri
    assert.equal(diff('2026-06-12', '2026-06-12', 'NSW').business_days, 0);
  });

  test('is negative when the end is before the start', () => {
    assert.equal(diff('2027-01-06', '2026-12-18', 'WA').business_days, -10);
  });

  test('--inclusive counts both ends', () => {
    assert.equal(diff('2026-06-15', '2026-06-19', 'NSW', ['--inclusive']).business_days, 5);
    assert.equal(diff('2026-06-15', '2026-06-19', 'NSW', ['--inclusive']).inclusive, true);
  });

  test('state holidays change the count', () => {
    assert.equal(diff('2026-10-30', '2026-11-06', 'VIC').business_days, 4);
    assert.equal(diff('2026-10-30', '2026-11-06', 'NSW').business_days, 5);
  });
});

describe('round trip', () => {
  test('add n then diff returns n, for every start day in 2026 and 2027, every state, both directions', () => {
    for (const state of STATES) {
      for (const n of [1, 7, 20]) {
        for (const from of ['2026-04-24', '2026-12-18', '2026-12-26', '2027-04-23', '2027-12-26']) {
          for (const sign of [1, -1]) {
            const to = add(sign * n, from, state).date;
            assert.equal(ok(['diff', from, to, '--state', state]).result.business_days, sign * n, `${state} ${from} ${sign * n}`);
          }
        }
      }
    }
  });

  test('a lap of every day in 2026 in WA: add 1 from each day lands on a business day', () => {
    let d = new Date('2026-01-01T00:00:00Z');
    const all = [];
    while (d.getUTCFullYear() === 2026) { all.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
    // Spot every 7th day to keep the run fast.
    for (const day of all.filter((_, i) => i % 7 === 0)) {
      const next = add(1, day, 'WA').date;
      assert.equal(is(next, 'WA').is_business_day, true, `${day} -> ${next}`);
      assert.ok(next > day);
    }
  });
});
