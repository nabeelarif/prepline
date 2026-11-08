import type { AppData, Goal, Phase, Resource } from '../domain/types';

/**
 * Everything the app needs from durable storage, in application terms. Implementations
 * (Supabase today) own tables, queries and backend types, and throw `RepositoryError`.
 *
 * The repository is always scoped to the signed-in user; ids never carry the user.
 * All writes are idempotent upserts keyed by id, so a failed save can be retried safely.
 */
export interface AppRepository {
  /** All data of the current user. "No data" is `goals: []`; failure throws. */
  loadAll(): Promise<AppData>;

  setActiveGoal(id: string | null): Promise<void>;

  /** Plan fields only. New plans are appended after existing ones. */
  saveGoal(goal: Omit<Goal, 'resources' | 'phases'>): Promise<void>;
  /** A whole plan with its phases and resources, atomically (duplicate, import). */
  saveGoalTree(goal: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  /** New resources are appended after existing ones in their plan. */
  saveResource(goalId: string, resource: Resource): Promise<void>;
  deleteResource(goalId: string, id: string): Promise<void>;
  /** Sets priority order from the full list of resource ids, atomically. */
  reorderResources(goalId: string, ids: string[]): Promise<void>;

  savePhase(goalId: string, phase: Phase): Promise<void>;
  /** Resources in the phase stay in the plan with no phase. */
  deletePhase(goalId: string, id: string): Promise<void>;
  reorderPhases(goalId: string, ids: string[]): Promise<void>;

  /** Replaces everything with `data` (restore a backup), atomically. */
  replaceAll(data: AppData): Promise<void>;
  /** Deletes all of the user's data, atomically. */
  deleteAll(): Promise<void>;
}
