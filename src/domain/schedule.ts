import { addDays, todayISO } from './dates';
import type { Metrics } from './metrics';
import type { Goal, ISODate, WorkUnit } from './types';

export interface PlannedUnit extends WorkUnit {
  /** Full length of the unit; `minutes` is the slice planned on this day. */
  full: number;
  /** 1-based index of this slice when the unit spans days. */
  part: number;
  split: boolean;
}

export interface StudyDay {
  date: ISODate;
  items: PlannedUnit[];
  minutes: number;
}

export interface Schedule {
  days: StudyDay[];
  /** Daily capacity in minutes. */
  cap: number;
  finish: ISODate | null;
}

/**
 * Packs unfinished work, in resource order, into days of `hoursPerDay` capacity.
 * Today's capacity is reduced by what was already done today; if under 10 minutes
 * remain, planning starts tomorrow. Units longer than the space left are split.
 */
export function schedule(g: Goal, met: Metrics, today: ISODate = todayISO()): Schedule {
  const cap = Math.max(15, Math.round(g.hoursPerDay * 60));
  const units: WorkUnit[] = [];
  for (const r of g.resources) {
    if (r.sections.length) {
      for (const s of r.sections) {
        if (!s.done)
          units.push({
            resId: r.id,
            secId: s.id,
            title: s.title,
            parent: r.title,
            type: r.type,
            url: r.url,
            minutes: Math.max(5, s.minutes),
          });
      }
    } else if (!r.done) {
      units.push({
        resId: r.id,
        secId: null,
        title: r.title,
        type: r.type,
        url: r.url,
        minutes: Math.max(5, r.minutes),
      });
    }
  }

  const days: StudyDay[] = [];
  let date = today;
  let left = cap - met.doneToday;
  let cur: StudyDay | null = null;
  if (left < 10) {
    date = addDays(date, 1);
    left = cap;
  }
  for (const u of units) {
    let rem = u.minutes;
    let part = 0;
    while (rem > 0) {
      if (left <= 0) {
        date = addDays(date, 1);
        left = cap;
      }
      if (!cur || cur.date !== date) {
        cur = { date, items: [], minutes: 0 };
        days.push(cur);
      }
      const take = Math.min(rem, left);
      part++;
      cur.items.push({
        ...u,
        minutes: take,
        full: u.minutes,
        part,
        split: take < u.minutes || part > 1,
      });
      cur.minutes += take;
      rem -= take;
      left -= take;
    }
  }
  return { days, cap, finish: days.length ? days[days.length - 1]!.date : null };
}
