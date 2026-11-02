#!/usr/bin/env node
// Re-fetches each state's official public holiday page, parses it into the shape in data/, and
// reports the difference from what is bundled.
//
//   node scripts/refresh-holidays.mjs --check     exit 0 when the bundled data matches the sources
//   node scripts/refresh-holidays.mjs --write     update data/ to match the sources
//
// Options:
//   --state WA,VIC          only these states
//   --through 2028          last year to keep (default 2028)
//   --data-dir DIR          data directory to compare with and write to (default: data/)
//   --pages-dir DIR         use DIR/<source id>.html (or .csv) instead of fetching that source
//   --pages-retrieved-on D  retrieved_on to record for pages read from --pages-dir (default: file date)
//   --allow-blocked         do not fail when a source cannot be fetched (it is still reported)
//   --report FILE           also write the report as markdown
//   --today YYYY-MM-DD      retrieved_on for pages fetched now (default: today, UTC)
//
// Exit codes: 0 ok, 1 data differs, 2 usage, 3 a page could not be parsed (its structure changed),
// 4 a source could not be fetched, so its data is unverified.
//
// Some state sites (VIC, NT, TAS, SA) sit behind a bot challenge that plain HTTP cannot pass. Those
// sources come back "blocked". Save the page from a browser into --pages-dir to check them anyway.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ParseError, parseACT, parseDga, parseNSW, parseNT, parseQLD, parseSA, parseTAS, parseVIC, parseWA, sortEntries, validateYear,
} from './lib/parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const FIRST_YEAR = 2025;
const DEFAULT_THROUGH = 2028;
const UA = 'au-bizdays-refresh/0.1 (+https://github.com/kd-011/au-bizdays)';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 8 * 1024 * 1024;

const one = (state, fn) => (text, opts) => new Map([[state, fn(text, opts)]]);
const DGA_URL = 'https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv';

/** expect: the years this source must show; if it cannot be read, those years are unverified. */
export const SOURCES = [
  { id: 'wa', state: 'WA', url: 'https://www.wa.gov.au/service/employment/workplace-arrangements/public-holidays-western-australia', expect: [2025, 2026, 2027, 2028], parse: one('WA', parseWA) },
  { id: 'nsw', state: 'NSW', url: 'https://www.nsw.gov.au/about-nsw/public-holidays', expect: [2026, 2027], parse: one('NSW', parseNSW) },
  { id: 'qld', state: 'QLD', url: 'https://www.qld.gov.au/recreation/travel/holidays/public', expect: [2026, 2027, 2028], parse: one('QLD', parseQLD) },
  { id: 'qld-2025', state: 'QLD', url: 'https://www.qld.gov.au/recreation/travel/holidays/queensland-public-holiday-dates-for-2025', expect: [2025], parse: one('QLD', parseQLD) },
  ...[2025, 2026, 2027, 2028].map((year) => ({
    id: `vic-${year}`, state: 'VIC', url: `https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-${year}`, expect: [year], parse: one('VIC', (t) => parseVIC(t, { year })),
  })),
  { id: 'sa', state: 'SA', url: 'https://www.safework.sa.gov.au/resources/public-holidays', expect: [2025, 2026, 2027, 2028], parse: one('SA', parseSA) },
  { id: 'tas', state: 'TAS', url: 'https://www.worksafe.tas.gov.au/topics/laws-and-compliance/public-holidays', expect: [2026, 2027, 2028], parse: one('TAS', parseTAS) },
  { id: 'nt', state: 'NT', url: 'https://nt.gov.au/employ/for-employees-in-nt/nt-public-holidays', expect: [2026, 2027, 2028], parse: one('NT', parseNT) },
  { id: 'act', state: 'ACT', url: 'https://www.act.gov.au/living-in-the-act/public-holidays-school-terms-and-daylight-saving', expect: [2026, 2027, 2028], parse: one('ACT', parseACT) },
  // The national dataset stops at 2025. It is the 2025 source for states whose own page no longer lists 2025,
  // and a cross-check for the rest.
  { id: 'dga-2025', state: '*', url: DGA_URL, ext: 'csv', expect: [2025], parse: parseDga },
];

// ---------------------------------------------------------------- fetching

export class BlockedError extends Error {}

