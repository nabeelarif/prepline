import type { AppData } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { createAppStore, type ResourceInput } from './store';

function memoryStorage(initial: unknown = null) {
  const saved: AppData[] = [];
  const adapter: StorageAdapter = {
    available: true,
    load: () => initial,
    save: (d) => {
      saved.push(d);
      return true;
    },
  };
  return { adapter, saved };
}

const input = (o: Partial<ResourceInput> = {}): ResourceInput => ({
  url: '',
  title: 'Read',
  type: 'article',
  minutes: 60,
  notes: '',
  phaseId: null,
  ...o,
});

function setup() {
  const { adapter, saved } = memoryStorage();
  const store = createAppStore(adapter);
  const s = () => store.getState();
  s().createGoal({ name: 'Prep', description: '', targetDate: '2026-05-01', hoursPerDay: 1 });
  const g = () => s().data.goals.find((x) => x.id === s().data.activeGoalId)!;
  const add = (o: Partial<ResourceInput> = {}) => {
    s().addResource(input(o));
    return g().resources.at(-1)!;
  };
  return { s, g, add, saved };
}

describe('store', () => {
  it('starts empty when nothing is saved, with no sample plan', () => {
    const s = createAppStore(memoryStorage().adapter).getState();
    expect(s.data).toEqual({ version: 1, activeGoalId: null, goals: [] });
  });

  it('persists every change through the adapter', () => {
    const { add, saved } = setup();
    add({ title: 'Read' });
    expect(saved).toHaveLength(2);
    expect(saved[1]!.goals[0]!.resources[0]!.title).toBe('Read');
  });

  it('keeps plans separate and switches between them', () => {
    const { s, add } = setup();
    add({ title: 'A' });
    const first = s().data.activeGoalId!;
    s().createGoal({ name: 'Other', description: '', targetDate: '2026-06-01', hoursPerDay: null });
    expect(s().data.goals[1]!.resources).toEqual([]);
    s().selectGoal(first);
    expect(s().data.activeGoalId).toBe(first);
  });

  it('duplicates a plan with fresh ids and remapped phases', () => {
    const { s, g, add } = setup();
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
    it('completes and reopens, keeping partial progress', () => {
      const { s, g, add } = setup();
      const { id } = add();
      s().setProgress(id, 20);
      s().toggleResource(id);
      expect(g().resources[0]).toMatchObject({ done: true, doneMinutes: 20 });
      expect(g().resources[0]!.doneAt).not.toBeNull();
      s().toggleResource(id);
      expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 20, doneAt: null });
    });

    it('clamps partial progress and completes at the full estimate', () => {
      const { s, g, add } = setup();
      const { id } = add({ minutes: 60 });
      s().setProgress(id, -5);
      expect(g().resources[0]).toMatchObject({ doneMinutes: 0, done: false });
      s().setProgress(id, 90);
      expect(g().resources[0]).toMatchObject({ done: true });
      s().setProgress(id, 30);
      expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 30, doneAt: null });
    });

    it('caps progress when the estimate shrinks', () => {
      const { s, g, add } = setup();
      const r = add({ minutes: 120 });
      s().setProgress(r.id, 90);
      s().updateResource(r.id, input({ minutes: 60 }));
      expect(g().resources[0]!.doneMinutes).toBe(60);
    });
  });

  it('keeps two resources In Progress independently and completes one', () => {
    const { s, g, add } = setup();
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

  it('restores partial progress after completing through Update progress', () => {
    const { s, g, add } = setup();
    const { id } = add({ minutes: 1200 });
    s().setProgress(id, 300);
    s().setProgress(id, 1200);
    expect(g().resources[0]).toMatchObject({ done: true });
    s().setStatus(id, 'in_progress');
    expect(g().resources[0]).toMatchObject({ done: false, doneMinutes: 300 });
  });

  it('resets to Not Started', () => {
    const { s, g, add } = setup();
    const { id } = add();
    s().setProgress(id, 30);
    s().setStatus(id, 'not_started');
    expect(g().resources[0]).toMatchObject({ doneMinutes: 0, startedAt: null, done: false });
  });

  it('reports when saving fails, and keeps the change in memory', () => {
    const adapter: StorageAdapter = { available: true, load: () => null, save: () => false };
    const store = createAppStore(adapter);
    store.getState().createGoal({
      name: 'Prep',
      description: '',
      targetDate: '2026-05-01',
      hoursPerDay: null,
    });
    expect(store.getState().storageOK).toBe(false);
    expect(store.getState().data.goals).toHaveLength(1);
  });

  it('moves resources within bounds', () => {
    const { s, g, add } = setup();
    const a = add({ title: 'A' });
    add({ title: 'B' });
    const titles = () => g().resources.map((r) => r.title);
    s().moveResource(a.id, -1);
    expect(titles()).toEqual(['A', 'B']);
    s().moveResource(a.id, 1);
    expect(titles()).toEqual(['B', 'A']);
  });

  it('places a dragged resource before or after another', () => {
    const { s, g, add } = setup();
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
    it('adds, edits and reorders phases, and switches to the phases view', () => {
      const { s, g } = setup();
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

    it('defaults resources to no phase and ignores unknown phase ids', () => {
      const { s, g, add } = setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      const pid = g().phases[0]!.id;
      add();
      add({ phaseId: pid });
      add({ phaseId: 'missing' });
      expect(g().resources.map((r) => r.phaseId)).toEqual([null, pid, null]);
      s().setResourcePhase(g().resources[0]!.id, pid);
      expect(g().resources[0]!.phaseId).toBe(pid);
    });

    it('deleting a phase keeps its resources, unassigned and in order', () => {
      const { s, g, add } = setup();
      s().addPhase({ name: 'Basics', description: '', color: 'blue' });
      const pid = g().phases[0]!.id;
      add({ title: 'A', phaseId: pid });
      add({ title: 'B' });
      s().setPhaseFilter(pid);
      s().deletePhase(pid);
      expect(g().phases).toEqual([]);
      expect(g().resources.map((r) => [r.title, r.phaseId])).toEqual([
        ['A', null],
        ['B', null],
      ]);
      expect(s().ui.phaseFilter).toBeNull();
    });
  });

  it('resets plan-specific view state when switching plans', () => {
    const { s, add } = setup();
    const { id } = add();
    s().selectResource(id);
    s().setTypeFilter('video');
    s().selectGoal(s().data.activeGoalId!);
    expect(s().ui).toMatchObject({ selectedResourceId: null, typeFilter: 'all' });
  });
});
