import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  type AuthProviderId,
  type AuthResult,
  type AuthService,
  type AuthUser,
  type LinkedMethod,
} from '../../auth/types';
import { createEmptyAppData } from '../../domain/backup';
import { parseAppData } from '../../domain/schema';
import type { AppData, Goal } from '../../domain/types';
import { RepositoryError, type RepositoryErrorCode } from '../../repositories/errors';
import type { AppRepository } from '../../repositories/types';
import type { Backend } from '../types';

/**
 * An in-memory backend for unit tests and the e2e build. It follows the same contracts
 * as the real one (per-user data, upserts, atomic replace) and can inject failures.
 * It is never chosen in a production build, and never stands in for a failed backend.
 */
interface Account {
  id: string;
  email: string;
  password: string | null;
  methods: AuthProviderId[];
}

interface Snapshot {
  accounts: Account[];
  data: Record<string, AppData>;
  current: string | null;
}

export interface MemoryOptions {
  /** Sign this account in at start (created if needed). */
  signedInAs?: string;
  /** Require email confirmation after sign-up, like the real backend. */
  confirmEmail?: boolean;
  /** Keeps state across page reloads (e2e only). */
  persist?: Storage;
  persistKey?: string;
}

export interface MemoryBackend extends Backend {
  /** Names of repository calls, in order, including failed ones. */
  calls: string[];
  /** Makes the next `count` repository calls throw before changing anything. */
  failNext(count?: number, code?: RepositoryErrorCode): void;
  /** Delays every repository call until the returned function is called. */
  hold(): () => void;
  dataOf(userId: string): AppData;
  userId(): string | null;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function createMemoryBackend(opts: MemoryOptions = {}): MemoryBackend {
  const key = opts.persistKey ?? 'memory-backend';
  let accounts: Account[] = [];
  let data: Record<string, AppData> = {};
  let current: string | null = null;
  const listeners = new Set<(u: AuthUser | null) => void>();
  const calls: string[] = [];
  let failures = 0;
  let failCode: RepositoryErrorCode = 'network';
  let gate: Promise<void> | null = null;
  let seq = 0;

  try {
    const raw = opts.persist?.getItem(key);
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot;
      accounts = snap.accounts;
      data = snap.data;
      current = snap.current;
    }
  } catch {
    /* start empty */
  }
  const persist = () => {
    try {
      opts.persist?.setItem(key, JSON.stringify({ accounts, data, current } satisfies Snapshot));
    } catch {
      /* ignore */
    }
  };

