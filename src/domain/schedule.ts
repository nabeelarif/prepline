import { addDays, diffDays, todayISO } from './dates';
import { metrics } from './metrics';
import { pace } from './pace';
import { focusOrder, resDone, studiedToday } from './resources';
import type { Goal, ISODate, Resource, ResourceStatus } from './types';

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

/** Minutes of these resources credited today. */
function studiedOn(resources: Resource[], today: ISODate): number {
  return resources.reduce((a, r) => a + studiedToday(r, today), 0);
}

/**
 * Minutes to study each day: the plan's daily hours, else the pace its deadline requires.
 * That pace is for the work left when today began, so studying today does not shrink the
 * target it counts towards. Null when neither exists, or when a not-started plan, or one
 * finished before today, has nothing to pace.
 */
export function dailyBudget(g: Goal, today: ISODate = todayISO()): number | null {
  if (g.hoursPerDay != null && g.hoursPerDay > 0) return Math.round(g.hoursPerDay * 60);
  const m = metrics(g.resources);
  const p = pace(g, { ...m, remaining: m.remaining + studiedOn(g.resources, today) }, today);
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
  const studied = studiedOn(g.resources, today);

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

/** Where a plan stands as a whole. Derived, never stored; a started, empty plan is in progress. */
export function planStatus(g: Goal): ResourceStatus {
  const m = metrics(g.resources);
  if (m.total > 0 && m.remaining === 0) return 'completed';
  return g.startDate ? 'in_progress' : 'not_started';
}

/** One day across every plan being worked on. */
export interface Agenda {
  date: ISODate;
  /** In plan order. */
  plans: { goal: Goal; day: StudyDay }[];
  /** Minutes the plans with a daily pace can hold; null when none has one. */
  budget: number | null;
  /**
   * What those plans ask for that day: each one's budget, or less when it has less work
   * than that left, so finishing everything always reaches it.
   */
  target: number;
  /**
   * Studied minutes that count towards `target`. Each plan counts at most its own budget, so
   * extra time on one never covers another, and plans without a budget are left out.
   */
  credited: number;
}

/**
 * What every plan in progress holds `offset` days from today. Today also keeps a plan that was
 * finished today. A later day lists only the plans with something planned on it.
 */
export function dayAgenda(goals: Goal[], offset = 0, today: ISODate = todayISO()): Agenda {
  const plans = goals.flatMap((goal) => {
    if (!goal.startDate) return [];
    const day = studyPlan(goal, offset + 1, today)[offset];
    if (!day) return [];
    const active = planStatus(goal) === 'in_progress';
    const listed = offset === 0 ? active || day.studied > 0 : day.slices.length > 0;
    return listed ? [{ goal, day }] : [];
  });
  let budget: number | null = null;
  let target = 0;
  let credited = 0;
  for (const { day } of plans) {
    if (day.budget == null) continue;
    budget = (budget ?? 0) + day.budget;
    target += Math.min(day.budget, day.studied + day.minutes);
    credited += Math.min(day.studied, day.budget);
  }
  return { date: addDays(today, offset), plans, budget, target, credited };
}
