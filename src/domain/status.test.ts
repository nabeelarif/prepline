import { res, TODAY } from '../test/fixtures';
import { metrics } from './metrics';
import {
  focusResource,
  progressPatch,
  resDone,
  resStatus,
  statusLosesProgress,
  statusPatch,
} from './resources';
import type { Resource, ResourceStatus } from './types';

const move = (r: Resource, to: ResourceStatus) => ({ ...r, ...statusPatch(r, to, TODAY) });
const record = (r: Resource, m: number) => ({ ...r, ...progressPatch(r, m, TODAY) });

describe('resource status', () => {
  const course = res({ id: 'swiftui', minutes: 1200 });

  it('starting credits nothing: In Progress at 0%', () => {
    const r = move(course, 'in_progress');
    expect(resStatus(r)).toBe('in_progress');
    expect(resDone(r)).toBe(0);
    expect(r.startedAt).toBe(TODAY);
  });

  it('recording time moves it to In Progress, and the full estimate completes it', () => {
    const r = record(course, 300);
    expect(resStatus(r)).toBe('in_progress');
    expect(resDone(r)).toBe(300);
    const done = record(r, 1200);
    expect(resStatus(done)).toBe('completed');
    expect(done.doneAt).toBe(TODAY);
  });

  it('completing credits the full estimate from any state', () => {
    expect(resDone(move(course, 'completed'))).toBe(1200);
    expect(resDone(move(record(course, 300), 'completed'))).toBe(1200);
  });

  it('reopening restores earlier partial progress, or starts at 0 when there was none', () => {
    const partial = move(move(record(course, 300), 'completed'), 'in_progress');
    expect(resStatus(partial)).toBe('in_progress');
    expect(resDone(partial)).toBe(300);
    const direct = move(move(course, 'completed'), 'in_progress');
    expect(resDone(direct)).toBe(0);
    expect(resStatus(direct)).toBe('in_progress');
  });

  it('completing by recording the full estimate keeps earlier partial progress for a reopen', () => {
    const done = record(record(course, 300), 1200);
    expect(resStatus(done)).toBe('completed');
    expect(resDone(done)).toBe(1200);
    const reopened = move(done, 'in_progress');
    expect(resStatus(reopened)).toBe('in_progress');
    expect(resDone(reopened)).toBe(300);
  });

  it('Not Started clears progress, and needs confirmation only when there is some', () => {
    expect(statusLosesProgress(move(course, 'in_progress'), 'not_started')).toBe(false);
    expect(statusLosesProgress(record(course, 300), 'not_started')).toBe(true);
    expect(statusLosesProgress(move(course, 'completed'), 'not_started')).toBe(true);
    const r = move(record(course, 300), 'not_started');
    expect(r).toMatchObject({ done: false, doneMinutes: 0, startedAt: null, doneAt: null });
    expect(resStatus(r)).toBe('not_started');
  });

  it('keeps several resources In Progress independently, weighted by hours', () => {
    const list = [
      move(res({ id: 'fundamentals', minutes: 60 }), 'completed'),
      record(res({ id: 'swiftui', minutes: 1200 }), 300),
      move(res({ id: 'async', minutes: 120 }), 'in_progress'),
      res({ id: 'system-design', minutes: 420 }),
    ];
    expect(list.map(resStatus)).toEqual(['completed', 'in_progress', 'in_progress', 'not_started']);
    expect(metrics(list)).toMatchObject({ done: 360, total: 1800, pct: 20, doneCount: 1 });
  });
});

describe('focusResource', () => {
  it('prefers the first In Progress resource in priority order', () => {
    const list = [
      res({ id: 'a' }),
      res({ id: 'b', startedAt: TODAY }),
      res({ id: 'c', doneMinutes: 10 }),
    ];
    expect(focusResource(list)?.id).toBe('b');
  });

  it('falls back to the first Not Started one, then to nothing', () => {
    expect(focusResource([res({ id: 'a', done: true }), res({ id: 'b' })])?.id).toBe('b');
    expect(focusResource([res({ id: 'a', done: true })])).toBeNull();
  });
});
