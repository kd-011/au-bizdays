import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;
export type State = (typeof STATES)[number];

export type Scope = 'statewide' | 'regional' | 'part-day';
export type Status = 'confirmed' | 'estimated';

export interface Holiday {
  date: string;
  name: string;
  scope: Scope;
  status: Status;
  note?: string;
}

/** One data/<state>/<year>.json file. */
export interface YearData {
  state: State;
  year: number;
  source_url: string;
  retrieved_on: string;
  estimate_basis?: string;
  holidays: Holiday[];
}

export interface StateData {
  state: State;
  /** Contiguous years, ascending. */
  years: YearData[];
}

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const SCOPES = new Set(['statewide', 'regional', 'part-day']);
const STATUSES = new Set(['confirmed', 'estimated']);
const cache = new Map<State, StateData>();

function fail(file: string, why: string): never {
  throw new Error(`Bundled holiday data is damaged (${file}): ${why}`);
}

function readYear(state: State, file: string, dir: string): YearData {
  const path = join(dir, file);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as YearData;
  const year = Number(file.replace('.json', ''));
  if (raw.state !== state || raw.year !== year) fail(path, 'state or year does not match the file name');
  if (!/^https:\/\//.test(raw.source_url) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.retrieved_on)) fail(path, 'missing source_url or retrieved_on');
  if (!Array.isArray(raw.holidays) || raw.holidays.length === 0) fail(path, 'no holidays');
  for (const h of raw.holidays) {
    if (!h.date.startsWith(`${year}-`) || !SCOPES.has(h.scope) || !STATUSES.has(h.status) || !h.name) fail(path, `bad entry ${JSON.stringify(h)}`);
  }
  return raw;
}

/** Read and validate every year file for a state. The only filesystem access in the package. */
export function loadStateData(state: State, dir: string = DATA_DIR): StateData {
  const hit = dir === DATA_DIR ? cache.get(state) : undefined;
  if (hit) return hit;
  const stateDir = join(dir, state.toLowerCase());
  const files = readdirSync(stateDir).filter((f) => /^\d{4}\.json$/.test(f)).sort();
  if (files.length === 0) fail(stateDir, 'no year files');
  const years = files.map((f) => readYear(state, f, stateDir));
  for (let i = 1; i < years.length; i++) {
    if ((years[i] as YearData).year !== (years[i - 1] as YearData).year + 1) fail(stateDir, 'years are not contiguous');
  }
  const data = { state, years };
  if (dir === DATA_DIR) cache.set(state, data);
  return data;
}
