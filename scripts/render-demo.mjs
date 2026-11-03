// Writes the generated blocks of the README and docs from the real program and the real data.
//   demo:       README.md, a few commands run against the built CLI, with their actual output
//   demo-full:  docs/commands.md, every command run the same way
//   sources:    docs/data.md, the data sources table, from data/<state>/<year>.json
// Usage: npm run assets            (build first, or use npm run check)
//        node scripts/render-demo.mjs --check    exits 1 if any of those files is stale
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SHORT = [
  ['add', '10', '--from', '2026-12-18', '--state', 'WA'],
  ['is', '2026-12-28', '--state', 'VIC'],
  ['add-calendar', '14', '--from', '2026-12-14', '--roll', 'forward', '--state', 'WA'],
  ['add', '1', '--from', '2028-12-29', '--state', 'WA'],
];

const FULL = [
  ['add', '10', '--from', '2026-12-18', '--state', 'WA'],
  ['is', '2026-12-28', '--state', 'VIC'],
  ['diff', '2026-12-18', '2027-01-06', '--state', 'WA'],
  ['next', '2026-12-24', '--state', 'SA'],
  ['prev', '2027-01-04', '--state', 'NSW'],
  ['roll', '2026-12-26', '--direction', 'forward', '--state', 'QLD'],
  ['add-calendar', '14', '--from', '2026-12-14', '--roll', 'forward', '--state', 'WA'],
  ['add', '3', '--from', 'today', '--state', 'VIC'],
  ['holidays', '--year', '2026', '--state', 'TAS'],
  ['add', '1', '--from', '2028-12-29', '--state', 'WA'],
];

const STATE_NAMES = { ACT: 'ACT', NSW: 'NSW', NT: 'NT', QLD: 'QLD', SA: 'SA', TAS: 'TAS', VIC: 'VIC', WA: 'WA' };

function demoText(commands) {
  const blocks = commands.map((args) => {
    // A fixed "today" keeps the output stable; the end-of-coverage warning and the word "today" depend on it.
    const r = spawnSync(process.execPath, [join(root, 'dist', 'cli.js'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', AU_BIZDAYS_TODAY: '2026-11-02', TZ: 'UTC' } });
    const out = `${r.stdout}${r.stderr}`.trimEnd();
    return `$ au-bizdays ${args.join(' ')}\n${out}${r.status === 0 ? '' : `\n(exit ${r.status})`}`;
  });
  return blocks.join('\n\n');
}

export function sourcesTable() {
  const rows = [];
  for (const state of Object.keys(STATE_NAMES)) {
    const groups = new Map();
    for (const f of readdirSync(join(root, 'data', state.toLowerCase())).sort()) {
      const d = JSON.parse(readFileSync(join(root, 'data', state.toLowerCase(), f), 'utf8'));
      const key = `${d.source_url}|${d.retrieved_on}|${d.holidays.every((h) => h.status === 'estimated') ? 'estimated' : ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d.year);
    }
    for (const [key, years] of groups) {
      const [url, retrieved, est] = key.split('|');
      const span = years.length === 1 ? String(years[0]) : `${years[0]} to ${years[years.length - 1]}`;
      rows.push(`| ${state} | ${url} | ${span}${est ? ' (estimated, see below)' : ''} | ${retrieved} |`);
    }
  }
  return `| State | Source | Years | Retrieved on |\n| --- | --- | --- | --- |\n${rows.join('\n')}`;
}

const fence = (name) => new RegExp(`(<!-- ${name}:start -->\\n\`\`\`console\\n)[\\s\\S]*?(\\n\`\`\`\\n<!-- ${name}:end -->)`);

export const BLOCKS = [
  { file: 'README.md', name: 'demo', re: fence('demo'), make: () => demoText(SHORT) },
  { file: 'docs/commands.md', name: 'demo-full', re: fence('demo-full'), make: () => demoText(FULL) },
  { file: 'docs/data.md', name: 'sources', re: /(<!-- sources:start -->\n)[\s\S]*?(\n<!-- sources:end -->)/, make: sourcesTable },
];

export const FILES = [...new Set(BLOCKS.map((b) => b.file))];

/** The text of one file with its generated blocks rewritten from the real program and data. */
export function render(file, text) {
  let next = text;
  for (const b of BLOCKS.filter((x) => x.file === file)) {
    if (!b.re.test(next)) throw new Error(`${file} has no ${b.name}:start / ${b.name}:end block`);
    const made = b.make();
    next = next.replace(b.re, (_, a, z) => a + made + z);
  }
  return next;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const file of FILES) {
    const path = join(root, file);
    const text = readFileSync(path, 'utf8');
    const next = render(file, text);
    if (next === text) continue;
    if (check) { console.error(`${file}: generated blocks are stale: run npm run assets`); stale++; } else { writeFileSync(path, next); console.log(`${file} updated`); }
  }
  if (check) {
    if (stale) process.exit(1);
    console.log('generated doc blocks are current');
  }
}
