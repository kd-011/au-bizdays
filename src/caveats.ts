import { coverageOf } from './calendar.js';
import type { Calendar, Span } from './calendar.js';
import type { Day } from './date.js';

/** Says in every result what "business day" means here, and what it leaves out. */
export function standingCaveats(state: string): string[] {
  return [
    `Business day here means Monday to Friday excluding ${state} statewide public holidays. Legislation, court rules or a contract may define business days differently (for example excluding other days or counting bank days). This is not legal advice; your own definition wins.`,
    'Regional and local holidays (show days, local event days and similar) and bank holidays are not counted.',
  ];
}

export interface CaveatOptions {
  touched: Span;
  /** Today as a day number, for the end-of-coverage warning. */
  today: Day;
  /** A year listing already shows scope per entry, so it skips the part-day notes. */
  listing?: boolean;
}

/** Caveats that depend on which days the answer touched, then the standing ones. */
export function caveatsFor(cal: Calendar, opts: CaveatOptions): { specific: string[]; all: string[] } {
  const specific: string[] = [];
  const estimated: { date: string; name: string; note?: string }[] = [];
  const partDay: string[] = [];
  for (let d = opts.touched.from; d <= opts.touched.to; d++) {
    for (const h of cal.on(d)) {
      if (h.status === 'estimated' && h.scope !== 'regional') estimated.push(h);
      if (h.scope === 'part-day' && !opts.listing) {
        partDay.push(`${h.name} (${h.date}) is a part-day holiday in ${cal.state}${h.note ? ` (${h.note})` : ''}. It is counted as a normal business day here.`);
      }
    }
  }
  if (estimated.length > 0 && estimated.length <= 3) {
    for (const e of estimated) {
      specific.push(`${e.name} on ${e.date} is estimated, not confirmed${e.note ? `: ${e.note}` : '.'} Check the official list before relying on this answer.`);
    }
  } else if (estimated.length > 3) {
    const notes = [...new Set(estimated.map((e) => e.note).filter(Boolean))];
    specific.push(`${estimated.length} holidays in this range are estimated, not confirmed (${estimated.map((e) => e.date).join(', ')})${notes.length ? `: ${notes.join(' ')}` : '.'} Check the official list before relying on this answer.`);
  }
  specific.push(...partDay);
  const end = coverageOf(cal).to;
  const endDay = cal.last;
  if (endDay - opts.today <= 60) {
    specific.push(`Holiday data coverage ends on ${end}. Results that need a date after that fail rather than guess.`);
  }
  return { specific, all: [...specific, ...standingCaveats(cal.state)] };
}
