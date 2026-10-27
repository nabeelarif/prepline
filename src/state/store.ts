import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { todayISO } from '../domain/dates';
import { uid } from '../domain/format';
import type { RoadmapView } from '../domain/roadmap';
import { progressPatch, statusPatch } from '../domain/resources';
import { parseAppData } from '../domain/schema';
import type { AppData, Goal, Phase, Resource, ResourceStatus, ResourceType } from '../domain/types';
import { createLocalStorageAdapter } from '../storage/localStorageAdapter';
import type { StorageAdapter } from '../storage/StorageAdapter';

export type Page = 'dashboard' | 'plans';
export type Overlay =
  | { kind: 'goal'; goalId: string | null }
  | { kind: 'resource'; resourceId: string | null; phaseId?: string | null }
  | { kind: 'phase'; phaseId: string | null }
  | { kind: 'details'; resourceId: string }
  | { kind: 'data' };

export type GoalInput = Pick<Goal, 'name' | 'description' | 'targetDate' | 'hoursPerDay'>;
export type ResourceInput = Pick<
  Resource,
  'url' | 'title' | 'type' | 'minutes' | 'notes' | 'phaseId'
>;
export type PhaseInput = Pick<Phase, 'name' | 'description' | 'color'>;

/** Per-session view state; never persisted. */
export interface UiState {
  page: Page;
  /** Journey shows resources (simple) or phases. */
  view: RoadmapView;
  typeFilter: ResourceType | 'all';
  statusFilter: ResourceStatus | 'all';
  /** Resource list limited to one phase; '' means resources in no phase. */
  phaseFilter: string | null;
  /** Resource picked on the journey, highlighted in the list. */
  selectedResourceId: string | null;
  showFullJourney: boolean;
  /** Mobile navigation drawer. */
  navOpen: boolean;
  overlay: Overlay | null;
  toast: { id: number; text: string } | null;
}

export interface Store {
  data: AppData;
  ui: UiState;
  storageOK: boolean;

  selectGoal(id: string): void;
  createGoal(input: GoalInput): void;
  updateGoal(id: string, input: GoalInput): void;
  deleteGoal(id: string): void;
  duplicateGoal(id: string): void;

  addResource(input: ResourceInput): void;
  updateResource(id: string, input: ResourceInput): void;
  deleteResource(id: string): void;
  moveResource(id: string, dir: -1 | 1): void;
  /** Completes a resource (full credit), or reopens a completed one as In Progress. */
  toggleResource(id: string): void;
  /** Moves a resource to a status; see `statusPatch()` for what each move changes. */
  setStatus(id: string, status: ResourceStatus): void;
  /** Records completed minutes; the full estimate completes the resource. */
  setProgress(id: string, minutes: number): void;
  setResourcePhase(id: string, phaseId: string | null): void;

  addPhase(input: PhaseInput): void;
  updatePhase(id: string, input: PhaseInput): void;
  deletePhase(id: string): void;
  movePhase(id: string, dir: -1 | 1): void;

  setPage(p: Page): void;
  setView(v: RoadmapView): void;
  setTypeFilter(f: UiState['typeFilter']): void;
  setStatusFilter(f: UiState['statusFilter']): void;
  setPhaseFilter(id: string | null): void;
  selectResource(id: string | null): void;
  toggleFullJourney(): void;
  setNavOpen(open: boolean): void;
  openOverlay(o: Overlay): void;
  closeOverlay(): void;
  showToast(text: string): void;
  dismissToast(): void;

  importData(data: AppData): void;
  resetAll(): void;
}

const freshUi = (): UiState => ({
  page: 'dashboard',
  view: 'simple',
  typeFilter: 'all',
  statusFilter: 'all',
  phaseFilter: null,
  selectedResourceId: null,
  showFullJourney: false,
  navOpen: false,
  overlay: null,
  toast: null,
});

/** UI state that belongs to one plan and is reset when the plan changes. */
const planUi = (): Partial<UiState> => ({
  page: 'dashboard',
  typeFilter: 'all',
  statusFilter: 'all',
  phaseFilter: null,
  selectedResourceId: null,
  showFullJourney: false,
  navOpen: false,
  overlay: null,
});

const emptyData = (): AppData => ({ version: 1, activeGoalId: null, goals: [] });

function activeOf(d: Draft<AppData>): Draft<Goal> | undefined {
  return d.goals.find((g) => g.id === d.activeGoalId);
}

/** A phase id that exists in the goal, or null. */
function validPhase(g: Draft<Goal>, id: string | null | undefined): string | null {
  return id && g.phases.some((p) => p.id === id) ? id : null;
}

/** Swaps an item with its neighbour; does nothing at either end. */
function move<T extends { id: string }>(list: T[], id: string, dir: -1 | 1) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
}

