import { addDays, diffDays, todayISO } from './dates';
import { metrics } from './metrics';
import { pace } from './pace';
import { focusOrder, resDone, studiedToday } from './resources';
import type { Goal, ISODate, Resource } from './types';

/** A share of one resource planned for one day. */
export interface StudySlice {
  resource: Resource;
  /** Minutes to study that day. */
  minutes: number;
  /** Minutes of the resource already credited before this slice. */
  from: number;
  /** Whether this slice completes the resource. */
  finishes: boolean;
}

export interface StudyDay {
  date: ISODate;
  /** Minutes the day can hold, or null when the plan gives no daily pace. */
  budget: number | null;
  slices: StudySlice[];
  /** Minutes planned across the slices. */
  minutes: number;
  /** Minutes already studied that day; only ever above 0 for today. */
  studied: number;
  /** What was studied that day, resource by resource; only today has any. */
  studiedItems: { resource: Resource; minutes: number }[];
}

/**
 * Minutes to study each day: the plan's daily hours, else the pace its deadline requires.
 * Null when neither exists, or when a not-started or finished plan has nothing to pace.
 */
export function dailyBudget(g: Goal, today: ISODate = todayISO()): number | null {
  if (g.hoursPerDay != null && g.hoursPerDay > 0) return Math.round(g.hoursPerDay * 60);
  const p = pace(g, metrics(g.resources), today);
  return p.kind === 'no_capacity' && p.requiredPerDay > 0 ? Math.ceil(p.requiredPerDay) : null;
}

/**
 * What to study over the next `days` days, filling each day's budget from the priority
 * order, as in `focusOrder` (In Progress first, then Not Started, habits last); a long
 * resource is split across days. With no budget, only today is planned, holding the focus
 * resource whole. Days after the deadline are left out.
 * Minutes already studied today (`studiedToday`) come off today's budget, so the list ends
 * when the day's goal is met.
 */
export function studyPlan(g: Goal, days = 1, today: ISODate = todayISO()): StudyDay[] {
  const budget = dailyBudget(g, today);
  const queue = focusOrder(g.resources.filter((r) => r.minutes - resDone(r) > 0)).map(
    (resource) => ({ resource, taken: resDone(resource) }),
  );

  const studiedItems = g.resources
    .map((resource) => ({ resource, minutes: studiedToday(resource, today) }))
    .filter((x) => x.minutes > 0);
  const studied = studiedItems.reduce((a, x) => a + x.minutes, 0);

  const out: StudyDay[] = [];
  const last = g.targetDate && g.targetDate >= today ? diffDays(today, g.targetDate) : Infinity;
  for (let i = 0; i < Math.min(days, last + 1); i++) {
    const day: StudyDay = {
      date: addDays(today, i),
      budget,
      slices: [],
      minutes: 0,
      studied: i === 0 ? studied : 0,
      studiedItems: i === 0 ? studiedItems : [],
    };
    out.push(day);
    // No budget: today shows the one resource to work on, and later days stay empty.
    const focus = queue[0];
    let left =
      budget != null
        ? Math.max(0, budget - day.studied)
        : i === 0 && focus
          ? focus.resource.minutes - focus.taken
          : 0;
    while (left > 0 && queue[0]) {
      const head = queue[0];
      const remaining = head.resource.minutes - head.taken;
      const minutes = Math.min(left, remaining);
      day.slices.push({
        resource: head.resource,
        minutes,
        from: head.taken,
        finishes: minutes === remaining,
      });
      day.minutes += minutes;
      head.taken += minutes;
      left -= minutes;
      if (head.taken >= head.resource.minutes) queue.shift();
    }
  }
  return out;
}
