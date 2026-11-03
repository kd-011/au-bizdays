import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { CoverageError, UsageError } from './calendar.js';
import { today, todayIn } from './clock.js';
import { SCHEMA, cmdAdd, cmdAddCalendar, cmdDiff, cmdHolidays, cmdIs, cmdNext, cmdPrev, cmdRoll } from './commands.js';
import type { Context, Envelope } from './commands.js';
import { oneLine } from './render.js';
import { VERSION } from './version.js';

export { VERSION };

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const state = z.string().describe('Australian state or territory: ACT, NSW, NT, QLD, SA, TAS, VIC or WA (case-insensitive). Required, because public holidays differ by state and there is no default.');
const date = (what: string) => z.string().describe(`${what}, as a calendar date YYYY-MM-DD, for example 2026-12-18, or the word today (the date now on the state's clock).`);

const output = {
  schema: z.literal(SCHEMA),
  command: z.string(),
  state: z.string(),
  input: z.record(z.string(), z.unknown()).describe('The arguments as understood.'),
  result: z.record(z.string(), z.unknown()).describe('The answer. Fields depend on the tool.'),
  assumptions: z.record(z.string(), z.unknown()).describe('Weekend definition, which holidays are counted, data sources and their retrieval dates, and the covered date range.'),
  caveats: z.array(z.string()).describe('Things that may change the answer: estimated holidays, part-day holidays, end of data coverage, and the standing note that this is not legal advice.'),
};

const DEFINITION =
  'A business day is Monday to Friday and not a statewide public holiday in the given state. Part-day, regional and local holidays are not counted. A date outside the bundled holiday data returns an error that names the covered range; no holiday is ever guessed. Read the caveats field: estimated holidays and the legal-advice note are there. Read-only, no network access.';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'au-bizdays', version: VERSION });

  const ctx = (): Context => ({ today: today(), todayIn });

  type Run = (args: Record<string, unknown>, ctx: Context) => Envelope;
  const handlers = new Map<string, (args: Record<string, unknown>) => unknown>();

  // The SDK infers the handler's argument type from the zod shape; every tool here validates its own
  // arguments in commands.ts, so the handler takes them loosely.
  function register(name: string, title: string, description: string, input: z.ZodRawShape, run: Run): void {
    const handler = (args: Record<string, unknown>) => {
      try {
        const env = run(args, ctx());
        return { content: [{ type: 'text' as const, text: oneLine(env) }], structuredContent: env as unknown as Record<string, unknown> };
      } catch (e) {
        if (e instanceof UsageError || e instanceof CoverageError) return { isError: true, content: [{ type: 'text' as const, text: e.message }] };
        return { isError: true, content: [{ type: 'text' as const, text: 'Unexpected error. Nothing was changed; this server only reads its bundled data.' }] };
      }
    };
    handlers.set(name, handler);
    // The schema is what tools/list advertises. Calls skip the SDK's own argument check (see below).
    server.registerTool(
      name,
      { title, description: `${description} ${DEFINITION}`, inputSchema: input, outputSchema: output, annotations: READ_ONLY },
      handler as never,
    );
  }

  register(
    'add_business_days',
    'Add business days to a date',
    'Return the date that is n business days after (or, if n is negative, before) a start date. The start day is day 0 and never counts: n = 1 from a Friday gives the next business day. Use it for notice periods, payment terms and deadlines counted in business days. The result lists the weekday holidays that were skipped.',
    { n: z.number().describe('Whole number of business days. Positive counts forward, negative counts back, 0 returns the start date.'), from: date('The start date'), state },
    (a, c) => cmdAdd(a as never, c),
  );

  register(
    'add_calendar_days',
    'Add calendar days, then roll onto a business day',
    'Add n calendar days to a date, then optionally move the result onto a business day. Use it for "14 days from X, and if that is not a business day, the next business day". roll = forward moves to the next business day, back to the previous one, none keeps the calendar date.',
    { n: z.number().describe('Whole number of calendar days; negative counts back.'), from: date('The start date'), roll: z.enum(['forward', 'back', 'none']).describe('What to do when the calendar date is not a business day.'), state },
    (a, c) => cmdAddCalendar(a as never, c),
  );

  register(
    'business_days_between',
    'Count business days between two dates',
    'Count the business days between two dates. By default the start day is excluded and the end day is included, so Monday to Friday of one clear week is 4; set inclusive to count both days. The count is negative when the end date is before the start date. It is the exact inverse of add_business_days.',
    { from: date('The start date'), to: date('The end date'), inclusive: z.boolean().optional().describe('Count the start day as well. Default false.'), state },
    (a, c) => cmdDiff(a as never, c),
  );

  register(
    'is_business_day',
    'Is a date a business day?',
    'Say whether one date is a business day in a state, and if not, why: a weekend, a named statewide public holiday, or both.',
    { date: date('The date to check'), state },
    (a, c) => cmdIs(a as never, c),
  );

  register(
    'next_business_day',
    'Next business day after a date',
    'The nearest business day strictly after a date, whether or not the date itself is a business day. Same as add_business_days with n = 1.',
    { date: date('The date to start from'), state },
    (a, c) => cmdNext(a as never, c),
  );

  register(
    'previous_business_day',
    'Previous business day before a date',
    'The nearest business day strictly before a date, whether or not the date itself is a business day. Same as add_business_days with n = -1.',
    { date: date('The date to start from'), state },
    (a, c) => cmdPrev(a as never, c),
  );

  register(
    'roll_to_business_day',
    'Move a date onto a business day',
    'If the date is a business day, return it unchanged. Otherwise move it to the next business day (direction = forward) or the previous one (direction = back).',
    { date: date('The date to roll'), direction: z.enum(['forward', 'back']).describe('Which way to move a non-business day.'), state },
    (a, c) => cmdRoll(a as never, c),
  );

  register(
    'list_holidays',
    'List a state\'s public holidays for a year',
    'List the bundled public holidays for one state and year with date, name, scope and status. Scope is statewide (not a business day) or part-day (counted as a business day). Status is confirmed or estimated. The result gives the official source URL and when it was retrieved.',
    { year: z.number().describe('Four-digit year, for example 2026.'), state },
    (a, c) => cmdHolidays(a as never, c),
  );

  // The SDK rejects arguments that do not fit the zod shape with its own message before a handler
  // runs. Take over tools/call so a missing state or a bad direction reaches commands.ts and comes
  // back as the same error text the CLI prints.
  server.server.setRequestHandler(CallToolRequestSchema, (request) => {
    const handler = handlers.get(request.params.name);
    if (!handler) throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
    const args = request.params.arguments;
    return handler(args && typeof args === 'object' && !Array.isArray(args) ? args : {}) as never;
  });

  return server;
}
