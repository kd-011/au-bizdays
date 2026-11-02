import type { Envelope } from './commands.js';
import { parseDay, weekdayName } from './date.js';
import type { Day } from './date.js';

const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
const str = (v: unknown) => String(v);
const withWeekday = (date: unknown) => `${weekdayName(parseDay(str(date)) as Day)} ${str(date)}`;

/** Caveats that depend on the answer; the last two are the standing ones. */
export const specificCaveats = (env: Envelope): string[] => env.caveats.slice(0, env.caveats.length - 2);

const FOOTER = (state: string) =>
  `Business day = Monday to Friday, excluding ${state} statewide public holidays. Not legal advice; your contract or the law may differ.`;

/** One sentence that states the answer. */
export function summary(env: Envelope): string {
  const r = env.result;
  const s = env.state;
  switch (env.command) {
    case 'add': {
      const n = r['n'] as number;
      if (n === 0) return `0 business days from ${str(r['from'])} in ${s} is ${withWeekday(r['date'])}.`;
      return `${plural(Math.abs(n), 'business day')} ${n < 0 ? 'before' : 'after'} ${str(r['from'])} in ${s} is ${withWeekday(r['date'])}.`;
    }
    case 'diff': {
      const n = r['business_days'] as number;
      const ends = r['inclusive'] ? 'both days included' : 'start day not counted, end day counted';
      return `${plural(n, 'business day')} from ${str(r['from'])} to ${str(r['to'])} in ${s} (${ends}).`;
    }
    case 'is': {
      const date = withWeekday(r['date']);
      if (r['is_business_day']) return `${date} is a business day in ${s}.`;
      const why = (r['reasons'] as { kind: string; name?: string }[]).map((x) => (x.kind === 'weekend' ? 'weekend' : x.name)).join(', ');
      return `${date} is not a business day in ${s}: ${why}.`;
    }
    case 'next':
      return `The next business day after ${str(r['from'])} in ${s} is ${withWeekday(r['date'])}.`;
    case 'prev':
      return `The previous business day before ${str(r['from'])} in ${s} is ${withWeekday(r['date'])}.`;
    case 'roll':
      return r['moved']
        ? `${withWeekday(r['from'])} is not a business day in ${s}; rolled ${str(r['direction'])} to ${withWeekday(r['date'])}.`
        : `${withWeekday(r['from'])} is already a business day in ${s}; no change.`;
    case 'add-calendar': {
      const n = r['n'] as number;
      const base = `${plural(Math.abs(n), 'calendar day')} ${n < 0 ? 'before' : 'after'} ${str(r['from'])} in ${s} is ${withWeekday(r['calendar_date'])}`;
      if (r['roll'] === 'none') return `${base}.`;
      return r['rolled']
        ? `${base}, which is not a business day, so rolled ${str(r['roll'])} to ${withWeekday(r['date'])}.`
        : `${base}, which is a business day, so no roll was needed.`;
    }
    case 'holidays': {
      const list = r['holidays'] as { scope: string }[];
      return `${s} public holidays ${str(r['year'])}: ${list.length} listed, ${list.filter((h) => h.scope === 'statewide').length} statewide.`;
    }
  }
}

/** The text a person sees at the terminal. */
export function human(env: Envelope): string {
  const lines = [summary(env)];
  const r = env.result;
  if (env.command === 'add') {
    const skipped = r['skipped_holidays'] as { date: string; name: string }[];
    if (skipped.length) lines.push(`Skipped holidays: ${skipped.map((h) => `${h.date} ${h.name}`).join(', ')}.`);
  }
  if (env.command === 'holidays') {
    for (const h of r['holidays'] as { date: string; weekday: string; name: string; scope: string; status: string; note?: string }[]) {
      const tags: string[] = [];
      if (h.scope === 'part-day') tags.push(`part-day${h.note ? `, ${h.note}` : ''}; counted as a business day`);
      if (h.status === 'estimated') tags.push('estimated');
      lines.push(`${h.date}  ${h.weekday.padEnd(9)}  ${h.name}${tags.length ? `  (${tags.join('; ')})` : ''}`);
    }
    lines.push(`Source: ${str(r['source_url'])} (retrieved ${str(r['retrieved_on'])})`);
  }
  for (const c of specificCaveats(env)) lines.push(`Note: ${c}`);
  lines.push(FOOTER(env.state));
  return lines.join('\n');
}

/** One line for MCP clients: the answer, then any caveats that apply to it. */
export function oneLine(env: Envelope): string {
  const c = specificCaveats(env);
  return [summary(env), ...c].join(' ').replace(/\s+/g, ' ');
}
