import { createEmptyAppData } from '../domain/backup';
import { addDays, todayISO } from '../domain/dates';
import type { Goal } from '../domain/types';
import { goal as makeGoal, res } from '../test/fixtures';
import { RepositoryError } from './errors';
import type { PlanSharingRepository } from './sharing';
import type { AppRepository } from './types';

export interface ContractSubject {
  repo: AppRepository;
  sharing: PlanSharingRepository;
  /** Signs out, so reads can be checked as someone with no account. */
  signOut(): Promise<void>;
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
        startDate: g1.startDate,
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

    it('deletes everything at once', async () => {
      await repo.saveGoalTree(tree('g1'));
      await repo.saveGoalTree(tree('g2'));
      await repo.deleteAll();
      const data = await repo.loadAll();
      expect(data).toEqual(createEmptyAppData());
    });

    it('adds plans without touching what is already saved', async () => {
      await repo.saveGoalTree(tree('old'));
      await repo.addGoals([tree('new1'), tree('new2')], 'new1');
      const data = await repo.loadAll();
      expect(data.goals.map((g) => g.id)).toEqual(['old', 'new1', 'new2']);
      expect(data.activeGoalId).toBe('new1');
    });

    it('stores minutes per day as absolute values, and zero removes a day', async () => {
      const today = todayISO();
      await repo.saveStudyDay(today, 25);
      await repo.saveStudyDay(today, 40);
      await repo.saveStudyDay(addDays(today, -1), 10);
      await repo.saveStudyDay(addDays(today, -400), 10);
      expect(await repo.loadStudyLog(371)).toEqual({ [today]: 40, [addDays(today, -1)]: 10 });
      await repo.saveStudyDay(addDays(today, -1), 0);
      expect(await repo.loadStudyLog(371)).toEqual({ [today]: 40 });
    });

    it('keeps the study log when plans are deleted, but not on delete-all', async () => {
      const today = todayISO();
      await repo.saveGoalTree(tree('g1'));
      await repo.saveStudyDay(today, 30);
      await repo.deleteGoal('g1');
      expect(await repo.loadStudyLog(371)).toEqual({ [today]: 30 });
      await repo.deleteAll();
      expect(await repo.loadStudyLog(371)).toEqual({});
    });

