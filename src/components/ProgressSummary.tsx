import { CalendarClock, Clock, FileText, Hourglass, PartyPopper } from 'lucide-react';
import { diffDays } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import type { Pace } from '../domain/pace';
import type { Goal, ISODate } from '../domain/types';
import { paceText } from './paceText';
import { ProgressRing } from './ProgressRing';

const hrs = (m: number) => Math.round((m / 60) * 10) / 10;

export function ProgressSummary({
  goal,
  met,
  pace,
  today,
}: {
  goal: Goal;
  met: Metrics;
  pace: Pace;
  today: ISODate;
}) {
  const pt = paceText(pace, goal);
  const dl = diffDays(today, goal.targetDate);
  const [daysNum, daysLabel] =
    dl > 0 ? [pl(dl, 'day'), 'Left'] : dl === 0 ? ['Today', 'Due'] : [pl(-dl, 'day'), 'Past due'];

  return (
    <section className="card summary" aria-label="Progress summary">
      <ProgressRing
        pct={met.pct}
        size={116}
        stroke={11}
        label={`${met.pct}% complete, ${hrs(met.done)} of ${hrs(met.total)} hours`}
      >
        <strong>{met.pct}%</strong>
        <small>
          {hrs(met.done)} / {hrs(met.total)} hours
        </small>
      </ProgressRing>
      <ul className="metrics">
        <li>
          <FileText aria-hidden="true" />
          <div>
            <strong>
              {met.doneCount} / {met.count}
            </strong>
            <span>Resources Completed</span>
          </div>
        </li>
        <li>
          <Clock aria-hidden="true" />
          <div>
            <strong>{fmtHours(met.done)}</strong>
            <span>Completed</span>
          </div>
        </li>
        <li>
          <Hourglass aria-hidden="true" />
          <div>
            <strong>{fmtHours(met.remaining)}</strong>
            <span>Remaining</span>
          </div>
        </li>
        <li>
          <CalendarClock aria-hidden="true" />
          <div>
            <strong>{daysNum}</strong>
            <span>{daysLabel}</span>
          </div>
        </li>
      </ul>
      <div className={`pace pace-${pace.kind}`}>
        {pace.kind === 'done' ? (
          <p className="done-note">
            <PartyPopper aria-hidden="true" />
            <span>
              <strong>Preparation complete!</strong> Every resource in this plan is done.
            </span>
          </p>
        ) : (
          <>
            <span className="pill">{pt.label}</span>
            <span className="pace-detail">{pt.detail}</span>
          </>
        )}
      </div>
    </section>
  );
}
