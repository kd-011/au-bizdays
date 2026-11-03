// Parsers for the official public holiday pages. Pure functions: HTML or CSV text in, entries out.
// Every parser fails loudly (ParseError) when the page does not look the way it did when the parser
// was written, rather than returning an empty or short year.

export class ParseError extends Error {}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_RE = MONTHS.join('|');
const WEEKDAY_RE = WEEKDAYS.join('|');

// ---------------------------------------------------------------- text helpers

const ENTITIES = { amp: '&', nbsp: ' ', rsquo: "'", lsquo: "'", ndash: '-', mdash: '-', quot: '"', apos: "'", lt: '<', gt: '>', hellip: '...' };

export function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const INLINE = 'a|span|strong|em|b|i|sup|sub|abbr|small|u|font|z|mark|cite';

/** Tag-stripped, entity-decoded text with whitespace collapsed. Inline tags join, block tags separate. */
export function textOf(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
      .replace(new RegExp(`</?(?:${INLINE})(?:\\s[^>]*)?>`, 'gi'), '')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[ \s]+/g, ' ')
    .trim();
}

/** Page text as lines, one per block element. */
export function linesOf(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
      .replace(new RegExp(`</?(?:${INLINE})(?:\\s[^>]*)?>`, 'gi'), '')
      .replace(/<\/?(?:p|div|li|tr|h[1-6]|br|table|section|ul|ol|td|th)(?:\s[^>]*)?\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .split('\n')
    .map((l) => l.replace(/[ \s]+/g, ' ').trim())
    .filter(Boolean);
}

/** Every table as { index, rows: string[][] }, cell text cleaned. */
export function tablesOf(html) {
  const out = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rows = [];
    for (const tr of m[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map((c) => textOf(c));
      if (cells.length) rows.push(cells);
    }
    out.push({ index: m.index, rows });
  }
  return out;
}

// ---------------------------------------------------------------- dates

const pad = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const weekdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Western Easter Sunday (anonymous Gregorian algorithm), used to sanity-check Good Friday. */
export function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Dates in a cell such as "Saturday 25 and Monday 27 April", "Thursday 1 January 2026" or
 * "Sunday1 January&Monday2 January". A month written once applies to the dates before it.
 * The weekday name is checked against the calendar, so a typo or a wrong year throws.
 */
export function parseWeekdayDates(text, { year, context }) {
  const re = new RegExp(`(${WEEKDAY_RE})\\s*(\\d{1,2})(?!\\d)\\s*(${MONTH_RE})?(?:\\s+(\\d{4})(?!\\d))?`, 'gi');
  const found = [];
  let pending = [];
  let m;
  while ((m = re.exec(text))) {
    const item = { weekday: WEEKDAYS.indexOf(m[1].toLowerCase()), day: Number(m[2]), month: m[3] ? MONTHS.indexOf(m[3].toLowerCase()) + 1 : 0, year: m[4] ? Number(m[4]) : 0 };
    pending.push(item);
    found.push(item);
    if (item.month) {
      for (const p of pending) p.month ||= item.month;
      for (const p of pending) p.year ||= item.year;
      pending = [];
    }
  }
  if (pending.length) throw new ParseError(`${context}: no month found for "${text}"`);
  return found.map((f) => {
    const y = f.year || year;
    if (!y) throw new ParseError(`${context}: no year for "${text}"`);
    if (year && f.year && f.year !== year) throw new ParseError(`${context}: "${text}" is not in ${year}`);
    if (f.day < 1 || f.day > daysIn(y, f.month)) throw new ParseError(`${context}: impossible date in "${text}"`);
    if (weekdayOf(y, f.month, f.day) !== f.weekday) {
      const cap = (w) => w[0].toUpperCase() + w.slice(1);
      throw new ParseError(`${context}: "${cap(WEEKDAYS[f.weekday])} ${f.day} ${cap(MONTHS[f.month - 1])} ${y}" is not a ${cap(WEEKDAYS[f.weekday])}`);
    }
    return iso(y, f.month, f.day);
  });
}

/** "26 January" with the year supplied by the caller (Tasmania). */
export function parseDayMonth(text, { year, context }) {
  const m = new RegExp(`^(\\d{1,2})\\s*(${MONTH_RE})$`, 'i').exec(text.replace(/[*#]/g, '').trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const day = Number(m[1]);
  if (day < 1 || day > daysIn(year, month)) throw new ParseError(`${context}: impossible date "${text}"`);
  return iso(year, month, day);
}

// ---------------------------------------------------------------- names and scope

const key = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

const CANON = new Map([
  ['anzac day', 'Anzac Day'],
  ['saturday before easter sunday', 'Easter Saturday'],
  ['the day after good friday', 'Easter Saturday'],
  ['easter saturday the day after good friday', 'Easter Saturday'],
  ['new years day', "New Year's Day"],
  ['kings birthday', "King's Birthday"],
  ['queens birthday', "Queen's Birthday"],
  ['australia day public holiday', 'Australia Day'],
  ['proclamation day', 'Proclamation Day holiday'],
  ['proclamation day holiday', 'Proclamation Day holiday'],
  ['proclamation day holiday and boxing day', 'Proclamation Day holiday'],
  ['western australia day', 'Western Australia Day'],
  ['western australiaday', 'Western Australia Day'],
  ['wa day', 'Western Australia Day'],
]);

/** Rows that are not statewide public holidays for everyone: regional days, sector-only days, bank holidays. */
const NOT_STATEWIDE = /(?:\w+ )+show day|show holiday|royal queensland show|^\d*\s*bank holiday|public service|public sector|state service|devonport cup|launceston cup|regatta|agfest|recreation day|local public holiday/i;

export function isNotStatewide(name) {
  return NOT_STATEWIDE.test(name.replace(/\s+/g, ' '));
}

/** Footnote digits and markers off, trailing qualifiers off, spelling made consistent. */
export function cleanName(raw) {
  let s = raw.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  s = s.replace(/^\d+(?=[A-Za-z])/, '').replace(/[*#]+/g, '');
  s = s.replace(/\s*\([^)]*\)/g, '').replace(/(?<=[A-Za-z'])\d+(?=\s|$)/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*:.*$/, '');
  return CANON.get(key(s)) ?? s;
}

const HOURS_RE = /(\d{1,2}(?:[.:]\d\d)?)\s*([ap]m)\s*(?:to|-)\s*midnight/i;

export function partDayHours(...texts) {
  for (const t of texts) {
    const m = t && HOURS_RE.exec(t.replace(/[\u2013\u2014]/g, '-'));
    if (m) return `${m[1]}${m[2].toLowerCase()} to midnight`;
  }
  return null;
}

const PART_DAY_NAME = /^(christmas eve|new year'?s eve)/i;

/**
 * Build entries from one row. rawName is the name cell, dates the already-parsed ISO dates.
 * Dates after the first get " (additional day)". Part-day rows need their hours from the row or the page.
 */
export function entriesFor(rawName, dates, { pageText = '', extraText = '', context, status = 'confirmed', note }) {
  if (isNotStatewide(rawName)) return [];
  const partDay = PART_DAY_NAME.test(rawName.replace(/^\d+/, '').trim());
  let name = cleanName(rawName);
  if (partDay) {
    name = /christmas eve/i.test(rawName) ? 'Christmas Eve' : "New Year's Eve";
    const hours = partDayHours(rawName, extraText, pageText);
    if (!hours) throw new ParseError(`${context}: ${name} is a part-day holiday but no hours ("7pm to midnight") were found`);
    return dates.map((date) => ({ date, name, scope: 'part-day', status, note: hours }));
  }
  return dates.map((date, i) => {
    const e = { date, name: i === 0 ? name : `${name} (additional day)`, scope: 'statewide', status };
    if (note) e.note = note;
    return e;
  });
}

// ---------------------------------------------------------------- validation

const REQUIRED = ["New Year's Day", 'Australia Day', 'Good Friday', 'Easter Monday', 'Anzac Day', 'Christmas Day'];

/** Fail when a parsed year is too thin to be right. Run on every year every parser returns. */
export function validateYear(state, year, entries) {
  const where = `${state} ${year}`;
  const names = new Set(entries.map((e) => e.name));
  for (const r of REQUIRED) if (!names.has(r)) throw new ParseError(`${where}: no "${r}" found`);
  if (!names.has('Boxing Day') && !names.has('Proclamation Day holiday')) throw new ParseError(`${where}: no Boxing Day found`);
  const statewide = entries.filter((e) => e.scope === 'statewide');
  if (statewide.length < 9) throw new ParseError(`${where}: only ${statewide.length} statewide holidays found, expected at least 9`);
  const seen = new Set();
  for (const e of entries) {
    if (!e.date.startsWith(`${year}-`)) throw new ParseError(`${where}: ${e.name} is dated ${e.date}`);
    const k = `${e.date}|${e.name}`;
    if (seen.has(k)) throw new ParseError(`${where}: duplicate ${e.name} on ${e.date}`);
    seen.add(k);
  }
  const gf = entries.find((e) => e.name === 'Good Friday');
  const want = addDays(easterSunday(year), -2);
  if (gf.date !== want) throw new ParseError(`${where}: Good Friday is ${gf.date}, Easter calculation says ${want}`);
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)));
}

// ---------------------------------------------------------------- state parsers
// Each returns Map<year, entry[]> for every year the page shows.

function add(map, entries) {
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4));
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(e);
  }
}

function mergeInto(target, src) {
  for (const [y, list] of src) {
    if (!target.has(y)) target.set(y, []);
    target.get(y).push(...list);
  }
}

/** Header row holding years ("2026") or "Date in 2026": column index to year. */
function yearHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 3); r++) {
    const cols = [];
    rows[r].forEach((c, i) => {
      const m = /^(?:date in )?(20\d\d)$/i.exec(c.trim());
      if (m) cols.push([i, Number(m[1])]);
    });
    if (cols.length) {
      // WA's previous-years table has no blank cell above the holiday names: shift the years right by one.
      const next = rows[r + 1];
      if (cols[0][0] === 0 && next && next.length === rows[r].length + 1) return { cols: cols.map(([i, y]) => [i + 1, y]), headerRow: r };
      return { cols, headerRow: r };
    }
  }
  return null;
}