    it('keeps each user’s study log private', async () => {
      await repo.saveStudyDay(todayISO(), 30);
      await subject.switchUser('b');
      expect(await repo.loadStudyLog(371)).toEqual({});
      await subject.switchUser('a');
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

/**
 * Behaviour every `PlanSharingRepository` must have. The rule that matters most: other
 * people only ever get plan content, never progress, dates or daily hours.
 */
export function describeSharingContract(name: string, make: () => Promise<ContractSubject>) {
  describe(`${name}: sharing contract`, () => {
    let subject: ContractSubject;
    let repo: AppRepository;
    let sharing: PlanSharingRepository;
    beforeEach(async () => {
      subject = await make();
      repo = subject.repo;
      sharing = subject.sharing;
      await subject.switchUser('b');
      await repo.deleteAll();
      await subject.switchUser('a');
      await repo.deleteAll();
    });

    /** A plan with progress, a deadline and daily hours: none of it may be shared. */
    const planWithProgress = (id: string): Goal =>
      makeGoal(
        [
          res({ id: `${id}-r1`, title: 'Read', done: true, doneMinutes: 30, doneAt: '2026-03-02' }),
          res({
            id: `${id}-r2`,
            title: 'Watch',
            phaseId: `${id}-p1`,
            startedAt: '2026-03-03',
            loggedOn: '2026-03-03',
            loggedMinutes: 20,
          }),
        ],
        {
          id,
          name: `Plan ${id}`,
          startDate: '2026-03-01',
          targetDate: '2026-04-01',
          hoursPerDay: 2,
          phases: [{ id: `${id}-p1`, name: 'Basics', description: '', color: 'green' }],
        },
      );
    const share = async (
      id: string,
      visibility: 'unlisted' | 'public',
      tags = ['Swift', 'swift', ' iOS '],
    ) => {
      await repo.saveGoalTree(planWithProgress(id));
      await sharing.setDisplayName('Ada');
      return sharing.setSharing(id, visibility, tags);
    };

    it('shares content only, never progress, dates or daily hours', async () => {
      const { slug } = await share('g1', 'unlisted');
      const plan = (await sharing.getShared(slug!))!;
      expect(plan).toMatchObject({ name: 'Plan g1', author: 'Ada', visibility: 'unlisted' });
      expect(plan.tags).toEqual(['ios', 'swift']);
      expect(plan.resources.map((r) => r.id)).toEqual(['g1-r1', 'g1-r2']);
      expect(Object.keys(plan.resources[0]!).sort()).toEqual(
        ['id', 'minutes', 'notes', 'phaseId', 'title', 'type', 'url'].sort(),
      );
      const text = JSON.stringify(plan);
      for (const secret of ['2026-03-02', '2026-03-03', '2026-04-01', 'hoursPerDay', 'done']) {
        expect(text).not.toContain(secret);
      }
    });

    it('shows where a copy came from, and links to the original only while it is shared', async () => {
      const original = await share('g1', 'public');
      await repo.saveGoalTree({
        ...planWithProgress('g2'),
        source: { slug: original.slug!, name: 'Plan g1' },
      });
      const copy = await sharing.setSharing('g2', 'public', []);
      expect((await sharing.getShared(original.slug!))?.source).toBeNull();
      const expected = { slug: original.slug, name: 'Plan g1', available: true };
      expect((await sharing.getShared(copy.slug!))?.source).toEqual(expected);
      const listed = await sharing.listPublic();
      expect(listed.find((p) => p.slug === copy.slug)?.source).toEqual(expected);

      // An unlisted original is for people with its link: a copy never reveals it.
      const hidden = { slug: null, name: 'Plan g1', available: false };
      await sharing.setSharing('g1', 'unlisted', []);
      expect((await sharing.getShared(copy.slug!))?.source).toEqual(hidden);
      await sharing.setSharing('g1', 'private', []);
      expect((await sharing.getShared(copy.slug!))?.source).toEqual(hidden);
    });

    it('can be read without an account; only public plans are listed', async () => {
      const unlisted = await share('g1', 'unlisted');
      const pub = await share('g2', 'public');
      await subject.signOut();
      expect((await sharing.getShared(unlisted.slug!))?.name).toBe('Plan g1');
      const list = await sharing.listPublic();
      expect(list.map((p) => p.slug)).toEqual([pub.slug]);
      expect(list[0]).toMatchObject({ resourceCount: 2, phaseCount: 1, author: 'Ada' });
      expect(await sharing.listPublic({ query: 'nothing like this' })).toEqual([]);
      expect(await sharing.listPublic({ tag: 'swift' })).toHaveLength(1);
    });

    it('searches tags, sorts by copies, lists popular tags and finds similar plans', async () => {
      const a = await share('g1', 'public', ['swift', 'ios']);
      const b = await share('g2', 'public', ['swift']);
      await subject.switchUser('b');
      await sharing.recordCopy(b.slug!);
      await subject.signOut();
      expect((await sharing.listPublic({ query: 'ios' })).map((p) => p.slug)).toEqual([a.slug]);
      expect((await sharing.listPublic({ sort: 'popular' })).map((p) => p.slug)).toEqual([
        b.slug,
        a.slug,
      ]);
      expect(await sharing.listPopularTags()).toEqual([
        { tag: 'swift', count: 2 },
        { tag: 'ios', count: 1 },
      ]);
      expect((await sharing.listSimilar(a.slug!)).map((p) => p.slug)).toEqual([b.slug]);
      expect(await sharing.listSimilar('no-such-plan')).toEqual([]);
    });

    it('stops sharing, and a plan that is deleted is no longer shared', async () => {
      const a = await share('g1', 'unlisted');
      const b = await share('g2', 'public');
      expect(await sharing.setSharing('g1', 'private', [])).toMatchObject({
        visibility: 'private',
      });
      await repo.deleteGoal('g2');
      expect(await sharing.getShared(a.slug!)).toBeNull();
      expect(await sharing.getShared(b.slug!)).toBeNull();
      expect((await sharing.loadSharing()).plans).toEqual({});
    });

    it('keeps the link when visibility changes, and reports the settings to the owner', async () => {
      const first = await share('g1', 'unlisted');
      const second = await sharing.setSharing('g1', 'public', []);
      expect(second.slug).toBe(first.slug);
      const mine = await sharing.loadSharing();
      expect(mine.displayName).toBe('Ada');
      expect(mine.plans['g1']).toMatchObject({ visibility: 'public', slug: first.slug });
    });

    it('gives every account a name, so a plan can go public without asking for one', async () => {
      await repo.saveGoalTree(planWithProgress('g1'));
      const { displayName } = await sharing.loadSharing();
      expect(displayName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
      const { slug } = await sharing.setSharing('g1', 'public', []);
      expect((await sharing.getShared(slug!))?.author).toBe(displayName);
    });

    it('rejects a blank name instead of clearing the author of shared plans', async () => {
      const { slug } = await share('g1', 'public');
      await expect(sharing.setDisplayName('   ')).rejects.toMatchObject({ code: 'validation' });
      expect((await sharing.getShared(slug!))?.author).toBe('Ada');
    });

    it('shows the current name of the account as the author, not a copy from sharing time', async () => {
      const { slug } = await share('g1', 'public');
      await sharing.setDisplayName('Ada Lovelace');
      expect((await sharing.getShared(slug!))?.author).toBe('Ada Lovelace');
      expect((await sharing.listPublic())[0]?.author).toBe('Ada Lovelace');
    });

    it('lets an empty plan be shared, but lists it only once it has a resource', async () => {
      await repo.saveGoalTree({ ...planWithProgress('g1'), resources: [] });
      await sharing.setDisplayName('Ada');
      const { slug } = await sharing.setSharing('g1', 'public', []);
      expect((await sharing.getShared(slug!))?.resources).toEqual([]);
      expect(await sharing.listPublic()).toEqual([]);
      await repo.saveResource('g1', res({ id: 'g1-r1' }));
      expect((await sharing.listPublic()).map((p) => p.slug)).toEqual([slug]);
    });

    it('only lets the owner share a plan, and counts each copy once', async () => {
      const { slug } = await share('g1', 'public');
      await subject.switchUser('b');
      await expect(sharing.setSharing('g1', 'public', [])).rejects.toBeInstanceOf(RepositoryError);
      expect((await sharing.loadSharing()).plans).toEqual({});
      await sharing.recordCopy(slug!);
      await sharing.recordCopy(slug!);
      await subject.switchUser('a');
      expect((await sharing.loadSharing()).plans['g1']!.copyCount).toBe(1);
      await sharing.recordCopy(slug!);
      expect((await sharing.loadSharing()).plans['g1']!.copyCount).toBe(1);
    });

    it('takes reports from signed-in people only', async () => {
      const { slug } = await share('g1', 'public');
      await subject.signOut();
      await expect(sharing.report(slug!, 'spam')).rejects.toMatchObject({ code: 'unauthorized' });
      await subject.switchUser('b');
      await sharing.report(slug!, 'spam');
      await sharing.report(slug!, 'spam again');
    });
  });
}
