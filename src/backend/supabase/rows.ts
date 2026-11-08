import { parseAppData } from '../../domain/schema';
import { createEmptyAppData } from '../../domain/backup';
import type { AppData, Goal, Phase, Resource } from '../../domain/types';

/** Database row shapes (snake_case). Private to the Supabase implementation. */
export interface GoalRow {
  id: string;
  name: string;
  description: string;
  target_date: string;
  hours_per_day: number | string | null;
  created_at: string;
  position: number;
}
export interface PhaseRow {
  id: string;
  goal_id: string;
  name: string;
  description: string;
  color: string;
  position: number;
}
export interface ResourceRow {
  id: string;
  goal_id: string;
  title: string;
  url: string;
  type: string;
  minutes: number;
  done_minutes: number;
  notes: string;
  done: boolean;
  done_at: string | null;
  started_at: string | null;
  phase_id: string | null;
  created_at: string;
  position: number;
}
export interface ProfileRow {
  active_goal_id: string | null;
}

export const goalPayload = (g: Omit<Goal, 'resources' | 'phases'>) => ({
  id: g.id,
  name: g.name,
  description: g.description,
  target_date: g.targetDate,
  hours_per_day: g.hoursPerDay,
  created_at: g.createdAt,
});

export const phasePayload = (p: Phase) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  color: p.color,
});

export const resourcePayload = (r: Resource) => ({
  id: r.id,
  title: r.title,
  url: r.url,
  type: r.type,
  minutes: r.minutes,
  done_minutes: r.doneMinutes,
  notes: r.notes,
  done: r.done,
  done_at: r.doneAt,
  started_at: r.startedAt,
  phase_id: r.phaseId,
  created_at: r.createdAt,
});

export const goalTreePayload = (g: Goal) => ({
  ...goalPayload(g),
  phases: g.phases.map(phasePayload),
  resources: g.resources.map(resourcePayload),
});

export const appDataPayload = (d: AppData) => ({
  active_goal_id: d.activeGoalId,
  goals: d.goals.map(goalTreePayload),
});

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Builds app data from rows. Goes through the same lenient schema as every other source of
 * data, so a value the app cannot read is repaired rather than crashing the load.
 */
export function rowsToAppData(
  goals: GoalRow[],
  phases: PhaseRow[],
  resources: ResourceRow[],
  profile: ProfileRow | null,
): AppData {
  const raw = {
    version: 1,
    activeGoalId: profile?.active_goal_id ?? null,
    goals: [...goals].sort(byPosition).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      targetDate: g.target_date,
      hoursPerDay: g.hours_per_day === null ? null : Number(g.hours_per_day),
      createdAt: g.created_at,
      phases: phases
        .filter((p) => p.goal_id === g.id)
        .sort(byPosition)
        .map((p) => ({ id: p.id, name: p.name, description: p.description, color: p.color })),
      resources: resources
        .filter((r) => r.goal_id === g.id)
        .sort(byPosition)
        .map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          type: r.type,
          minutes: r.minutes,
          doneMinutes: r.done_minutes,
          notes: r.notes,
          done: r.done,
          doneAt: r.done_at,
          startedAt: r.started_at,
          phaseId: r.phase_id,
          createdAt: r.created_at,
        })),
    })),
  };
  return parseAppData(raw) ?? createEmptyAppData();
}
