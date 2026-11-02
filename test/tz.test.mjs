import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATES, run } from './helpers.mjs';

// Dates are calendar dates. The answer must not depend on the machine's timezone, including
// zones far ahead of or behind UTC, and zones that observe daylight saving.
const ZONES = ['UTC', 'Australia/Perth', 'Australia/Sydney', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];

const CALLS = [
  ['add', '10', '--from', '2026-12-18'],
  ['add', '-3', '--from', '2027-01-04'],
  ['diff', '2026-03-01', '2026-05-01'],
  ['is', '2026-10-04'],
  ['is', '2027-04-04'],
  ['next', '2026-04-02'],
  ['prev', '2026-10-05'],
  ['roll', '2026-10-03', '--direction', 'forward'],
  ['add-calendar', '14', '--from', '2026-09-28', '--roll', 'forward'],
  ['holidays', '--year', '2026'],
  ['holidays', '--year', '2028'],
];

test('same answers in every timezone, for every state', () => {
  for (const state of STATES) {
    for (const call of CALLS) {
      const args = [...call, '--state', state, '--json'];
      const base = run(args, { TZ: 'UTC' });
      assert.equal(base.code, 0, args.join(' '));
      for (const tz of ZONES.slice(1)) {
        const r = run(args, { TZ: tz });
        assert.equal(r.stdout, base.stdout, `${tz} differs from UTC for ${args.join(' ')}`);
      }
    }
  }
});

test('the suite itself was started in this timezone (informational)', () => {
  assert.ok(Intl.DateTimeFormat().resolvedOptions().timeZone);
});
