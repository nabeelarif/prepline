import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRepository } from '../../repositories/types';
import { call } from './call';
import {
  goalPayload,
  goalTreePayload,
  phasePayload,
  resourcePayload,
  rowsToAppData,
  type GoalRow,
  type PhaseRow,
  type ResourceRow,
} from './rows';

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
      return rowsToAppData(all.goals, all.phases, all.resources, all.active_goal_id);
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
    addGoals: (goals, activeGoalId) =>
      rpc('append_goals', { p_goals: goals.map(goalTreePayload), p_active_goal_id: activeGoalId }),
    deleteAll: () => rpc('delete_all_data', {}),
  };
}
