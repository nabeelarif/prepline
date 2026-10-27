import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { todayISO } from '../domain/dates';
import { uid } from '../domain/format';
import { isDone } from '../domain/resources';
import { sampleGoal } from '../domain/sample';
import { parseAppData } from '../domain/schema';
import type { AppData, Goal, Rating, Resource } from '../domain/types';
import { createLocalStorageAdapter } from '../storage/localStorageAdapter';
import type { StorageAdapter } from '../storage/StorageAdapter';

export type Filter = 'all' | 'todo' | 'done';
export type Overlay =
  | { kind: 'goal'; goalId: string | null }
  | { kind: 'resource'; resourceId: string | null }
  | { kind: 'data' };

export type GoalInput = Pick<Goal, 'name' | 'targetDate' | 'hoursPerDay'>;
export type ResourceInput = Pick<
  Resource,
  'url' | 'title' | 'type' | 'minutes' | 'notes' | 'sections'
>;

/** Per-session view state; never persisted. */
export interface UiState {
  filter: Filter;
  /** Resource just finished, shown in the rating banner. */
  ratingFor: string | null;
  collapsed: Record<string, true>;
  showAllDays: boolean;
  overlay: Overlay | null;
}

export interface Store {
  data: AppData;
  ui: UiState;
  storageOK: boolean;

  selectGoal(id: string): void;
  createGoal(input: GoalInput): void;
  updateGoal(id: string, input: GoalInput): void;
  deleteGoal(id: string): void;

  addResource(input: ResourceInput): void;
  updateResource(id: string, input: ResourceInput): void;
  deleteResource(id: string): void;
  moveResource(id: string, dir: -1 | 1): void;
  toggleResource(id: string): void;
  toggleSection(resId: string, secId: string): void;
  rate(id: string, rating: Rating): void;
  skipRating(): void;

  setFilter(f: Filter): void;
  toggleCollapsed(id: string): void;
  toggleShowAllDays(): void;
  openOverlay(o: Overlay): void;
  closeOverlay(): void;

  importData(data: AppData): void;
  loadSample(): void;
  resetAll(): void;
}

const freshUi = (): UiState => ({
  filter: 'all',
  ratingFor: null,
  collapsed: {},
  showAllDays: false,
  overlay: null,
});

function initialData(storage: StorageAdapter): AppData {
  const saved = parseAppData(storage.load());
  if (saved) return saved;
  const g = sampleGoal();
  return { version: 1, activeGoalId: g.id, goals: [g] };
}

function activeOf(d: Draft<AppData>): Draft<Goal> | undefined {
  return d.goals.find((g) => g.id === d.activeGoalId);
}

