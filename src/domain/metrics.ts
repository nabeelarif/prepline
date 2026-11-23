import { isDone, resDone, resTotal } from './resources';
import type { Resource, ResourceType } from './types';

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

export interface TypeShare extends Metrics {
  type: ResourceType;
}

/** Progress per resource type, for types the list uses, largest estimate first. */
export function metricsByType(resources: Resource[]): TypeShare[] {
  const byType = new Map<ResourceType, Resource[]>();
  for (const r of resources) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  return [...byType]
    .map(([type, list]) => ({ type, ...metrics(list) }))
    .sort((a, b) => b.total - a.total);
}
