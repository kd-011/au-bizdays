import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { root } from './helpers.mjs';

const parse = await import('../scripts/lib/parse.mjs');
const refresh = await import('../scripts/refresh-holidays.mjs');

describe('date cells', () => {
  const read = (text, year = 2026) => parse.parseWeekdayDates(text, { year, context: 'test' });

  test('one date, with a footnote digit after it', () => {
    assert.deepEqual(read('Monday 27 January2', 2025), ['2025-01-27']);
  });
  test('two dates sharing a month written once', () => {
    assert.deepEqual(read('Saturday 25 and Monday 27 April'), ['2026-04-25', '2026-04-27']);
  });
  test('two dates with the month on each, no space before "and"', () => {
    assert.deepEqual(read('Saturday 25 Decemberand Monday 27 December', 2027), ['2027-12-25', '2027-12-27']);
  });
  test('no spaces and an ampersand, as WA writes them', () => {
    assert.deepEqual(read('Sunday1 January&Monday2 January', 2023), ['2023-01-01', '2023-01-02']);
  });
  test('a year in the text is used and checked', () => {
    assert.deepEqual(read('Thursday 1 January 2026', 0), ['2026-01-01']);
    assert.throws(() => read('Thursday 1 January 2027', 2026), parse.ParseError);
  });
  test('a weekday that does not match the date is an error', () => {
    assert.throws(() => read('Friday 1 January'), /is not a Friday/);
  });
  test('a missing month and an impossible date are errors', () => {
    assert.throws(() => read('Monday 27'), /no month/);
    assert.throws(() => read('Monday 30 February'), parse.ParseError);
  });
});

describe('names', () => {
  test('footnotes and spelling are cleaned', () => {
    assert.equal(parse.cleanName('Good Friday1'), 'Good Friday');
    assert.equal(parse.cleanName('3Additional Day'), 'Additional Day');
    assert.equal(parse.cleanName('ANZAC Day1'), 'Anzac Day');
    assert.equal(parse.cleanName('Saturday before Easter Sunday'), 'Easter Saturday');
    assert.equal(parse.cleanName('Easter Saturday - the day after Good Friday'), 'Easter Saturday');
    assert.equal(parse.cleanName('Christmas Day* (25 December)'), 'Christmas Day');
    assert.equal(parse.cleanName('Western AustraliaDay'), 'Western Australia Day');
  });
  test('regional and sector-only rows are recognised, WA Show Day is not one of them', () => {
    for (const n of ['Alice Springs Show Day1', 'Royal Queensland Show (Brisbane area only)6', '1Bank Holiday', 'Easter Tuesday - generally Tasmanian Public Service only']) {
      assert.equal(parse.isNotStatewide(n), true, n);
    }
    assert.equal(parse.isNotStatewide('Show Day*'), false);
  });
  test('a part-day row needs its hours', () => {
    assert.throws(() => parse.entriesFor('Christmas Eve', ['2026-12-24'], { context: 'test' }), /hours/);
    const [e] = parse.entriesFor('Christmas Eve - part day holiday2', ['2026-12-24'], { context: 'test', pageText: 'Part day holiday - from 7pm to midnight only.' });
    assert.equal(e.scope, 'part-day');
    assert.equal(e.note, '7pm to midnight');
  });
});

describe('csv', () => {
  test('quoted fields with commas, quotes and newlines', () => {
    const rows = parse.parseCsv('a,b,c\n1,"x, ""y""",3\n4,"line1\nline2",6\n');
    assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, "y"', '3'], ['4', 'line1\nline2', '6']]);
  });
  test('an unexpected header is an error', () => {
    assert.throws(() => parse.parseDga('foo,bar\n1,2\n'), /unexpected header/);
  });
});

const WEEKDAY = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const LONG = (date) => `${WEEKDAY(date)} ${Number(date.slice(8))} ${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}`;

