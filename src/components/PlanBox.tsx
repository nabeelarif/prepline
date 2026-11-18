import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Hourglass,
  ListPlus,
  PartyPopper,
  Play,
  Pencil,
  Plus,
  Share2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { diffDays, fmtDate } from '../domain/dates';
import { fmtHours, pl } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import { estimatedFinish, type Pace } from '../domain/pace';
import type { Goal, ISODate } from '../domain/types';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { Menu } from './Menu';
import { daysLeftTile, paceText, untilText } from './paceText';
import { ProgressRing } from './ProgressRing';
import { VelocityStrip } from './VelocityStrip';

const hrs = (m: number) => Math.round((m / 60) * 10) / 10;

/** Estimated completion at the planned daily hours, and how it compares with the target. */
function Estimate({ goal, met, today }: { goal: Goal; met: Metrics; today: ISODate }) {
  const finish = estimatedFinish(met, goal.hoursPerDay, today);
  // Without daily hours the velocity strip already says how to get an estimate.
  if (!finish || !goal.startDate) return null;
  const ahead = goal.targetDate ? diffDays(finish, goal.targetDate) : null;
  return (
    <p className="estimate">
      <span className="estimate-label">Estimated completion</span>
      <strong>{fmtDate(finish, true)}</strong>
      {ahead !== null && (
        <span className={ahead >= 0 ? 'est-good' : 'est-bad'}>
          {ahead > 0
            ? `${pl(ahead, 'day')} ahead of deadline`
            : ahead === 0
              ? 'Right on the deadline'
              : `${pl(-ahead, 'day')} after deadline`}
        </span>
      )}
    </p>
  );
}

/** Everything about the current plan in one card: status, title, actions, and progress. */
export function PlanBox({
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
  const goals = useStore((s) => s.data.goals);
  const { selectGoal, openOverlay } = useStore.getState();
  const navigate = useNavigate();
  // On a plan's own page the address names the plan, so switching changes the address too.
  const onPlanPage = useParams().planId !== undefined;

  const pt = paceText(pace, goal);
  // Schema and `startPlan` keep a deadline from existing without a start.
  const target = goal.targetDate;
  const [daysNum, daysLabel] = !goal.startDate
    ? ['–', 'Not started']
    : !target
      ? ['–', 'No deadline']
      : daysLeftTile(today, target);

  return (
    <section className="card plan-box" aria-label="Plan overview">
      <div className={`plan-status pace-${pace.kind}`}>
        {pace.kind === 'done' ? (
          <p className="done-note">
            <PartyPopper aria-hidden="true" />
            <span>
              <strong>Preparation complete!</strong> Every resource in this plan is done.
            </span>
          </p>
        ) : (
          <span className="pill" title={pt.detail}>
            {pt.label}
          </span>
        )}
        {!goal.startDate ? (
          <p className="target">
            <CalendarDays size={18} aria-hidden="true" />
            <span>Not started yet. Start whenever you are ready.</span>
            <button
              className="btn sm primary"
              onClick={() => openOverlay({ kind: 'start', goalId: goal.id })}
            >
              <Play size={14} aria-hidden="true" /> Start plan
            </button>
          </p>
        ) : target ? (
          <p className="target">
            <CalendarDays size={18} aria-hidden="true" />
            <span>
              Target: <strong>{fmtDate(target, true)}</strong>{' '}
              <span className="muted">({untilText(today, target)})</span>
            </span>
          </p>
        ) : null}
        <Estimate goal={goal} met={met} today={today} />
      </div>

      <div className="plan-head">
        <div className="plan-pick">
          <Menu
            label={`Current plan: ${goal.name}. Switch plan`}
            triggerClass="plan-btn"
            trigger={
              <>
                <h1>{goal.name}</h1>
                <ChevronDown size={18} aria-hidden="true" />
              </>
            }
            items={[
              { heading: 'Your plans' },
              ...goals.map((g) => ({
                label: g.name,
                checked: g.id === goal.id,
                icon: g.id === goal.id ? <Check size={16} /> : <span className="menu-gap" />,
                onSelect: () => (onPlanPage ? navigate(paths.plan(g.id)) : selectGoal(g.id)),
              })),
              'divider',
              {
                label: 'New plan',
                icon: <Plus size={16} />,
                onSelect: () => openOverlay({ kind: 'goal', goalId: null }),
              },
            ]}
          />
          <button
            className="icon-btn"
            aria-label="Share plan"
            title="Share plan"
            onClick={() => openOverlay({ kind: 'share', goalId: goal.id })}
          >
            <Share2 size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label="Edit plan"
            title="Edit plan"
            onClick={() => openOverlay({ kind: 'goal', goalId: goal.id })}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="plan-actions">
          <button
            className="btn"
            title="Group resources into milestones (optional)"
            onClick={() => openOverlay({ kind: 'phase', phaseId: null })}
          >
            <ListPlus size={18} aria-hidden="true" /> Add Phase
          </button>
          <button
            className="btn primary"
            title="Add an article, video, course or practice"
            onClick={() => openOverlay({ kind: 'resource', resourceId: null })}
          >
            <Plus size={18} aria-hidden="true" /> Add Resource
          </button>
        </div>
      </div>
      {goal.source && (
        <p className="muted plan-source">
          Forked from <Link to={paths.shared(goal.source.slug)}>{goal.source.name}</Link>
        </p>
      )}

      <VelocityStrip goal={goal} met={met} pace={pace} />

      <div className="plan-stats">
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
      </div>
    </section>
  );
}