const NO_DATE = /^(?:-|n\/?a|not applicable|nil)?$/i;

/** Default cell reader: weekday-led dates such as "Friday 3 April". Anything else in a non-empty cell is an error. */
function weekdayCell(context) {
  return (text, year, name) => {
    const t = text.replace(/[*#]+/g, ' ').trim();
    if (NO_DATE.test(t) || isNotStatewide(name)) return null;
    const dates = parseWeekdayDates(t, { year, context: `${context} ${name}` });
    if (!dates.length) throw new ParseError(`${context} ${year}: cannot read a date from "${text}" (${name})`);
    return { dates };
  };
}

/**
 * Tables with years as columns (WA, NSW, QLD, VIC, TAS). In a single-year table a one-cell row
 * continues the holiday above it (VIC lists the Monday after a weekend Boxing Day that way), and
 * NSW lists "Additional Day" rows under the holiday they belong to.
 */
function parseYearColumns(table, { context, pageText, cell }) {
  // Only the holiday tables: others on these pages (regional days, school terms) have year columns too.
  if (!table.rows.some((r) => /^\d*new year's day/i.test(r[0] ?? ''))) return null;
  const head = yearHeader(table.rows);
  if (!head) return null;
  const map = new Map();
  let last = null;
  for (const row of table.rows.slice(head.headerRow + 1)) {
    let rawName = row[0] ?? '';
    let cells = new Map(head.cols.map(([i]) => [i, row[i] ?? '']));
    let continued = false;
    if (row.length === 1 && last && head.cols.length === 1) {
      rawName = last;
      cells = new Map([[head.cols[0][0], row[0]]]);
      continued = true;
    }
    if (!rawName) continue;
    const additional = /^\d*\s*additional day$/i.test(rawName.trim());
    if (additional) {
      if (!last) throw new ParseError(`${context}: "Additional Day" row with no holiday above it`);
      rawName = last;
    } else if (!continued) {
      last = rawName;
    }
    for (const [i, year] of head.cols) {
      const c = cell(cells.get(i) ?? '', year, rawName);
      if (!c) continue;
      let list = entriesFor(rawName, c.dates, { pageText, extraText: cells.get(i), context: `${context} ${year}`, status: c.status, note: c.note });
      if (continued || additional) list = list.map((e) => ({ ...e, name: e.name.endsWith('(additional day)') ? e.name : `${e.name} (additional day)` }));
      add(map, list);
    }
  }
  return map;
}

function requireYears(map, expected, context) {
  for (const y of expected) if (!map.has(y)) throw new ParseError(`${context}: no ${y} found (page has ${[...map.keys()].sort().join(', ') || 'nothing'})`);
}

export function parseWA(html) {
  const pageText = textOf(html);
  const out = new Map();
  for (const t of tablesOf(html)) {
    const m = parseYearColumns(t, {
      context: 'WA',
      pageText,
      cell: (text, year, name) => {
        const c = weekdayCell('WA')(text, year, name);
        if (c && /#/.test(text)) return { ...c, status: 'estimated', note: 'Marked to be confirmed once appointed by proclamation and published in the Government Gazette.' };
        return c;
      },
    });
    if (m) mergeInto(out, m);
  }
  requireYears(out, [2025, 2026, 2027, 2028], 'WA');
  return out;
}

export function parseNSW(html) {
  const out = new Map();
  for (const t of tablesOf(html)) {
    const m = parseYearColumns(t, { context: 'NSW', pageText: '', cell: weekdayCell('NSW') });
    if (m) mergeInto(out, m);
  }
  requireYears(out, [2026, 2027], 'NSW');
  return out;
}

export function parseQLD(html) {
  const out = new Map();
  for (const t of tablesOf(html)) {
    const m = parseYearColumns(t, { context: 'QLD', pageText: '', cell: weekdayCell('QLD') });
    if (m) mergeInto(out, m);
  }
  if (!out.size) throw new ParseError('QLD: no holiday table found');
  return out;
}

/**
 * Grand Finals the AFL has announced, by year. Victoria's Friday holiday is the day before, but
 * Business Victoria keeps saying "subject to AFL schedule" until the holiday is gazetted, so the
 * page alone would put 2027 a week early. Source for 2027: afl.com.au, "Dates for 2027 AFL season
 * confirmed" (Grand Final on Saturday 2 October). Add a year here when the AFL announces it.
 */
export const AFL_GRAND_FINAL = { 2027: '2027-10-02' };

const longDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/^(\w+),? /, '$1 ');

export function lastFriday(year, month) {
  let d = daysIn(year, month);
  while (weekdayOf(year, month, d) !== 5) d--;
  return iso(year, month, d);
}

/** One Business Victoria page per year. */
export function parseVIC(html, { year }) {
  const pageText = textOf(html);
  const out = new Map();
  for (const t of tablesOf(html)) {
    const m = parseYearColumns(t, {
      context: 'VIC',
      pageText,
      cell: (text, y, name) => {
        if (/grand final/i.test(name) && !new RegExp(WEEKDAY_RE, 'i').test(text)) {
          // "Subject to AFL schedule": the page says the date typically falls on the last Friday in September.
          if (!/last friday in september/i.test(pageText)) throw new ParseError(`VIC ${y}: Grand Final Friday has no date and the page no longer gives the usual-date rule`);
          const gf = AFL_GRAND_FINAL[y];
          if (gf) return { dates: [addDays(gf, -1)], status: 'estimated', note: `Not yet gazetted. The AFL has set the ${y} Grand Final for ${longDate(gf)}, so this is the Friday before it.` };
          return { dates: [lastFriday(y, 9)], status: 'estimated', note: 'Date not yet announced. The source says it typically falls on the last Friday in September.' };
        }
        return weekdayCell('VIC')(text, y, name);
      },
    });
    if (m) mergeInto(out, m);
  }
  requireYears(out, [year], 'VIC');
  if ([...out.keys()].some((y) => y !== year)) throw new ParseError(`VIC: page for ${year} shows ${[...out.keys()].join(', ')}`);
  return out;
}

export function parseTAS(html) {
  const out = new Map();
  for (const t of tablesOf(html)) {
    const m = parseYearColumns(t, {
      context: 'TAS',
      pageText: '',
      cell: (text, year, name) => {
        const clean = text.replace(/[*#]+/g, ' ').trim();
        if (NO_DATE.test(clean) || isNotStatewide(name)) return null;
        const d = parseDayMonth(clean, { year, context: `TAS ${name}` });
        if (!d) throw new ParseError(`TAS ${year}: cannot read a date from "${text}" (${name})`);
        return { dates: [d] };
      },
    });
    if (m) mergeInto(out, m);
  }
  requireYears(out, [2026, 2027, 2028], 'TAS');
  // The page says a New Year's Day on a weekend moves to the Monday, but its table lists 1 January
  // for 2028 (a Saturday) and nothing else. Add the Monday as an estimate rather than drop it.
  for (const [year, list] of out) {
    const nyd = list.find((e) => e.name === "New Year's Day");
    if (!nyd) continue;
    const wd = weekdayOf(year, Number(nyd.date.slice(5, 7)), Number(nyd.date.slice(8)));
    if ((wd === 6 || wd === 0) && !list.some((e) => e.name === "New Year's Day (additional day)")) {
      list.push({ date: addDays(nyd.date, wd === 6 ? 2 : 1), name: "New Year's Day (additional day)", scope: 'statewide', status: 'estimated', note: "The table lists 1 January only. The Monday comes from the page's own rule that a weekend New Year's Day moves to the following Monday." });
    }
    // Christmas Day on a weekend: the table lists only the substitute (27 December), but the page's
    // substitute rule makes 25 December a holiday as well, so keep it and call the 27th the additional day.
    const xmas = list.find((e) => e.name === 'Christmas Day');
    if (xmas && xmas.date !== `${year}-12-25`) {
      const day = weekdayOf(year, 12, 25) === 6 ? 'Saturday' : 'Sunday';
      xmas.name = 'Christmas Day (additional day)';
      list.push({ date: `${year}-12-25`, name: 'Christmas Day', scope: 'statewide', status: 'confirmed', note: `A ${day}. The table lists 27 December, and the page's substitute rule makes both the ${day} and the ${day === 'Saturday' ? 'Monday' : 'Tuesday'} holidays.` });
    }
  }
  return out;
}

export function parseNT(html) {
  const pageText = textOf(html);
  const out = new Map();
  let tables = 0;
  for (const t of tablesOf(html)) {
    if (!t.rows.length || !/^holiday$/i.test(t.rows[0][0] ?? '') || !/^date$/i.test(t.rows[0][1] ?? '')) continue;
    tables++;
    for (const [rawName, cell] of t.rows.slice(1)) {
      if (!rawName || isNotStatewide(rawName) || NO_DATE.test(cell ?? '')) continue;
      const dates = parseWeekdayDates(cell, { context: `NT ${rawName}` });
      if (!dates.length) throw new ParseError(`NT: cannot read a date from "${cell}" (${rawName})`);
      for (const d of dates) if (!/\b20\d\d\b/.test(cell)) throw new ParseError(`NT: date without a year in "${cell}"`);
      const monday = /^boxing day monday$/i.test(rawName.trim());
      const list = entriesFor(monday ? 'Boxing Day' : rawName, dates, { pageText, extraText: cell, context: `NT ${rawName}` });
      add(out, monday ? list.map((e) => ({ ...e, name: 'Boxing Day (additional day)' })) : list);
    }
  }
  if (!tables) throw new ParseError('NT: no holiday tables found');
  requireYears(out, [2026, 2027, 2028], 'NT');
  return out;
}

export function parseACT(html) {
  const pageText = textOf(html);
  const out = new Map();
  for (const t of tablesOf(html)) {
    if (!/^public holiday$/i.test(t.rows[0]?.[0] ?? '')) continue; // school term tables have other headers
    const before = html.slice(Math.max(0, t.index - 700), t.index);
    const heads = [...before.matchAll(/>\s*(20\d\d)(?: public holidays)?\s*<\/(?:h\d|span)>/gi)];
    if (!heads.length) throw new ParseError('ACT: holiday table with no year heading above it');
    const year = Number(heads[heads.length - 1][1]);
    for (const [rawName, cell] of t.rows.slice(1)) {
      if (!rawName || isNotStatewide(rawName)) continue;
      const dates = parseWeekdayDates(cell, { year, context: `ACT ${rawName}` });
      if (!dates.length) throw new ParseError(`ACT ${year}: cannot read a date from "${cell}" (${rawName})`);
      add(out, entriesFor(rawName, dates, { pageText, extraText: cell, context: `ACT ${year} ${rawName}` }));
    }
  }
  requireYears(out, [2026, 2027, 2028], 'ACT');
  return out;
}

/** SafeWork SA: a list per year, "Thursday 1 January: New Year's Day". */
export function parseSA(html) {
  const lines = linesOf(html);
  const out = new Map();
  const heading = /^(20\d\d) South Australia's public holidays and school holidays$/i;
  const item = new RegExp(`^((?:${WEEKDAY_RE}) [^:]*?):\\s*(.+)$`, 'i');
  let year = 0;
  let seen = 0;
  for (const line of lines) {
    const h = heading.exec(line);
    if (h) { year = Number(h[1]); seen++; continue; }
    if (/^note:/i.test(line)) year = 0;
    if (!year) continue;
    const m = item.exec(line);
    if (!m) continue;
    const [, datePart, label] = m;
    if (/school/i.test(label)) continue;
    const dates = parseWeekdayDates(datePart, { year, context: `SA ${label}` });
    const extra = /^\(additional public holiday for (.+)\)$/i.exec(label.trim());
    if (extra) {
      add(out, dates.map((date) => ({ date, name: `${cleanName(extra[1])} (additional day)`, scope: 'statewide', status: 'confirmed' })));
    } else {
      add(out, entriesFor(label, dates, { extraText: label, context: `SA ${year} ${label}` }));
    }
  }
  if (!seen) throw new ParseError('SA: no per-year headings found');
  requireYears(out, [2025, 2026, 2027, 2028], 'SA');
  return out;
}

// ---------------------------------------------------------------- data.gov.au CSV

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

/** The national dataset: one CSV per year, all jurisdictions. Returns Map<STATE, Map<year, entry[]>>. */
export function parseDga(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const head = rows[0]?.map((h) => h.trim().toLowerCase());
  const col = (n) => (head ?? []).indexOf(n);
  const [cDate, cName, cInfo, cJur] = [col('date'), col('holiday name'), col('information'), col('jurisdiction')];
  if (!head || [cDate, cName, cInfo, cJur].some((c) => c < 0)) throw new ParseError(`data.gov.au CSV: unexpected header ${JSON.stringify(head)}`);
  const out = new Map();
  for (const r of rows.slice(1)) {
    const state = (r[cJur] ?? '').trim().toUpperCase();
    const name = (r[cName] ?? '').trim();
    const raw = (r[cDate] ?? '').trim();
    if (!name) continue;
    if (!raw) continue; // an undated row, for example VIC's Grand Final Friday in 2025
    if (!/^\d{8}$/.test(raw)) throw new ParseError(`data.gov.au CSV: bad date "${raw}" for ${name}`);
    if (!['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].includes(state)) throw new ParseError(`data.gov.au CSV: unknown jurisdiction "${r[cJur]}"`);
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
    const list = entriesFor(name, [date], { extraText: r[cInfo] ?? '', context: `data.gov.au ${state} ${name}` });
    if (!out.has(state)) out.set(state, new Map());
    add(out.get(state), list);
  }
  return out;
}
