import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { call, connect, ok, run } from './helpers.mjs';

// 2026-11-02 14:00 UTC is a different calendar date depending on the state's clock:
//   Perth (UTC+8) 22:00 on the 2nd, Darwin (UTC+9:30) 23:30 on the 2nd,
//   Brisbane (UTC+10) 00:00 on the 3rd, Adelaide (UTC+10:30) 00:30 on the 3rd,
//   Sydney, Canberra, Melbourne, Hobart (UTC+11, daylight saving) 01:00 on the 3rd.
const NOW = { AU_BIZDAYS_NOW: '2026-11-02T14:00:00Z' };
const TODAY = { WA: '2026-11-02', NT: '2026-11-02', QLD: '2026-11-03', SA: '2026-11-03', NSW: '2026-11-03', ACT: '2026-11-03', VIC: '2026-11-03', TAS: '2026-11-03' };

describe('the word "today" in place of a date', () => {
  for (const [state, date] of Object.entries(TODAY)) {
    test(`is today in ${state} uses the date on that state's clock (${date})`, () => {
      const out = ok(['is', 'today', '--state', state], NOW);
      assert.equal(out.result.date, date);
      assert.equal(out.input.date, date, 'the input echoes the resolved date, not the word');
    });
  }

  test('works for the start of add, add-calendar and diff, and is case-insensitive', () => {
    assert.equal(ok(['add', '10', '--from', 'today', '--state', 'WA'], NOW).result.from, '2026-11-02');
    assert.equal(ok(['add', '10', '--from', 'Today', '--state', 'NSW'], NOW).result.from, '2026-11-03');
    assert.equal(ok(['add-calendar', '14', '--from', 'today', '--roll', 'forward', '--state', 'SA'], NOW).result.from, '2026-11-03');
    const d = ok(['diff', 'today', '2026-12-18', '--state', 'WA'], NOW);
    assert.equal(d.result.from, '2026-11-02');
    assert.equal(d.result.to, '2026-12-18');
  });

  test('add 1 from today in VIC skips Melbourne Cup', () => {
    // 2026-11-03 is Melbourne Cup, so tomorrow is not a business day and Wednesday is the answer.
    assert.equal(ok(['add', '1', '--from', 'today', '--state', 'VIC'], { AU_BIZDAYS_NOW: '2026-11-02T14:00:00Z' }).result.date, '2026-11-04');
  });

  test('human output shows the date it used', () => {
    const r = run(['next', 'today', '--state', 'WA'], NOW);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /2026-11-02/);
  });

  test('without any override it reads the real clock and gives a plausible date', () => {
    const out = ok(['is', 'today', '--state', 'WA'], { AU_BIZDAYS_NOW: '', AU_BIZDAYS_TODAY: '' });
    assert.match(out.result.date, /^20(2[5-8])-\d{2}-\d{2}$/);
  });

  test('AU_BIZDAYS_TODAY still fixes the date for every state', () => {
    assert.equal(ok(['is', 'today', '--state', 'WA'], { AU_BIZDAYS_TODAY: '2026-12-25' }).result.date, '2026-12-25');
  });

  test('a clock outside the bundled data is a coverage error that names the range', () => {
    const r = run(['is', 'today', '--state', 'WA'], { AU_BIZDAYS_NOW: '2031-06-01T00:00:00Z' });
    assert.equal(r.code, 3);
    assert.match(r.stderr, /2025-01-01 to 2028-12-31/);
  });

  test('a bad AU_BIZDAYS_NOW is a usage error', () => {
    const r = run(['is', 'today', '--state', 'WA'], { AU_BIZDAYS_NOW: 'yesterday-ish' });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /AU_BIZDAYS_NOW/);
  });

  test('other words are still rejected, and the message mentions today', () => {
    for (const word of ['tomorrow', 'yesterday', 'now']) {
      const r = run(['is', word, '--state', 'WA'], NOW);
      assert.equal(r.code, 2, word);
      assert.match(r.stderr, /today/);
    }
  });

  test('the state is still required, so there is no clock to read without one', () => {
    const r = run(['is', 'today'], NOW);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /state is required/i);
  });

  test('the MCP tools accept it too', async () => {
    const { client, close } = await connect(NOW);
    try {
      const res = await call(client, 'is_business_day', { date: 'today', state: 'WA' });
      assert.ok(!res.isError, JSON.stringify(res));
      assert.equal(res.structuredContent.result.date, '2026-11-02');
      const res2 = await call(client, 'add_business_days', { n: 5, from: 'today', state: 'NSW' });
      assert.equal(res2.structuredContent.result.from, '2026-11-03');
    } finally {
      await close();
    }
  });
});
