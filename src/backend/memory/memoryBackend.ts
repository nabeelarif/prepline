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
import { addDays, todayISO } from '../../domain/dates';
import { parseAppData } from '../../domain/schema';
import type { StudyLog } from '../../domain/studyLog';
import type { AppData, Goal } from '../../domain/types';
import { RepositoryError, type RepositoryErrorCode } from '../../repositories/errors';
import {
  cleanTags,
  MAX_DISPLAY_NAME,
  randomDisplayName,
  type PlanSharing,
  type Visibility,
  type PlanSummary,
  type SharedPlan,
} from '../../domain/share';
import type { UrlEnricher, UrlInfo } from '../../repositories/enrich';
import type { PlanSharingRepository } from '../../repositories/sharing';
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

/** A shared plan's settings, stored per owner and plan like the `plan_shares` table. */
interface Share {
  visibility: Exclude<Visibility, 'private'>;
  slug: string;
  tags: string[];
  hidden: boolean;
  publishedAt: string;
  /** Ids of the people who copied it, so each counts once. */
  copiedBy: string[];
}

interface Snapshot {
  accounts: Account[];
  data: Record<string, AppData>;
  current: string | null;
  shares?: Record<string, Record<string, Share>>;
  names?: Record<string, string>;
  study?: Record<string, StudyLog>;
  reports?: { slug: string; by: string; reason: string }[];
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
  /** Registers what a link lookup returns (tests and the e2e build have no network). */
  setUrlInfo(url: string, info: UrlInfo): void;
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
  let shares: Record<string, Record<string, Share>> = {};
  let names: Record<string, string> = {};
  let study: Record<string, StudyLog> = {};
  let reports: { slug: string; by: string; reason: string }[] = [];

