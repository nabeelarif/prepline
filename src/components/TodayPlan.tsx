import type { CSSProperties } from 'react';
import { RATE_LABELS } from '../domain/constants';
import { fmtDate, relDay } from '../domain/dates';
import { fmtMin } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import type { PlannedUnit, Schedule } from '../domain/schedule';
import type { ISODate, WorkUnit } from '../domain/types';
import { safeUrl } from '../domain/urls';
import { useStore } from '../state/store';
import { TypeChip } from './TypeChip';

function UnitTitle({ title, url }: { title: string; url: string }) {
  const href = safeUrl(url);
  return href ? (
    <a className="tt" href={href} target="_blank" rel="noopener noreferrer">
      {title}
    </a>
  ) : (
    <span className="tt">{title}</span>
  );
}

function TodoItem({ unit, done }: { unit: WorkUnit | PlannedUnit; done: boolean }) {
  const toggleResource = useStore((s) => s.toggleResource);
  const toggleSection = useStore((s) => s.toggleSection);
  const split = 'split' in unit && unit.split && !done;
  const toggle = () =>
    unit.secId ? toggleSection(unit.resId, unit.secId) : toggleResource(unit.resId);

  return (
    <li className={done ? 'is-done' : undefined}>
      <button
        className={`tick${done ? ' on' : ''}`}
        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${unit.title}`}
        onClick={toggle}
      />
      <div className="t">
        <UnitTitle title={unit.title} url={unit.url} />
        <span className="sub">
          <TypeChip type={unit.type} />
          {unit.parent && <span>{unit.parent}</span>}
          <span className="mono">
            {split ? `${fmtMin(unit.minutes)} of ${fmtMin(unit.full)}` : fmtMin(unit.minutes)}
          </span>
        </span>
      </div>
    </li>
  );
}

interface Props {
  met: Metrics;
  sch: Schedule;
  today: ISODate;
}

export function TodayPlan({ met, sch, today }: Props) {
  const openOverlay = useStore((s) => s.openOverlay);
  const day = sch.days[0];
  const planned = met.remaining > 0 && day?.date === today ? day.minutes : 0;

  let body;
  if (met.total === 0) {
    body = (
      <>
        <p className="empty-note">Nothing planned yet. Add a resource and it shows up here.</p>
        <button
          className="btn primary"
          onClick={() => openOverlay({ kind: 'resource', resourceId: null })}
        >
          Add your first resource
        </button>
      </>
    );
  } else if (met.remaining === 0) {
    body = (
      <>
        <p className="empty-note">
          Everything on this goal is done.
          {met.low.length > 0 && ' These are the ones you rated 3 or lower and could review again:'}
        </p>
        {met.low.length > 0 && (
          <ul className="todo">
            {met.low.map((r) => (
              <li key={r.id}>
                <span className="ring" style={{ '--p': 100 } as CSSProperties} aria-hidden="true" />
                <div className="t">
                  <UnitTitle title={r.title} url={r.url} />
                  <span className="sub">
                    <TypeChip type={r.type} />
                    <span>
                      Rated {r.rating} · {RATE_LABELS[r.rating!]}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  } else if (day && day.date === today) {
    body = (
      <ul className="todo">
        {day.items.map((u) => (
          <TodoItem key={`${u.resId}:${u.secId}`} unit={u} done={false} />
        ))}
      </ul>
    );
  } else if (day) {
    body = (
      <p className="empty-note">
        You have put in {fmtMin(met.doneToday)} today, which covers your daily plan. Next up{' '}
        {relDay(day.date, today).toLowerCase()}: <strong>{day.items[0]!.title}</strong>.
      </p>
    );
  }

  return (
    <section className="card" aria-labelledby="todayH">
      <div className="card-head">
        <h2 id="todayH">Today</h2>
        {planned > 0 && <span className="mono muted">{fmtMin(planned)} planned</span>}
        <span className="hl">{fmtDate(today)}</span>
      </div>
      {body}
      {met.todayDone.length > 0 && (
        <>
          <p className="subhead">Done today</p>
          <ul className="todo">
            {met.todayDone.map((u) => (
              <TodoItem key={`${u.resId}:${u.secId}`} unit={u} done />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
