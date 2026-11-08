import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRepository } from '../../repositories/types';
import { toRepositoryError } from './errors';
import {
  appDataPayload,
  goalPayload,
  goalTreePayload,
  phasePayload,
  resourcePayload,
  rowsToAppData,
  type GoalRow,
  type PhaseRow,
  type ProfileRow,
  type ResourceRow,
} from './rows';

/** Throws a `RepositoryError` for a failed Supabase response; returns its data otherwise. */
function check<T>(res: { data: T; error: unknown; status?: number }): T {
  if (res.error) {
    const e = res.error as object;
    throw toRepositoryError({ ...e, status: res.status });
  }
  return res.data;
}

async function call<T>(op: PromiseLike<{ data: T; error: unknown; status?: number }>): Promise<T> {
  try {
    return check(await op);
  } catch (e) {
    throw toRepositoryError(e);
  }
}

/** Table names, queries and RPCs live here and nowhere else. */
export function createSupabaseRepository(client: SupabaseClient): AppRepository {
  const rpc = (fn: string, args: Record<string, unknown>) =>
    call(client.rpc(fn, args)).then(() => undefined);

  return {
    async loadAll() {
      // Separate reads are fine: a plan's data is small, and the order of rows is by position.
      const [goals, phases, resources, profile] = await Promise.all([
        call(client.from('goals').select('*').order('position')),
        call(client.from('phases').select('*').order('position')),
        call(client.from('resources').select('*').order('position')),
        call(client.from('profiles').select('active_goal_id').maybeSingle()),
      ]);
      return rowsToAppData(
        goals as GoalRow[],
        phases as PhaseRow[],
        resources as ResourceRow[],
        profile as ProfileRow | null,
      );
    },
    setActiveGoal: (id) => rpc('set_active_goal', { p_goal_id: id }),
    saveGoal: (goal) => rpc('save_goal', { p_goal: goalPayload(goal) }),
    saveGoalTree: (goal) => rpc('save_goal_tree', { p_goal: goalTreePayload(goal) }),
    async deleteGoal(id) {
      await call(client.from('goals').delete().eq('id', id));
    },
    saveResource: (goalId, r) =>
      rpc('save_resource', { p_goal_id: goalId, p_resource: resourcePayload(r) }),
    async deleteResource(goalId, id) {
      await call(client.from('resources').delete().eq('goal_id', goalId).eq('id', id));
    },
    reorderResources: (goalId, ids) => rpc('reorder_resources', { p_goal_id: goalId, p_ids: ids }),
    savePhase: (goalId, p) => rpc('save_phase', { p_goal_id: goalId, p_phase: phasePayload(p) }),
    async deletePhase(goalId, id) {
      await call(client.from('phases').delete().eq('goal_id', goalId).eq('id', id));
    },
    reorderPhases: (goalId, ids) => rpc('reorder_phases', { p_goal_id: goalId, p_ids: ids }),
    replaceAll: (data) => rpc('replace_all_data', { p_data: appDataPayload(data) }),
    deleteAll: () => rpc('delete_all_data', {}),
  };
}
