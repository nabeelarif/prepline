import { Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { fmtDate } from '../domain/dates';
import { fmtHours } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import { velocity, type Pace } from '../domain/pace';
import type { Goal } from '../domain/types';
import { paceText, velocityText } from './paceText';

/** Daily time needed against daily time planned, with a bar comparing the two. */
export function VelocityStrip({ goal, met, pace }: { goal: Goal; met: Metrics; pace: Pace }) {
  // No clock (nothing planned, done, not started, or no deadline): nothing to compare.
  if (pace.daysLeft === null || !goal.targetDate) return null;

  const v = velocity(pace, goal.hoursPerDay);
  if (!v) {
    const past = pace.kind === 'past';
    return (
      <div className={`velocity vel-${past ? 'behind' : 'info'}`}>
        <span className="vel-icon">
          <Gauge aria-hidden="true" />
        </span>
        <div className="vel-text">
          <p className="vel-head">
            <strong>
              {past
                ? 'Target date has passed'
                : `Daily pace needed: ${fmtHours(pace.requiredPerDay)}/day`}
            </strong>
            <span className="vel-tag">{past ? 'Past due' : 'Set daily hours'}</span>
          </p>
          <p className="vel-detail">
            {past
              ? `The remaining ${fmtHours(met.remaining)} were due ${fmtDate(goal.targetDate)}. `
              : `${fmtHours(met.remaining)} remain by ${fmtDate(goal.targetDate)}. `}
            {paceText(pace, goal).detail}
          </p>
        </div>
      </div>
    );
  }

  const t = velocityText(v, goal, met.remaining);
  const scale = Math.max(v.requiredMin, v.plannedMin);
  const pct = (m: number) => `${Math.min(100, (m / scale) * 100)}%`;
  const behind = v.kind === 'behind';
  const multiple = v.ratio == null ? '' : ` (${v.ratio}x ${behind ? 'of need' : 'buffer'})`;
  const barLabel = `Required ${fmtHours(v.requiredMin)} a day, planned ${fmtHours(v.plannedMin)} a day`;

  return (
    <div className={`velocity vel-${v.kind}`}>
      <span className="vel-icon">
        {behind ? <TrendingDown aria-hidden="true" /> : <TrendingUp aria-hidden="true" />}
      </span>
      <div className="vel-text">
        <p className="vel-head">
          <strong>{t.headline}</strong>
          <span className="vel-tag">{t.tag}</span>
        </p>
        <p className="vel-detail">{t.detail}</p>
      </div>
      <div className="vel-compare">
        <p className="vel-labels">
          <span>Req: {fmtHours(v.requiredMin)}</span>
          <span>
            Planned: {fmtHours(v.plannedMin)}
            {multiple}
          </span>
        </p>
        <div className="vel-bar" role="img" aria-label={barLabel}>
          {/* Behind: the planned part fills first and the shortfall shows in red. */}
          <span
            className="vel-seg vel-base"
            style={{ width: pct(Math.min(v.requiredMin, v.plannedMin)) }}
          />
          <span className="vel-seg vel-diff" style={{ width: pct(Math.abs(v.diffMin)) }} />
        </div>
      </div>
    </div>
  );
}
