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

/**
 * Where a shared plan was copied from. The link (`slug`) is given only while the original is
 * public; otherwise `available` is false and only the title it had is shown.
 */
export interface PlanOrigin {
  slug: string | null;
  name: string;
  available: boolean;
}

/** A shared plan, content only. No progress, no dates, no daily hours, no owner id. */
export interface SharedPlan {
  slug: string;
  visibility: Exclude<Visibility, 'private'>;
  name: string;
  description: string;
  /** The owner's display name; null if they never set one. */
  author: string | null;
  /** The plan this one was copied from, if any. */
  source: PlanOrigin | null;
  tags: string[];
  publishedAt: string;
  copyCount: number;
  /** How many people starred it. */
  favoriteCount: number;
  /** Whether the signed-in viewer starred it; false when signed out. */
  favorited: boolean;
  phases: Phase[];
  resources: SharedResource[];
}

/** A card in the Explore list. */
export interface PlanSummary {
  slug: string;
  name: string;
  description: string;
  author: string | null;
  source: PlanOrigin | null;
  tags: string[];
  publishedAt: string;
  copyCount: number;
  favoriteCount: number;
  favorited: boolean;
  phaseCount: number;
  resourceCount: number;
  totalMinutes: number;
}

/** How Explore orders plans: newest first, most copied first, or most favorited first. */
export type PublicSort = 'new' | 'popular' | 'favorites';

/** A tag used by public plans and how many use it. */
export interface PublicTag {
  tag: string;
  count: number;
}

/** The owner's sharing settings for one plan. */
export interface PlanSharing {
  visibility: Visibility;
  slug: string | null;
  tags: string[];
  /**
   * A moderator took the plan down. Only a `setSharing` answer is ever true here: the app
   * then treats the plan as not shared.
   */
  hidden: boolean;
  copyCount: number;
  /** How many people starred it; the owner sees the count, never who. */
  favoriteCount: number;
}

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;
export const MAX_DISPLAY_NAME = 40;

export interface SharingValue {
  visibility: Visibility;
  /** Comma separated, as typed. */
  tags: string;
}

// Word lists for the name every new account gets. `supabase/schema.sql` has a copy in
// `random_display_name()`, which is what production uses; keep the two in step.
export const NAME_ADJECTIVES =
  'Curious Focused Steady Bright Patient Eager Keen Daring Mindful Swift Bold Calm Clever Diligent Nimble Resolute Determined Thoughtful Radiant Plucky Gritty Sharp Humble Lively Fearless Earnest Inventive Tenacious Quiet Witty Brave Restless Hopeful Agile Wise Spirited Driven Gentle Ambitious Cheerful'.split(
    ' ',
  );
export const NAME_NOUNS =
  'Pathfinder Navigator Voyager Scholar Explorer Wayfarer Trailblazer Climber Learner Compass Otter Heron Fox Falcon Pioneer Cartographer Wanderer Ranger Sherpa Lantern Summit Meadow Comet Harbor Owl Lynx Raven Badger Sparrow Dolphin Panda Maple Cedar Ember Horizon Beacon Anchor Quill Atlas Journeyer'.split(
    ' ',
  );

/** A friendly name for an account that did not pick one, like "Curious Pathfinder 42". */
export function randomDisplayName(random: () => number = Math.random): string {
  const pick = (list: string[]) => list[Math.floor(random() * list.length)]!;
  const digits = String(Math.floor(random() * 100)).padStart(2, '0');
  return `${pick(NAME_ADJECTIVES)} ${pick(NAME_NOUNS)} ${digits}`;
}

/** What a plan file asks for when it is imported: who can open the plan, and its tags. */
export interface ImportShare {
  visibility: Exclude<Visibility, 'private'>;
  tags: string[];
}

const VISIBILITIES: readonly Visibility[] = ['private', 'unlisted', 'public'];

/**
 * Reads the optional `sharing` key of a plan in an import file. A missing key and `private`
 * both give null (nothing to share). Anything unusable is repaired towards the safer
 * choice, private, and described in `notes` so the user sees it before confirming.
 */
export function readImportSharing(
  raw: unknown,
  planName: string,
): { share: ImportShare | null; notes: string[] } {
  if (raw == null) return { share: null, notes: [] };
  const o = typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const visibility = o.visibility;
  if (!VISIBILITIES.includes(visibility as Visibility))
    return {
      share: null,
      notes: [`"${planName}" has an unknown sharing setting and will stay private.`],
    };
  if (visibility === 'private') return { share: null, notes: [] };
  const list = Array.isArray(o.tags) ? o.tags : [];
  const given = list.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
  const tags = cleanTags(given);
  const distinct = new Set(given.map((t) => t.trim().toLowerCase())).size;
  const notes: string[] = [];
  // Tags that are not a list of text are ignored, which the user should hear about.
  if ((o.tags != null && !Array.isArray(o.tags)) || list.some((t) => typeof t !== 'string'))
    notes.push(`"${planName}" has tags that are not a list of text; those will be ignored.`);
  if (tags.length < distinct)
    notes.push(
      `"${planName}" has tags that are too long or more than ${MAX_TAGS}; only ${tags.length} will be kept.`,
    );
  return { share: { visibility: visibility as ImportShare['visibility'], tags }, notes };
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
    source: { slug: shared.slug, name: shared.name },
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
      loggedOn: null,
      loggedMinutes: 0,
      createdAt: today,
    })),
  };
  return { version: 1, activeGoalId: goal.id, goals: [goal] };
}

/** The arguments `setPlanSharing` takes after the plan id, from the form's value. */
export function sharingArgs(v: SharingValue): [Visibility, string[]] {
  return [v.visibility, cleanTags(v.tags.split(/[,\n]/))];
}
