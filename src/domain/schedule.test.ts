import { metrics } from './metrics';
import { pace } from './pace';
import { schedule } from './schedule';
import type { Goal, Resource } from './types';

const TODAY = '2026-03-10';

const res = (o: Partial<Resource> & { id: string }): Resource => ({
  title: o.id,
  url: '',
  type: 'article',
  minutes: 30,
  notes: '',
  done: false,
  doneAt: null,
  rating: null,
  sections: [],
  ...o,
});

const goal = (resources: Resource[], o: Partial<Goal> = {}): Goal => ({
  id: 'g',
  name: 'Goal',
  targetDate: '2026-03-20',
  hoursPerDay: 1,
  sample: false,
  createdAt: TODAY,
  resources,
  ...o,
});

const plan = (g: Goal) => {
  const met = metrics(g, TODAY);
  const sch = schedule(g, met, TODAY);
  return { met, sch, p: pace(g, met, sch, TODAY) };
};

describe('metrics', () => {
  it('weights progress and readiness by minutes', () => {
    const { met } = plan(
      goal([
        res({ id: 'a', minutes: 90, done: true, doneAt: TODAY, rating: 5 }),
        res({ id: 'b', minutes: 30, done: true, doneAt: '2026-03-01', rating: 1 }),
        res({ id: 'c', minutes: 120 }),
      ]),
    );
    expect(met.total).toBe(240);
    expect(met.done).toBe(120);
    expect(met.pct).toBe(50);
    expect(met.doneToday).toBe(90);
    expect(met.readiness).toBe(4); // (90*5 + 30*1) / 120
    expect(met.low.map((r) => r.id)).toEqual(['b']);
  });

  it('never shows 100% while work remains', () => {
    const { met } = plan(
      goal([res({ id: 'a', minutes: 999, done: true }), res({ id: 'b', minutes: 1 })]),
    );
    expect(met.pct).toBe(99);
  });

  it('derives minutes and done state from sections', () => {
    const r = res({
      id: 'c',
      minutes: 1,
      sections: [
        { id: 's1', title: 'One', minutes: 60, done: true, doneAt: TODAY },
        { id: 's2', title: 'Two', minutes: 40, done: false, doneAt: null },
      ],
    });
    const { met } = plan(goal([r]));
    expect(met.total).toBe(100);
    expect(met.doneToday).toBe(60);
    expect(met.todayDone[0]).toMatchObject({ secId: 's1', parent: 'c' });
  });
});

describe('schedule', () => {
  it('fills days in resource order and splits long units', () => {
    const { sch } = plan(goal([res({ id: 'a', minutes: 40 }), res({ id: 'b', minutes: 50 })]));
    expect(sch.cap).toBe(60);
    expect(sch.days.map((d) => d.date)).toEqual(['2026-03-10', '2026-03-11']);
    expect(sch.days[0]!.items.map((u) => [u.resId, u.minutes, u.split])).toEqual([
      ['a', 40, false],
      ['b', 20, true],
    ]);
    expect(sch.days[1]!.items[0]).toMatchObject({ resId: 'b', minutes: 30, part: 2, full: 50 });
    expect(sch.finish).toBe('2026-03-11');
  });

  it('starts tomorrow when less than 10 minutes of today is left', () => {
    const { sch } = plan(
      goal([
        res({ id: 'a', minutes: 55, done: true, doneAt: TODAY }),
        res({ id: 'b', minutes: 20 }),
      ]),
    );
    expect(sch.days[0]!.date).toBe('2026-03-11');
  });

  it('counts work done today against today', () => {
    const { sch } = plan(
      goal([
        res({ id: 'a', minutes: 30, done: true, doneAt: TODAY }),
        res({ id: 'b', minutes: 45 }),
      ]),
    );
    expect(sch.days[0]).toMatchObject({ date: TODAY, minutes: 30 });
  });
});

describe('pace', () => {
  it('reports idle, done, on track and behind', () => {
    expect(plan(goal([])).p.kind).toBe('idle');
    expect(plan(goal([res({ id: 'a', done: true })])).p.kind).toBe('done');
    expect(plan(goal([res({ id: 'a', minutes: 120 })])).p).toMatchObject({
      kind: 'ok',
      label: 'On track · 9 days spare',
    });
    expect(
      plan(goal([res({ id: 'a', minutes: 60 * 13 })], { targetDate: '2026-03-20' })).p,
    ).toMatchObject({ kind: 'bad', label: 'Behind · 2 days late' });
    expect(plan(goal([res({ id: 'a' })], { targetDate: '2026-03-01' })).p.label).toBe(
      'Past target',
    );
  });
});
