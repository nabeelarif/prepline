import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError } from '../../auth/types';
import { RepositoryError } from '../../repositories/errors';
import { goal, res } from '../../test/fixtures';
import { toAuthError, toRepositoryError } from './errors';
import { createSupabaseRepository } from './repository';
import { appDataPayload, goalTreePayload, rowsToAppData } from './rows';

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
          target_date: '2026-05-01',
          hours_per_day: null,
          created_at: '2026-01-01',
          position: 1,
        },
        {
          id: 'g1',
          name: 'First',
          description: '',
          target_date: '2026-05-01',
          hours_per_day: '1.50',
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
          type: 'video',
          minutes: 30,
          done_minutes: 0,
          notes: '',
          done: false,
          done_at: null,
          started_at: null,
          phase_id: 'p1',
          created_at: '2026-01-01',
          position: 1,
        },
        {
          id: 'a',
          goal_id: 'g1',
          title: 'A',
          url: '',
          type: 'article',
          minutes: 30,
          done_minutes: 10,
          notes: 'n',
          done: false,
          done_at: null,
          started_at: null,
          phase_id: null,
          created_at: '2026-01-01',
          position: 0,
        },
      ],
      { active_goal_id: 'g2' },
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
    expect(
      JSON.stringify(appDataPayload({ version: 1, activeGoalId: 'g1', goals: [g] })),
    ).not.toMatch(/user_id/);
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
  it('loads with four reads and reports a failed read as an error, not empty data', async () => {
    const ok = fakeClient(() => ({ data: [] }));
    const loaded = await createSupabaseRepository(ok.client).loadAll();
    expect(loaded.goals).toEqual([]);
    expect(ok.calls.map((c) => c.call).sort()).toEqual(
      ['goals.select', 'phases.select', 'profiles.maybeSingle', 'resources.select'].sort(),
    );

    const failing = fakeClient((call) =>
      call === 'goals.select' ? { error: { message: 'Failed to fetch' } } : { data: [] },
    );
    await expect(createSupabaseRepository(failing.client).loadAll()).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('sends every multi-row write as one RPC call, and deletes by id', async () => {
    const { client, calls } = fakeClient(() => ({}));
    const repo = createSupabaseRepository(client);
    const g = goal([res({ id: 'r1' })], { id: 'g1' });
    await repo.saveGoalTree(g);
    await repo.replaceAll({ version: 1, activeGoalId: 'g1', goals: [g] });
    await repo.reorderResources('g1', ['r1']);
    await repo.deleteAll();
    await repo.deleteResource('g1', 'r1');
    expect(calls.map((c) => c.call)).toEqual([
      'rpc:save_goal_tree',
      'rpc:replace_all_data',
      'rpc:reorder_resources',
      'rpc:delete_all_data',
      'resources.delete',
    ]);
    expect(calls[4]!.args).toEqual([
      ['goal_id', 'g1'],
      ['id', 'r1'],
    ]);
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
