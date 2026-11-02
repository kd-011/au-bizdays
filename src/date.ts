// Calendar dates as day numbers (days since 1970-01-01). No Date objects, so the machine's
// timezone and daylight saving rules cannot affect an answer.

export type Day = number;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a proleptic Gregorian date. */
function daysFromCivil(y: number, m: number, d: number): Day {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: Day): { y: number; m: number; d: number } {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;

/** Parse YYYY-MM-DD strictly. Returns null for anything else, including impossible dates. */
export function parseDay(text: string): Day | null {
  const m = ISO.exec(text);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return daysFromCivil(y, mo, d);
}

export function formatDay(day: Day): string {
  const { y, m, d } = civilFromDays(day);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 0 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayIndex(day: Day): number {
  return (((day + 4) % 7) + 7) % 7;
}

export const weekdayName = (day: Day): string => WEEKDAYS[weekdayIndex(day)] as string;
export const isWeekend = (day: Day): boolean => {
  const w = weekdayIndex(day);
  return w === 0 || w === 6;
};
export const yearOf = (day: Day): number => civilFromDays(day).y;
export const startOfYear = (year: number): Day => daysFromCivil(year, 1, 1);
export const endOfYear = (year: number): Day => daysFromCivil(year, 12, 31);