/** A Business Victoria style page for one year, built from data/vic/<year>.json, with optional edits. */
function vicPage(year, edit = (rows) => rows) {
  const data = JSON.parse(readFileSync(join(root, 'data', 'vic', `${year}.json`), 'utf8'));
  let rows = data.holidays.map((h) => ({ name: h.name, date: h.date, estimated: h.status === 'estimated' }));
  // A source lists an additional day under the holiday it belongs to.
  rows = rows.filter((r) => !r.name.endsWith('(additional day)')).flatMap((r) => [r, ...rows.filter((x) => x.name === `${r.name} (additional day)`)]);
  rows = edit(rows);
  const body = rows.map((r) => {
    if (r.raw) return r.raw;
    if (r.name.endsWith('(additional day)')) return `<tr><td>${LONG(r.date)}</td></tr>`;
    const cell = r.estimated ? 'Subject to AFL schedule3' : LONG(r.date);
    return `<tr><td>${r.name}</td><td>${cell}</td></tr>`;
  }).join('\n');
  return `<html><body><h1>Victorian public holidays ${year}</h1>
<table><tr><th>Holiday</th><th>Date in ${year}</th></tr>${body}</table>
<p>3 Friday before AFL Grand Final typically falls on the last Friday in September.</p></body></html>`;
}

function pagesDir(edits = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'au-bizdays-pages-'));
  for (const y of [2025, 2026, 2027, 2028]) writeFileSync(join(dir, `vic-${y}.html`), edits[y] ?? vicPage(y));
  writeFileSync(join(dir, 'dga-2025.csv'), 'Date,Holiday Name,Information,More Information,Jurisdiction\n');
  return dir;
}

