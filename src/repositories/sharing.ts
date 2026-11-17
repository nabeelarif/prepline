import type { PlanSharing, PlanSummary, SharedPlan, Visibility } from '../domain/share';

export interface PublicListQuery {
  /** Matches the title or description. */
  query?: string;
  tag?: string;
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
  /** Public plans, newest first. */
  listPublic(q?: PublicListQuery): Promise<PlanSummary[]>;

  /** The signed-in user's sharing settings, by plan id; plans not shared are absent. */
  loadSharing(): Promise<{ plans: Record<string, PlanSharing>; displayName: string | null }>;
  /**
   * Sets who can open one of the user's plans. Public needs a display name and at least one
   * resource. `private` stops sharing.
   */
  setSharing(goalId: string, visibility: Visibility, tags: string[]): Promise<PlanSharing>;
  setDisplayName(name: string): Promise<void>;
  /** Counts the signed-in user's first copy of a plan. Never fails the copy itself. */
  recordCopy(slug: string): Promise<void>;
  report(slug: string, reason: string): Promise<void>;
}
