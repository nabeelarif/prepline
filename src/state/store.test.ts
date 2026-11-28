import { todayISO } from '../domain/dates';
import type { AppData } from '../domain/types';
import { createMemoryBackend, type MemoryBackend } from '../backend/memory/memoryBackend';
import { createAppStore, type ResourceInput } from './store';

const input = (o: Partial<ResourceInput> = {}): ResourceInput => ({
  url: '',
  title: 'Read',
  type: 'read',
  minutes: 60,
  notes: '',
  phaseId: null,
  ...o,
});

type Store = ReturnType<typeof createAppStore>;

/** Waits until the backend has confirmed every change. */
const flush = (store: Store) =>
  vi.waitFor(() => {
    const { status, pending } = store.getState().sync;
    expect(pending).toBe(0);
    expect(status).not.toBe('saving');
  });

/** A store signed in to `backend`, with its data loaded. */
async function open(
  backend: MemoryBackend = createMemoryBackend({ signedInAs: 'a@example.test' }),
) {
  const store = createAppStore(backend);
  const stop = store.getState().init();
  await vi.waitFor(() => expect(store.getState().load.status).toBe('ready'));
  return { store, backend, stop };
}

async function setup() {
  const { store, backend } = await open();
  const s = () => store.getState();
  s().createGoal({ name: 'Prep', description: '', targetDate: '2026-05-01', hoursPerDay: 1 });
  const g = () => s().data.goals.find((x) => x.id === s().data.activeGoalId)!;
  const add = (o: Partial<ResourceInput> = {}) => {
    s().addResource(input(o));
    return g().resources.at(-1)!;
  };
  /** What the backend holds for the signed-in user. */
  const saved = () => backend.dataOf(backend.userId()!);
  return { s, g, add, store, backend, saved, flush: () => flush(store) };
}

