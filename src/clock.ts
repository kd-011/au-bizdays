import { UsageError } from './calendar.js';
import type { State } from './data.js';

// Where each state's capital keeps time. Used only to answer the word "today".
const ZONES: Record<State, string> = {
  ACT: 'Australia/Sydney',
  NSW: 'Australia/Sydney',
  NT: 'Australia/Darwin',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  TAS: 'Australia/Hobart',
  VIC: 'Australia/Melbourne',
  WA: 'Australia/Perth',
};

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** The current instant. AU_BIZDAYS_NOW (an ISO timestamp with a zone) overrides it, which the tests use. */
function now(): Date {
  const env = process.env['AU_BIZDAYS_NOW'];
  if (!env) return new Date();
  const t = INSTANT.test(env) ? Date.parse(env) : NaN;
  if (Number.isNaN(t)) throw new UsageError(`AU_BIZDAYS_NOW must be an ISO timestamp with a zone, like 2026-11-02T14:00:00Z, got "${env}".`);
  return new Date(t);
}

function fixed(): string | undefined {
  const env = process.env['AU_BIZDAYS_TODAY'];
  if (!env) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(env)) throw new UsageError(`AU_BIZDAYS_TODAY must be YYYY-MM-DD, got "${env}".`);
  return env;
}

/** Today (UTC) as YYYY-MM-DD, for the end-of-data warning. AU_BIZDAYS_TODAY fixes it. */
export function today(): string {
  return fixed() ?? now().toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD on the clock of the state's capital. AU_BIZDAYS_TODAY fixes it for every state. */
export function todayIn(state: State): string {
  return fixed() ?? new Intl.DateTimeFormat('en-CA', { timeZone: ZONES[state], year: 'numeric', month: '2-digit', day: '2-digit' }).format(now());
}
