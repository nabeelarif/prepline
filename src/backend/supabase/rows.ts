import { parseAppData } from '../../domain/schema';
import { createEmptyAppData } from '../../domain/backup';
import type { PlanSharing, PlanSummary, SharedPlan } from '../../domain/share';
import type { AppData, Goal, Phase, Resource, ResourceType } from '../../domain/types';

/** Database row shapes (snake_case). Private to the Supabase implementation. */
export interface GoalRow {
  id: string;
  name: string;
  description: string;
  start_date: string | null;
  target_date: string | null;
  hours_per_day: number | string | null;
  source_slug: string | null;
  source_name: string | null;
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
  logged_on: string | null;
  logged_minutes: number;
  phase_id: string | null;
  created_at: string;
  position: number;
}

export const goalPayload = (g: Omit<Goal, 'resources' | 'phases'>) => ({
  id: g.id,
  name: g.name,
  description: g.description,
  start_date: g.startDate,
  target_date: g.targetDate,
  hours_per_day: g.hoursPerDay,
  source_slug: g.source?.slug ?? null,
  source_name: g.source?.name ?? null,
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
  logged_on: r.loggedOn,
  logged_minutes: r.loggedMinutes,
  phase_id: r.phaseId,
  created_at: r.createdAt,
});

export const goalTreePayload = (g: Goal) => ({
  ...goalPayload(g),
  phases: g.phases.map(phasePayload),
  resources: g.resources.map(resourcePayload),
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
  activeGoalId: string | null,
): AppData {
  const raw = {
    version: 1,
    activeGoalId,
    goals: [...goals].sort(byPosition).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      startDate: g.start_date,
      targetDate: g.target_date,
      hoursPerDay: g.hours_per_day === null ? null : Number(g.hours_per_day),
      source: g.source_slug ? { slug: g.source_slug, name: g.source_name ?? '' } : null,
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
          loggedOn: r.logged_on,
          loggedMinutes: r.logged_minutes,
          phaseId: r.phase_id,
          createdAt: r.created_at,
        })),
    })),
  };
  return parseAppData(raw) ?? createEmptyAppData();
}

/** Shapes returned by the sharing functions in `supabase/schema.sql` (snake_case). */
export interface SharedPlanJson {
  slug: string;
  visibility: 'unlisted' | 'public';
  name: string;
  description: string;
  author: string | null;
  tags: string[];
  published_at: string;
  copy_count: number;
  phases: Phase[];
  resources: {
    id: string;
    title: string;
    url: string;
    type: ResourceType;
    minutes: number;
    notes: string;
    phase_id: string | null;
  }[];
}
export interface SummaryJson {
  slug: string;
  name: string;
  description: string;
  author: string | null;
  tags: string[];
  published_at: string;
  copy_count: number;
  phase_count: number;
  resource_count: number;
  total_minutes: number;
}
/** A plan's sharing settings: a `plan_shares` row or what `set_plan_sharing` returns. */
export interface SharingJson {
  visibility: PlanSharing['visibility'];
  slug: string | null;
  tags: string[] | null;
  hidden?: boolean;
  copy_count?: number;
}

export const toSharing = (j: SharingJson): PlanSharing => ({
  visibility: j.visibility,
  slug: j.slug,
  tags: j.tags ?? [],
  hidden: !!j.hidden,
  copyCount: Number(j.copy_count) || 0,
});

export const toShared = (j: SharedPlanJson): SharedPlan => ({
  slug: j.slug,
  visibility: j.visibility,
  name: j.name,
  description: j.description,
  author: j.author,
  tags: j.tags ?? [],
  publishedAt: j.published_at,
  copyCount: j.copy_count,
  phases: j.phases,
  resources: j.resources.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    type: r.type,
    minutes: r.minutes,
    notes: r.notes,
    phaseId: r.phase_id,
  })),
});

export const toSummary = (j: SummaryJson): PlanSummary => ({
  slug: j.slug,
  name: j.name,
  description: j.description,
  author: j.author,
  tags: j.tags ?? [],
  publishedAt: j.published_at,
  copyCount: j.copy_count,
  phaseCount: j.phase_count,
  resourceCount: j.resource_count,
  totalMinutes: j.total_minutes,
});