export function createAppStore(storage: StorageAdapter = createLocalStorageAdapter()) {
  return create<Store>()((set, get) => {
    /**
     * Applies a change to the saved data, persists it, and optionally updates UI state.
     * `ui` may be a function, evaluated after the recipe runs.
     */
    const commit = (
      recipe: (d: Draft<AppData>) => void | AppData,
      ui?: Partial<UiState> | (() => Partial<UiState>),
    ) => {
      const data = produce(get().data, recipe);
      const storageOK = storage.save(data);
      const patch = typeof ui === 'function' ? ui() : ui;
      set((s) => ({ data, storageOK, ui: patch ? { ...s.ui, ...patch } : s.ui }));
    };
    const setUi = (ui: Partial<UiState>) => set((s) => ({ ui: { ...s.ui, ...ui } }));
    const ratingFor = () => get().ui.ratingFor;

    return {
      data: initialData(storage),
      ui: freshUi(),
      storageOK: storage.available,

      selectGoal: (id) =>
        commit(
          (d) => {
            d.activeGoalId = id;
          },
          { showAllDays: false, ratingFor: null, filter: 'all' },
        ),

      createGoal: (input) =>
        commit(
          (d) => {
            const g: Goal = {
              id: uid(),
              ...input,
              sample: false,
              createdAt: todayISO(),
              resources: [],
            };
            d.goals.push(g);
            d.activeGoalId = g.id;
          },
          { filter: 'all', showAllDays: false, ratingFor: null, overlay: null },
        ),

      updateGoal: (id, input) =>
        commit(
          (d) => {
            const g = d.goals.find((x) => x.id === id);
            if (g) Object.assign(g, input, { sample: false });
          },
          { overlay: null },
        ),

      deleteGoal: (id) =>
        commit(
          (d) => {
            d.goals = d.goals.filter((g) => g.id !== id);
            d.activeGoalId = d.goals[0]?.id ?? null;
          },
          { ratingFor: null, filter: 'all', showAllDays: false, overlay: null },
        ),

      addResource: (input) =>
        commit(
          (d) => {
            const g = activeOf(d);
            if (!g) return;
            g.resources.push({ id: uid(), done: false, doneAt: null, rating: null, ...input });
            g.sample = false;
          },
          { overlay: null },
        ),

      updateResource: (id, input) =>
        commit(
          (d) => {
            const g = activeOf(d);
            const r = g?.resources.find((x) => x.id === id);
            if (!g || !r) return;
            Object.assign(r, input);
            g.sample = false;
          },
          { overlay: null },
        ),

      deleteResource: (id) =>
        commit(
          (d) => {
            const g = activeOf(d);
            if (g) g.resources = g.resources.filter((x) => x.id !== id);
          },
          ratingFor() === id ? { ratingFor: null } : undefined,
        ),

      moveResource: (id, dir) =>
        commit((d) => {
          const g = activeOf(d);
          if (!g) return;
          const i = g.resources.findIndex((x) => x.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= g.resources.length) return;
          [g.resources[i], g.resources[j]] = [g.resources[j]!, g.resources[i]!];
        }),

      // Finishing a resource (or its last section) opens the rating banner for it.
      toggleResource: (id) => {
        let next = ratingFor();
        commit(
          (d) => {
            const r = activeOf(d)?.resources.find((x) => x.id === id);
            if (!r) return;
            r.done = !r.done;
            r.doneAt = r.done ? todayISO() : null;
            if (r.done) next = r.id;
            else if (next === r.id) next = null;
          },
          () => ({ ratingFor: next }),
        );
      },

      toggleSection: (resId, secId) => {
        let next = ratingFor();
        commit(
          (d) => {
            const r = activeOf(d)?.resources.find((x) => x.id === resId);
            const s = r?.sections.find((x) => x.id === secId);
            if (!r || !s) return;
            s.done = !s.done;
            s.doneAt = s.done ? todayISO() : null;
            if (s.done && isDone(r)) next = r.id;
            else if (!s.done && next === r.id) next = null;
          },
          () => ({ ratingFor: next }),
        );
      },

      rate: (id, rating) =>
        commit(
          (d) => {
            const r = activeOf(d)?.resources.find((x) => x.id === id);
            if (r) r.rating = rating;
          },
          ratingFor() === id ? { ratingFor: null } : undefined,
        ),

      skipRating: () => setUi({ ratingFor: null }),

      setFilter: (filter) => setUi({ filter }),
      toggleCollapsed: (id) => {
        const collapsed = { ...get().ui.collapsed };
        if (collapsed[id]) delete collapsed[id];
        else collapsed[id] = true;
        setUi({ collapsed });
      },
      toggleShowAllDays: () => setUi({ showAllDays: !get().ui.showAllDays }),
      openOverlay: (overlay) => setUi({ overlay }),
      closeOverlay: () => setUi({ overlay: null }),

      importData: (data) =>
        commit(() => data, { ratingFor: null, filter: 'all', showAllDays: false, overlay: null }),

      loadSample: () =>
        commit(
          (d) => {
            const s = sampleGoal();
            d.goals.push(s);
            d.activeGoalId = s.id;
          },
          { ratingFor: null, filter: 'all', overlay: null },
        ),

      resetAll: () =>
        commit(() => ({ version: 1, activeGoalId: null, goals: [] }), {
          ratingFor: null,
          overlay: null,
        }),
    };
  });
}

export const useStore = createAppStore();

export function useActiveGoal(): Goal | null {
  return useStore((s) => s.data.goals.find((g) => g.id === s.data.activeGoalId) ?? null);
}
