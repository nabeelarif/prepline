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

/** Who made a plan file, as the maker reports it. Informational only; it changes nothing on import. */
export interface GeneratedBy {
  tool?: string;
  model?: string;
  skill?: string;
}

const GENERATED_BY_MAX = 60;

/** Reads `generatedBy` from a file, keeping only trimmed text keys. Null when nothing is usable. */
export function generatedByOf(raw: unknown): GeneratedBy | null {
  const v = (raw as { generatedBy?: unknown } | null)?.generatedBy;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out: GeneratedBy = {};
  for (const key of ['tool', 'model', 'skill'] as const) {
    const text = (v as Record<string, unknown>)[key];
    const clean = typeof text === 'string' ? text.trim().slice(0, GENERATED_BY_MAX) : '';
    if (clean) out[key] = clean;
  }
  return Object.keys(out).length ? out : null;
}

/** "Claude (claude-opus-5-5) · create-roadtogoals-plan 1.1.0", from whichever parts are given. */
export function formatGeneratedBy({ tool, model, skill }: GeneratedBy): string {
  const who = tool && model ? `${tool} (${model})` : (tool ?? model);
  return [who, skill].filter(Boolean).join(' · ');
}
