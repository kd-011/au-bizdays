import { UsageError } from './calendar.js';

/** Today (UTC) as YYYY-MM-DD. AU_BIZDAYS_TODAY overrides it, which the tests use. */
export function today(): string {
  const env = process.env['AU_BIZDAYS_TODAY'];
  if (env) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(env)) throw new UsageError(`AU_BIZDAYS_TODAY must be YYYY-MM-DD, got "${env}".`);
    return env;
  }
  return new Date().toISOString().slice(0, 10);
}