const runRefresh = (args) => {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'refresh-holidays.mjs'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

describe('refresh-holidays.mjs', () => {
  test('needs --check or --write', () => {
    const r = runRefresh([]);
    assert.equal(r.code, 2);
    assert.match(r.out, /--check or --write/);
  });

  test('rejects an unknown state and an unknown option', () => {
    assert.equal(runRefresh(['--check', '--state', 'XX']).code, 2);
    assert.equal(runRefresh(['--check', '--bogus']).code, 2);
  });

  test('--check exits 0 when the pages match the bundled data', () => {
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir()]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /matches every source/);
  });

  test('--check exits 1 with a readable diff when a date differs', () => {
    const page = vicPage(2026, (rows) => rows.map((r) => (r.name === 'Melbourne Cup' ? { ...r, date: '2026-11-10' } : r)));
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir({ 2026: page })]);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /data\/vic\/2026\.json/);
    assert.match(r.out, /^\s+- 2026-11-03 Melbourne Cup/m);
    assert.match(r.out, /^\s+\+ 2026-11-10 Melbourne Cup/m);
  });

  test('a page that lost a row fails loudly instead of producing a short year', () => {
    const page = vicPage(2026, (rows) => rows.filter((r) => r.name !== 'Christmas Day'));
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir({ 2026: page })]);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /PARSE FAILURES/);
    assert.match(r.out, /no "Christmas Day" found/);
  });

  test('a page whose table disappeared fails loudly', () => {
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir({ 2027: '<html><body><p>Page redesigned</p></body></html>' })]);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /vic-2027: VIC: no 2027 found/);
  });

  test('a wrong Good Friday is caught against the Easter calculation', () => {
    const page = vicPage(2026, (rows) => rows.map((r) => (r.name === 'Good Friday' ? { ...r, date: '2026-04-10' } : r)));
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir({ 2026: page })]);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /Good Friday is 2026-04-10, Easter calculation says 2026-04-03/);
  });

  test('a weekday that does not match its date fails loudly', () => {
    const page = vicPage(2026, (rows) => rows.map((r) => (r.name === 'Melbourne Cup' ? { raw: '<tr><td>Melbourne Cup</td><td>Wednesday 3 November</td></tr>' } : r)));
    const r = runRefresh(['--check', '--state', 'VIC', '--pages-dir', pagesDir({ 2026: page })]);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /is not a Wednesday/);
  });

  test('--write updates the file for a changed date, and writes nothing when a page cannot be parsed', () => {
    const data = mkdtempSync(join(tmpdir(), 'au-bizdays-data-'));
    cpSync(join(root, 'data'), data, { recursive: true });
    const moved = vicPage(2026, (rows) => rows.map((r) => (r.name === 'Melbourne Cup' ? { ...r, date: '2026-11-10' } : r)));
    const w = runRefresh(['--write', '--state', 'VIC', '--data-dir', data, '--pages-dir', pagesDir({ 2026: moved }), '--today', '2030-01-02']);
    assert.equal(w.code, 0, w.out);
    const file = JSON.parse(readFileSync(join(data, 'vic', '2026.json'), 'utf8'));
    assert.ok(file.holidays.some((h) => h.date === '2026-11-10' && h.name === 'Melbourne Cup'));
    assert.ok(!file.holidays.some((h) => h.date === '2026-11-03'));
    assert.deepEqual(Object.keys(file), ['state', 'year', 'source_url', 'retrieved_on', 'holidays']);
    // Untouched years keep their original retrieved_on.
    assert.equal(JSON.parse(readFileSync(join(data, 'vic', '2027.json'), 'utf8')).retrieved_on, JSON.parse(readFileSync(join(root, 'data', 'vic', '2027.json'), 'utf8')).retrieved_on);

    const before = readFileSync(join(data, 'vic', '2026.json'), 'utf8');
    const broken = vicPage(2026, (rows) => rows.filter((r) => r.name !== 'Christmas Day' && r.name !== 'Melbourne Cup'));
    const w2 = runRefresh(['--write', '--state', 'VIC', '--data-dir', data, '--pages-dir', pagesDir({ 2026: broken, 2027: vicPage(2027, (rows) => rows.map((r) => ({ ...r, date: r.date }))) })]);
    assert.equal(w2.code, 3, w2.out);
    assert.equal(readFileSync(join(data, 'vic', '2026.json'), 'utf8'), before);
  });

  test('the bundled estimated NSW 2028 file is accepted as unpublished, and a confirmed one is not', () => {
    // NSW has no pages here, so only check the guard on the data: confirmed data with no source is an error.
    const data = mkdtempSync(join(tmpdir(), 'au-bizdays-data-'));
    cpSync(join(root, 'data'), data, { recursive: true });
    const f = join(data, 'nsw', '2028.json');
    const j = JSON.parse(readFileSync(f, 'utf8'));
    j.holidays[0].status = 'confirmed';
    writeFileSync(f, JSON.stringify(j));
    const dir = mkdtempSync(join(tmpdir(), 'au-bizdays-pages-'));
    // An NSW page that has 2026 and 2027 rows only: build it from the data.
    const rows = (year) => JSON.parse(readFileSync(join(root, 'data', 'nsw', `${year}.json`), 'utf8')).holidays;
    const cell = (h) => `${LONG(h.date)} ${h.date.slice(0, 4)}`;
    const table = `<table><tr><th>Holiday</th><th>2026</th><th>2027</th></tr>${rows(2026).map((a) => {
      const b = rows(2027).find((x) => x.name === a.name);
      return `<tr><td>${a.name.replace(' (additional day)', '')}</td><td>${cell(a)}</td><td>${b ? cell(b) : 'Not applicable'}</td></tr>`;
    }).join('')}</table>`;
    writeFileSync(join(dir, 'nsw.html'), `<html>${table}</html>`);
    writeFileSync(join(dir, 'dga-2025.csv'), 'Date,Holiday Name,Information,More Information,Jurisdiction\n');
    const r = runRefresh(['--check', '--state', 'NSW', '--data-dir', data, '--pages-dir', dir]);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /NSW 2028: bundled data is marked confirmed but no source publishes 2028/);
  });
});

