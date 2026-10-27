import { diffDays, fmtDate } from '../domain/dates';
import { fmtMin, pl } from '../domain/format';
import type { Pace } from '../domain/pace';
import type { Goal, ISODate } from '../domain/types';
import { useStore } from '../state/store';

export function GoalHeader({ goal, pace, today }: { goal: Goal; pace: Pace; today: ISODate }) {
  const openOverlay = useStore((s) => s.openOverlay);
  const dl = diffDays(today, goal.targetDate);
  const left = dl < 0 ? `${pl(-dl, 'day')} past` : dl === 0 ? 'due today' : `${pl(dl, 'day')} left`;

  return (
    <header className="goal-head">
      <div>
        <p className="eyebrow">Goal</p>
        <h1>{goal.name}</h1>
        <p className="gh-meta">
          Target <strong>{fmtDate(goal.targetDate)}</strong> · {left} ·{' '}
          {fmtMin(goal.hoursPerDay * 60)} a day
        </p>
      </div>
      <div className="gh-side">
        <span className={`pill pill-${pace.kind}`}>{pace.label}</span>
        <button
          className="btn ghost sm"
          onClick={() => openOverlay({ kind: 'goal', goalId: goal.id })}
        >
          Edit goal
        </button>
      </div>
      <p className="gh-detail">{pace.detail}</p>
    </header>
  );
}
