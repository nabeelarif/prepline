import type { Resource } from './types';

export function resTotal(r: Resource): number {
  return r.sections.length ? r.sections.reduce((a, s) => a + s.minutes, 0) : r.minutes;
}

export function resDone(r: Resource): number {
  return r.sections.length
    ? r.sections.reduce((a, s) => a + (s.done ? s.minutes : 0), 0)
    : r.done
      ? r.minutes
      : 0;
}

export function isDone(r: Resource): boolean {
  return r.sections.length ? r.sections.every((s) => s.done) : r.done;
}