describe('fetching', () => {
  let server, base, seen;
  before(async () => {
    seen = [];
    server = createServer((req, res) => {
      seen.push({ url: req.url, ua: req.headers['user-agent'] });
      if (req.url === '/ok') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<p>hello</p>'); }
      if (req.url === '/challenge') { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('<html><title>Just a moment...</title></html>'); }
      if (req.url === '/missing') { res.writeHead(404); return res.end('no'); }
      // /hang never answers
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => { server.closeAllConnections?.(); return new Promise((r) => server.close(r)); });

  test('sends a User-Agent that names the repository', async () => {
    assert.equal(await refresh.fetchText(`${base}/ok`), '<p>hello</p>');
    assert.match(seen[0].ua, /au-bizdays/);
    assert.match(seen[0].ua, /github\.com\/kd-011\/au-bizdays/);
  });

  test('a bot challenge is reported as blocked, not as a parse problem', async () => {
    await assert.rejects(refresh.fetchText(`${base}/challenge`), refresh.BlockedError);
  });

  test('an error status is an error', async () => {
    await assert.rejects(refresh.fetchText(`${base}/missing`), /HTTP 404/);
  });

  test('a server that never answers times out', async () => {
    const t0 = Date.now();
    await assert.rejects(refresh.fetchText(`${base}/hang`, { timeoutMs: 300 }), /no answer within/);
    assert.ok(Date.now() - t0 < 5000);
  });
});

describe('the Friday before the AFL Grand Final', () => {
  const vic = (year) => parse.parseVIC(vicPage(year), { year }).get(year);
  const friday = (year) => vic(year).find((e) => /Grand Final/.test(e.name));

  test('2027 is the day before the Grand Final the AFL announced (Saturday 2 October), not the last Friday in September', () => {
    assert.equal(friday(2027).date, '2027-10-01');
    assert.equal(friday(2027).status, 'estimated');
    assert.match(friday(2027).note, /Saturday 2 October/);
  });

  test('a year the AFL has not announced still falls back to the last Friday in September', () => {
    assert.equal(friday(2028).date, '2028-09-29');
    assert.match(friday(2028).note, /last Friday in September/);
  });
});

describe('Tasmania, from a table that lists only the substitute day', () => {
  const dataFile = (y) => JSON.parse(readFileSync(join(root, 'data', 'tas', `${y}.json`), 'utf8'));
  const long = (date) => `${Number(date.slice(8))} ${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}`;
  const YEARS = [2026, 2027, 2028];
  // Tasmania's table, rebuilt from the bundled files the way the page prints it: one row per holiday, one column per year.
  function tasPage() {
    const rows = [];
    const names = ["New Year's Day", 'Australia Day', 'Eight Hours Day', 'Good Friday', 'Easter Monday', 'ANZAC Day', "King's Birthday", 'Christmas Day', 'Boxing Day'];
    for (const name of names) {
      const cells = YEARS.map((y) => {
        const hs = dataFile(y).holidays;
        const find = (n) => hs.find((h) => h.name.toLowerCase() === n.toLowerCase());
        // With a weekend Christmas the page lists the substitute day only.
        return long((name === 'Christmas Day' ? find('Christmas Day (additional day)') ?? find(name) : find(name)).date);
      });
      rows.push(`<tr><td>${name}</td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
    }
    return `<html><body><table><tr><th>Holiday</th>${YEARS.map((y) => `<th>${y}</th>`).join('')}</tr>${rows.join('')}</table></body></html>`;
  }

  test('a table that lists 27 December 2027 for Christmas Day gives back the bundled file, Saturday 25 December included', () => {
    const got = parse.sortEntries(parse.parseTAS(tasPage()).get(2027));
    const want = parse.sortEntries(dataFile(2027).holidays);
    assert.deepEqual(got, want);
    assert.ok(got.some((e) => e.date === '2027-12-25' && e.name === 'Christmas Day'));
    assert.ok(got.some((e) => e.date === '2027-12-27' && e.name === 'Christmas Day (additional day)'));
  });

  test('a year where 25 December is a weekday is left alone', () => {
    const got = parse.parseTAS(tasPage()).get(2026).filter((e) => /Christmas/.test(e.name));
    assert.deepEqual(got.map((e) => [e.date, e.name]), [['2026-12-25', 'Christmas Day']]);
  });
});
