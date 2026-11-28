import { ChevronLeft, ChevronRight, ExternalLink, Flame, Gauge, Play } from 'lucide-react';
import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtDate, relDay, todayISO } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import { resStatus } from '../domain/resources';
import { dayAgenda, planStatus, type StudyDay, type StudySlice } from '../domain/schedule';
import { currentStreak } from '../domain/studyLog';
import type { Goal } from '../domain/types';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { useTimer } from '../state/timer';
import { DoneTick } from './DoneTick';
import { ProgressRing } from './ProgressRing';
import { ResourceLink } from './ResourceLink';
import { TimerButton } from './TimerButton';
import { TypeLabel } from './TypeLabel';

/** How many days past today can be looked at. Further out, the guess is worth little. */
const DAYS_AHEAD = 6;

/** The day to show, as days from today; anything unusable in the address means today. */
function dayOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= DAYS_AHEAD ? n : 0;
}

/**
 * What to study on one day in every plan in progress, filled from each plan's priority
 * order. Opens on today and steps forward a day at a time.
 */
export function TodayView() {
  // The day lives in the address, so a reload keeps it.
  const [params, setParams] = useSearchParams();
  const offset = dayOffset(params.get('day'));
  const nextRef = useRef<HTMLButtonElement>(null);
  const goTo = (to: number) => {
    if (to < 0 || to > DAYS_AHEAD) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (to > 0) next.set('day', String(to));
        else next.delete('day');
        return next;
      },
      { replace: true },
    );
  };

  const goals = useStore((s) => s.data.goals);
  const log = useStore((s) => s.studyLog);
  const timing = useTimer((s) => s.timer !== null);
  const today = todayISO();
  const isToday = offset === 0;
  const agenda = dayAgenda(goals, offset, today);
  const inProgress = goals.filter((g) => planStatus(g) === 'in_progress').length;
  const waiting = goals.filter((g) => planStatus(g) === 'not_started');
  const streak = log.ready ? currentStreak(log.days, today) : 0;
  const { budget, target, credited } = agenda;
  // Rounded down, so 100% means the target is met. The nudge absorbs float error.
  const dayPct = target ? Math.floor((credited / target) * 100 + 1e-6) : 0;
  const planned = agenda.plans.reduce((a, p) => a + p.day.minutes, 0);
  // Today lists every plan in progress, so an empty list means there is none.
  const nothingStarted = isToday && !agenda.plans.length;
  const title = relDay(agenda.date, today);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 aria-live="polite">{title}</h1>
          <p className="muted today-sub">
            {[
              isToday && inProgress > 0 && `${pl(inProgress, 'plan')} in progress`,
              // Further out, the heading is already the date.
              offset < 2 && fmtDate(agenda.date),
              isToday
                ? budget != null && `${fmtHours(budget)} a day`
                : planned > 0 && `${fmtHours(planned)} planned`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {isToday && log.ready && (
            <p className="today-streak">
              <Flame size={16} aria-hidden="true" className={streak > 0 ? 'lit' : ''} />{' '}
              {streak > 0 ? `${pl(streak, 'day')} streak` : 'No streak yet'}
              {streak > 0 && !timing && (log.days[today] ?? 0) === 0 && ' · study today to keep it'}
            </p>
          )}
        </div>
        {!nothingStarted && (
          <div className="today-head-side">
            {isToday && target > 0 && (
              <ProgressRing
                pct={dayPct}
                size={64}
                stroke={7}
                label={`${fmtHours(credited)} of ${fmtHours(target)} studied today`}
              >
                <strong>{dayPct}%</strong>
              </ProgressRing>
            )}
            <div className="btn-row" role="group" aria-label="Day">
              {!isToday && (
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    goTo(0);
                    // This button goes away, so focus moves to one that stays.
                    nextRef.current?.focus();
                  }}
                >
                  Back to today
                </button>
              )}
              {/* aria-disabled, not disabled: a button that was just used keeps focus. */}
              <button
                type="button"
                className="btn sm icon-only"
                aria-label="Previous day"
                title="Previous day"
                aria-disabled={isToday}
                onClick={() => goTo(offset - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                ref={nextRef}
                type="button"
                className="btn sm"
                aria-disabled={offset === DAYS_AHEAD}
                onClick={() => goTo(offset + 1)}
              >
                Next day <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </header>
      {agenda.plans.length ? (
        <>
          {!isToday && <p className="muted today-assume">Assumes you finish the days before.</p>}
          {agenda.plans.map(({ goal, day }) => (
            <PlanDay
              // A new day starts over, so nothing on it slides in as if just finished.
              key={`${goal.id}:${day.date}`}
              goal={goal}
              day={day}
              isToday={isToday}
            />
          ))}
        </>
      ) : (
        <EmptyDay isToday={isToday} waiting={waiting} />
      )}
    </>
  );
}

/** Says why a day has no plan to list. */
function EmptyDay({ isToday, waiting }: { isToday: boolean; waiting: Goal[] }) {
  if (!isToday) {
    return (
      <Notice title="Nothing planned for this day">
        <p>Later days fill from plans with daily study hours or a deadline.</p>
      </Notice>
    );
  }
  if (waiting.length) return <StartAPlan plans={waiting} />;
  return (
    <Notice title="All done">
      <p>Every plan is complete.</p>
    </Notice>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card today-notice">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function StartAPlan({ plans }: { plans: Goal[] }) {
  return (
    <Notice title="No plan in progress">
      <p>Start a plan to get a daily list.</p>
      <ul className="today-list">
        {plans.map((g) => (
          <li key={g.id} className="today-item">
            <div className="today-main">
              <Link to={paths.plan(g.id)}>{g.name}</Link>
            </div>
            <button
              type="button"
              className="btn sm primary"
              aria-label={`Start ${g.name}`}
              onClick={() => useStore.getState().openOverlay({ kind: 'start', goalId: g.id })}
            >
              Start plan
            </button>
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/** One plan's share of the day. Only today's rows can be acted on. */
function PlanDay({ goal, day, isToday }: { goal: Goal; day: StudyDay; isToday: boolean }) {
  // Only items that appear after the page opened slide in, not ones already there.
  const seen = useRef(new Set(day.studiedItems.map((x) => x.resource.id)));
  const empty = !goal.resources.length;
  const finished = planStatus(goal) === 'completed';
  // A passed deadline gives no pace either, but the plan does have one.
  const overdue = goal.targetDate != null && goal.targetDate < day.date;
  const paceFix = overdue ? 'Pick a new date' : 'Set daily hours';
  const headingId = `today-plan-${goal.id}`;
  return (
    <section className="card today-day" aria-labelledby={headingId}>
      <div className="today-plan-head">
        <h2 id={headingId}>
          <Link to={paths.plan(goal.id)}>{goal.name}</Link>
        </h2>
        {day.budget != null && <span className="muted small">{fmtHours(day.budget)} a day</span>}
      </div>
      {empty && <p className="muted">Add resources to this plan to fill your day.</p>}
      {finished && <p className="muted">All done. Every resource in this plan is complete.</p>}
      {isToday && day.budget == null && !empty && !finished && (
        <p className="muted small">
          {overdue ? 'The deadline has passed' : 'No daily hours or deadline'}, so this shows what
          to work on next.{' '}
          <button
            type="button"
            className="btn sm ghost"
            aria-label={`${paceFix} for ${goal.name}`}
            onClick={() => useStore.getState().openOverlay({ kind: 'goal', goalId: goal.id })}
          >
            {paceFix}
          </button>
        </p>
      )}
      {day.studied > 0 && (
        <p className="today-studied">
          <strong>{fmtHours(day.studied)}</strong>
          {day.budget != null && ` of ${fmtHours(day.budget)}`} done today
          {day.budget != null && day.studied >= day.budget && !finished && ' · goal reached'}
        </p>
      )}
      <ul className="today-list">
        {day.slices.map((s) => (
          <SliceRow
            key={`${s.resource.id}:${s.from}`}
            goalId={goal.id}
            slice={s}
            actions={isToday}
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
                <div className="today-main">
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    <TypeLabel type={r.type} /> · {fmtHours(minutes)}
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
      <div className="today-main">
        <strong>{r.title}</strong>
        <span className="muted small">
          <TypeLabel type={r.type} /> · {fmtHours(slice.minutes)}
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
