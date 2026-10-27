import { goal, res, TODAY } from '../test/fixtures';
import { metrics } from './metrics';
import { pace } from './pace';
import { resDone, resStatus } from './resources';

describe('resource progress', () => {
  it('credits partial minutes, capped at the estimate, and full minutes when done', () => {
    expect(resDone(res({ id: 'a', doneMinutes: 20 }))).toBe(20);
    expect(resDone(res({ id: 'a', doneMinutes: 500 }))).toBe(60);
    expect(resDone(res({ id: 'a', doneMinutes: 20, done: true }))).toBe(60);
  });

  it('derives status from progress', () => {
    expect(resStatus(res({ id: 'a' }))).toBe('not_started');
    expect(resStatus(res({ id: 'a', doneMinutes: 1 }))).toBe('in_progress');
    expect(resStatus(res({ id: 'a', done: true }))).toBe('completed');
  });
});

describe('metrics', () => {
  it('weights progress by hours, not by resource count (spec example: 8h of 30h)', () => {
    const m = metrics([
      res({ id: 'article', minutes: 60, done: true }),
      res({ id: 'video', minutes: 120, done: true }),
      res({ id: 'course', minutes: 1200, doneMinutes: 300 }),
      res({ id: 'practice', minutes: 420 }),
    ]);
    expect(m).toEqual({
      total: 1800,
      done: 480,
      remaining: 1320,
      pct: 27,
      doneCount: 2,
      count: 4,
    });
  });

  it('is 0% with no work and only 100% when everything is done', () => {
    expect(metrics([]).pct).toBe(0);
    expect(metrics([res({ id: 'a', minutes: 1000, doneMinutes: 999 })]).pct).toBe(99);
    expect(metrics([res({ id: 'a', done: true })]).pct).toBe(100);
  });
});

describe('pace', () => {
  // 10h of work; target is 11 calendar days away counting today.
  const work = [res({ id: 'a', minutes: 600 })];
  const at = (hoursPerDay: number | null, o = {}) => {
    const g = goal(work, { hoursPerDay, ...o });
    return pace(g, metrics(g.resources), TODAY);
  };

  it('reports the required daily pace', () => {
    expect(at(1)).toMatchObject({ daysLeft: 11, requiredPerDay: 600 / 11 });
  });

  it('is on track, at risk, or behind depending on daily capacity', () => {
    expect(at(2).kind).toBe('on_track');
    expect(at(1).kind).toBe('at_risk');
    expect(at(0.5).kind).toBe('behind');
  });

  it('makes no judgement without a daily capacity', () => {
    expect(at(null).kind).toBe('no_capacity');
  });

  it('handles empty, finished and overdue plans', () => {
    expect(pace(goal([]), metrics([]), TODAY).kind).toBe('idle');
    const done = [res({ id: 'a', done: true })];
    expect(pace(goal(done), metrics(done), TODAY).kind).toBe('done');
    expect(at(1, { targetDate: '2026-03-09' }).kind).toBe('past');
  });
});
