import { todayISO } from './dates';
import { uid } from './format';
import type { AppData, Goal, ISODate, Phase, Resource } from './types';

/** Who can open a plan. `private` is the default: only its owner. */
export type Visibility = 'private' | 'unlisted' | 'public';

/**
 * A resource as other people see it: what it is, never how far its owner has got.
 * Built from `Resource` so a new content field is shared by adding it here.
 */
export type SharedResource = Pick<
  Resource,
  'id' | 'title' | 'url' | 'type' | 'minutes' | 'notes' | 'phaseId'
>;

/** A shared plan, content only. No progress, no dates, no daily hours, no owner id. */
export interface SharedPlan {
  slug: string;
  visibility: Exclude<Visibility, 'private'>;
  name: string;
  description: string;
  /** The owner's display name; null if they never set one. */
  author: string | null;
  tags: string[];
  publishedAt: string;
  copyCount: number;
  phases: Phase[];
  resources: SharedResource[];
}

/** A card in the Explore list. */
export interface PlanSummary {
  slug: string;
  name: string;
  description: string;
  author: string | null;
  tags: string[];
  publishedAt: string;
  copyCount: number;
  phaseCount: number;
  resourceCount: number;
  totalMinutes: number;
}

/** The owner's sharing settings for one plan. */
export interface PlanSharing {
  visibility: Visibility;
  slug: string | null;
  tags: string[];
  /** A moderator took the plan down. The owner still sees it as shared. */
  hidden: boolean;
  copyCount: number;
}

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;
export const MAX_DISPLAY_NAME = 40;

export interface SharingValue {
  visibility: Visibility;
  /** Comma separated, as typed. */
  tags: string;
  displayName: string;
}

/** Why a sharing choice cannot be saved, or null. Public plans are credited to a name. */
export function sharingProblem(v: SharingValue): string | null {
  return v.visibility === 'public' && !v.displayName.trim()
    ? 'Add a display name. It is shown as the author. Your email is never shown.'
    : null;
}

/** Lowercase, trimmed, unique tags within the limits. The database applies the same rules. */
export function cleanTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const tag = t.trim().toLowerCase();
    if (tag && tag.length <= MAX_TAG_LENGTH) out.add(tag);
  }
  return [...out].sort().slice(0, MAX_TAGS);
}

/**
 * A copy of a shared plan for the viewer's own account: fresh ids, nothing done, not
 * started, no deadline and no daily hours. Phases keep their resources through the new ids.
 */
export function copyOfSharedPlan(shared: SharedPlan, today: ISODate = todayISO()): AppData {
  const phaseIds = new Map(shared.phases.map((p) => [p.id, uid()]));
  const goal: Goal = {
    id: uid(),
    name: shared.name,
    description: shared.description,
    startDate: null,
    targetDate: null,
    hoursPerDay: null,
    createdAt: today,
    phases: shared.phases.map((p) => ({ ...p, id: phaseIds.get(p.id)! })),
    resources: shared.resources.map((r) => ({
      ...r,
      id: uid(),
      phaseId: r.phaseId ? (phaseIds.get(r.phaseId) ?? null) : null,
      done: false,
      doneMinutes: 0,
      doneAt: null,
      startedAt: null,
      createdAt: today,
    })),
  };
  return { version: 1, activeGoalId: goal.id, goals: [goal] };
}
