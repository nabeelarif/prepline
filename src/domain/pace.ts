import { diffDays, fmtDate, todayISO } from './dates';
import { fmtMin, pl } from './format';
import type { Metrics } from './metrics';
import type { Schedule } from './schedule';
import type { Goal, ISODate } from './types';

export type PaceKind = 'idle' | 'done' | 'ok' | 'bad';

export interface Pace {
  kind: PaceKind;
  label: string;
  detail: string;
}

export function pace(g: Goal, met: Metrics, sch: Schedule, today: ISODate = todayISO()): Pace {
  const daysLeft = diffDays(today, g.targetDate) + 1;
  if (met.total === 0)
    return {
      kind: 'idle',
      label: 'Nothing planned yet',
      detail:
        'Add the articles, videos and courses you want to get through. Prepline lays them out across the days before your target date.',
    };
  if (met.remaining === 0)
    return {
      kind: 'done',
      label: 'Complete',
      detail: 'Every resource is done. Revisit anything you rated 3 or lower before the big day.',
    };

  const daily = fmtMin(g.hoursPerDay * 60);
  // remaining > 0 here, so the schedule has at least one day.
  const finish = sch.finish!;
  const need = Math.ceil(met.remaining / Math.max(1, daysLeft) / 5) * 5;
  if (daysLeft <= 0)
    return {
      kind: 'bad',
      label: 'Past target',
      detail: `The target was ${fmtDate(g.targetDate)}. At ${daily} a day you finish on ${fmtDate(finish)}. Pick a new date in Edit goal.`,
    };
  if (finish <= g.targetDate) {
    const spare = diffDays(finish, g.targetDate);
    return {
      kind: 'ok',
      label: spare > 0 ? `On track · ${pl(spare, 'day')} spare` : 'On track · no slack',
      detail: `At ${daily} a day you finish on ${fmtDate(finish)}. The minimum pace to make your date is ${fmtMin(need)} a day.`,
    };
  }
  const late = diffDays(g.targetDate, finish);
  return {
    kind: 'bad',
    label: `Behind · ${pl(late, 'day')} late`,
    detail: `At ${daily} a day you finish on ${fmtDate(finish)}. To make ${fmtDate(g.targetDate)}, plan for ${fmtMin(need)} a day or trim the list.`,
  };
}
