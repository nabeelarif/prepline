import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 864e5);
}

export function validISO(s: unknown): s is ISODate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(fromISO(s).getTime());
}

/** "Mon, Apr 20", or "Apr 20, 2027" when `long`. */
export function fmtDate(s: ISODate, long = false): string {
  return fromISO(s).toLocaleDateString(
    undefined,
    long
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric' },
  );
}

export function relDay(s: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, s);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDate(s);
}
