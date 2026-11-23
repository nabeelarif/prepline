import { addDays, fromISO } from './dates';
import { studiedToday } from './resources';
import type { AppData, ISODate } from './types';

/** Minutes studied per local day. Days with nothing studied are absent. */
export type StudyLog = Record<ISODate, number>;

/** The most one day can hold; the database rejects more. */
export const MAX_DAY_MINUTES = 1440;

/** How many days back the app loads; the heatmap and streaks look no further. */
export const STUDY_LOG_DAYS = 371;

/**
 * Minutes gained today across the resources that changed between two snapshots (negative
 * when progress was taken back). Each resource's one-day tally is the source, so only
 * resources present in both snapshots count: a copied plan arrives with no progress, and a
 * deleted resource leaves what was already studied in the log.
 */
export function studyDelta(prev: AppData, next: AppData, today: ISODate): number {
  if (prev === next) return 0;
  const before = new Map(prev.goals.map((g) => [g.id, g]));
  let delta = 0;
  for (const g of next.goals) {
    const old = before.get(g.id);
    // Only plans that changed can hold changed resources (Immer keeps the rest identical).
    if (!old || old === g) continue;
    const oldResources = new Map(old.resources.map((r) => [r.id, r]));
    for (const r of g.resources) {
      const was = oldResources.get(r.id);
      if (was && was !== r) delta += studiedToday(r, today) - studiedToday(was, today);
    }
  }
  return delta;
}

/** The log with `delta` minutes added to `day` (between zero and 24 hours; a zero day is removed). */
export function addStudy(log: StudyLog, day: ISODate, delta: number): StudyLog {
  const minutes = Math.min(MAX_DAY_MINUTES, Math.max(0, Math.round((log[day] ?? 0) + delta)));
  const next = { ...log };
  if (minutes > 0) next[day] = minutes;
  else delete next[day];
  return next;
}

/**
 * Consecutive days with study. Today may still be empty without breaking the streak, so
 * the count ends yesterday until something is studied today.
 */
export function currentStreak(log: StudyLog, today: ISODate): number {
  let day = (log[today] ?? 0) > 0 ? today : addDays(today, -1);
  let n = 0;
  while ((log[day] ?? 0) > 0) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The longest run of consecutive study days in the log. */
export function longestStreak(log: StudyLog): number {
  const days = Object.keys(log)
    .filter((d) => log[d]! > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Heat level 0 to 4 for a day's minutes. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(minutes: number): HeatLevel {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

export interface HeatCell {
  day: ISODate;
  minutes: number;
  level: HeatLevel;
}

/**
 * The heatmap as columns of weeks (Monday first, oldest column first) ending with the week
 * of `today`. Days after today are null so the last column can be short.
 */
export function heatmapWeeks(log: StudyLog, today: ISODate, weeks: number): (HeatCell | null)[][] {
  const sinceMonday = (fromISO(today).getDay() + 6) % 7;
  const start = addDays(today, -sinceMonday - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      if (day > today) return null;
      const minutes = log[day] ?? 0;
      return { day, minutes, level: heatLevel(minutes) };
    }),
  );
}

/**
 * Month names for the heatmap's top row: one entry per week column, set only where a new
 * month begins (the first column is always labelled), otherwise an empty string.
 */
export function monthLabels(weeks: (HeatCell | null)[][]): string[] {
  let prev = -1;
  const labels = weeks.map((week) => {
    const first = week.find((c) => c);
    if (!first) return '';
    const date = fromISO(first.day);
    if (date.getMonth() === prev) return '';
    prev = date.getMonth();
    return date.toLocaleString('en-US', { month: 'short' });
  });
  // A month that ends in the first column would print over the next month's label.
  if (labels[0] && labels[1]) labels[0] = '';
  return labels;
}
