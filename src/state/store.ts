import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { createEmptyAppData, mergePlans } from '../domain/backup';
import { todayISO } from '../domain/dates';
import { uid } from '../domain/format';
import type { RoadmapView } from '../domain/roadmap';
import { progressPatch, statusPatch } from '../domain/resources';
import { parseAppData } from '../domain/schema';
import type { AppData, Goal, Phase, Resource, ResourceStatus, ResourceType } from '../domain/types';
import { describeAuthError } from '../auth/describe';
import type { AuthProviderId, AuthResult, AuthUser, LinkedMethod } from '../auth/types';
import { createBackend } from '../backend';
import type { Backend } from '../backend/types';
import { describeError } from '../repositories/errors';
import { diffData } from './syncOps';
import { IDLE_SYNC, WriteQueue, type SyncState } from './writeQueue';

export type Page = 'dashboard' | 'plans';
export type Overlay =
  | { kind: 'goal'; goalId: string | null }
  | { kind: 'resource'; resourceId: string | null; phaseId?: string | null }
  | { kind: 'phase'; phaseId: string | null }
  | { kind: 'details'; resourceId: string }
  | { kind: 'data' }
  | { kind: 'account' };

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

export type AuthState =
  { status: 'loading' | 'signedOut'; user: null } | { status: 'signedIn'; user: AuthUser };

export interface LoadState {
  /** `error` means the data could not be loaded, which is not the same as having none. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

/** Result of a sign-in step: what happened next, or text to show the user. */
export type AuthOutcome = { ok: true; result: AuthResult } | { ok: false; error: string };

export interface Store {
  data: AppData;
  ui: UiState;
  auth: AuthState;
  load: LoadState;
  /** Whether the backend has confirmed the latest changes. */
  sync: SyncState;
  /** A restore, add or delete-all is running; further ones are refused. */
  busy: boolean;

  /** Starts watching the session and loads the signed-in user's data. Returns a cleanup. */
  init(): () => void;
  reload(): Promise<void>;
  /** Saves again from the failed write on. */
  retrySync(): void;
  signInWithProvider(p: Exclude<AuthProviderId, 'password'>): Promise<AuthOutcome>;
  signInWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signUpWithPassword(email: string, password: string): Promise<AuthOutcome>;
  sendPasswordReset(email: string): Promise<AuthOutcome>;
  linkProvider(p: Exclude<AuthProviderId, 'password'>): Promise<AuthOutcome>;
  linkPassword(email: string, password: string): Promise<AuthOutcome>;
  unlinkProvider(p: AuthProviderId): Promise<AuthOutcome>;
  listMethods(): Promise<LinkedMethod[]>;
  signOut(): Promise<AuthOutcome>;

  selectGoal(id: string): void;
  createGoal(input: GoalInput): void;
  updateGoal(id: string, input: GoalInput): void;
  deleteGoal(id: string): void;
  duplicateGoal(id: string): void;

  addResource(input: ResourceInput): void;
  updateResource(id: string, input: ResourceInput): void;
  deleteResource(id: string): void;
  moveResource(id: string, dir: -1 | 1): void;
  /** Drag and drop: puts a resource right before or after another one. */
  placeResource(id: string, targetId: string, after: boolean): void;
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

