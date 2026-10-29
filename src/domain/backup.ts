import { toISO } from './dates';
import type { AppData } from './types';

/** The one valid empty state: no plans, no active plan. Round-trips through `parseAppData()`. */
export const createEmptyAppData = (): AppData => ({ version: 1, activeGoalId: null, goals: [] });

const pad = (n: number) => String(n).padStart(2, '0');

/** "prepline-backup-2026-10-28.json", in local time. */
export function backupFileName(now: Date = new Date()): string {
  return `prepline-backup-${toISO(now)}.json`;
}

/**
 * Local date and time with the UTC offset, "2026-10-28T14:32:05+05:00". It reads as the
 * time on the exporting device but still names one exact moment, so a backup opened
 * in another time zone shows the right time there.
 */
export function localDateTime(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const zone = `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${zone}`;
}

/**
 * The backup file's contents: the saved data as is, plus `exportedAt` (see
 * `localDateTime`). That extra key exists only in backup files. Loading and the
 * legacy app both ignore it.
 */
export function serializeBackup(data: AppData, now: Date = new Date()): string {
  return JSON.stringify({ ...data, exportedAt: localDateTime(now) }, null, 2);
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Reads `exportedAt` from a backup, or null when it is missing or not a real date.
 * A value without an offset (a hand-edited file) is read as local time.
 */
export function exportedAtOf(raw: unknown): string | null {
  const v = (raw as { exportedAt?: unknown } | null)?.exportedAt;
  if (typeof v !== 'string' || !DATE_TIME.test(v)) return null;
  return isNaN(new Date(v).getTime()) ? null : v;
}