  try {
    const raw = opts.persist?.getItem(key);
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot;
      accounts = snap.accounts;
      data = snap.data;
      current = snap.current;
      shares = snap.shares ?? {};
      names = snap.names ?? {};
      study = snap.study ?? {};
      reports = snap.reports ?? [];
    }
  } catch {
    /* start empty */
  }
  const persist = () => {
    try {
      opts.persist?.setItem(
        key,
        JSON.stringify({
          accounts,
          data,
          current,
          shares,
          names,
          study,
          reports,
        } satisfies Snapshot),
      );
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
      // Like the database trigger: every account starts with a name, which can be changed.
      names[a.id] = randomDisplayName();
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
    // A plan that no longer exists is no longer shared.
    const mine = shares[current];
    if (mine)
      for (const id of Object.keys(mine)) if (!d.goals.some((g) => g.id === id)) delete mine[id];
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
    addGoals: (goals, activeGoalId) =>
      run('addGoals', (d) => {
        const added = parseAppData(clone({ version: 1, activeGoalId: null, goals }));
        if (!added) throw new RepositoryError('validation', 'invalid data');
        for (const g of added.goals) upsert(d.goals, g);
        if (activeGoalId) d.activeGoalId = activeGoalId;
      }),
    loadStudyLog: (days) =>
      run('loadStudyLog', () => {
        const since = addDays(todayISO(), -days);
        return Object.fromEntries(
          Object.entries(study[current!] ?? {}).filter(([day]) => day >= since),
        );
      }),
    saveStudyDay: (day, minutes) =>
      run('saveStudyDay', () => {
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)
          throw new RepositoryError('validation', 'minutes out of range');
        const mine = (study[current!] ??= {});
        if (minutes > 0) mine[day] = minutes;
        else delete mine[day];
      }),
    deleteAll: () =>
      run('deleteAll', (d) => {
        Object.assign(d, createEmptyAppData());
        delete study[current!];
      }),
  };

  /** A trimmed display name, or undefined for none. Too long is rejected. */
  const validName = (raw: string): string | undefined => {
    const n = raw.trim();
    if (n.length > MAX_DISPLAY_NAME) throw new RepositoryError('validation', 'name too long');
    return n || undefined;
  };
  const saveName = (me: string, name: string | undefined) => {
    if (name) names[me] = name;
    else delete names[me];
  };

  /** Like `run`, for sharing calls: honours holds and injected failures. */
  const shared = async <T>(
    name: string,
    needsUser: boolean,
    fn: (userId: string) => T,
  ): Promise<T> => {
    calls.push(name);
    if (gate) await gate;
    if (failures > 0) {
      failures--;
      throw new RepositoryError(failCode, `injected ${failCode} failure`);
    }
    if (needsUser && !current) throw new RepositoryError('unauthorized', 'not signed in');
    const out = fn(current ?? '');
    persist();
    return out;
  };
  /** Every share with its owner, for lookups across users. */
  const allShares = () =>
    Object.entries(shares).flatMap(([owner, byGoal]) =>
      Object.entries(byGoal).map(([goalId, share]) => ({ owner, goalId, share })),
    );
  const findShare = (slug: string) =>
    allShares().find((f) => f.share.slug === slug && !f.share.hidden) ?? null;
  const toSettings = (s: Share): PlanSharing => ({
    visibility: s.visibility,
    slug: s.slug,
    tags: s.tags,
    hidden: s.hidden,
    copyCount: s.copiedBy.length,
  });
  const toShared = (f: NonNullable<ReturnType<typeof findShare>>): SharedPlan => {
    const g = data[f.owner]!.goals.find((x) => x.id === f.goalId)!;
    // Content only: this is what other people may see.
    return clone({
      slug: f.share.slug,
      visibility: f.share.visibility,
      name: g.name,
      description: g.description,
      author: names[f.owner] ?? null,
      tags: f.share.tags,
      publishedAt: f.share.publishedAt,
      copyCount: f.share.copiedBy.length,
      phases: g.phases,
      resources: g.resources.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        type: r.type,
        minutes: r.minutes,
        notes: r.notes,
        phaseId: r.phaseId,
      })),
    });
  };
  const toSummary = (p: SharedPlan): PlanSummary => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    author: p.author,
    tags: p.tags,
    publishedAt: p.publishedAt,
    copyCount: p.copyCount,
    phaseCount: p.phases.length,
    resourceCount: p.resources.length,
    totalMinutes: p.resources.reduce((n, r) => n + r.minutes, 0),
  });

  /** Public, visible plans with at least one resource (an empty plan is not listed). */
  const listed = () =>
    allShares()
      .filter((f) => f.share.visibility === 'public' && !f.share.hidden)
      .map(toShared)
      .filter((p) => p.resources.length > 0);

  const sharing: PlanSharingRepository = {
    getShared: (slug) =>
      shared('getShared', false, () => {
        const f = findShare(slug);
        return f ? toShared(f) : null;
      }),
    listPublic: (q = {}) =>
      shared('listPublic', false, () => {
        const needle = (q.query ?? '').trim().toLowerCase();
        return listed()
          .filter(
            (p) =>
              (!needle ||
                p.name.toLowerCase().includes(needle) ||
                p.description.toLowerCase().includes(needle) ||
                p.tags.some((t) => t.includes(needle))) &&
              (!q.tag || p.tags.includes(q.tag.toLowerCase())),
          )
          .sort(
            (a, b) =>
              (q.sort === 'popular' ? b.copyCount - a.copyCount : 0) ||
              b.publishedAt.localeCompare(a.publishedAt) ||
              a.slug.localeCompare(b.slug),
          )
          .slice(q.offset ?? 0, (q.offset ?? 0) + Math.min(50, Math.max(1, q.limit ?? 24)))
          .map(toSummary);
      }),
    listPopularTags: (limit = 20) =>
      shared('listPopularTags', false, () => {
        const counts = new Map<string, number>();
        for (const p of listed()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
        return [...counts]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
          .slice(0, Math.min(50, Math.max(1, limit)));
      }),
    listSimilar: (slug, limit = 6) =>
      shared('listSimilar', false, () => {
        const me = findShare(slug);
        if (!me) return [];
        const mine = new Set(me.share.tags);
        return listed()
          .filter((p) => p.slug !== slug)
          .map((p) => ({ p, overlap: p.tags.filter((t) => mine.has(t)).length }))
          .filter((x) => x.overlap > 0)
          .sort(
            (a, b) =>
              b.overlap - a.overlap ||
              b.p.copyCount - a.p.copyCount ||
              a.p.slug.localeCompare(b.p.slug),
          )
          .slice(0, Math.min(24, Math.max(1, limit)))
          .map((x) => toSummary(x.p));
      }),
    loadSharing: () =>
      shared('loadSharing', true, (me) => ({
        plans: Object.fromEntries(
          Object.entries(shares[me] ?? {}).map(([id, s]) => [id, toSettings(s)]),
        ),
        displayName: names[me] ?? null,
      })),
    setSharing: (goalId, visibility, tags) =>
      shared('setSharing', true, (me) => {
        const g = (data[me] ?? createEmptyAppData()).goals.find((x) => x.id === goalId);
        if (!g) throw new RepositoryError('notFound', 'plan not found');
        const mine = (shares[me] ??= {});
        if (visibility === 'private') {
          delete mine[goalId];
          return { visibility: 'private', slug: null, tags: [], hidden: false, copyCount: 0 };
        }
        if (visibility === 'public') {
          if (!names[me]) {
            throw new RepositoryError(
              'validation',
              'set a display name before making a plan public',
            );
          }
          const others = Object.entries(mine).filter(
            ([id, s]) => id !== goalId && s.visibility === 'public',
          );
          if (others.length >= 20)
            throw new RepositoryError('validation', 'at most 20 public plans');
        }
        const existing = mine[goalId];
        const next: Share = {
          visibility,
          tags: cleanTags(tags),
          hidden: existing?.hidden ?? false,
          slug: existing?.slug ?? `s${++seq}${Math.random().toString(36).slice(2, 10)}`,
          publishedAt: existing?.publishedAt ?? new Date().toISOString(),
          copiedBy: existing?.copiedBy ?? [],
        };
        mine[goalId] = next;
        return toSettings(next);
      }),
    setDisplayName: (name) =>
      shared('setDisplayName', true, (me) => {
        const clean = validName(name);
        if (!clean) throw new RepositoryError('validation', 'a display name cannot be empty');
        saveName(me, clean);
      }),
    recordCopy: (slug) =>
      shared('recordCopy', true, (me) => {
        const f = findShare(slug);
        if (f && f.owner !== me && !f.share.copiedBy.includes(me)) f.share.copiedBy.push(me);
      }),
    report: (slug, reason) =>
      shared('report', true, (me) => {
        if (!Object.values(shares).some((b) => Object.values(b).some((s) => s.slug === slug))) {
          throw new RepositoryError('notFound', 'plan not found');
        }
        if (!reports.some((r) => r.slug === slug && r.by === me)) {
          reports.push({ slug, by: me, reason: reason.trim().slice(0, 500) });
        }
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
    async signUpWithPassword(email, password, displayName) {
      assertStrong(password);
      const existing = accounts.find((x) => x.email === email);
      if (existing?.password) throw new AuthError('emailTaken', 'Email already registered');
      const a = account(email, password, 'password');
      a.password = password;
      const name = displayName?.trim().slice(0, MAX_DISPLAY_NAME);
      if (name && !existing) names[a.id] = name;
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
    async deleteAccount() {
      const me = requireUser();
      // Plans the user shared go with them; copies others made are separate plans.
      accounts = accounts.filter((a) => a.id !== me.id);
      delete data[me.id];
      delete shares[me.id];
      delete names[me.id];
      delete study[me.id];
      reports = reports.filter((r) => r.by !== me.id);
      current = null;
      persist();
      emit();
    },
  };

  // Link lookups: only what a test or the e2e page registered; there is no network here.
  const urlInfo = new Map<string, UrlInfo>();
  const enricher: UrlEnricher = { enrich: async (url) => urlInfo.get(url) ?? null };

  return {
    repo,
    sharing,
    auth,
    enricher,
    setUrlInfo: (url: string, info: UrlInfo) => void urlInfo.set(url, info),
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