export async function fetchText(url, { timeoutMs = TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,text/csv;q=0.9,*/*;q=0.5' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`response over ${MAX_BYTES} bytes`);
      const body = buf.toString('utf8');
      const challenged = res.headers.get('cf-mitigated') === 'challenge' || /<title>Just a moment/i.test(body);
      if (challenged || res.status === 403) throw new BlockedError(`HTTP ${res.status}${challenged ? ' (bot challenge)' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return body;
    } catch (e) {
      if (e instanceof BlockedError) throw e;
      lastErr = e;
    }
  }
  throw new Error(lastErr?.name === 'TimeoutError' ? `no answer within ${timeoutMs / 1000}s` : String(lastErr?.message ?? lastErr));
}

async function loadSource(src, opts) {
  const ext = src.ext ?? 'html';
  const local = opts.pagesDir && join(opts.pagesDir, `${src.id}.${ext}`);
  let text, retrievedOn;
  try {
    if (local && existsSync(local)) {
      text = readFileSync(local, 'utf8');
      retrievedOn = opts.pagesRetrievedOn ?? statSync(local).mtime.toISOString().slice(0, 10);
    } else {
      text = await fetchText(src.url);
      retrievedOn = opts.today;
    }
  } catch (e) {
    return { src, status: e instanceof BlockedError ? 'blocked' : 'unreachable', error: e.message };
  }
  try {
    const data = src.parse(text, {});
    for (const [state, years] of data) for (const [year, entries] of years) validateYear(state, year, entries);
    return { src, status: 'ok', data, retrievedOn };
  } catch (e) {
    if (e instanceof ParseError) return { src, status: 'parse-error', error: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- data files

const fileFor = (dir, state, year) => join(dir, state.toLowerCase(), `${year}.json`);

function readExisting(dir, state, year) {
  const f = fileFor(dir, state, year);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

export function serialize(file) {
  const { holidays, ...head } = file;
  const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = holidays.map((h) => `    ${JSON.stringify(h)}`).join(',\n');
  return `{\n${lines.join('\n')}\n  "holidays": [\n${rows}\n  ]\n}\n`;
}

const entryKey = (e) => JSON.stringify([e.date, e.name, e.scope, e.status, e.note ?? null]);
const entryText = (e) => `${e.date} ${e.name} [${e.scope}, ${e.status}${e.note ? `, ${e.note}` : ''}]`;

function diffEntries(oldList, newList) {
  const o = new Map(oldList.map((e) => [entryKey(e), e]));
  const n = new Map(newList.map((e) => [entryKey(e), e]));
  return [
    ...[...o].filter(([k]) => !n.has(k)).map(([, e]) => `- ${entryText(e)}`),
    ...[...n].filter(([k]) => !o.has(k)).map(([, e]) => `+ ${entryText(e)}`),
  ].sort((a, b) => a.slice(2).localeCompare(b.slice(2)) || a.localeCompare(b));
}

// ---------------------------------------------------------------- the run

export async function refresh(opts) {
  const results = new Map();
  for (const src of SOURCES) {
    if (opts.states && src.state !== '*' && !opts.states.includes(src.state)) continue;
    results.set(src.id, await loadSource(src, opts));
  }
  const report = { files: [], unverified: [], unpublished: [], parseErrors: [], crossChecks: [], errors: [], sources: [...results.values()] };
  for (const r of report.sources) if (r.status === 'parse-error') report.parseErrors.push(`${r.src.id}: ${r.error}`);

  const dga = results.get('dga-2025');
  for (const state of opts.states ?? STATES) {
    const mine = SOURCES.filter((s) => s.state === state || s.state === '*').filter((s) => results.has(s.id));
    for (let year = FIRST_YEAR; year <= opts.through; year++) {
      let chosen = null;
      let blockedBy = null;
      for (const src of mine) {
        const r = results.get(src.id);
        if (r.status === 'ok') {
          const list = r.data.get(state)?.get(year);
          if (list) { chosen = { src, list, retrievedOn: r.retrievedOn }; break; }
          if (src.expect.includes(year) && src.state !== '*') { report.errors.push(`${state} ${year}: ${src.id} no longer shows ${year}`); blockedBy = {}; break; }
        } else if (src.expect.includes(year)) {
          blockedBy = { src, r };
          break;
        }
      }
      const existing = readExisting(opts.dataDir, state, year);
      if (blockedBy) {
        if (blockedBy.src) report.unverified.push(`${state} ${year}: ${blockedBy.src.id} is ${blockedBy.r.status} (${blockedBy.r.error})`);
        if (!existing) report.errors.push(`${state} ${year}: no bundled file and the source could not be read`);
        continue;
      }
      if (!chosen) {
        // Nothing publishes this year. Only an estimated file may stand in for it.
        if (!existing) report.errors.push(`${state} ${year}: no source publishes it and nothing is bundled`);
        else if (existing.holidays.some((h) => h.status !== 'estimated')) report.errors.push(`${state} ${year}: bundled data is marked confirmed but no source publishes ${year}`);
        else report.unpublished.push(`${state} ${year}: no source publishes it yet, so the bundled estimate stays`);
        continue;
      }
      const holidays = sortEntries(chosen.list);
      const next = { state, year, source_url: chosen.src.url, retrieved_on: chosen.retrievedOn, holidays };
      if (existing && existing.source_url === next.source_url && diffEntries(existing.holidays, holidays).length === 0) continue;
      const changes = existing ? diffEntries(existing.holidays, holidays) : [`+ new file with ${holidays.length} entries`];
      if (existing && existing.source_url !== next.source_url) changes.unshift(`source_url: ${existing.source_url} -> ${next.source_url}`);
      report.files.push({ state, year, next, changes, isNew: !existing });

      // Cross-check against the national dataset where both have the year.
      if (dga?.status === 'ok' && chosen.src.id !== 'dga-2025') {
        const other = dga.data.get(state)?.get(year);
        if (other) report.crossChecks.push(...compareDates(state, year, holidays, other));
      }
    }
    // Cross-check years whose file did not change too.
    if (dga?.status === 'ok') {
      for (const [year, other] of dga.data.get(state) ?? []) {
        const chosenSrc = mine.find((s) => s.id !== 'dga-2025' && results.get(s.id).status === 'ok' && results.get(s.id).data.get(state)?.has(year));
        if (!chosenSrc || report.files.some((f) => f.state === state && f.year === year)) continue;
        report.crossChecks.push(...compareDates(state, year, results.get(chosenSrc.id).data.get(state).get(year), other));
      }
    }
  }
  return report;
}

function compareDates(state, year, mine, theirs) {
  const dates = (l) => new Map(l.filter((e) => e.scope !== 'regional').map((e) => [e.date, e.name]));
  const a = dates(mine), b = dates(theirs);
  const out = [];
  for (const [d, n] of a) if (!b.has(d)) out.push(`${state} ${year}: state page has ${d} ${n}, data.gov.au does not`);
  for (const [d, n] of b) if (!a.has(d)) out.push(`${state} ${year}: data.gov.au has ${d} ${n}, state page does not`);
  return out;
}

export function render(report, { mode }) {
  const out = [];
  const L = (s = '') => out.push(s);
  for (const r of report.sources) L(`source ${r.src.id}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
  L();
  if (report.parseErrors.length) {
    L('PARSE FAILURES (the page structure probably changed; nothing was written for these):');
    report.parseErrors.forEach((e) => L(`  ${e}`));
    L();
  }
  if (report.errors.length) { L('PROBLEMS:'); report.errors.forEach((e) => L(`  ${e}`)); L(); }
  if (report.files.length) {
    L(mode === 'write' ? 'Updated files:' : 'Bundled data differs from the sources:');
    for (const f of report.files) { L(`  data/${f.state.toLowerCase()}/${f.year}.json`); f.changes.forEach((c) => L(`    ${c}`)); }
    L();
  }
  if (report.unverified.length) { L('NOT VERIFIED (source could not be fetched, bundled data left as it is):'); report.unverified.forEach((e) => L(`  ${e}`)); L(); }
  if (report.unpublished.length) { L('Not yet published by any source:'); report.unpublished.forEach((e) => L(`  ${e}`)); L(); }
  if (report.crossChecks.length) { L('Disagreements with the data.gov.au dataset (not changed, for a person to judge):'); report.crossChecks.forEach((e) => L(`  ${e}`)); L(); }
  if (!report.files.length && !report.parseErrors.length && !report.errors.length && !report.unverified.length) L('Bundled data matches every source that could be read.');
  return out.join('\n');
}

export function exitCode(report, { allowBlocked }) {
  if (report.parseErrors.length || report.errors.length) return 3;
  if (report.files.length) return 1;
  if (report.unverified.length && !allowBlocked) return 4;
  return 0;
}

// ---------------------------------------------------------------- main

function parseArgs(argv) {
  const o = { today: new Date().toISOString().slice(0, 10), through: DEFAULT_THROUGH, dataDir: DATA_DIR };
  const need = (i, a) => { if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') o.mode = 'check';
    else if (a === '--write') o.mode = 'write';
    else if (a === '--allow-blocked') o.allowBlocked = true;
    else if (a === '--state') o.states = need(i++, a).split(',').map((s) => s.trim().toUpperCase());
    else if (a === '--through') o.through = Number(need(i++, a));
    else if (a === '--pages-dir') o.pagesDir = need(i++, a);
    else if (a === '--data-dir') o.dataDir = need(i++, a);
    else if (a === '--pages-retrieved-on') o.pagesRetrievedOn = need(i++, a);
    else if (a === '--report') o.report = need(i++, a);
    else if (a === '--today') o.today = need(i++, a);
    else throw new Error(`unknown option ${a}`);
  }
  if (!o.mode) throw new Error('give --check or --write');
  if (o.states?.some((s) => !STATES.includes(s))) throw new Error(`unknown state in --state (use ${STATES.join(', ')})`);
  if (!Number.isInteger(o.through) || o.through < FIRST_YEAR) throw new Error('--through must be a year');
  for (const d of [o.today, o.pagesRetrievedOn]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('dates are YYYY-MM-DD');
  return o;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`refresh-holidays: ${e.message}`); process.exit(2); }
  const report = await refresh(opts);
  if (opts.mode === 'write' && !report.parseErrors.length && !report.errors.length) {
    for (const f of report.files) {
      mkdirSync(dirname(fileFor(opts.dataDir, f.state, f.year)), { recursive: true });
      writeFileSync(fileFor(opts.dataDir, f.state, f.year), serialize(f.next));
    }
  }
  const text = render(report, { mode: opts.mode });
  console.log(text);
  if (opts.report) writeFileSync(opts.report, `${'```'}\n${text}\n${'```'}\n`);
  const code = exitCode(report, opts);
  // After a successful --write the differences are resolved: only failures remain failures.
  process.exit(opts.mode === 'write' && code === 1 ? 0 : code);
}
