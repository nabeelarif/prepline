import { toISO } from './dates';
import type { AppData } from './types';

/** The one valid empty state: no plans, no active plan. Round-trips through `parseAppData()`. */
export const createEmptyAppData = (): AppData => ({ version: 1, activeGoalId: null, goals: [] });

const pad = (n: number) => String(n).padStart(2, '0');

/** "prepline-backup-2026-10-28.json", in local time. */
export function backupFileName(now: Date = new Date()): string {
  return `prepline-backup-${toISO(now)}.json`;
}

/** Local date and time, "2026-10-28T14:32:05", with no time zone. */
export function localDateTime(d: Date): string {
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * The backup file's contents: the saved data as is, plus `exportedAt`. That extra key
 * exists only in backup files. Loading and the legacy app both ignore it.
 */
export function serializeBackup(data: AppData, now: Date = new Date()): string {
  return JSON.stringify({ ...data, exportedAt: localDateTime(now) }, null, 2);
}

/** Reads `exportedAt` from a backup, or null when it is missing or not a real date. */
export function exportedAtOf(raw: unknown): string | null {
  const v = (raw as { exportedAt?: unknown } | null)?.exportedAt;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  return isNaN(new Date(v).getTime()) ? null : v;
}