describe('store', () => {
  it('shares a plan, and copies a shared plan with no progress', async () => {
    const { s, g, add, flush } = await setup();
    const r = add({ title: 'Read' });
    s().setProgress(r.id, 60);
    s().startPlan(g().id, '2026-05-01');
    await flush();
    await vi.waitFor(() => expect(s().sharing.status).toBe('ready'));

    // Every account already has a name, so going public needs nothing more.
    expect(s().sharing.displayName).toMatch(/^\S+ \S+ \d{2}$/);
    expect(await s().setPlanSharing(g().id, 'public', ['Swift'])).toBeNull();
    const slug = s().sharing.plans[g().id]!.slug!;

    const shared = (await s().fetchShared(slug))!;
    expect(shared.resources).toHaveLength(1);
    expect(JSON.stringify(shared)).not.toContain('2026-05-01');

    // Another user copies it: their own plan, fresh ids, not started, nothing done.
    const original = { id: g().id, name: g().name, resourceId: r.id };
    await s().signOut();
    await s().signUpWithPassword('b@example.test', 'password1');
    await vi.waitFor(() => expect(s().load.status).toBe('ready'));
    expect(await s().copySharedPlan(shared)).toBeNull();
    const copy = s().data.goals[0]!;
    expect(copy).toMatchObject({ name: original.name, startDate: null, targetDate: null });
    expect(copy.id).not.toBe(original.id);
    expect(copy.source).toEqual({ slug, name: original.name });
    expect(copy.resources[0]).toMatchObject({ title: 'Read', done: false, doneMinutes: 0 });
    expect(copy.resources[0]!.id).not.toBe(original.resourceId);
    // The copy is the new user's own: it is not shared, and sharing settings are not carried over.
    await vi.waitFor(() => expect(s().sharing.status).toBe('ready'));
    expect(s().sharing.plans).toEqual({});
    expect((await s().fetchShared(slug))?.copyCount).toBe(1);
  });

  it('creates a plan not started, and starts it with or without a deadline', async () => {
    const { s, g, saved, flush } = await setup();
    expect(g()).toMatchObject({ startDate: null, targetDate: null });

    s().startPlan(g().id, '2026-05-01');
    expect(g().startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g().targetDate).toBe('2026-05-01');
    await flush();
    expect(saved().goals[0]).toMatchObject({ startDate: g().startDate, targetDate: '2026-05-01' });

    // Starting again changes nothing; a deadline can be cleared by editing the plan.
    const started = g().startDate;
    s().startPlan(g().id, null);
    expect(g()).toMatchObject({ startDate: started, targetDate: '2026-05-01' });
    s().updateGoal(g().id, { name: 'Prep', description: '', hoursPerDay: 1, targetDate: null });
    expect(g()).toMatchObject({ startDate: started, targetDate: null });
    await flush();
    expect(saved().goals[0]!.targetDate).toBeNull();
  });

  it('keeps plans separate and switches between them', async () => {
    const { s, add } = await setup();
    add({ title: 'A' });
    const first = s().data.activeGoalId!;
    s().createGoal({ name: 'Other', description: '', targetDate: '2026-06-01', hoursPerDay: null });
    expect(s().data.goals[1]!.resources).toEqual([]);
    s().selectGoal(first);
    expect(s().data.activeGoalId).toBe(first);
  });

  it('duplicates a plan with fresh ids and remapped phases', async () => {
    const { s, g, add } = await setup();
    s().addPhase({ name: 'Basics', description: '', color: 'green' });
    const r = add({ phaseId: g().phases[0]!.id });
    s().duplicateGoal(g().id);
    const [a, b] = s().data.goals;
    expect(b!.name).toBe('Prep (copy)');
    expect(b!.id).not.toBe(a!.id);
    expect(b!.resources[0]!.id).not.toBe(r.id);
    expect(b!.phases[0]!.id).not.toBe(a!.phases[0]!.id);
    expect(b!.resources[0]!.phaseId).toBe(b!.phases[0]!.id);
  });

  describe('progress', () => {
    it('completes and reopens, keeping partial progress', async () => {
      const { s, g, add } = await setup();
      const { id } = add();
      s().setProgress(id, 20);
      s().toggleResource(id);
      expect(g().resources[0]).toMatchObject({ done: true, doneMinutes: 20 });
      expect(g().resources[0]!.doneAt).not.toBeNull();
      s().toggleResource(id);
      expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 20, doneAt: null });
    });

    it('clamps partial progress and completes at the full estimate', async () => {
      const { s, g, add } = await setup();
      const { id } = add({ minutes: 60 });
      s().setProgress(id, -5);
      expect(g().resources[0]).toMatchObject({ doneMinutes: 0, done: false });
      s().setProgress(id, 90);
      expect(g().resources[0]).toMatchObject({ done: true });
      s().setProgress(id, 30);
      expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 30, doneAt: null });
    });

    it('caps progress when the estimate shrinks', async () => {
      const { s, g, add } = await setup();
      const r = add({ minutes: 120 });
      s().setProgress(r.id, 90);
      s().updateResource(r.id, input({ minutes: 60 }));
      expect(g().resources[0]!.doneMinutes).toBe(60);
    });
  });

  it('keeps two resources In Progress independently and completes one', async () => {
    const { s, g, add } = await setup();
    const a = add({ title: 'SwiftUI', minutes: 1200 });
    const b = add({ title: 'Async', minutes: 120 });
    add({ title: 'Later' });
    s().setStatus(a.id, 'in_progress');
    s().setStatus(b.id, 'in_progress');
    s().setProgress(a.id, 300);
    s().setProgress(b.id, 60);
    s().setStatus(b.id, 'completed');
    const [ra, rb, rc] = g().resources;
    expect(ra).toMatchObject({ done: false, doneMinutes: 300 });
    expect(ra!.startedAt).not.toBeNull();
    expect(rb).toMatchObject({ done: true });
    expect(rc).toMatchObject({ done: false, doneMinutes: 0, startedAt: null });
  });

  it('restores partial progress after completing through Update progress', async () => {
    const { s, g, add } = await setup();
    const { id } = add({ minutes: 1200 });
    s().setProgress(id, 300);
    s().setProgress(id, 1200);
    expect(g().resources[0]).toMatchObject({ done: true });
    s().setStatus(id, 'in_progress');
    expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 300 });
  });

  it('resets to Not Started', async () => {
    const { s, g, add } = await setup();
    const { id } = add();
    s().setProgress(id, 30);
    s().setStatus(id, 'not_started');
    expect(g().resources[0]).toMatchObject({ doneMinutes: 0, startedAt: null, done: false });
  });

  it('moves resources within bounds', async () => {
    const { s, g, add } = await setup();
    const a = add({ title: 'A' });
    add({ title: 'B' });
    const titles = () => g().resources.map((r) => r.title);
    s().moveResource(a.id, -1);
    expect(titles()).toEqual(['A', 'B']);
    s().moveResource(a.id, 1);
    expect(titles()).toEqual(['B', 'A']);
  });

  it('places a dragged resource before or after another', async () => {
    const { s, g, add } = await setup();
    const a = add({ title: 'A' });
    const b = add({ title: 'B' });
    const c = add({ title: 'C' });
    const titles = () => g().resources.map((r) => r.title);
    s().placeResource(c.id, a.id, false);
    expect(titles()).toEqual(['C', 'A', 'B']);
    s().placeResource(c.id, b.id, true);
    expect(titles()).toEqual(['A', 'B', 'C']);
    s().placeResource(a.id, c.id, false);
    expect(titles()).toEqual(['B', 'A', 'C']);
    // Unknown target or dropping on itself changes nothing.
    s().placeResource(a.id, 'missing', true);
    s().placeResource(a.id, a.id, true);
    expect(titles()).toEqual(['B', 'A', 'C']);
  });

  describe('phases', () => {
    it('adds, edits and reorders phases, and switches to the phases view', async () => {
      const { s, g } = await setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      s().addPhase({ name: 'Advanced', description: '', color: 'red' });
      expect(s().ui.view).toBe('phases');
      const [a, b] = g().phases;
      s().updatePhase(b!.id, { name: 'Deep dives', description: 'Hard parts', color: 'pink' });
      s().movePhase(b!.id, -1);
      s().movePhase(b!.id, -1);
      expect(g().phases.map((p) => p.name)).toEqual(['Deep dives', 'Basics']);
      expect(g().phases[1]!.id).toBe(a!.id);
    });

    it('defaults resources to no phase and ignores unknown phase ids', async () => {
      const { s, g, add } = await setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      const pid = g().phases[0]!.id;
      add();
      add({ phaseId: pid });
      add({ phaseId: 'missing' });
      expect(g().resources.map((r) => r.phaseId)).toEqual([null, pid, null]);
      s().setResourcePhase(g().resources[0]!.id, pid);
      expect(g().resources[0]!.phaseId).toBe(pid);
    });

    it('deleting a phase keeps its resources, unassigned and in order', async () => {
      const { s, g, add } = await setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      const pid = g().phases[0]!.id;
      add({ title: 'A', phaseId: pid });
      add({ title: 'B' });
      s().deletePhase(pid);
      expect(g().phases).toEqual([]);
      expect(g().resources.map((r) => [r.title, r.phaseId])).toEqual([
        ['A', null],
        ['B', null],
      ]);
    });
  });

  it('resets plan-specific view state when switching plans', async () => {
    const { s, add } = await setup();
    const { id } = add();
    s().selectResource(id);
    s().setTypeFilter('watch');
    s().selectGoal(s().data.activeGoalId!);
    expect(s().ui).toMatchObject({ selectedResourceId: null, typeFilter: 'all' });
  });

  describe('persistence', () => {
    it('starts with no plans for a new account (empty, not an error)', async () => {
      const { store } = await open();
      expect(store.getState().data).toEqual({ version: 1, activeGoalId: null, goals: [] });
      expect(store.getState().load.status).toBe('ready');
    });

    it('saves every change through the repository, and a reload finds it', async () => {
      const { add, saved, flush, backend, s } = await setup();
      const r = add({ title: 'Read' });
      s().setProgress(r.id, 20);
      await flush();
      expect(saved().goals[0]!.resources[0]).toMatchObject({ title: 'Read', doneMinutes: 20 });
      expect(s().sync.status).toBe('saved');
      const { store: reloaded } = await open(backend);
      expect(reloaded.getState().data).toEqual(s().data);
    });

    it('persists reorders, phase deletes and the active plan', async () => {
      const { s, g, add, saved, flush } = await setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      const phase = g().phases[0]!.id;
      const a = add({ title: 'A', phaseId: phase });
      add({ title: 'B' });
      const c = add({ title: 'C' });
      s().placeResource(c.id, a.id, false);
      s().deletePhase(phase);
      s().createGoal({
        name: 'Other',
        description: '',
        targetDate: '2026-06-01',
        hoursPerDay: null,
      });
      s().selectGoal(saved().goals[0]?.id ?? s().data.goals[0]!.id);
      await flush();
      const goal = saved().goals[0]!;
      expect(goal.resources.map((r) => [r.title, r.phaseId])).toEqual([
        ['C', null],
        ['A', null],
        ['B', null],
      ]);
      expect(goal.phases).toEqual([]);
      expect(saved().activeGoalId).toBe(goal.id);
      expect(saved().goals).toHaveLength(2);
    });

    it('saves in order, so rapid updates end with the newest value', async () => {
      const { s, add, saved, flush, backend } = await setup();
      const r = add();
      for (let m = 1; m <= 30; m++) s().setProgress(r.id, m);
      await flush();
      expect(saved().goals[0]!.resources[0]!.doneMinutes).toBe(30);
      const writes = backend.calls.filter((c) => c === 'saveResource').length;
      expect(writes).toBeGreaterThanOrEqual(31);
    });

    it('coalesces rapid reorders into the latest order', async () => {
      const { s, add, g, saved, flush, backend } = await setup();
      const a = add({ title: 'A' });
      add({ title: 'B' });
      add({ title: 'C' });
      const release = backend.hold();
      s().placeResource(a.id, g().resources[2]!.id, true);
      s().moveResource(a.id, -1);
      s().moveResource(a.id, 1);
      release();
      await flush();
      expect(saved().goals[0]!.resources.map((r) => r.title)).toEqual(['B', 'C', 'A']);
      expect(backend.calls.filter((c) => c === 'reorderResources').length).toBeLessThanOrEqual(2);
    });

    it('only confirms with a toast after the backend has saved', async () => {
      const { s, backend, flush } = await setup();
      await flush();
      const release = backend.hold();
      s().showToast('clear');
      s().addResource(input());
      expect(s().ui.toast?.text).not.toBe('Resource added');
      expect(s().sync.status).toBe('saving');
      release();
      await flush();
      expect(s().ui.toast?.text).toBe('Resource added');
      expect(s().sync.status).toBe('saved');
    });
  });

  describe('failed saves', () => {
    it('offers discarding, not retrying, when the server rejects a write for good', async () => {
      const { s, backend, add, saved } = await setup();
      await vi.waitFor(() => expect(s().sync.pending).toBe(0));
      backend.failNext(1, 'validation');
      add({ title: 'Rejected' });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      expect(s().sync.retryable).toBe(false);
      s().retrySync();
      expect(s().sync.status).toBe('error');
      await s().discardUnsaved();
      expect(s().sync).toMatchObject({ status: 'idle', pending: 0 });
      expect(s().data.goals[0]!.resources).toEqual(saved().goals[0]!.resources);
    });

    it('does not reload over edits that are not saved yet', async () => {
      const { s, backend, add } = await setup();
      await vi.waitFor(() => expect(s().sync.pending).toBe(0));
      backend.failNext(1);
      add({ title: 'Unsaved' });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      expect(s().sync.retryable).toBe(true);
      await s().reload();
      expect(s().data.goals[0]!.resources).toHaveLength(1);
    });

    it('does not put a restore into memory after the user signed out', async () => {
      const { s, backend } = await setup();
      await vi.waitFor(() => expect(s().sync.pending).toBe(0));
      const release = backend.hold();
      const done = s().deleteAllData();
      await s().signOut();
      release();
      expect(await done).toBe(false);
      expect(s().data.goals).toEqual([]);
      expect(s().auth.status).toBe('signedOut');
    });

    it('ignores edits made while a restore or delete-all is running, and says so', async () => {
      const { s, backend, add } = await setup();
      await vi.waitFor(() => expect(s().sync.pending).toBe(0));
      const release = backend.hold();
      const done = s().deleteAllData();
      add({ title: 'Too late' });
      expect(s().ui.toast?.text).toMatch(/wait/i);
      release();
      expect(await done).toBe(true);
      expect(s().data.goals).toEqual([]);
      await vi.waitFor(() => expect(s().sync.pending).toBe(0));
      expect(backend.dataOf(backend.userId()!).goals).toEqual([]);
    });

    it('keeps the change in memory, reports it, and retry saves it', async () => {
      const { s, add, saved, flush, backend } = await setup();
      await flush();
      backend.failNext(1);
      add({ title: 'Unsaved' });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      expect(s().sync.error).toMatch(/server/i);
      expect(s().data.goals[0]!.resources[0]!.title).toBe('Unsaved');
      expect(saved().goals[0]!.resources).toHaveLength(0);
      expect(s().ui.toast?.text).not.toBe('Resource added');
      s().retrySync();
      await flush();
      expect(s().sync.status).toBe('saved');
      expect(saved().goals[0]!.resources.map((r) => r.title)).toEqual(['Unsaved']);
      expect(s().ui.toast?.text).toBe('Resource added');
    });

    it('holds later changes behind a failed one and saves them in order after retry', async () => {
      const { s, add, saved, flush, backend } = await setup();
      await flush();
      backend.failNext(1);
      const r = add({ title: 'First' });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      s().setProgress(r.id, 15);
      // The resource save, the progress save, and today's study-log total.
      expect(s().sync.pending).toBe(3);
      expect(saved().goals[0]!.resources).toHaveLength(0);
      s().retrySync();
      await flush();
      expect(saved().goals[0]!.resources[0]).toMatchObject({ title: 'First', doneMinutes: 15 });
    });
  });

  describe('restore and delete', () => {
    const backup: AppData = {
      version: 1,
      activeGoalId: 'b2',
      goals: [
        {
          id: 'b1',
          name: 'One',
          description: '',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
          hoursPerDay: null,
          createdAt: '2026-01-01',
          resources: [],
          phases: [],
        },
        {
          id: 'b2',
          name: 'Two',
          description: '',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
          hoursPerDay: 1,
          createdAt: '2026-01-01',
          resources: [],
          phases: [],
        },
      ],
    };
    /** A plan with a resource selected and filters set, so a reset is visible. */
    const busy = async () => {
      const t = await setup();
      const r = t.add();
      t.s().selectResource(r.id);
      t.s().setStatusFilter('completed');
      t.s().openOverlay({ kind: 'import' });
      await t.flush();
      return t;
    };

    it('changes nothing in memory or on the server when saving fails', async () => {
      const { s, backend, saved } = await busy();
      const before = { data: s().data, ui: s().ui, server: saved() };
      backend.failNext(2);
      expect(await s().addPlans(backup)).toBeNull();
      expect(await s().deleteAllData()).toBe(false);
      expect(s().data).toBe(before.data);
      expect(s().ui).toEqual({
        ...before.ui,
        toast: expect.objectContaining({ text: expect.any(String) }),
      });
      expect(saved()).toEqual(before.server);
      expect(s().busy).toBe(false);
    });

    it('refuses a second import while one is running', async () => {
      const { s, backend } = await busy();
      const release = backend.hold();
      const first = s().addPlans(backup);
      expect(s().busy).toBe(true);
      expect(await s().addPlans(backup)).toBeNull();
      release();
      expect(await first).not.toBeNull();
      expect(backend.calls.filter((c) => c === 'addGoals')).toHaveLength(1);
    });

    it('adds plans from a file next to the saved ones, atomically', async () => {
      const { s, saved } = await busy();
      const result = await s().addPlans(backup);
      expect(result).toEqual({
        addedIds: s()
          .data.goals.slice(1)
          .map((g) => g.id),
        unshared: [],
      });
      expect(s().data.goals.map((g) => g.name)).toEqual(['Prep', 'One', 'Two']);
      expect(saved().goals.map((g) => g.name)).toEqual(['Prep', 'One', 'Two']);
      expect(s().ui.overlay).toEqual({ kind: 'import' });
    });

    it('shares imported plans as the file asks, and leaves the rest private', async () => {
      const { s } = await busy();
      await vi.waitFor(() => expect(s().sharing.status).toBe('ready'));
      const shares = [{ visibility: 'unlisted' as const, tags: ['swift', 'ios'] }, null];
      expect(await s().addPlans(backup, shares)).not.toBeNull();
      const [one, two] = s().data.goals.slice(1);
      expect(s().sharing.plans[one!.id]).toMatchObject({
        visibility: 'unlisted',
        tags: ['ios', 'swift'],
      });
      expect(s().sharing.plans[two!.id]).toBeUndefined();
    });

    it('reports plans whose sharing failed, and still adds them', async () => {
      const { s, backend } = await busy();
      await vi.waitFor(() => expect(s().sharing.status).toBe('ready'));
      vi.spyOn(backend.sharing, 'setSharing').mockRejectedValueOnce(new Error('sharing is down'));
      const result = await s().addPlans(backup, [{ visibility: 'unlisted', tags: [] }, null]);
      expect(result?.unshared).toEqual(['One']);
      expect(s().data.goals.map((g) => g.name)).toEqual(['Prep', 'One', 'Two']);
    });

    it('keeps plans another device saved meanwhile when adding plans', async () => {
      const { s, backend, saved } = await busy();
      // Another device adds a plan this one has not loaded.
      await backend.repo.saveGoalTree({
        ...backup.goals[0]!,
        id: 'other-device',
        name: 'Elsewhere',
      });
      expect(await s().addPlans(backup)).not.toBeNull();
      expect(saved().goals.map((g) => g.name)).toEqual(['Prep', 'Elsewhere', 'One', 'Two']);
      expect(backend.calls).toContain('addGoals');
    });

    it('deletes everything, and stays empty after a reload', async () => {
      const { s, backend } = await busy();
      expect(await s().deleteAllData()).toBe(true);
      expect(s().data).toEqual({ version: 1, activeGoalId: null, goals: [] });
      expect(s().ui).toMatchObject({
        overlay: null,
        selectedResourceId: null,
        statusFilter: 'all',
      });
      expect(s().ui.toast?.text).toBe('All Road to Goals data deleted');
      expect((await open(backend)).store.getState().data.goals).toEqual([]);
    });

    it('drops queued writes that deleting everything replaced', async () => {
      const { s, add, saved, flush, backend } = await setup();
      await flush();
      backend.failNext(1);
      add({ title: 'Stale' });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      expect(await s().deleteAllData()).toBe(true);
      expect(s().sync.status).not.toBe('error');
      await flush();
      expect(saved().goals).toEqual([]);
    });
  });

  describe('loading and accounts', () => {
    it('asks for a new password after a reset link, then returns to the app', async () => {
      const backend = createMemoryBackend({ signedInAs: 'a@example.test' });
      let fire = () => {};
      const store = createAppStore({
        repo: backend.repo,
        sharing: backend.sharing,
        enricher: backend.enricher,
        auth: {
          ...backend.auth,
          onPasswordRecovery: (cb) => ((fire = cb), () => {}),
        },
      });
      store.getState().init();
      await vi.waitFor(() => expect(store.getState().load.status).toBe('ready'));
      fire();
      expect(store.getState().recovery).toBe(true);
      expect((await store.getState().updatePassword('short')).ok).toBe(false);
      expect(store.getState().recovery).toBe(true);
      expect((await store.getState().updatePassword('long-enough-1')).ok).toBe(true);
      expect(store.getState().recovery).toBe(false);
    });

    it('shows a load failure as an error, not as an empty account', async () => {
      const backend = createMemoryBackend({ signedInAs: 'a@example.test' });
      backend.failNext(1);
      const store = createAppStore(backend);
      store.getState().init();
      await vi.waitFor(() => expect(store.getState().load.status).toBe('error'));
      expect(store.getState().data.goals).toEqual([]);
      await store.getState().reload();
      expect(store.getState().load.status).toBe('ready');
    });

    it('is signed out until someone signs in', async () => {
      const backend = createMemoryBackend();
      const store = createAppStore(backend);
      store.getState().init();
      await vi.waitFor(() => expect(store.getState().auth.status).toBe('signedOut'));
      expect(store.getState().load.status).toBe('idle');
    });

    it('keeps each user’s data apart and clears memory on sign-out', async () => {
      const backend = createMemoryBackend();
      const store = createAppStore(backend);
      const s = () => store.getState();
      s().init();
      await vi.waitFor(() => expect(s().auth.status).toBe('signedOut'));

      expect((await s().signUpWithPassword('a@example.test', 'password1')).ok).toBe(true);
      await vi.waitFor(() => expect(s().load.status).toBe('ready'));
      s().createGoal({
        name: 'Mine',
        description: '',
        targetDate: '2026-05-01',
        hoursPerDay: null,
      });
      s().openOverlay({ kind: 'import' });
      await flush(store);

      await s().signOut();
      await vi.waitFor(() => expect(s().auth.status).toBe('signedOut'));
      expect(s().data.goals).toEqual([]);
      expect(s().ui.overlay).toBeNull();

      await s().signUpWithPassword('b@example.test', 'password2');
      await vi.waitFor(() => expect(s().load.status).toBe('ready'));
      expect(s().data.goals).toEqual([]);

      await s().signOut();
      await s().signInWithPassword('a@example.test', 'password1');
      await vi.waitFor(() => expect(s().data.goals.map((g) => g.name)).toEqual(['Mine']));
    });

    it('does not let a failed write for one user reach the next', async () => {
      const backend = createMemoryBackend();
      const store = createAppStore(backend);
      const s = () => store.getState();
      s().init();
      await vi.waitFor(() => expect(s().auth.status).toBe('signedOut'));
      await s().signUpWithPassword('a@example.test', 'password1');
      await vi.waitFor(() => expect(s().load.status).toBe('ready'));
      backend.failNext(1);
      s().createGoal({
        name: 'Unsaved',
        description: '',
        targetDate: '2026-05-01',
        hoursPerDay: null,
      });
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      await s().signOut();
      await s().signUpWithPassword('b@example.test', 'password2');
      await vi.waitFor(() => expect(s().load.status).toBe('ready'));
      expect(s().sync.status).toBe('idle');
      await flush(store);
      expect(backend.dataOf(backend.userId()!).goals).toEqual([]);
    });

    it('reports a wrong password without signing in', async () => {
      const backend = createMemoryBackend();
      const store = createAppStore(backend);
      const out = await store.getState().signInWithPassword('x@example.test', 'nope');
      expect(out).toEqual({ ok: false, error: 'Incorrect email or password.' });
    });

    it('linking another method keeps the same account and data', async () => {
      const { s, flush, store } = await setup();
      await flush();
      const before = s().auth.user!.id;
      expect((await s().linkProvider('google')).ok).toBe(true);
      expect(s().auth.user!.id).toBe(before);
      expect((await s().listMethods()).map((m) => m.provider)).toEqual(['password', 'google']);
      expect(store.getState().data.goals).toHaveLength(1);
      expect((await s().unlinkProvider('password')).ok).toBe(true);
      expect((await s().unlinkProvider('google')).ok).toBe(false);
    });
  });

  describe('study log', () => {
    const today = () => todayISO();

    it('adds minutes studied today and saves the day total', async () => {
      const { s, add, saved, flush, backend } = await setup();
      await vi.waitFor(() => expect(s().studyLog.ready).toBe(true));
      const r = add({ minutes: 60 });
      s().setProgress(r.id, 20);
      s().setProgress(r.id, 45);
      expect(s().studyLog.days).toEqual({ [today()]: 45 });
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({ [today()]: 45 });
      s().setStatus(r.id, 'completed');
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({ [today()]: 60 });
      // Taking progress back takes the minutes back; the plan itself is not the log.
      s().setStatus(r.id, 'not_started');
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({});
      expect(saved().goals).toHaveLength(1);
    });

    it('credits timer minutes to the resource and the log, in any plan', async () => {
      const { s, add, g, flush, backend } = await setup();
      await vi.waitFor(() => expect(s().studyLog.ready).toBe(true));
      const r = add({ minutes: 60 });
      const goalId = g().id;
      expect(s().addStudyMinutes(goalId, r.id, 25)).toBe(true);
      expect(s().addStudyMinutes(goalId, r.id, 10)).toBe(true);
      expect(g().resources[0]!.doneMinutes).toBe(35);
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({ [today()]: 35 });
      // Reaching the estimate completes it; a completed or missing resource is refused.
      expect(s().addStudyMinutes(goalId, r.id, 500)).toBe(true);
      expect(g().resources[0]!.done).toBe(true);
      expect(s().addStudyMinutes(goalId, r.id, 5)).toBe(false);
      expect(s().addStudyMinutes(goalId, 'nope', 5)).toBe(false);
    });

    it('refuses timer minutes while the log is not loaded', async () => {
      const backend = createMemoryBackend({ signedInAs: 'a@example.test' });
      backend.repo.loadStudyLog = () => Promise.reject(new Error('down'));
      const { store } = await open(backend);
      const s = () => store.getState();
      s().createGoal({ name: 'Prep', description: '', targetDate: null, hoursPerDay: null });
      s().addResource(input());
      const g = s().data.goals[0]!;
      expect(s().studyLog.ready).toBe(false);
      expect(s().addStudyMinutes(g.id, g.resources[0]!.id, 10)).toBe(false);
      expect(s().data.goals[0]!.resources[0]!.doneMinutes).toBe(0);
    });

    it('keeps the log when a plan is deleted, and clears it with Delete All Data', async () => {
      const { s, add, g, flush, backend } = await setup();
      await vi.waitFor(() => expect(s().studyLog.ready).toBe(true));
      s().setProgress(add().id, 30);
      s().deleteGoal(g().id);
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({ [today()]: 30 });
      expect(await s().deleteAllData()).toBe(true);
      expect(s().studyLog.days).toEqual({});
      expect(await backend.repo.loadStudyLog(30)).toEqual({});
    });

    it('does not count twice when the save is retried', async () => {
      const { s, add, flush, backend } = await setup();
      await vi.waitFor(() => expect(s().studyLog.ready).toBe(true));
      const r = add();
      await flush();
      backend.failNext(1);
      s().setProgress(r.id, 25);
      await vi.waitFor(() => expect(s().sync.status).toBe('error'));
      s().retrySync();
      await flush();
      expect(await backend.repo.loadStudyLog(30)).toEqual({ [today()]: 25 });
    });

    it('loads the saved log on sign-in', async () => {
      const backend = createMemoryBackend({ signedInAs: 'a@example.test' });
      await backend.repo.saveStudyDay(today(), 15);
      const { store } = await open(backend);
      await vi.waitFor(() =>
        expect(store.getState().studyLog).toEqual({ ready: true, days: { [today()]: 15 } }),
      );
    });

    it('records nothing, and still works, when the log cannot be loaded', async () => {
      const backend = createMemoryBackend({ signedInAs: 'a@example.test' });
      backend.repo.loadStudyLog = () => Promise.reject(new Error('down'));
      const { store } = await open(backend);
      await vi.waitFor(() => expect(store.getState().studyLog.ready).toBe(false));
      store
        .getState()
        .createGoal({ name: 'P', description: '', targetDate: null, hoursPerDay: null });
      store.getState().addResource(input());
      const id = store.getState().data.goals[0]!.resources[0]!.id;
      store.getState().setProgress(id, 10);
      await flush(store);
      expect(backend.calls).not.toContain('saveStudyDay');
      expect(store.getState().sync.status).toBe('saved');
    });
  });
});
