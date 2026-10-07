// Date helpers. Business dates (visit date, follow-up date) are calendar dates stored in
// Postgres DATE columns, which Prisma represents as UTC midnight. "Today" is always
// resolved in the organization's timezone (Africa/Kigali, UTC+2, no DST).

export const BUSINESS_TIMEZONE = 'Africa/Kigali';

/** Calendar date (YYYY-MM-DD) of an instant, as seen in Kigali. */
export function kigaliDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(instant);
}

/** Today's calendar date in Kigali, YYYY-MM-DD. */
export function todayKigali(): string {
  return kigaliDateString(new Date());
}

/** Current month (0-11) and year in Kigali. */
export function currentKigaliMonth(): { month: number; year: number } {
  const [y, m] = todayKigali().split('-').map(Number);
  return { month: m - 1, year: y };
}

/** YYYY-MM-DD for a DATE column value (UTC midnight). */
export function dateColumnToString(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/** DATE column value for a YYYY-MM-DD string. Throws on malformed input. */
export function stringToDateColumn(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid date: ${s}`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

/** Inclusive-exclusive range of DATE values for a calendar month (month 0-11). */
export function monthDateRange(year: number, month: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, month, 1)), lt: new Date(Date.UTC(year, month + 1, 1)) };
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((stringToDateColumn(b).getTime() - stringToDateColumn(a).getTime()) / 86400000);
}

const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Range of timestamps (e.g. createdAt) falling inside a Kigali calendar month. */
export function monthInstantRange(year: number, month: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month, 1) - KIGALI_OFFSET_MS),
    lt: new Date(Date.UTC(year, month + 1, 1) - KIGALI_OFFSET_MS),
  };
}

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LONG[month]} ${year}`;
}

/** Parses ?month=&year= search params (month 0-11), falling back to the current Kigali month. */
export function parsePeriodParams(params: { month?: string; year?: string }) {
  const current = currentKigaliMonth();
  const month = Number(params.month);
  const year = Number(params.year);
  return {
    month: params.month !== undefined && Number.isInteger(month) && month >= 0 && month <= 11 ? month : current.month,
    year: params.year !== undefined && Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : current.year,
    currentYear: current.year,
  };
}

/** Last calendar day (YYYY-MM-DD) of a month. */
export function monthLastDay(year: number, month: number): string {
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD shifted by a number of days. */
export function addDaysToDate(date: string, days: number): string {
  const d = stringToDateColumn(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
