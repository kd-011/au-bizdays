// The eight operations, shared by the CLI and the MCP server so both give the same answer and the
// same error text. Each takes loosely typed arguments, validates them, and returns an envelope.
import {
  CoverageError, UsageError, addBusinessDays, addCalendarDays, businessDaysBetween, coverageOf, createCalendar,
  dayInfo, requireYear, rollToBusinessDay,
} from './calendar.js';
import type { Calendar, Direction, Roll, Span } from './calendar.js';
import { caveatsFor } from './caveats.js';
import { endOfYear, formatDay, parseDay, startOfYear, weekdayName } from './date.js';
import type { Day } from './date.js';
import { STATES, loadStateData } from './data.js';
import type { State } from './data.js';

export const SCHEMA = 'au-bizdays/v1';

export type CommandName = 'add' | 'diff' | 'is' | 'next' | 'prev' | 'roll' | 'add-calendar' | 'holidays';

export interface Assumptions {
  weekend: string[];
  holidays_counted: 'statewide';
  part_day_holidays: string;
  regional_holidays: string;
  data_source: { year: number; url: string; retrieved_on: string }[];
  data_version: string;
  coverage: { from: string; to: string };
}

export interface Envelope {
  schema: typeof SCHEMA;
  command: CommandName;
  state: State;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  assumptions: Assumptions;
  caveats: string[];
}

/** The clock, passed in so the core never reads it. `todayIn` answers "today" for a state's own time zone. */
export interface Context {
  today: string;
  todayIn?: (state: State) => string;
}

// ---------------------------------------------------------------- input checks

export function parseState(v: unknown): State {
  if (typeof v !== 'string' || v.trim() === '') throw new UsageError(`A state is required: one of ${STATES.join(', ')}.`);
  const s = v.trim().toUpperCase();
  if (!(STATES as readonly string[]).includes(s)) throw new UsageError(`Unknown state "${v}". Use one of ${STATES.join(', ')}.`);
  return s as State;
}

function parseDate(v: unknown, label: string, ctx: Context, state: State): Day {
  if (v === undefined || v === null || v === '') throw new UsageError(`A ${label} is required, as YYYY-MM-DD or the word today.`);
  let day: Day | null = null;
  if (typeof v === 'string') {
    // "today" is the calendar date on the state's own clock, so it does not depend on where this runs.
    day = v.trim().toLowerCase() === 'today' ? parseDay(ctx.todayIn ? ctx.todayIn(state) : ctx.today) : parseDay(v);
  }
  if (day === null) throw new UsageError(`Invalid ${label} "${String(v)}": dates are YYYY-MM-DD calendar dates, for example 2026-12-18, or the word today.`);
  return day;
}

function parseWhole(v: unknown, label: string): number {
  if (v === undefined || v === null || v === '') throw new UsageError(`${label} is required, as a whole number.`);
  const n = typeof v === 'string' ? (/^[+-]?\d+$/.test(v.trim()) ? Number(v) : NaN) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new UsageError(`${label} must be a whole number, got "${String(v)}".`);
  if (Math.abs(n) > 1_000_000) throw new UsageError(`${label} is too large (limit 1000000).`);
  return n;
}

function parseChoice<T extends string>(v: unknown, label: string, choices: readonly T[]): T {
  if (v === undefined || v === null || v === '') throw new UsageError(`${label} is required: ${choices.join(' or ')}.`);
  if (typeof v !== 'string' || !(choices as readonly string[]).includes(v)) throw new UsageError(`Invalid ${label} "${String(v)}": use ${choices.join(' or ')}.`);
  return v as T;
}

function parseFlag(v: unknown, label: string): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v !== 'boolean') throw new UsageError(`${label} must be true or false, got "${String(v)}".`);
  return v;
}

function parseYear(v: unknown): number {
  if (v === undefined || v === null || v === '') throw new UsageError('A year is required, for example 2026.');
  const n = typeof v === 'string' ? (/^\d{4}$/.test(v.trim()) ? Number(v) : NaN) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 9999) throw new UsageError(`Invalid year "${String(v)}": use a four-digit year such as 2026.`);
  return n;
}

const calendars = new Map<State, Calendar>();
function calendarFor(state: State): Calendar {
  let cal = calendars.get(state);
  if (!cal) {
    cal = createCalendar(loadStateData(state));
    calendars.set(state, cal);
  }
  return cal;
}

// ---------------------------------------------------------------- envelope

function assumptionsFor(cal: Calendar): Assumptions {
  const years = cal.data.years;
  return {
    weekend: ['Saturday', 'Sunday'],
    holidays_counted: 'statewide',
    part_day_holidays: 'not counted: treated as business days, listed in caveats',
    regional_holidays: 'not counted: regional and local holidays are not in the data',
    data_source: years.map((y) => ({ year: y.year, url: y.source_url, retrieved_on: y.retrieved_on })),
    data_version: years.map((y) => y.retrieved_on).sort().pop() as string,
    coverage: coverageOf(cal),
  };
}

