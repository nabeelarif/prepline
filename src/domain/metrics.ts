import { todayISO } from './dates';
import { isDone, resDone, resTotal } from './resources';
import type { Goal, ISODate, Resource, WorkUnit } from './types';

export interface Metrics {
  total: number;
  done: number;
  remaining: number;
  /** Progress by minutes, never shown as 100 until everything is done. */
  pct: number;
  doneToday: number;
  todayDone: WorkUnit[];
  /** Average rating weighted by each finished resource's minutes; null when nothing is rated. */
  readiness: number | null;
  rated: number;
  doneCount: number;
  count: number;
  /** Finished resources rated 3 or lower. */
  low: Resource[];
}

export function metrics(g: Goal, today: ISODate = todayISO()): Metrics {
  let total = 0;
  let done = 0;
  let doneToday = 0;
  let wSum = 0;
  let wRate = 0;
  let rated = 0;
  let doneCount = 0;
  const todayDone: WorkUnit[] = [];
  const low: Resource[] = [];

  for (const r of g.resources) {
    const T = resTotal(r);
    total += T;
    done += resDone(r);
    if (isDone(r)) {
      doneCount++;
      if (r.rating) {
        rated++;
        wSum += T;
        wRate += T * r.rating;
        if (r.rating <= 3) low.push(r);
      }
    }
    if (r.sections.length) {
      for (const s of r.sections) {
        if (s.done && s.doneAt === today) {
          doneToday += s.minutes;
          todayDone.push({
            resId: r.id,
            secId: s.id,
            title: s.title,
            parent: r.title,
            type: r.type,
            url: r.url,
            minutes: s.minutes,
          });
        }
      }
    } else if (r.done && r.doneAt === today) {
      doneToday += r.minutes;
      todayDone.push({
        resId: r.id,
        secId: null,
        title: r.title,
        type: r.type,
        url: r.url,
        minutes: r.minutes,
      });
    }
  }

  let pct = total ? Math.round((done / total) * 100) : 0;
  if (pct === 100 && done < total) pct = 99;
  return {
    total,
    done,
    remaining: total - done,
    pct,
    doneToday,
    todayDone,
    readiness: wSum ? wRate / wSum : null,
    rated,
    doneCount,
    count: g.resources.length,
    low,
  };
}
