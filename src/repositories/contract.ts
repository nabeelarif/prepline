import { createEmptyAppData } from '../domain/backup';
import type { Goal } from '../domain/types';
import { goal as makeGoal, res } from '../test/fixtures';
import { RepositoryError } from './errors';
import type { AppRepository } from './types';

export interface ContractSubject {
  repo: AppRepository;
  /** Makes `repo` act for a different user. Data of the other user must stay invisible. */
  switchUser(name: 'a' | 'b'): Promise<void>;
}

/**
 * Behaviour every `AppRepository` must have. Run it against the in-memory backend in unit
 * tests, and against a real backend when one is configured (see the Supabase test).
 */
export function describeRepositoryContract(name: string, make: () => Promise<ContractSubject>) {
  describe(`${name}: repository contract`, () => {
    let repo: AppRepository;
    let subject: ContractSubject;
    beforeEach(async () => {
      subject = await make();
      repo = subject.repo;
      await subject.switchUser('a');
      await repo.deleteAll();
    });

    const tree = (id: string): Goal =>
      makeGoal([res({ id: `${id}-r1` }), res({ id: `${id}-r2`, phaseId: `${id}-p1` })], {
        id,
        phases: [
          { id: `${id}-p1`, name: 'Basics', description: 'x', color: 'green' },
          { id: `${id}-p2`, name: 'More', description: '', color: 'red' },
        ],
      });

    it('loads an empty account as no data, not as a failure', async () => {
      expect(await repo.loadAll()).toEqual(createEmptyAppData());
    });

    it('stores a whole plan and returns it unchanged, in order', async () => {
      const g = tree('g1');
      await repo.saveGoalTree(g);
      await repo.setActiveGoal('g1');
      expect(await repo.loadAll()).toEqual({ version: 1, activeGoalId: 'g1', goals: [g] });
    });

    it('appends new plans, resources and phases, and updates existing ones in place', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.saveGoalTree(tree('g2'));
      await repo.saveResource('g1', res({ id: 'new' }));
      await repo.savePhase('g1', { id: 'p3', name: 'Last', description: '', color: 'blue' });
      await repo.saveResource(
        'g1',
        res({ id: 'g1-r1', title: 'Renamed', done: true, doneAt: '2026-03-11' }),
      );
      const data = await repo.loadAll();
      expect(data.goals.map((g) => g.id)).toEqual(['g1', 'g2']);
      expect(data.goals[0]!.resources.map((r) => r.id)).toEqual(['g1-r1', 'g1-r2', 'new']);
      expect(data.goals[0]!.resources[0]).toMatchObject({ title: 'Renamed', done: true });
      expect(data.goals[0]!.phases.map((p) => p.id)).toEqual(['g1-p1', 'g1-p2', 'p3']);
    });

    it('saves are idempotent, so a retry cannot duplicate anything', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.saveResource('g1', res({ id: 'x' }));
      await repo.saveResource('g1', res({ id: 'x' }));
      const { goals } = await repo.loadAll();
      expect(goals[0]!.resources.filter((r) => r.id === 'x')).toHaveLength(1);
    });

    it('updates plan fields without touching its contents', async () => {
      await repo.saveGoalTree(tree('g1'));
      const g1 = tree('g1');
      await repo.saveGoal({
        id: g1.id,
        name: 'Renamed',
        description: g1.description,
        targetDate: g1.targetDate,
        hoursPerDay: null,
        createdAt: g1.createdAt,
      });
      const g = (await repo.loadAll()).goals[0]!;
      expect(g).toMatchObject({ name: 'Renamed', hoursPerDay: null });
      expect(g.resources).toHaveLength(2);
      expect(g.phases).toHaveLength(2);
    });

    it('reorders resources and phases', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.reorderResources('g1', ['g1-r2', 'g1-r1']);
      await repo.reorderPhases('g1', ['g1-p2', 'g1-p1']);
      const g = (await repo.loadAll()).goals[0]!;
      expect(g.resources.map((r) => r.id)).toEqual(['g1-r2', 'g1-r1']);
      expect(g.phases.map((p) => p.id)).toEqual(['g1-p2', 'g1-p1']);
    });

    it('deleting a phase keeps its resources, with no phase', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.deletePhase('g1', 'g1-p1');
      const g = (await repo.loadAll()).goals[0]!;
      expect(g.phases.map((p) => p.id)).toEqual(['g1-p2']);
      expect(g.resources.map((r) => [r.id, r.phaseId])).toEqual([
        ['g1-r1', null],
        ['g1-r2', null],
      ]);
    });

    it('deleting a plan deletes its contents; deleting a resource keeps the rest', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.saveGoalTree(tree('g2'));
      await repo.deleteResource('g1', 'g1-r1');
      await repo.deleteGoal('g2');
      const data = await repo.loadAll();
      expect(data.goals.map((g) => g.id)).toEqual(['g1']);
      expect(data.goals[0]!.resources.map((r) => r.id)).toEqual(['g1-r2']);
    });

    it('replaces everything at once, and deletes everything', async () => {
      await repo.saveGoalTree(tree('old'));
      await repo.replaceAll({ version: 1, activeGoalId: 'g2', goals: [tree('g1'), tree('g2')] });
      let data = await repo.loadAll();
      expect(data.goals.map((g) => g.id)).toEqual(['g1', 'g2']);
      expect(data.activeGoalId).toBe('g2');
      await repo.deleteAll();
      data = await repo.loadAll();
      expect(data).toEqual(createEmptyAppData());
    });

    it('keeps each user’s data private', async () => {
      await repo.saveGoalTree(tree('mine'));
      await subject.switchUser('b');
      expect((await repo.loadAll()).goals).toEqual([]);
      // Writing to another user's ids neither changes nor reveals their data.
      await repo.deleteGoal('mine').catch((e) => expect(e).toBeInstanceOf(RepositoryError));
      await repo.saveResource('mine', res({ id: 'intruder' })).catch(() => {});
      await subject.switchUser('a');
      const goals = (await repo.loadAll()).goals;
      expect(goals.map((g) => g.id)).toEqual(['mine']);
      expect(goals[0]!.resources.map((r) => r.id)).not.toContain('intruder');
    });
  });
}
