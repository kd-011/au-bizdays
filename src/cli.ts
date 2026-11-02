#!/usr/bin/env node
import { CoverageError, UsageError } from './calendar.js';
import {
  SCHEMA, cmdAdd, cmdAddCalendar, cmdDiff, cmdHolidays, cmdIs, cmdNext, cmdPrev, cmdRoll,
} from './commands.js';
import type { Context, Envelope } from './commands.js';
import { today } from './clock.js';
import { STATES } from './data.js';
import { human } from './render.js';
import { VERSION } from './version.js';

interface Spec {
  positionals: string[];
  values: string[];
  flags: string[];
  usage: string;
  help: string;
  run(p: string[], o: Record<string, string | boolean | undefined>, ctx: Context): Envelope;
}

const STATE_LINE = `--state <STATE>   ${STATES.join(', ')} (case-insensitive, required)`;

const SPECS: Record<string, Spec> = {
  add: {
    positionals: ['n'], values: ['from', 'state'], flags: [],
    usage: 'add <n> --from <date> --state <STATE>',
    help: `Add n business days to a date.

The start day does not count: day 0 is --from, and the first business day after it is day 1.
add 1 from a Friday gives the next business day. A negative n counts back instead, and add 0
returns --from unchanged. Weekdays that are statewide holidays are skipped and listed.`,
    run: (p, o, c) => cmdAdd({ n: p[0], from: o['from'], state: o['state'] }, c),
  },
  diff: {
    positionals: ['from', 'to'], values: ['state'], flags: ['inclusive'],
    usage: 'diff <from> <to> --state <STATE> [--inclusive]',
    help: `Count business days between two dates.

By default the start day is excluded and the end day is included: Monday to Friday of one clear
week is 4. --inclusive counts both days (5 for the same week). When <to> is before <from> the count
is negative, and this is the exact inverse of add: add n then diff always returns n.`,
    run: (p, o, c) => cmdDiff({ from: p[0], to: p[1], inclusive: o['inclusive'] === true, state: o['state'] }, c),
  },
  is: {
    positionals: ['date'], values: ['state'], flags: [],
    usage: 'is <date> --state <STATE>',
    help: 'Say whether a date is a business day, and if not, why: a weekend, a named statewide holiday, or both.',
    run: (p, o, c) => cmdIs({ date: p[0], state: o['state'] }, c),
  },
  next: {
    positionals: ['date'], values: ['state'], flags: [],
    usage: 'next <date> --state <STATE>',
    help: 'The nearest business day strictly after a date. Same as add 1.',
    run: (p, o, c) => cmdNext({ date: p[0], state: o['state'] }, c),
  },
  prev: {
    positionals: ['date'], values: ['state'], flags: [],
    usage: 'prev <date> --state <STATE>',
    help: 'The nearest business day strictly before a date. Same as add -1.',
    run: (p, o, c) => cmdPrev({ date: p[0], state: o['state'] }, c),
  },
  roll: {
    positionals: ['date'], values: ['direction', 'state'], flags: [],
    usage: 'roll <date> --direction forward|back --state <STATE>',
    help: `If the date is not a business day, move it to the nearest one: the next business day with
--direction forward, the previous with --direction back. A business day is returned unchanged.`,
    run: (p, o, c) => cmdRoll({ date: p[0], direction: o['direction'], state: o['state'] }, c),
  },
  'add-calendar': {
    positionals: ['n'], values: ['from', 'roll', 'state'], flags: [],
    usage: 'add-calendar <n> --from <date> --roll forward|back|none --state <STATE>',
    help: `Add n calendar days, then optionally roll the result onto a business day. Use it for
"14 calendar days from X, and if that is not a business day move it to the next one":
add-calendar 14 --from X --roll forward. --roll none keeps the calendar date as it is.
A negative n counts back.`,
    run: (p, o, c) => cmdAddCalendar({ n: p[0], from: o['from'], roll: o['roll'], state: o['state'] }, c),
  },
  holidays: {
    positionals: [], values: ['year', 'state'], flags: [],
    usage: 'holidays --year <year> --state <STATE>',
    help: `List a state's holidays for a year with name, date and scope. Scope is statewide (not a
business day), or part-day (counted as a business day and noted as a caveat). Entries marked
estimated are not yet confirmed by the source.`,
    run: (_p, o, c) => cmdHolidays({ year: o['year'], state: o['state'] }, c),
  },
};

const BLURBS: Record<string, string> = {
  add: 'n business days after a date (negative counts back)',
  diff: 'business days between two dates',
  is: 'is it a business day, and if not why',
  next: 'nearest business day strictly after a date',
  prev: 'nearest business day strictly before a date',
  roll: 'move a non-business day to the nearest one',
  'add-calendar': 'n calendar days, then roll onto a business day',
  holidays: "the state's holidays for a year",
};

