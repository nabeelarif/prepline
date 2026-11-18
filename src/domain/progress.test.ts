import { addDays } from './dates';
import { goal, res, TODAY } from '../test/fixtures';
import { metrics } from './metrics';
import { estimatedFinish, pace, velocity } from './pace';
import { progressPatch, resDone, resStatus, statusPatch, studiedToday } from './resources';

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

  it('has no clock before the plan starts, and never runs late without a deadline', () => {
    // Even a deadline that has already passed is ignored until the plan is started.
    expect(at(1, { startDate: null, targetDate: null })).toMatchObject({
      kind: 'not_started',
      daysLeft: null,
    });
    expect(at(1, { startDate: null, targetDate: '2026-03-09' }).kind).toBe('not_started');
    expect(at(0.5, { targetDate: null })).toMatchObject({ kind: 'open', daysLeft: null });
  });
});

describe('estimatedFinish', () => {
  const met = metrics([res({ id: 'a', minutes: 600 })]);

  it('counts today as the first day of work', () => {
    expect(estimatedFinish(met, 2, TODAY)).toBe(addDays(TODAY, 4)); // 5 days of 2h
    expect(estimatedFinish(met, 10, TODAY)).toBe(TODAY);
    expect(estimatedFinish(met, 4, TODAY)).toBe(addDays(TODAY, 2)); // 2.5 rounds up to 3 days
  });

  it('has no estimate without capacity, work, or resources', () => {
    expect(estimatedFinish(met, null, TODAY)).toBeNull();
    expect(estimatedFinish(met, 0, TODAY)).toBeNull();
    expect(estimatedFinish(metrics([]), 2, TODAY)).toBeNull();
    expect(estimatedFinish(metrics([res({ id: 'a', done: true })]), 2, TODAY)).toBeNull();
  });
});

describe('velocity', () => {
  // 10h of work over 11 days needs about 54.5 minutes a day.
  const work = [res({ id: 'a', minutes: 600 })];
  const at = (hoursPerDay: number | null) => {
    const g = goal(work, { hoursPerDay });
    return velocity(pace(g, metrics(g.resources), TODAY), hoursPerDay);
  };

  it('shows spare time when the plan is on track or at risk', () => {
    expect(at(2)).toMatchObject({ kind: 'on_track', plannedMin: 120, ratio: 2.2 });
    expect(at(2)!.diffMin).toBeCloseTo(120 - 600 / 11);
    expect(at(1)).toMatchObject({ kind: 'at_risk' });
  });

  it('shows a shortfall when behind', () => {
    const v = at(0.5)!;
    expect(v.kind).toBe('behind');
    expect(v.diffMin).toBeLessThan(0);
    expect(v.ratio).toBe(0.5);
  });

  it('has nothing to compare without daily hours, work, or time', () => {
    expect(at(null)).toBeNull();
    const none = goal([], { hoursPerDay: 2 });
    expect(velocity(pace(none, metrics([]), TODAY), 2)).toBeNull();
    const late = goal(work, { hoursPerDay: 2, targetDate: '2026-03-09' });
    expect(velocity(pace(late, metrics(late.resources), TODAY), 2)).toBeNull();
  });
});

describe('study log', () => {
  const r0 = res({ id: 'a', minutes: 100 });

  it('adds up what is recorded on one day and starts again on the next', () => {
    const a = { ...r0, ...progressPatch(r0, 30, TODAY) };
    expect(studiedToday(a, TODAY)).toBe(30);
    const b = { ...a, ...progressPatch(a, 50, TODAY) };
    expect(studiedToday(b, TODAY)).toBe(50);
    expect(studiedToday(b, '2026-03-11')).toBe(0);
    const c = { ...b, ...progressPatch(b, 70, '2026-03-11') };
    expect(c).toMatchObject({ loggedOn: '2026-03-11', loggedMinutes: 20 });
  });

  it('credits the rest when completed, and takes it back on reopen or Not Started', () => {
    const a = { ...r0, ...progressPatch(r0, 30, TODAY) };
    const done = { ...a, ...statusPatch(a, 'completed', TODAY) };
    expect(studiedToday(done, TODAY)).toBe(100);
    const reopened = { ...done, ...statusPatch(done, 'in_progress', TODAY) };
    expect(studiedToday(reopened, TODAY)).toBe(30);
    expect(statusPatch(reopened, 'not_started', TODAY)).toMatchObject({
      loggedOn: null,
      loggedMinutes: 0,
    });
  });

  it('never goes below zero when earlier progress is lowered', () => {
    const a = res({ id: 'a', minutes: 100, doneMinutes: 80, startedAt: '2026-03-01' });
    const b = { ...a, ...progressPatch(a, 20, TODAY) };
    expect(b).toMatchObject({ loggedOn: null, loggedMinutes: 0 });
  });
});
