import { addDays, diffDays, todayISO } from './dates';
import type { Metrics } from './metrics';
import type { Goal, ISODate } from './types';

export type PaceKind = 'idle' | 'done' | 'past' | 'on_track' | 'at_risk' | 'behind' | 'no_capacity';

export interface Pace {
  kind: PaceKind;
  /** Calendar days from today to the target date, counting today. 0 or less when past. */
  daysLeft: number;
  /** Minutes a day needed to finish the remaining work by the target date. */
  requiredPerDay: number;
}

/** Within this share of capacity the plan is at risk rather than on track. */
const RISK_MARGIN = 0.9;

/**
 * Whether the remaining work fits before the target date at the plan's daily capacity.
 * Without a capacity, only the required pace is reported.
 */
export function pace(g: Goal, met: Metrics, today: ISODate = todayISO()): Pace {
  const daysLeft = diffDays(today, g.targetDate) + 1;
  const requiredPerDay = daysLeft > 0 ? met.remaining / daysLeft : met.remaining;
  const out = (kind: PaceKind): Pace => ({ kind, daysLeft, requiredPerDay });

  if (met.total === 0) return out('idle');
  if (met.remaining === 0) return out('done');
  if (daysLeft <= 0) return out('past');
  if (g.hoursPerDay == null) return out('no_capacity');
  const cap = g.hoursPerDay * 60;
  if (requiredPerDay > cap) return out('behind');
  return out(requiredPerDay > cap * RISK_MARGIN ? 'at_risk' : 'on_track');
}

/**
 * The day the remaining work would be finished at the plan's daily capacity, counting today
 * as the first day. Null without a capacity or when there is nothing left to do.
 */
export function estimatedFinish(
  met: Metrics,
  hoursPerDay: number | null,
  today: ISODate = todayISO(),
): ISODate | null {
  if (met.total === 0 || met.remaining === 0) return null;
  if (hoursPerDay == null || hoursPerDay <= 0) return null;
  const days = Math.ceil(met.remaining / (hoursPerDay * 60));
  return addDays(today, days - 1);
}

export interface Velocity {
  kind: 'on_track' | 'at_risk' | 'behind';
  /** Minutes a day needed, and minutes a day the plan sets aside. */
  requiredMin: number;
  plannedMin: number;
  /** Planned minus required: positive is spare time each day, negative is a shortfall. */
  diffMin: number;
  /** Planned over required, to one decimal; null when nothing is required. */
  ratio: number | null;
}

/** Required against planned daily time; null when there is nothing to compare. */
export function velocity(p: Pace, hoursPerDay: number | null): Velocity | null {
  if (p.kind !== 'on_track' && p.kind !== 'at_risk' && p.kind !== 'behind') return null;
  if (hoursPerDay == null) return null;
  const plannedMin = hoursPerDay * 60;
  const ratio = p.requiredPerDay > 0 ? Math.round((plannedMin / p.requiredPerDay) * 10) / 10 : null;
  return {
    kind: p.kind,
    requiredMin: p.requiredPerDay,
    plannedMin,
    diffMin: plannedMin - p.requiredPerDay,
    ratio,
  };
}
