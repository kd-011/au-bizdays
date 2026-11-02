// Business-day arithmetic. Pure functions over a Calendar: nothing here reads a file, the clock or
// the timezone. A business day is Monday to Friday and not a statewide public holiday.
import { endOfYear, formatDay, isWeekend, parseDay, startOfYear } from './date.js';
import type { Day } from './date.js';
import type { Holiday, State, StateData } from './data.js';

export class UsageError extends Error {
  readonly code = 'usage';
}

/** A date or year outside the bundled data. We refuse rather than guess a holiday. */
export class CoverageError extends Error {
  readonly code = 'out_of_coverage';
  constructor(message: string, readonly coverage: { from: string; to: string }) {
    super(message);
  }
}

export interface Calendar {
  state: State;
  first: Day;
  last: Day;
  data: StateData;
  /** Every entry on a day, any scope. Estimated entries carry the year file's basis when they have no note of their own. */
  on(day: Day): Holiday[];
}

export function createCalendar(data: StateData): Calendar {
  const byDay = new Map<Day, Holiday[]>();
  for (const y of data.years) {
    for (const h of y.holidays) {
      const day = parseDay(h.date) as Day;
      const entry: Holiday = h.status === 'estimated' && !h.note && y.estimate_basis ? { ...h, note: y.estimate_basis } : h;
      const list = byDay.get(day);
      if (list) list.push(entry);
      else byDay.set(day, [entry]);
    }
  }
  const years = data.years;
  return {
    state: data.state,
    first: startOfYear((years[0] as { year: number }).year),
    last: endOfYear((years[years.length - 1] as { year: number }).year),
    data,
    on: (day) => byDay.get(day) ?? [],
  };
}

export const coverageOf = (cal: Calendar) => ({ from: formatDay(cal.first), to: formatDay(cal.last) });

/** Throw unless the day is inside the bundled data. */
function need(cal: Calendar, day: Day): void {
  if (day < cal.first || day > cal.last) {
    const c = coverageOf(cal);
    throw new CoverageError(
      `${formatDay(day)} is outside the holiday data bundled for ${cal.state} (${c.from} to ${c.to}). The answer would depend on holidays that are not in the data, so none is given.`,
      c,
    );
  }
}

export function requireYear(cal: Calendar, year: number): void {
  const c = coverageOf(cal);
  if (year < +c.from.slice(0, 4) || year > +c.to.slice(0, 4)) {
    throw new CoverageError(`There is no holiday data for ${year} in ${cal.state} (bundled data covers ${c.from} to ${c.to}), so no list is given.`, c);
  }
}

const statewide = (cal: Calendar, day: Day) => cal.on(day).filter((h) => h.scope === 'statewide');

export function isBusinessDay(cal: Calendar, day: Day): boolean {
  need(cal, day);
  return !isWeekend(day) && statewide(cal, day).length === 0;
}

export interface DayInfo {
  weekend: boolean;
  holidays: Holiday[];
  isBusinessDay: boolean;
}

export function dayInfo(cal: Calendar, day: Day): DayInfo {
  need(cal, day);
  const holidays = statewide(cal, day);
  const weekend = isWeekend(day);
  return { weekend, holidays, isBusinessDay: !weekend && holidays.length === 0 };
}

export interface Span {
  from: Day;
  to: Day;
}
const span = (a: Day, b: Day): Span => ({ from: Math.min(a, b), to: Math.max(a, b) });

export interface AddResult {
  date: Day;
  /** Weekday holidays passed on the way. Holidays on a weekend change nothing, so they are left out. */
  skipped: { day: Day; holiday: Holiday }[];
  touched: Span;
}

/** The nth business day after `from` (before it when n is negative). The start day is day 0 and never counts. */
export function addBusinessDays(cal: Calendar, from: Day, n: number): AddResult {
  need(cal, from);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  let day = from;
  const skipped: AddResult['skipped'] = [];
  while (left > 0) {
    day += step;
    need(cal, day);
    if (isWeekend(day)) continue;
    const hs = statewide(cal, day);
    if (hs.length === 0) left--;
    else for (const holiday of hs) skipped.push({ day, holiday });
  }
  return { date: day, skipped, touched: span(from, day) };
}

export const nextBusinessDay = (cal: Calendar, from: Day) => addBusinessDays(cal, from, 1);
export const previousBusinessDay = (cal: Calendar, from: Day) => addBusinessDays(cal, from, -1);

/**
 * Business days passed or landed on when stepping one calendar day at a time from `from` to `to`.
 * Going forward that is the days in (from, to]; going back it is [to, from). Counting this way
 * makes add and diff exact inverses for every start day. `inclusive` also counts the start day.
 */
export function businessDaysBetween(cal: Calendar, from: Day, to: Day, inclusive: boolean): { count: number; touched: Span } {
  need(cal, from);
  need(cal, to);
  const forward = to >= from;
  const lo = forward ? (inclusive ? from : from + 1) : to;
  const hi = forward ? to : inclusive ? from : from - 1;
  let count = 0;
  for (let d = lo; d <= hi; d++) if (isBusinessDay(cal, d)) count++;
  return { count: forward ? count : -count, touched: span(from, to) };
}

export type Direction = 'forward' | 'back';

/** The day itself if it is a business day, otherwise the nearest one in the given direction. */
export function rollToBusinessDay(cal: Calendar, day: Day, direction: Direction): { date: Day; moved: boolean; touched: Span } {
  need(cal, day);
  const step = direction === 'forward' ? 1 : -1;
  let d = day;
  while (!isBusinessDay(cal, d)) {
    d += step;
    need(cal, d);
  }
  return { date: d, moved: d !== day, touched: span(day, d) };
}

export type Roll = Direction | 'none';

export function addCalendarDays(cal: Calendar, from: Day, n: number, roll: Roll): { calendar: Day; date: Day; rolled: boolean; touched: Span } {
  need(cal, from);
  const calendar = from + n;
  need(cal, calendar);
  if (roll === 'none') return { calendar, date: calendar, rolled: false, touched: span(from, calendar) };
  const r = rollToBusinessDay(cal, calendar, roll);
  return { calendar, date: r.date, rolled: r.moved, touched: span(from, r.date) };
}
