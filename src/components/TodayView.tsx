import { ExternalLink, Flame, Gauge, Play } from 'lucide-react';
import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDate, relDay, todayISO } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import { metrics } from '../domain/metrics';
import { resStatus } from '../domain/resources';
import { studyPlan, type StudyDay, type StudySlice } from '../domain/schedule';
import { currentStreak } from '../domain/studyLog';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { useTimer } from '../state/timer';
import { DoneTick } from './DoneTick';
import { ProgressRing } from './ProgressRing';
import { TypeIcon } from './icons';
import { ResourceLink } from './ResourceLink';
import { TimerButton } from './TimerButton';

type Range = 'today' | 'week';

/** The study list for today, or the next seven days, filled from the plan's priority order. */
export function TodayView({ goal }: { goal: Goal }) {
  // The range lives in the address, so a reload or a shared link keeps it.
  const [params, setParams] = useSearchParams();
  const range: Range = params.get('range') === 'week' ? 'week' : 'today';
  const setRange = (r: Range) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (r === 'week') next.set('range', 'week');
        else next.delete('range');
        return next;
      },
      { replace: true },
    );
  const today = todayISO();
  const days = studyPlan(goal, range === 'today' ? 1 : 7, today);
  const budget = days[0]?.budget ?? null;
  const finished = metrics(goal.resources).remaining === 0;
  const log = useStore((s) => s.studyLog);
  const timing = useTimer((s) => s.timer !== null);
  const studied = days[0]?.studied ?? 0;
  const dayPct = budget ? Math.round(Math.min(100, (studied / budget) * 100)) : 0;
  const streak = log.ready ? currentStreak(log.days, today) : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{range === 'today' ? 'Today' : 'This week'}</h1>
          <p className="muted today-sub">
            {goal.name} · {fmtDate(today)}
            {budget != null && ` · ${fmtHours(budget)} a day`}
          </p>
          {log.ready && (
            <p className="today-streak">
              <Flame size={16} aria-hidden="true" className={streak > 0 ? 'lit' : ''} />{' '}
              {streak > 0 ? `${pl(streak, 'day')} streak` : 'No streak yet'}
              {streak > 0 && !timing && (log.days[today] ?? 0) === 0 && ' · study today to keep it'}
            </p>
          )}
        </div>
        <div className="today-head-side">
          {range === 'today' && budget != null && goal.startDate && (
            <ProgressRing
              pct={dayPct}
              size={64}
              stroke={7}
              label={`${fmtHours(studied)} of ${fmtHours(budget)} studied today`}
            >
              <strong>{dayPct}%</strong>
            </ProgressRing>
          )}
          <div className="seg" role="group" aria-label="Range">
            {(['today', 'week'] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn sm${range === r ? ' primary' : ''}`}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r === 'today' ? 'Today' : 'This week'}
              </button>
            ))}
          </div>
        </div>
      </header>
      {!goal.startDate ? (
        <Notice title="This plan has not started">
          Start it to get a daily list.{' '}
          <button
            className="btn sm primary"
            onClick={() => useStore.getState().openOverlay({ kind: 'start', goalId: goal.id })}
          >
            Start plan
          </button>
        </Notice>
      ) : !goal.resources.length ? (
        <Notice title="Nothing to study yet">Add resources to this plan to fill your day.</Notice>
      ) : (
        <>
          {finished && <Notice title="All done">Every resource in this plan is complete.</Notice>}
          {budget == null && (
            <p className="muted">
              Set daily study hours or a deadline in Edit plan to fill each day. Showing what to
              work on next.
            </p>
          )}
          {days.map((d) => (
            <DaySection
              key={d.date}
              day={d}
              goalId={goal.id}
              today={today}
              showHeading={range === 'week'}
              finished={finished}
            />
          ))}
        </>
      )}
    </>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card today-notice">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

function DaySection({
  day,
  goalId,
  today,
  showHeading,
  finished,
}: {
  day: StudyDay;
  goalId: string;
  today: string;
  showHeading: boolean;
  finished: boolean;
}) {
  // Only items that appear after the page opened slide in, not ones already there.
  const seen = useRef(new Set(day.studiedItems.map((x) => x.resource.id)));
  return (
    <section className="card today-day" aria-label={relDay(day.date, today)}>
      {showHeading && (
        <h2>
          {relDay(day.date, today)}
          <span className="muted">
            {' '}
            ·{' '}
            {day.slices.length
              ? fmtHours(day.minutes)
              : day.studied > 0
                ? 'Done for today'
                : 'Nothing planned'}
          </span>
        </h2>
      )}
      {day.studied > 0 && (
        <p className="today-studied">
          <strong>{fmtHours(day.studied)}</strong>
          {day.budget != null && ` of ${fmtHours(day.budget)}`} done today
          {day.budget != null && day.studied >= day.budget && !finished && ' · goal reached'}
        </p>
      )}
      {!day.slices.length && !showHeading && day.studied === 0 && !finished && (
        <p className="muted">Nothing planned.</p>
      )}
      <ul className="today-list">
        {day.slices.map((s) => (
          <SliceRow
            key={`${s.resource.id}:${s.from}`}
            goalId={goalId}
            slice={s}
            actions={day.date === today}
          />
        ))}
      </ul>
      {day.studiedItems.length > 0 && (
        <>
          <h3 className="today-sub-h">Done today</h3>
          <ul className="today-list">
            {day.studiedItems.map(({ resource: r, minutes }) => (
              <li
                key={r.id}
                className={`today-item${seen.current.has(r.id) ? '' : ' arrive'}${r.done ? ' is-done' : ''}`}
              >
                <DoneTick r={r} />
                <TypeIcon type={r.type} size={20} />
                <div className="today-main">
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    {fmtHours(minutes)}
                    {r.done && ' · completed'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {day.slices.length > 0 && (
        <p className="muted small today-total">
          {fmtHours(day.minutes)}
          {day.studied > 0
            ? ' left today'
            : day.budget != null && ` of ${fmtHours(day.budget)} planned`}
        </p>
      )}
    </section>
  );
}

function SliceRow({
  goalId,
  slice,
  actions,
}: {
  goalId: string;
  slice: StudySlice;
  actions: boolean;
}) {
  const { setStatus, openOverlay } = useStore.getState();
  const r = slice.resource;
  const active = resStatus(r) === 'in_progress';
  const partial = slice.minutes < r.minutes;

  return (
    <li className="today-item">
      {actions && <DoneTick r={r} />}
      <TypeIcon type={r.type} size={20} />
      <div className="today-main">
        <strong>{r.title}</strong>
        <span className="muted small">
          {fmtHours(slice.minutes)}
          {partial && ` of ${fmtHours(r.minutes)}`}
          {slice.from > 0 && ` · ${fmtHours(slice.from)} done`}
          {slice.finishes && partial && ' · finishes it'}
        </span>
      </div>
      {actions && (
        <div className="btn-row">
          <TimerButton goalId={goalId} r={r} />
          {active && (
            <button
              className="btn sm"
              onClick={() => openOverlay({ kind: 'details', resourceId: r.id })}
            >
              <Gauge size={15} aria-hidden="true" /> Update progress
            </button>
          )}
          {!active && !r.url && (
            <button className="btn sm" onClick={() => setStatus(r.id, 'in_progress')}>
              <Play size={15} aria-hidden="true" /> Start
            </button>
          )}
          <ResourceLink
            r={r}
            className="btn sm primary"
            onOpen={() => !active && setStatus(r.id, 'in_progress')}
          >
            <ExternalLink size={15} aria-hidden="true" /> {active ? 'Continue' : 'Open'}
          </ResourceLink>
        </div>
      )}
    </li>
  );
}
