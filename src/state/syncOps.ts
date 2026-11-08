import type { AppData, Goal } from '../domain/types';
import type { AppRepository } from '../repositories/types';

/** One repository call waiting to be saved. */
export interface SyncOp {
  /** Ops with the same key are superseded by a later one (only for whole-order writes). */
  key?: string;
  run: () => Promise<void>;
  /** Runs once the backend confirmed this op, e.g. to show a "saved" toast. */
  after?: () => void;
}

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const planFieldsChanged = (a: Goal, b: Goal) =>
  a.name !== b.name ||
  a.description !== b.description ||
  a.targetDate !== b.targetDate ||
  a.hoursPerDay !== b.hoursPerDay ||
  a.createdAt !== b.createdAt;

const planFields = (g: Goal): Omit<Goal, 'resources' | 'phases'> => ({
  id: g.id,
  name: g.name,
  description: g.description,
  targetDate: g.targetDate,
  hoursPerDay: g.hoursPerDay,
  createdAt: g.createdAt,
});

/**
 * The repository calls that turn `prev` into `next`. The store applies every change in
 * memory first (Immer keeps unchanged objects identical, so a reference check finds what
 * changed), then saves exactly these row-level writes, in an order that satisfies the
 * relations: plans, phases, resources, then deletes, then order and the active plan.
 */
export function diffData(prev: AppData, next: AppData, repo: AppRepository): SyncOp[] {
  if (prev === next) return [];
  const saves: SyncOp[] = [];
  const deletes: SyncOp[] = [];
  const orders: SyncOp[] = [];
  const nextIds = new Set(next.goals.map((g) => g.id));

  for (const g of next.goals) {
    const old = prev.goals.find((x) => x.id === g.id);
    if (!old) {
      saves.push({ run: () => repo.saveGoalTree(g) });
      continue;
    }
    if (old === g) continue;

    if (planFieldsChanged(old, g)) saves.push({ run: () => repo.saveGoal(planFields(g)) });

    const oldPhases = new Map(old.phases.map((p) => [p.id, p]));
    for (const p of g.phases) {
      if (oldPhases.get(p.id) !== p) saves.push({ run: () => repo.savePhase(g.id, p) });
    }
    const oldResources = new Map(old.resources.map((r) => [r.id, r]));
    for (const r of g.resources) {
      if (oldResources.get(r.id) !== r) saves.push({ run: () => repo.saveResource(g.id, r) });
    }

    const phaseIds = new Set(g.phases.map((p) => p.id));
    const resourceIds = new Set(g.resources.map((r) => r.id));
    for (const r of old.resources) {
      if (!resourceIds.has(r.id)) deletes.push({ run: () => repo.deleteResource(g.id, r.id) });
    }
    for (const p of old.phases) {
      if (!phaseIds.has(p.id)) deletes.push({ run: () => repo.deletePhase(g.id, p.id) });
    }

    // New items are appended by the backend, so only a different order needs a write.
    const order = (oldIds: string[], ids: string[], set: Set<string>) => {
      const kept = oldIds.filter((id) => set.has(id));
      const oldSet = new Set(oldIds);
      return sameOrder([...kept, ...ids.filter((id) => !oldSet.has(id))], ids);
    };
    const rIds = g.resources.map((r) => r.id);
    if (
      !order(
        old.resources.map((r) => r.id),
        rIds,
        resourceIds,
      )
    ) {
      orders.push({ key: `resources:${g.id}`, run: () => repo.reorderResources(g.id, rIds) });
    }
    const pIds = g.phases.map((p) => p.id);
    if (
      !order(
        old.phases.map((p) => p.id),
        pIds,
        phaseIds,
      )
    ) {
      orders.push({ key: `phases:${g.id}`, run: () => repo.reorderPhases(g.id, pIds) });
    }
  }
  for (const g of prev.goals) {
    if (!nextIds.has(g.id)) deletes.push({ run: () => repo.deleteGoal(g.id) });
  }

  const ops = [...saves, ...deletes, ...orders];
  if (prev.activeGoalId !== next.activeGoalId) {
    const id = next.activeGoalId;
    ops.push({ key: 'active', run: () => repo.setActiveGoal(id) });
  }
  return ops;
}
