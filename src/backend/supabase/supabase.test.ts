import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError } from '../../auth/types';
import { RepositoryError } from '../../repositories/errors';
import { goal, res } from '../../test/fixtures';
import { toAuthError, toRepositoryError } from './errors';
import { createSupabaseRepository } from './repository';
import { createSupabaseSharing } from './sharing';
import { goalTreePayload, rowsToAppData } from './rows';

/** A fake client that records table and RPC calls and answers from a script. */
function fakeClient(answer: (call: string, args?: unknown) => { data?: unknown; error?: unknown }) {
  const calls: { call: string; args?: unknown }[] = [];
  const respond = (call: string, args?: unknown) => {
    calls.push({ call, args });
    const { data = null, error = null } = answer(call, args);
    return Promise.resolve({ data, error });
  };
  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    const then = (cb: (v: unknown) => unknown) => respond(`${name}.select`).then(cb);
    Object.assign(chain, {
      select: () => chain,
      order: () => chain,
      gte: () => chain,
      maybeSingle: () => respond(`${name}.maybeSingle`),
      delete: () => {
        const filters: unknown[] = [];
        const del: Record<string, unknown> = {
          eq: (col: string, v: unknown) => (filters.push([col, v]), del),
          then: (cb: (v: unknown) => unknown) => respond(`${name}.delete`, filters).then(cb),
        };
        return del;
      },
      then,
    });
    return chain;
  };
  const client = {
    from: table,
    rpc: (fn: string, args: unknown) => respond(`rpc:${fn}`, args),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('row mapping', () => {
  const g = goal(
    [res({ id: 'r1', phaseId: 'p1', done: true, doneAt: '2026-03-11' }), res({ id: 'r2' })],
    {
      id: 'g1',
      hoursPerDay: 1.5,
      phases: [{ id: 'p1', name: 'A', description: '', color: 'blue' }],
    },
  );

  it('builds app data from rows in position order, repairing odd values', () => {
    const data = rowsToAppData(
      [
        {
          id: 'g2',
          name: 'Second',
          description: '',
          start_date: '2026-01-01',
          target_date: '2026-05-01',
          hours_per_day: null,
          source_slug: null,
          source_name: null,
          created_at: '2026-01-01',
          position: 1,
        },
        {
          id: 'g1',
          name: 'First',
          description: '',
          start_date: '2026-01-01',
          target_date: '2026-05-01',
          hours_per_day: '1.50',
          source_slug: null,
          source_name: null,
          created_at: '2026-01-01',
          position: 0,
        },
      ],
      [{ id: 'p1', goal_id: 'g1', name: 'A', description: '', color: 'blue', position: 0 }],
      [
        {
          id: 'b',
          goal_id: 'g1',
          title: 'B',
          url: '',
          type: 'watch',
          minutes: 30,
          done_minutes: 0,
          notes: '',
          done: false,
          done_at: null,
          started_at: null,
          logged_on: null,
          logged_minutes: 0,
          phase_id: 'p1',
          created_at: '2026-01-01',
          position: 1,
        },
        {
          id: 'a',
          goal_id: 'g1',
          title: 'A',
          url: '',
          type: 'read',
          minutes: 30,
          done_minutes: 10,
          notes: 'n',
          done: false,
          done_at: null,
          started_at: null,
          logged_on: null,
          logged_minutes: 0,
          phase_id: null,
          created_at: '2026-01-01',
          position: 0,
        },
      ],
      'g2',
    );
    expect(data.goals.map((x) => x.id)).toEqual(['g1', 'g2']);
    expect(data.activeGoalId).toBe('g2');
    expect(data.goals[0]!.hoursPerDay).toBe(1.5);
    expect(data.goals[0]!.resources.map((r) => r.id)).toEqual(['a', 'b']);
    expect(data.goals[0]!.resources[1]!.phaseId).toBe('p1');
  });

  it('treats no rows and no profile as an empty account', () => {
    expect(rowsToAppData([], [], [], null)).toEqual({ version: 1, activeGoalId: null, goals: [] });
  });

  it('writes snake_case payloads that carry no user id', () => {
    const payload = goalTreePayload(g);
    expect(payload).toMatchObject({ id: 'g1', target_date: g.targetDate, hours_per_day: 1.5 });
    expect(payload.resources[0]).toMatchObject({
      done_minutes: 0,
      done_at: '2026-03-11',
      phase_id: 'p1',
    });
    expect(JSON.stringify(payload)).not.toMatch(/user_id/);
  });
});

describe('error mapping', () => {
  it.each([
    [{ message: 'TypeError: Failed to fetch' }, 'network'],
    [{ code: '42501', message: 'rls' }, 'unauthorized'],
    [{ code: 'PGRST301', message: 'jwt' }, 'unauthorized'],
    [{ code: '23503', message: 'fk' }, 'conflict'],
    [{ code: '23514', message: 'check' }, 'validation'],
    [{ code: 'XX000', message: 'boom' }, 'unknown'],
  ])('maps %j to %s', (failure, code) => {
    const e = toRepositoryError(failure);
    expect(e).toBeInstanceOf(RepositoryError);
    expect(e.code).toBe(code);
  });

  it('maps auth failures and keeps the app errors', () => {
    expect(toAuthError({ code: 'invalid_credentials', message: 'x' }).code).toBe(
      'invalidCredentials',
    );
    expect(toAuthError({ code: 'identity_already_exists', message: 'x' }).code).toBe(
      'alreadyLinked',
    );
    expect(toAuthError({ name: 'AuthRetryableFetchError', message: 'x' }).code).toBe('network');
    const own = new AuthError('lastMethod', 'x');
    expect(toAuthError(own)).toBe(own);
  });
});

describe('repository', () => {
  it('loads in one RPC call and reports a failed read as an error, not empty data', async () => {
    const empty = { goals: [], phases: [], resources: [], active_goal_id: null };
    const ok = fakeClient(() => ({ data: empty }));
    const loaded = await createSupabaseRepository(ok.client).loadAll();
    expect(loaded.goals).toEqual([]);
    expect(ok.calls.map((c) => c.call)).toEqual(['rpc:load_all_data']);

    const failing = fakeClient(() => ({ error: { message: 'Failed to fetch' } }));
    await expect(createSupabaseRepository(failing.client).loadAll()).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('sends every multi-row write as one RPC call, and deletes by id', async () => {
    const { client, calls } = fakeClient(() => ({}));
    const repo = createSupabaseRepository(client);
    const g = goal([res({ id: 'r1' })], { id: 'g1' });
    await repo.saveGoalTree(g);
    await repo.addGoals([g], 'g1');
    await repo.reorderResources('g1', ['r1']);
    await repo.deleteAll();
    await repo.deleteResource('g1', 'r1');
    expect(calls.map((c) => c.call)).toEqual([
      'rpc:save_goal_tree',
      'rpc:append_goals',
      'rpc:reorder_resources',
      'rpc:delete_all_data',
      'resources.delete',
    ]);
    expect(calls[4]!.args).toEqual([
      ['goal_id', 'g1'],
      ['id', 'r1'],
    ]);
  });

  it('saves a study day through one RPC and reads the log as a day map', async () => {
    const { client, calls } = fakeClient((call) =>
      call === 'study_log.select' ? { data: [{ day: '2026-03-10', minutes: 40 }] } : {},
    );
    const repo = createSupabaseRepository(client);
    await repo.saveStudyDay('2026-03-10', 40);
    expect(calls[0]).toEqual({
      call: 'rpc:save_study_day',
      args: { p_day: '2026-03-10', p_minutes: 40 },
    });
    expect(await repo.loadStudyLog(371)).toEqual({ '2026-03-10': 40 });
  });

  it('throws app-level errors for failed writes', async () => {
    const { client } = fakeClient(() => ({ error: { code: '23514', message: 'check' } }));
    await expect(
      createSupabaseRepository(client).saveResource('g', res({ id: 'r' })),
    ).rejects.toMatchObject({
      name: 'RepositoryError',
      code: 'validation',
    });
  });
});

describe('sharing', () => {
  const json = {
    slug: 'abc123',
    visibility: 'public',
    name: 'Plan',
    description: 'd',
    author: 'Ada',
    tags: ['ios'],
    published_at: '2026-03-01T00:00:00Z',
    copy_count: 2,
    favorite_count: 5,
    favorited: true,
    phases: [{ id: 'p1', name: 'One', description: '', color: 'blue' }],
    resources: [
      {
        id: 'r1',
        title: 'T',
        url: 'https://a.dev',
        type: 'watch',
        minutes: 30,
        notes: '',
        phase_id: 'p1',
      },
    ],
  };

  it('maps a shared plan from the function result, and a missing one to null', async () => {
    const found = createSupabaseSharing(fakeClient(() => ({ data: json })).client);
    expect(await found.getShared('abc123')).toMatchObject({
      slug: 'abc123',
      author: 'Ada',
      copyCount: 2,
      favoriteCount: 5,
      favorited: true,
      resources: [{ id: 'r1', phaseId: 'p1', minutes: 30 }],
    });
    const missing = createSupabaseSharing(fakeClient(() => ({ data: null })).client);
    expect(await missing.getShared('nope')).toBeNull();
  });

  it('gives the owner fork and favorite counts, and leaves out a taken-down plan', async () => {
    const share = { visibility: 'public', tags: [], hidden: false, copy_count: 2 };
    const { client } = fakeClient((call) => {
      if (call === 'rpc:my_favorite_counts') return { data: { g1: 3, g3: 9 } };
      if (call.includes('plan_shares'))
        return {
          data: [
            { ...share, goal_id: 'g1', slug: 'a' },
            { ...share, goal_id: 'g2', slug: 'b' },
            { ...share, goal_id: 'g3', slug: 'c', hidden: true },
          ],
        };
      return { data: { display_name: 'Ada' } };
    });
    const { plans } = await createSupabaseSharing(client).loadSharing();
    expect(plans).toMatchObject({
      g1: { copyCount: 2, favoriteCount: 3 },
      g2: { copyCount: 2, favoriteCount: 0 },
    });
    expect(Object.keys(plans)).toEqual(['g1', 'g2']);
  });

  it('lists, sets and reports through functions, never tables, and cleans tags first', async () => {
    const { client, calls } = fakeClient((call) =>
      call === 'rpc:set_plan_sharing'
        ? { data: { visibility: 'public', slug: 's', tags: ['ios'] } }
        : { data: [] },
    );
    const sharing = createSupabaseSharing(client);
    await sharing.listPublic({ query: 'swift', limit: 10, sort: 'popular' });
    await sharing.listPopularTags();
    await sharing.listSimilar('s');
    await sharing.setSharing('g1', 'public', [' iOS ', 'ios', '']);
    await sharing.setDisplayName('Ada');
    await sharing.recordCopy('s');
    await sharing.report('s', 'spam');
    await sharing.listFavorites({ limit: 5 });
    await sharing.setFavorite('s', true);
    expect(calls.map((c) => c.call)).toEqual([
      'rpc:list_public_plans',
      'rpc:list_popular_tags',
      'rpc:similar_plans',
      'rpc:set_plan_sharing',
      'rpc:set_display_name',
      'rpc:record_plan_copy',
      'rpc:report_plan',
      'rpc:list_my_favorites',
      'rpc:set_plan_favorite',
    ]);
    expect(calls[7]!.args).toEqual({ p_limit: 5, p_offset: 0 });
    expect(calls[8]!.args).toEqual({ p_slug: 's', p_on: true });
    expect(calls[0]!.args).toMatchObject({
      p_query: 'swift',
      p_limit: 10,
      p_offset: 0,
      p_sort: 'popular',
    });
    expect(calls[1]!.args).toEqual({ p_limit: 20 });
    expect(calls[2]!.args).toEqual({ p_slug: 's', p_limit: 6 });
    expect(calls[3]!.args).toEqual({
      p_goal_id: 'g1',
      p_visibility: 'public',
      p_tags: ['ios'],
    });
  });

  it('maps a missing plan and a rejected value to app-level errors', async () => {
    const gone = createSupabaseSharing(
      fakeClient(() => ({ error: { code: 'P0002', message: 'plan not found' } })).client,
    );
    await expect(gone.setSharing('g1', 'public', [])).rejects.toMatchObject({ code: 'notFound' });
    const bad = createSupabaseSharing(
      fakeClient(() => ({ error: { code: '23514', message: 'set a display name' } })).client,
    );
    await expect(bad.setSharing('g1', 'public', [])).rejects.toMatchObject({
      code: 'validation',
      message: 'set a display name',
    });
  });
});
