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
  type ResourceRow,
} from './rows';

/** Awaits a Supabase call; throws a `RepositoryError` for a thrown or returned error. */
async function call<T>(op: PromiseLike<{ data: T; error: unknown; status?: number }>): Promise<T> {
  let res;
  try {
    res = await op;
  } catch (e) {
    throw toRepositoryError(e);
  }
  if (res.error) throw toRepositoryError({ ...(res.error as object), status: res.status });
  return res.data;
}

/** Table names, queries and RPCs live here and nowhere else. */
export function createSupabaseRepository(client: SupabaseClient): AppRepository {
  const rpc = (fn: string, args: Record<string, unknown>) =>
    call(client.rpc(fn, args)).then(() => undefined);

  return {
    async loadAll() {
      const all = (await call(client.rpc('load_all_data'))) as {
        goals: GoalRow[];
        phases: PhaseRow[];
        resources: ResourceRow[];
        active_goal_id: string | null;
      };
      return rowsToAppData(all.goals, all.phases, all.resources, {
        active_goal_id: all.active_goal_id,
      });
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
    addGoals: (goals, activeGoalId) =>
      rpc('append_goals', { p_goals: goals.map(goalTreePayload), p_active_goal_id: activeGoalId }),
    deleteAll: () => rpc('delete_all_data', {}),
  };
}
