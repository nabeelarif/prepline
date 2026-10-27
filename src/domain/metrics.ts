import { isDone, resDone, resTotal } from './resources';
import type { Resource } from './types';

export interface Metrics {
  /** Minutes. */
  total: number;
  done: number;
  remaining: number;
  /** Progress weighted by minutes; never shown as 100 until everything is done. */
  pct: number;
  doneCount: number;
  count: number;
}

/** Weighted progress over any list of resources: a plan, a phase, or one resource. */
export function metrics(resources: Resource[]): Metrics {
  let total = 0;
  let done = 0;
  let doneCount = 0;
  for (const r of resources) {
    total += resTotal(r);
    done += resDone(r);
    if (isDone(r)) doneCount++;
  }
  let pct = total ? Math.round((done / total) * 100) : 0;
  if (pct === 100 && done < total) pct = 99;
  return { total, done, remaining: total - done, pct, doneCount, count: resources.length };
}
