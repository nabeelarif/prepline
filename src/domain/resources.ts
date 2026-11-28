import type { ISODate, Resource, ResourceStatus } from './types';

export function resTotal(r: Resource): number {
  return r.minutes;
}

/** Credited minutes: the full estimate once done, otherwise the partial progress. */
export function resDone(r: Resource): number {
  return r.done ? r.minutes : Math.min(Math.max(0, r.doneMinutes), r.minutes);
}

export function isDone(r: Resource): boolean {
  return r.done;
}

/**
 * Workflow state. Completed when done; In Progress once started or once any time
 * is recorded, even at 0 minutes; otherwise Not Started. Any number of resources
 * can be In Progress at once.
 */
export function resStatus(r: Resource): ResourceStatus {
  if (r.done) return 'completed';
  return r.startedAt || resDone(r) > 0 ? 'in_progress' : 'not_started';
}

/** Moving to this status discards recorded progress, so the UI must confirm it. */
export function statusLosesProgress(r: Resource, to: ResourceStatus): boolean {
  return to === 'not_started' && (r.done || resDone(r) > 0);
}

const PROGRESS_KEYS = [
  'done',
  'doneAt',
  'doneMinutes',
  'startedAt',
  'loggedOn',
  'loggedMinutes',
] as const;

export type Progress = Pick<Resource, (typeof PROGRESS_KEYS)[number]>;

/** A copy of the fields a status move can change, for restoring them later. */
export function progressOf(r: Resource): Progress {
  return Object.fromEntries(PROGRESS_KEYS.map((k) => [k, r[k]])) as Progress;
}

export function sameProgress(a: Progress, b: Progress): boolean {
  return PROGRESS_KEYS.every((k) => a[k] === b[k]);
}

/** Minutes of this resource credited today. */
export function studiedToday(r: Resource, today: ISODate): number {
  return r.loggedOn === today ? r.loggedMinutes : 0;
}

/**
 * The day's tally after credited minutes change to `nextDone`: gains add to today's total,
 * and losses (reopening, Not Started) take back from it, never below zero.
 */
function logged(r: Resource, nextDone: number, today: ISODate) {
  const minutes = Math.max(0, studiedToday(r, today) + nextDone - resDone(r));
  return minutes > 0
    ? { loggedOn: today, loggedMinutes: minutes }
    : { loggedOn: null, loggedMinutes: 0 };
}

/**
 * Fields to change for a status move. Starting credits nothing. Completing credits
 * the full estimate. Reopening restores earlier partial progress if there was any.
 * Not Started clears everything.
 */
export function statusPatch(r: Resource, to: ResourceStatus, today: ISODate): Progress {
  const startedAt = r.startedAt ?? today;
  switch (to) {
    case 'not_started':
      return {
        done: false,
        doneAt: null,
        doneMinutes: 0,
        startedAt: null,
        loggedOn: null,
        loggedMinutes: 0,
      };
    case 'in_progress': {
      // A full partial value would read as finished, so a reopen starts that one at 0.
      const doneMinutes = r.doneMinutes < r.minutes ? r.doneMinutes : 0;
      return {
        done: false,
        doneAt: null,
        doneMinutes,
        startedAt,
        ...logged(r, Math.min(doneMinutes, r.minutes), today),
      };
    }
    case 'completed':
      return {
        done: true,
        doneAt: r.done ? r.doneAt : today,
        doneMinutes: r.doneMinutes,
        startedAt,
        ...logged(r, r.minutes, today),
      };
  }
}

/**
 * Fields to change when recording completed minutes. Recording the full estimate
 * completes the resource the same way Mark completed does, keeping any earlier
 * partial progress so a later reopen can restore it.
 */
export function progressPatch(r: Resource, minutes: number, today: ISODate): Progress {
  const m = Math.round(Math.min(Math.max(0, minutes), r.minutes));
  if (m === r.minutes) return statusPatch(r, 'completed', today);
  return {
    done: false,
    doneAt: null,
    doneMinutes: m,
    startedAt: r.startedAt ?? today,
    ...logged(r, m, today),
  };
}

/**
 * Unfinished resources in the order to work on them: In Progress before Not Started, each in
 * priority order. A habit repeats and is never "finished" in one sitting, so habits come
 * after everything else.
 */
export function focusOrder<R extends Resource>(resources: R[]): R[] {
  const rank = (r: R) => (r.type === 'habit' ? 2 : 0) + (resStatus(r) === 'in_progress' ? 0 : 1);
  return resources.filter((r) => resStatus(r) !== 'completed').sort((a, b) => rank(a) - rank(b)); // stable, so priority order holds within a rank
}

/**
 * What to work on now: the first of `focusOrder`. Null when everything is done.
 */
export function focusResource(resources: Resource[]): Resource | null {
  return focusOrder(resources)[0] ?? null;
}

/** The plan holding a resource. Resource ids are unique across a user's plans. */
export function goalOfResource<G extends { resources: Pick<Resource, 'id'>[] }>(
  goals: G[],
  resourceId: string,
): G | undefined {
  return goals.find((g) => g.resources.some((r) => r.id === resourceId));
}

/** A resource in any plan, by plan and resource id. */
export function findResource<R extends Pick<Resource, 'id'>>(
  goals: { id: string; resources: R[] }[],
  goalId: string,
  resourceId: string,
): R | undefined {
  return goals.find((g) => g.id === goalId)?.resources.find((r) => r.id === resourceId);
}