let toastSeq = 0;

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
    const toast = (text: string) => ({ toast: { id: ++toastSeq, text } });
    const resource = (d: Draft<AppData>, id: string) =>
      activeOf(d)?.resources.find((x) => x.id === id);

    return {
      data: parseAppData(storage.load()) ?? emptyData(),
      ui: freshUi(),
      storageOK: storage.available,

      selectGoal: (id) =>
        commit((d) => {
          d.activeGoalId = id;
        }, planUi()),

      createGoal: (input) =>
        commit(
          (d) => {
            const g: Goal = {
              id: uid(),
              ...input,
              createdAt: todayISO(),
              resources: [],
              phases: [],
            };
            d.goals.push(g);
            d.activeGoalId = g.id;
          },
          { ...planUi(), ...toast('Plan created') },
        ),

      updateGoal: (id, input) =>
        commit(
          (d) => {
            const g = d.goals.find((x) => x.id === id);
            if (g) Object.assign(g, input);
          },
          { overlay: null, ...toast('Plan saved') },
        ),

      deleteGoal: (id) =>
        commit(
          (d) => {
            d.goals = d.goals.filter((g) => g.id !== id);
            if (d.activeGoalId === id) d.activeGoalId = d.goals[0]?.id ?? null;
          },
          { overlay: null, selectedResourceId: null, phaseFilter: null },
        ),

      // A full copy, progress included, with fresh ids so the two plans never share data.
      duplicateGoal: (id) =>
        commit((d) => {
          const src = get().data.goals.find((g) => g.id === id);
          if (!src) return;
          const phaseIds = new Map(src.phases.map((p) => [p.id, uid()]));
          d.goals.push({
            ...src,
            id: uid(),
            name: `${src.name} (copy)`.slice(0, 120),
            createdAt: todayISO(),
            phases: src.phases.map((p) => ({ ...p, id: phaseIds.get(p.id)! })),
            resources: src.resources.map((r) => ({
              ...r,
              id: uid(),
              phaseId: r.phaseId ? (phaseIds.get(r.phaseId) ?? null) : null,
            })),
          });
        }, toast('Plan duplicated')),

      addResource: (input) =>
        commit(
          (d) => {
            const g = activeOf(d);
            if (!g) return;
            g.resources.push({
              id: uid(),
              doneMinutes: 0,
              done: false,
              doneAt: null,
              startedAt: null,
              createdAt: todayISO(),
              ...input,
              phaseId: validPhase(g, input.phaseId),
            });
          },
          { overlay: null, ...toast('Resource added') },
        ),

      updateResource: (id, input) =>
        commit(
          (d) => {
            const g = activeOf(d);
            const r = g?.resources.find((x) => x.id === id);
            if (!g || !r) return;
            Object.assign(r, input, { phaseId: validPhase(g, input.phaseId) });
            r.doneMinutes = Math.min(r.doneMinutes, r.minutes);
          },
          { overlay: null, ...toast('Resource saved') },
        ),

      deleteResource: (id) =>
        commit(
          (d) => {
            const g = activeOf(d);
            if (g) g.resources = g.resources.filter((x) => x.id !== id);
          },
          () => ({
            overlay: null,
            ...(get().ui.selectedResourceId === id ? { selectedResourceId: null } : {}),
          }),
        ),

      moveResource: (id, dir) =>
        commit((d) => {
          const g = activeOf(d);
          if (g) move(g.resources, id, dir);
        }),

      toggleResource: (id) =>
        commit((d) => {
          const r = resource(d, id);
          if (r) Object.assign(r, statusPatch(r, r.done ? 'in_progress' : 'completed', todayISO()));
        }),

      setStatus: (id, status) =>
        commit((d) => {
          const r = resource(d, id);
          if (r) Object.assign(r, statusPatch(r, status, todayISO()));
        }),

      setProgress: (id, minutes) =>
        commit((d) => {
          const r = resource(d, id);
          if (r) Object.assign(r, progressPatch(r, minutes, todayISO()));
        }),

      setResourcePhase: (id, phaseId) =>
        commit((d) => {
          const g = activeOf(d);
          const r = g?.resources.find((x) => x.id === id);
          if (g && r) r.phaseId = validPhase(g, phaseId);
        }),

      addPhase: (input) =>
        commit(
          (d) => {
            activeOf(d)?.phases.push({ id: uid(), ...input });
          },
          { overlay: null, view: 'phases', ...toast('Phase added') },
        ),

      updatePhase: (id, input) =>
        commit(
          (d) => {
            const p = activeOf(d)?.phases.find((x) => x.id === id);
            if (p) Object.assign(p, input);
          },
          { overlay: null, ...toast('Phase saved') },
        ),

      // Resources in the phase stay in the plan, just without a phase.
      deletePhase: (id) =>
        commit(
          (d) => {
            const g = activeOf(d);
            if (!g) return;
            g.phases = g.phases.filter((p) => p.id !== id);
            for (const r of g.resources) if (r.phaseId === id) r.phaseId = null;
          },
          () => ({
            overlay: null,
            ...(get().ui.phaseFilter === id ? { phaseFilter: null } : {}),
          }),
        ),

      movePhase: (id, dir) =>
        commit((d) => {
          const g = activeOf(d);
          if (g) move(g.phases, id, dir);
        }),

      setPage: (page) => setUi({ page, navOpen: false }),
      setView: (view) => setUi({ view }),
      setTypeFilter: (typeFilter) => setUi({ typeFilter }),
      setStatusFilter: (statusFilter) => setUi({ statusFilter }),
      setPhaseFilter: (phaseFilter) => setUi({ phaseFilter, selectedResourceId: null }),
      // Clears list filters so the picked resource's row is visible.
      selectResource: (selectedResourceId) =>
        setUi(
          selectedResourceId
            ? { selectedResourceId, typeFilter: 'all', statusFilter: 'all', phaseFilter: null }
            : { selectedResourceId },
        ),
      toggleFullJourney: () => setUi({ showFullJourney: !get().ui.showFullJourney }),
      setNavOpen: (navOpen) => setUi({ navOpen }),
      openOverlay: (overlay) => setUi({ overlay }),
      closeOverlay: () => setUi({ overlay: null }),
      showToast: (text) => setUi(toast(text)),
      dismissToast: () => setUi({ toast: null }),

      importData: (data) => commit(() => data, { ...planUi(), ...toast('Backup imported') }),

      resetAll: () => commit(emptyData, planUi()),
    };
  });
}

export const useStore = createAppStore();

export function useActiveGoal(): Goal | null {
  return useStore((s) => s.data.goals.find((g) => g.id === s.data.activeGoalId) ?? null);
}