function envelope(
  cal: Calendar, command: CommandName, input: Record<string, unknown>, result: Record<string, unknown>, touched: Span, ctx: Context,
  listing = false,
): Envelope {
  const today = parseDay(ctx.today);
  if (today === null) throw new UsageError(`Invalid today "${ctx.today}": use YYYY-MM-DD.`);
  return {
    schema: SCHEMA,
    command,
    state: cal.state,
    input,
    result,
    assumptions: assumptionsFor(cal),
    caveats: caveatsFor(cal, { touched, today, listing }).all,
  };
}

const dateFields = (day: Day) => ({ date: formatDay(day), weekday: weekdayName(day) });

// ---------------------------------------------------------------- commands

export function cmdAdd(a: { n: unknown; from: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const n = parseWhole(a.n, 'n');
  const from = parseDate(a.from, 'from date', ctx, state);
  const cal = calendarFor(state);
  const r = addBusinessDays(cal, from, n);
  return envelope(cal, 'add', { n, from: formatDay(from) }, {
    from: formatDay(from),
    n,
    ...dateFields(r.date),
    skipped_holidays: r.skipped.map((s) => ({ date: formatDay(s.day), name: s.holiday.name })),
  }, r.touched, ctx);
}

export function cmdDiff(a: { from: unknown; to: unknown; inclusive?: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const from = parseDate(a.from, 'from date', ctx, state);
  const to = parseDate(a.to, 'to date', ctx, state);
  const inclusive = parseFlag(a.inclusive, 'inclusive');
  const cal = calendarFor(state);
  const r = businessDaysBetween(cal, from, to, inclusive);
  return envelope(cal, 'diff', { from: formatDay(from), to: formatDay(to), inclusive }, {
    from: formatDay(from), to: formatDay(to), inclusive, business_days: r.count,
  }, r.touched, ctx);
}

export function cmdIs(a: { date: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const day = parseDate(a.date, 'date', ctx, state);
  const cal = calendarFor(state);
  const info = dayInfo(cal, day);
  const reasons: Record<string, unknown>[] = [];
  if (info.weekend) reasons.push({ kind: 'weekend' });
  for (const h of info.holidays) reasons.push({ kind: 'holiday', name: h.name, scope: h.scope, status: h.status });
  return envelope(cal, 'is', { date: formatDay(day) }, { ...dateFields(day), is_business_day: info.isBusinessDay, reasons }, { from: day, to: day }, ctx);
}

function nearby(command: 'next' | 'prev', a: { date: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const day = parseDate(a.date, 'date', ctx, state);
  const cal = calendarFor(state);
  const r = addBusinessDays(cal, day, command === 'next' ? 1 : -1);
  return envelope(cal, command, { date: formatDay(day) }, { from: formatDay(day), ...dateFields(r.date) }, r.touched, ctx);
}
export const cmdNext = (a: { date: unknown; state: unknown }, ctx: Context) => nearby('next', a, ctx);
export const cmdPrev = (a: { date: unknown; state: unknown }, ctx: Context) => nearby('prev', a, ctx);

export function cmdRoll(a: { date: unknown; direction: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const day = parseDate(a.date, 'date', ctx, state);
  const direction: Direction = parseChoice(a.direction, 'direction', ['forward', 'back'] as const);
  const cal = calendarFor(state);
  const r = rollToBusinessDay(cal, day, direction);
  return envelope(cal, 'roll', { date: formatDay(day), direction }, {
    from: formatDay(day), direction, ...dateFields(r.date), moved: r.moved,
  }, r.touched, ctx);
}

export function cmdAddCalendar(a: { n: unknown; from: unknown; roll: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const n = parseWhole(a.n, 'n');
  const from = parseDate(a.from, 'from date', ctx, state);
  const roll: Roll = parseChoice(a.roll, 'roll', ['forward', 'back', 'none'] as const);
  const cal = calendarFor(state);
  const r = addCalendarDays(cal, from, n, roll);
  return envelope(cal, 'add-calendar', { n, from: formatDay(from), roll }, {
    from: formatDay(from), n, roll, calendar_date: formatDay(r.calendar), ...dateFields(r.date), rolled: r.rolled,
  }, r.touched, ctx);
}

export function cmdHolidays(a: { year: unknown; state: unknown }, ctx: Context): Envelope {
  const state = parseState(a.state);
  const year = parseYear(a.year);
  const cal = calendarFor(state);
  requireYear(cal, year);
  const file = cal.data.years.find((y) => y.year === year) as (typeof cal.data.years)[number];
  const holidays = file.holidays.map((h) => {
    const entry: Record<string, unknown> = { date: h.date, weekday: weekdayName(parseDay(h.date) as Day), name: h.name, scope: h.scope, status: h.status };
    if (h.note) entry['note'] = h.note;
    else if (h.status === 'estimated' && file.estimate_basis) entry['note'] = file.estimate_basis;
    return entry;
  });
  return envelope(cal, 'holidays', { year }, { year, source_url: file.source_url, retrieved_on: file.retrieved_on, holidays }, { from: startOfYear(year), to: endOfYear(year) }, ctx, true);
}

export { CoverageError, UsageError };
