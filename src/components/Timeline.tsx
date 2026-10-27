import type { ReactNode } from 'react';
import { DAY_LIMIT, RESOURCE_TYPES } from '../domain/constants';
import { diffDays, fmtDate, relDay } from '../domain/dates';
import { fmtMin, pl } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import type { Schedule, StudyDay } from '../domain/schedule';
import type { Goal, ISODate } from '../domain/types';
import { useStore } from '../state/store';
import { TypeChip } from './TypeChip';

function DayStop({ d, late, today }: { d: StudyDay; late: boolean; today: ISODate }) {
  const isToday = d.date === today;
  return (
    <li className={`stop${isToday ? ' is-today' : ''}${late ? ' is-late' : ''}`}>
      <span className="dot" />
      <div className="stop-head">
        <span className="stop-date">{relDay(d.date, today)}</span>
        <span className="mono muted">{fmtMin(d.minutes)}</span>
      </div>
      <ul className="stop-items">
        {d.items.map((u) => (
          <li key={`${u.resId}:${u.secId}:${u.part}`}>
            <i className={`tdot t-${u.type}`} aria-hidden="true" />
            <span>
              {u.title}
              {u.split && (
                <>
                  {' '}
                  <em>{u.part === 1 ? 'starts' : 'cont.'}</em>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function TargetStop({ goal, late, spare = 0 }: { goal: Goal; late: boolean; spare?: number }) {
  const note = late
    ? 'Anything after this point misses your date'
    : spare > 0
      ? `${pl(spare, 'day')} of slack after you finish`
      : 'You finish right on the day';
  return (
    <li className={`stop target${late ? ' late' : ''}`}>
      <span className="dot" />
      <div className="stop-head">
        <span className="stop-date">Target date</span>
        <span className="mono muted">{fmtDate(goal.targetDate)}</span>
      </div>
      <p className="stop-note">{note}</p>
    </li>
  );
}

interface Props {
  goal: Goal;
  met: Metrics;
  sch: Schedule;
  today: ISODate;
}

/** The plan drawn as a route: one stop per study day, plus the finish line and target date. */
export function Timeline({ goal, met, sch, today }: Props) {
  const showAll = useStore((s) => s.ui.showAllDays);
  const toggleShowAll = useStore((s) => s.toggleShowAllDays);

  const head = (
    <div className="card-head">
      <h2 id="tlH">Timeline</h2>
      {sch.days.length > 0 && (
        <span className="mono muted">
          {pl(sch.days.length, 'study day')} · {fmtMin(sch.cap)}/day
        </span>
      )}
    </div>
  );

  if (!sch.days.length || !sch.finish) {
    return (
      <section className="card" aria-labelledby="tlH">
        {head}
        <p className="empty-note">
          {met.total
            ? 'Everything is done, so there is nothing left to schedule.'
            : `Your plan appears here once you add resources. Each day gets ${fmtMin(sch.cap)} of work, in the order of your list.`}
        </p>
      </section>
    );
  }

  const finish = sch.finish;
  const late = finish > goal.targetDate;
  const limit = showAll ? sch.days.length : Math.min(sch.days.length, DAY_LIMIT);
  const rows: ReactNode[] = [];
  let targetShown = false;
  for (const d of sch.days.slice(0, limit)) {
    if (!targetShown && d.date > goal.targetDate) {
      rows.push(<TargetStop key="target" goal={goal} late />);
      targetShown = true;
    }
    rows.push(<DayStop key={d.date} d={d} late={d.date > goal.targetDate} today={today} />);
  }

  const hidden = sch.days.length - limit;
  if (hidden > 0 || sch.days.length > DAY_LIMIT) {
    rows.push(
      <li key="more" className="stop more">
        <span className="dot" />
        <button className="linkish" onClick={toggleShowAll}>
          {hidden > 0 ? `Show ${pl(hidden, 'more day')}` : 'Show fewer days'}
        </button>
      </li>,
    );
  }

  const fin = (
    <li key="finish" className={`stop finish${late ? ' late' : ''}`}>
      <span className="dot" />
      <div className="stop-head">
        <span className="stop-date">Finish line</span>
        <span className="mono muted">{fmtDate(finish)}</span>
      </div>
      <p className="stop-note">
        {late
          ? `${pl(diffDays(goal.targetDate, finish), 'day')} after your target`
          : 'Every resource done'}
      </p>
    </li>
  );
  if (late) {
    if (!targetShown) rows.push(<TargetStop key="target" goal={goal} late />);
    rows.push(fin);
  } else {
    rows.push(
      fin,
      <TargetStop
        key="target"
        goal={goal}
        late={false}
        spare={diffDays(finish, goal.targetDate)}
      />,
    );
  }

  return (
    <section className="card" aria-labelledby="tlH">
      {head}
      <div className="legend">
        {RESOURCE_TYPES.map((t) => (
          <TypeChip key={t} type={t} />
        ))}
      </div>
      <ol className="route">{rows}</ol>
    </section>
  );
}
