import { toISO } from './dates';
import { uid } from './format';
import type { AppData, Goal } from './types';

/** The one valid empty state: no plans, no active plan. Round-trips through `parseAppData()`. */
export const createEmptyAppData = (): AppData => ({ version: 1, activeGoalId: null, goals: [] });

/**
 * Adds the plans in `incoming` after the existing ones and makes the first of them
 * active. Every added plan, phase and resource gets a new id, so ids from the file
 * (often short ones like "r1" in a generated plan) never clash with saved data or
 * with each other. Resources keep their phase through the new phase ids.
 */
export function mergePlans(current: AppData, incoming: AppData): AppData {
  const added = incoming.goals.map((g): Goal => {
    const phaseIds = new Map(g.phases.map((p) => [p.id, uid()]));
    return {
      ...g,
      id: uid(),
      phases: g.phases.map((p) => ({ ...p, id: phaseIds.get(p.id)! })),
      resources: g.resources.map((r) => ({
        ...r,
        id: uid(),
        phaseId: r.phaseId ? (phaseIds.get(r.phaseId) ?? null) : null,
      })),
    };
  });
  return {
    version: 1,
    activeGoalId: added[0]?.id ?? current.activeGoalId,
    goals: [...current.goals, ...added],
  };
}

/**
 * Gives a plan, phase or resource a new id when an earlier one in `data` already has it.
 * Ids are unique per user in the database, not per plan, so a file whose plans reuse
 * short ids ("p1", "r1") would otherwise lose rows or be rejected on restore.
 */
export function uniqueIds(data: AppData): AppData {
  const goalIds = new Set<string>();
  const phaseIds = new Set<string>();
  const resourceIds = new Set<string>();
  const fresh = (seen: Set<string>, id: string) => {
    const out = seen.has(id) ? uid() : id;
    seen.add(out);
    return out;
  };
  return {
    ...data,
    goals: data.goals.map((g): Goal => {
      const phaseMap = new Map(g.phases.map((p) => [p.id, fresh(phaseIds, p.id)]));
      return {
        ...g,
        // The first plan with an id keeps it, so `activeGoalId` still points at that one.
        id: fresh(goalIds, g.id),
        phases: g.phases.map((p) => ({ ...p, id: phaseMap.get(p.id)! })),
        resources: g.resources.map((r) => ({
          ...r,
          id: fresh(resourceIds, r.id),
          phaseId: r.phaseId ? (phaseMap.get(r.phaseId) ?? null) : null,
        })),
      };
    }),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "roadtogoals-backup-2026-10-28.json", in local time. */
export function backupFileName(now: Date = new Date()): string {
  return `roadtogoals-backup-${toISO(now)}.json`;
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