  /**
   * Replaces all saved data with a checked backup, in one atomic backend call. Memory
   * changes only after the backend confirms, so a failure changes nothing. Returns whether
   * it worked. Keeps the backup overlay open so it can show the result.
   */
  restoreBackup(data: AppData): Promise<boolean>;
  /** Adds the plans from a checked file next to the saved ones (see `mergePlans`), the same way. */
  addPlans(data: AppData): Promise<boolean>;
  /** Deletes all saved data, the same way. Closes overlays on success. */
  deleteAllData(): Promise<boolean>;
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

function place<T extends { id: string }>(list: T[], id: string, targetId: string, after: boolean) {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0 || id === targetId || !list.some((x) => x.id === targetId)) return;
  const [item] = list.splice(i, 1);
  const j = list.findIndex((x) => x.id === targetId);
  list.splice(after ? j + 1 : j, 0, item!);
}

let toastSeq = 0;

export function createAppStore({ repo, auth }: Backend) {
  return create<Store>()((set, get) => {
    const queue = new WriteQueue((sync) => set({ sync }));
    let userId: string | null = null;
    let loadSeq = 0;

    /**
     * Applies a change to the data in memory at once, then saves it through the write queue.
     * `ui` may be a function, evaluated after the recipe runs. A `toast` in it is shown only
     * once the backend has confirmed the save.
     */
    const commit = (
      recipe: (d: Draft<AppData>) => void | AppData,
      ui?: Partial<UiState> | (() => Partial<UiState>),
    ) => {
      const prev = get().data;
      const data = produce(prev, recipe);
      const { toast: confirmed, ...patch } = (typeof ui === 'function' ? ui() : ui) ?? {};
      set((s) => ({ data, ui: ui ? { ...s.ui, ...patch } : s.ui }));
      const ops = diffData(prev, data, repo);
      if (confirmed) {
        if (ops.length === 0) set((s) => ({ ui: { ...s.ui, toast: confirmed } }));
        else ops[ops.length - 1]!.after = () => set((s) => ({ ui: { ...s.ui, toast: confirmed } }));
      }
      queue.enqueue(ops);
    };
    /**
     * Swaps in whole new data, unlike `commit()`: the backend call runs on its own, after
     * anything in flight, and memory only changes if it succeeds, so a failed restore or
     * delete never looks like it worked. Refuses a second one while one is running.
     */
    const replaceData = async (
      save: (clean: AppData) => Promise<void>,
      next: AppData,
      ui?: Partial<UiState>,
    ): Promise<boolean> => {
      if (get().busy) return false;
      const clean = parseAppData(JSON.parse(JSON.stringify(next)));
      if (!clean) return false;
      set({ busy: true });
      try {
        await queue.exclusive(() => save(clean));
        set((s) => ({ data: clean, ui: { ...s.ui, ...planUi(), ...ui } }));
        return true;
      } catch {
        return false;
      } finally {
        set({ busy: false });
      }
    };

    const loadData = async () => {
      const seq = ++loadSeq;
      set({ load: { status: 'loading', error: null } });
      try {
        const loaded = await repo.loadAll();
        if (seq !== loadSeq) return;
        set({
          data: parseAppData(loaded) ?? createEmptyAppData(),
          load: { status: 'ready', error: null },
        });
      } catch (e) {
        if (seq !== loadSeq) return;
        set({ load: { status: 'error', error: describeError(e) } });
      }
    };
    /** Starts over for another user, or for nobody: nothing of the old user stays in memory. */
    const handleUser = (user: AuthUser | null) => {
      if (user && user.id === userId) {
        set({ auth: { status: 'signedIn', user } });
        return;
      }
      userId = user?.id ?? null;
      loadSeq++;
      queue.clear();
      const reset = { data: createEmptyAppData(), ui: freshUi(), sync: IDLE_SYNC, busy: false };
      if (!user) {
        set({
          ...reset,
          auth: { status: 'signedOut', user: null },
          load: { status: 'idle', error: null },
        });
        return;
      }
      set({ ...reset, auth: { status: 'signedIn', user } });
      void loadData();
    };

    const attempt = async (fn: () => Promise<AuthResult | void>): Promise<AuthOutcome> => {
      try {
        return { ok: true, result: (await fn()) ?? 'done' };
      } catch (e) {
        return { ok: false, error: describeAuthError(e) };
      }
    };

    const setUi = (ui: Partial<UiState>) => set((s) => ({ ui: { ...s.ui, ...ui } }));
    const toast = (text: string) => ({ toast: { id: ++toastSeq, text } });
    const resource = (d: Draft<AppData>, id: string) =>
      activeOf(d)?.resources.find((x) => x.id === id);

    return {
      data: createEmptyAppData(),
      ui: freshUi(),
      auth: { status: 'loading', user: null },
      load: { status: 'idle', error: null },
      sync: IDLE_SYNC,
      busy: false,

      init: () => {
        const stop = auth.onChange((user) => handleUser(user));
        // Warn before leaving the page with changes the backend has not confirmed.
        const warn = (e: BeforeUnloadEvent) => {
          if (get().sync.status === 'saving' || get().sync.status === 'error') e.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => {
          stop();
          window.removeEventListener('beforeunload', warn);
        };
      },
      reload: loadData,
      retrySync: () => queue.retry(),
      signInWithProvider: (p) => attempt(() => auth.signInWithProvider(p)),
      signInWithPassword: (e, p) => attempt(() => auth.signInWithPassword(e, p)),
      signUpWithPassword: (e, p) => attempt(() => auth.signUpWithPassword(e, p)),
      sendPasswordReset: (e) => attempt(() => auth.sendPasswordReset(e)),
      linkProvider: (p) => attempt(() => auth.linkProvider(p)),
      linkPassword: (e, p) => attempt(() => auth.linkPassword(e, p)),
      unlinkProvider: (p) => attempt(() => auth.unlinkProvider(p)),
      listMethods: () => auth.listMethods().catch(() => []),
      signOut: () => attempt(() => auth.signOut()),

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

      placeResource: (id, targetId, after) =>
        commit((d) => {
          const g = activeOf(d);
          if (g) place(g.resources, id, targetId, after);
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

      restoreBackup: (data) =>
        replaceData((clean) => repo.replaceAll(clean), data, { overlay: { kind: 'data' } }),

      addPlans: (data) =>
        replaceData((clean) => repo.replaceAll(clean), mergePlans(get().data, data), {
          overlay: { kind: 'data' },
        }),

      deleteAllData: () =>
        replaceData(
          () => repo.deleteAll(),
          createEmptyAppData(),
          toast('All Road to Goals data deleted'),
        ),
    };
  });
}

/**
 * Composition root: the backend comes from `createBackend()` and nothing else in the UI
 * or state layer knows which one it is. Without configuration the store is wired to a
 * backend that fails every call, and `App` shows `backendConfigError` instead.
 */
const created = createBackend(import.meta.env);
/** The wired backend, exposed so tests can seed and break the in-memory one. */
export const currentBackend: Backend | null = 'backend' in created ? created.backend : null;
export const backendConfigError = 'configError' in created ? created.configError : null;
const unavailable = (): never => {
  throw new Error(backendConfigError ?? 'Backend not configured');
};
export const useStore = createAppStore(
  'backend' in created
    ? created.backend
    : {
        repo: new Proxy({}, { get: () => unavailable }) as Backend['repo'],
        auth: new Proxy({}, { get: () => unavailable }) as Backend['auth'],
      },
);

export function useActiveGoal(): Goal | null {
  return useStore((s) => s.data.goals.find((g) => g.id === s.data.activeGoalId) ?? null);
}
