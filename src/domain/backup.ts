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
