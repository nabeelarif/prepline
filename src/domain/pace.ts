import { diffDays, todayISO } from './dates';
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
