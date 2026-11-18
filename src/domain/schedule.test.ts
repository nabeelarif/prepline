import { describe, expect, it } from 'vitest';
import { goal, res, TODAY } from '../test/fixtures';
import { dailyBudget, studyPlan } from './schedule';

const ids = (g: ReturnType<typeof studyPlan>[number]) =>
  g.slices.map((s) => `${s.resource.id}:${s.minutes}`);

describe('studyPlan', () => {
  it('fills the day from the priority order and splits the last resource', () => {
    const g = goal([res({ id: 'a', minutes: 40 }), res({ id: 'b', minutes: 60 })], {
      hoursPerDay: 1,
    });
    const [day] = studyPlan(g, 1, TODAY);
    expect(ids(day!)).toEqual(['a:40', 'b:20']);
    expect(day!.slices.map((s) => s.finishes)).toEqual([true, false]);
    expect(day!.minutes).toBe(60);
  });

  it('puts In Progress resources first and counts only what is left', () => {
    const g = goal([res({ id: 'a' }), res({ id: 'b', startedAt: TODAY, doneMinutes: 45 })], {
      hoursPerDay: 1,
    });
    const [day] = studyPlan(g, 1, TODAY);
    expect(ids(day!)).toEqual(['b:15', 'a:45']);
    expect(day!.slices[0]!.from).toBe(45);
  });

  it('skips finished resources and ends when work runs out', () => {
    const g = goal([res({ id: 'a', done: true }), res({ id: 'b', minutes: 30 })], {
      hoursPerDay: 2,
    });
    const days = studyPlan(g, 3, TODAY);
    expect(ids(days[0]!)).toEqual(['b:30']);
    expect(days[1]!.slices).toEqual([]);
  });

  it('carries a long resource across the week', () => {
    const g = goal([res({ id: 'a', minutes: 150 })], { hoursPerDay: 1 });
    const days = studyPlan(g, 7, TODAY);
    expect(days.map((d) => d.minutes)).toEqual([60, 60, 30, 0, 0, 0, 0]);
    expect(days[2]!.slices[0]!.finishes).toBe(true);
    expect(days[1]!.date).toBe('2026-03-11');
  });

  it('stops at the deadline', () => {
    const g = goal([res({ id: 'a', minutes: 600 })], { targetDate: '2026-03-12' });
    expect(studyPlan(g, 7, TODAY)).toHaveLength(3);
  });

  it('uses the required pace without daily hours, and the focus resource without a deadline', () => {
    const due = goal([res({ id: 'a', minutes: 300 })], {
      hoursPerDay: null,
      targetDate: '2026-03-14',
    });
    expect(dailyBudget(due, TODAY)).toBe(60);
    const open = goal([res({ id: 'a', minutes: 300 })], { hoursPerDay: null, targetDate: null });
    expect(dailyBudget(open, TODAY)).toBeNull();
    const days = studyPlan(open, 7, TODAY);
    expect(ids(days[0]!)).toEqual(['a:300']);
    expect(days.slice(1).every((d) => d.slices.length === 0)).toBe(true);
  });
});

describe('studyPlan: minutes studied today', () => {
  it('takes them off today only, and lists what was studied', () => {
    const g = goal(
      [
        res({
          id: 'a',
          minutes: 90,
          doneMinutes: 40,
          startedAt: TODAY,
          loggedOn: TODAY,
          loggedMinutes: 40,
        }),
        res({ id: 'b', minutes: 90 }),
      ],
      { hoursPerDay: 1 },
    );
    const [today, tomorrow] = studyPlan(g, 2, TODAY);
    expect(today!.studied).toBe(40);
    expect(today!.studiedItems.map((x) => x.resource.id)).toEqual(['a']);
    expect(ids(today!)).toEqual(['a:20']);
    expect(tomorrow!.studied).toBe(0);
    expect(tomorrow!.minutes).toBe(60);
  });

  it('plans nothing more once the goal is met, and ignores earlier days', () => {
    const met = goal(
      [res({ id: 'a', minutes: 200, doneMinutes: 60, loggedOn: TODAY, loggedMinutes: 60 })],
      { hoursPerDay: 1 },
    );
    expect(studyPlan(met, 1, TODAY)[0]!.slices).toEqual([]);
    const old = goal(
      [res({ id: 'a', minutes: 200, doneMinutes: 60, loggedOn: '2026-03-09', loggedMinutes: 60 })],
      { hoursPerDay: 1 },
    );
    const [day] = studyPlan(old, 1, TODAY);
    expect(day!.studied).toBe(0);
    expect(ids(day!)).toEqual(['a:60']);
  });
});
