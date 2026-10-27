import type { Goal, Resource } from '../domain/types';

export const TODAY = '2026-03-10';

/** A 60-minute, unstarted article; override any field. */
export const res = (o: Partial<Resource> & { id: string }): Resource => ({
  title: o.id,
  url: '',
  type: 'article',
  minutes: 60,
  doneMinutes: 0,
  notes: '',
  done: false,
  doneAt: null,
  startedAt: null,
  phaseId: null,
  createdAt: TODAY,
  ...o,
});

/** A plan due 10 days after TODAY at 1h/day. */
export const goal = (resources: Resource[], o: Partial<Goal> = {}): Goal => ({
  id: 'g',
  name: 'Plan',
  description: '',
  targetDate: '2026-03-20',
  hoursPerDay: 1,
  createdAt: TODAY,
  resources,
  phases: [],
  ...o,
});