const GLOBAL_HELP = `au-bizdays ${VERSION}
Business-day and deadline arithmetic for Australian states and territories.

Usage: au-bizdays <command> [arguments] --state <STATE> [--json]

Commands:
${Object.entries(SPECS).map(([name, s]) => `  ${s.usage.replace(/ --state <STATE>/, '').padEnd(58)}${BLURBS[name]}`).join('\n')}

Options:
  ${STATE_LINE}
  --json            machine-readable output (schema au-bizdays/v1), also for errors
  -h, --help        help; au-bizdays <command> --help for one command
  -v, --version

A business day is Monday to Friday and not a statewide public holiday in the chosen state.
Part-day, regional and local holidays are not counted. Legislation, court rules or a contract
may define business days differently; this is not legal advice.

Dates are YYYY-MM-DD. Exit codes: 0 ok, 2 usage error, 3 date outside the bundled holiday data.`;

const commandHelp = (name: string, s: Spec) => `au-bizdays ${s.usage}\n\n${s.help}\n\n  ${STATE_LINE}\n  --json            machine-readable output (schema au-bizdays/v1)`;

interface Parsed {
  command?: string;
  positionals: string[];
  options: Record<string, string | boolean | undefined>;
  help: boolean;
  version: boolean;
  json: boolean;
}

function parse(argv: string[]): Parsed {
  const out: Parsed = { positionals: [], options: {}, help: false, version: false, json: false };
  const rest: string[] = [];
  const raw: [string, string | undefined][] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-v' || a === '--version') out.version = true;
    else if (a === '--json') out.json = true;
    else if (/^-\d+$/.test(a)) rest.push(a);
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) raw.push([a.slice(2, eq), a.slice(eq + 1)]);
      else raw.push([a.slice(2), undefined]);
    } else if (a.startsWith('-') && a.length > 1) throw new UsageError(`Unknown option ${a}.`);
    else rest.push(a);
    // A value option takes the next token, which may be anything (including a negative number).
    const last = raw[raw.length - 1];
    if (last && last[1] === undefined && a.startsWith('--') && !a.includes('=') && VALUE_OPTIONS.has(a.slice(2))) {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`${a} needs a value.`);
      last[1] = next;
      i++;
    }
  }
  [out.command, ...out.positionals] = rest;
  for (const [k, v] of raw) out.options[k] = v === undefined ? true : v;
  return out;
}

const VALUE_OPTIONS = new Set(['state', 'from', 'direction', 'roll', 'year']);
const FLAG_OPTIONS = new Set(['inclusive']);

function main(argv: string[]): number {
  let json = argv.includes('--json');
  const out = (s: string) => process.stdout.write(s.endsWith('\n') ? s : `${s}\n`);
  try {
    const p = parse(argv);
    json = p.json;
    if (p.version) { out(VERSION); return 0; }
    const spec = p.command ? SPECS[p.command] : undefined;
    if (p.help) { out(spec && p.command ? commandHelp(p.command, spec) : GLOBAL_HELP); return 0; }
    if (!p.command) throw new UsageError('No command given. Run au-bizdays --help.');
    if (!spec) throw new UsageError(`Unknown command "${p.command}". Run au-bizdays --help.`);
    for (const k of Object.keys(p.options)) {
      if (!spec.values.includes(k) && !spec.flags.includes(k)) throw new UsageError(`Unknown option --${k} for ${p.command}.`);
      if (FLAG_OPTIONS.has(k) && p.options[k] !== true) throw new UsageError(`--${k} does not take a value.`);
    }
    if (p.positionals.length > spec.positionals.length) throw new UsageError(`Unexpected argument "${p.positionals[spec.positionals.length]}" for ${p.command}.`);
    const env = spec.run(p.positionals, p.options, { today: today() });
    out(json ? JSON.stringify(env, null, 2) : human(env));
    return 0;
  } catch (e) {
    const code = e instanceof UsageError ? 2 : e instanceof CoverageError ? 3 : 1;
    const message = e instanceof Error ? e.message : String(e);
    if (json) {
      const error: Record<string, unknown> = { code: e instanceof UsageError ? 'usage' : e instanceof CoverageError ? 'out_of_coverage' : 'internal', message, exit_code: code };
      if (e instanceof CoverageError) error['coverage'] = e.coverage;
      out(JSON.stringify({ schema: SCHEMA, error }, null, 2));
    } else {
      process.stderr.write(`au-bizdays: ${message}\n`);
    }
    return code;
  }
}

process.exitCode = main(process.argv.slice(2));
