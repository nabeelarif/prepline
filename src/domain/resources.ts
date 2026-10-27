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

type Progress = Pick<Resource, 'done' | 'doneAt' | 'doneMinutes' | 'startedAt'>;

/**
 * Fields to change for a status move. Starting credits nothing. Completing credits
 * the full estimate. Reopening restores earlier partial progress if there was any.
 * Not Started clears everything.
 */
export function statusPatch(r: Resource, to: ResourceStatus, today: ISODate): Progress {
  const startedAt = r.startedAt ?? today;
  switch (to) {
    case 'not_started':
      return { done: false, doneAt: null, doneMinutes: 0, startedAt: null };
    case 'in_progress':
      return {
        done: false,
        doneAt: null,
        // A full partial value would read as finished, so a reopen starts that one at 0.
        doneMinutes: r.doneMinutes < r.minutes ? r.doneMinutes : 0,
        startedAt,
      };
    case 'completed':
      return {
        done: true,
        doneAt: r.done ? r.doneAt : today,
        doneMinutes: r.doneMinutes,
        startedAt,
      };
  }
}

/**
 * Fields to change when recording completed minutes. Recording the full estimate
 * completes the resource the same way the checkbox does, keeping any earlier
 * partial progress so a later reopen can restore it.
 */
export function progressPatch(r: Resource, minutes: number, today: ISODate): Progress {
  const m = Math.round(Math.min(Math.max(0, minutes), r.minutes));
  if (m === r.minutes) return statusPatch(r, 'completed', today);
  return { done: false, doneAt: null, doneMinutes: m, startedAt: r.startedAt ?? today };
}

/**
 * What to work on now: the first In Progress resource in priority order, or else
 * the first Not Started one. Null when everything is done.
 */
export function focusResource(resources: Resource[]): Resource | null {
  return (
    resources.find((r) => resStatus(r) === 'in_progress') ??
    resources.find((r) => resStatus(r) === 'not_started') ??
    null
  );
}