  const account = (email: string, password: string | null, method: AuthProviderId): Account => {
    let a = accounts.find((x) => x.email === email);
    if (!a) {
      a = {
        id: `user-${++seq}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        password,
        methods: [],
      };
      accounts.push(a);
      data[a.id] = createEmptyAppData();
    }
    if (!a.methods.includes(method)) a.methods.push(method);
    return a;
  };
  if (opts.signedInAs && !current) current = account(opts.signedInAs, 'pw', 'password').id;

  const user = (): AuthUser | null => {
    const a = accounts.find((x) => x.id === current);
    return a ? { id: a.id, email: a.email } : null;
  };
  const emit = () => {
    persist();
    const u = user();
    listeners.forEach((l) => l(u));
  };

  /** Runs one repository call against the current user's data. */
  const run = async <T>(name: string, fn: (d: AppData) => T): Promise<T> => {
    calls.push(name);
    if (gate) await gate;
    if (failures > 0) {
      failures--;
      throw new RepositoryError(failCode, `injected ${failCode} failure`);
    }
    if (!current) throw new RepositoryError('unauthorized', 'not signed in');
    const d = clone(data[current] ?? createEmptyAppData());
    const out = fn(d);
    data[current] = d;
    persist();
    return out;
  };
  const goal = (d: AppData, id: string): Goal => {
    const g = d.goals.find((x) => x.id === id);
    if (!g) throw new RepositoryError('notFound', `plan ${id} not found`);
    return g;
  };
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = clone(item);
    else list.push(clone(item));
  };
  const order = <T extends { id: string }>(list: T[], ids: string[]): T[] => {
    const byId = new Map(list.map((x) => [x.id, x]));
    const ordered = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    return [...ordered, ...list.filter((x) => !ids.includes(x.id))];
  };

  const repo: AppRepository = {
    loadAll: () => run('loadAll', (d) => clone(d)),
    setActiveGoal: (id) =>
      run('setActiveGoal', (d) => {
        d.activeGoalId = id;
      }),
    saveGoal: (g) =>
      run('saveGoal', (d) => {
        const existing = d.goals.find((x) => x.id === g.id);
        if (existing) Object.assign(existing, clone(g));
        else d.goals.push({ ...clone(g), resources: [], phases: [] });
      }),
    saveGoalTree: (g) =>
      run('saveGoalTree', (d) => {
        upsert(d.goals, g);
      }),
    deleteGoal: (id) =>
      run('deleteGoal', (d) => {
        d.goals = d.goals.filter((g) => g.id !== id);
        if (d.activeGoalId === id) d.activeGoalId = d.goals[0]?.id ?? null;
      }),
    saveResource: (goalId, r) => run('saveResource', (d) => upsert(goal(d, goalId).resources, r)),
    deleteResource: (goalId, id) =>
      run('deleteResource', (d) => {
        const g = goal(d, goalId);
        g.resources = g.resources.filter((r) => r.id !== id);
      }),
    reorderResources: (goalId, ids) =>
      run('reorderResources', (d) => {
        const g = goal(d, goalId);
        g.resources = order(g.resources, ids);
      }),
    savePhase: (goalId, p) => run('savePhase', (d) => upsert(goal(d, goalId).phases, p)),
    deletePhase: (goalId, id) =>
      run('deletePhase', (d) => {
        const g = goal(d, goalId);
        g.phases = g.phases.filter((p) => p.id !== id);
        for (const r of g.resources) if (r.phaseId === id) r.phaseId = null;
      }),
    reorderPhases: (goalId, ids) =>
      run('reorderPhases', (d) => {
        const g = goal(d, goalId);
        g.phases = order(g.phases, ids);
      }),
    replaceAll: (next) =>
      run('replaceAll', (d) => {
        const clean = parseAppData(clone(next));
        if (!clean) throw new RepositoryError('validation', 'invalid data');
        Object.assign(d, clean);
      }),
    addGoals: (goals, activeGoalId) =>
      run('addGoals', (d) => {
        const added = parseAppData(clone({ version: 1, activeGoalId: null, goals }));
        if (!added) throw new RepositoryError('validation', 'invalid data');
        for (const g of added.goals) upsert(d.goals, g);
        if (activeGoalId) d.activeGoalId = activeGoalId;
      }),
    deleteAll: () =>
      run('deleteAll', (d) => {
        Object.assign(d, createEmptyAppData());
      }),
  };

  const signInAs = (a: Account): AuthResult => {
    current = a.id;
    emit();
    return 'signedIn';
  };
  const requireUser = (): Account => {
    const a = accounts.find((x) => x.id === current);
    if (!a) throw new AuthError('unknown', 'not signed in');
    return a;
  };

  const assertStrong = (password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError('weakPassword', 'Password too short');
    }
  };

  const auth: AuthService = {
    onChange(cb) {
      listeners.add(cb);
      queueMicrotask(() => {
        if (listeners.has(cb)) cb(user());
      });
      return () => listeners.delete(cb);
    },
    async signInWithProvider(provider) {
      return signInAs(account(`${provider}@example.test`, null, provider));
    },
    async signInWithPassword(email, password) {
      const a = accounts.find((x) => x.email === email && x.password === password);
      if (!a) throw new AuthError('invalidCredentials', 'Invalid email or password');
      return signInAs(a);
    },
    async signUpWithPassword(email, password) {
      assertStrong(password);
      const existing = accounts.find((x) => x.email === email);
      if (existing?.password) throw new AuthError('emailTaken', 'Email already registered');
      const a = account(email, password, 'password');
      a.password = password;
      if (opts.confirmEmail) {
        persist();
        return 'confirmEmail';
      }
      return signInAs(a);
    },
    async sendPasswordReset() {},
    onPasswordRecovery: () => () => {},
    async updatePassword(password) {
      assertStrong(password);
      requireUser().password = password;
      persist();
    },
    async linkProvider(provider) {
      const a = requireUser();
      const other = accounts.find((x) => x.id !== a.id && x.methods.includes(provider));
      if (other && other.email === `${provider}@example.test`) {
        throw new AuthError('alreadyLinked', 'That account is already in use');
      }
      if (!a.methods.includes(provider)) a.methods.push(provider);
      emit();
      return 'done';
    },
    async linkPassword(email, password) {
      const a = requireUser();
      a.password = password;
      a.email = email;
      if (!a.methods.includes('password')) a.methods.push('password');
      emit();
      return 'done';
    },
    async unlinkProvider(provider) {
      const a = requireUser();
      if (a.methods.length <= 1)
        throw new AuthError('lastMethod', 'Cannot remove your last method');
      a.methods = a.methods.filter((m) => m !== provider);
      emit();
    },
    async listMethods(): Promise<LinkedMethod[]> {
      return requireUser().methods.map((provider) => ({ provider, detail: requireUser().email }));
    },
    async signOut() {
      current = null;
      emit();
    },
  };

  return {
    repo,
    auth,
    calls,
    failNext(count = 1, code = 'network') {
      failures = count;
      failCode = code;
    },
    hold() {
      let release!: () => void;
      gate = new Promise<void>((r) => (release = r));
      return () => {
        gate = null;
        release();
      };
    },
    dataOf: (id) => clone(data[id] ?? createEmptyAppData()),
    userId: () => current,
  };
}
