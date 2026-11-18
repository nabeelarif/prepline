import type {
  PlanSharing,
  PlanSummary,
  PublicSort,
  PublicTag,
  SharedPlan,
  Visibility,
} from '../domain/share';

export interface PublicListQuery {
  /** Matches the title, description or a tag. */
  query?: string;
  tag?: string;
  /** `new` (default) is newest first; `popular` is most copied first. */
  sort?: PublicSort;
  limit?: number;
  offset?: number;
}

/**
 * Sharing, kept apart from `AppRepository` because most of it works for people who are
 * not signed in, and none of it ever returns progress or schedules.
 *
 * Reading (`getShared`, `listPublic`) needs no account. Everything else needs the
 * signed-in user and throws `RepositoryError('unauthorized')` without one.
 */
export interface PlanSharingRepository {
  /** A plan by its link. Null when the link is wrong, the plan is private or taken down. */
  getShared(slug: string): Promise<SharedPlan | null>;
  /** Public plans, newest first unless `sort` says otherwise. */
  listPublic(q?: PublicListQuery): Promise<PlanSummary[]>;
  /** Tags used by public plans, most used first. */
  listPopularTags(limit?: number): Promise<PublicTag[]>;
  /** Public plans sharing tags with the plan at `slug`, best match first. Never includes it. */
  listSimilar(slug: string, limit?: number): Promise<PlanSummary[]>;

  /** The signed-in user's sharing settings, by plan id; plans not shared are absent. */
  loadSharing(): Promise<{ plans: Record<string, PlanSharing>; displayName: string | null }>;
  /**
   * Sets who can open one of the user's plans. `private` stops sharing. The author shown to
   * others is the account's display name, which every account has (see `setDisplayName`).
   */
  setSharing(goalId: string, visibility: Visibility, tags: string[]): Promise<PlanSharing>;
  setDisplayName(name: string): Promise<void>;
  /** Counts the signed-in user's first copy of a plan. Never fails the copy itself. */
  recordCopy(slug: string): Promise<void>;
  report(slug: string, reason: string): Promise<void>;
}
