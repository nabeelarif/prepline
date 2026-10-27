import { diffDays, todayISO } from '../domain/dates';
import { pl } from '../domain/format';
import { metrics } from '../domain/metrics';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { Logo } from './icons';

function goalStatus(g: Goal, today: string): { pct: number; sub: string } {
  const m = metrics(g, today);
  const dl = diffDays(today, g.targetDate);
  const sub =
    m.total && m.remaining === 0
      ? 'Complete'
      : dl < 0
        ? 'Past target'
        : dl === 0
          ? 'Due today'
          : `${pl(dl, 'day')} left`;
  return { pct: m.pct, sub };
}

export function Sidebar() {
  const goals = useStore((s) => s.data.goals);
  const activeId = useStore((s) => s.data.activeGoalId);
  const storageOK = useStore((s) => s.storageOK);
  const selectGoal = useStore((s) => s.selectGoal);
  const openOverlay = useStore((s) => s.openOverlay);
  const today = todayISO();

  return (
    <aside className="side">
      <div className="brand">
        <Logo />
        <span>Prepline</span>
      </div>
      {goals.length > 0 && (
        <>
          <p className="side-label">Goals</p>
          <ul className="goal-list">
            {goals.map((g) => {
              const { pct, sub } = goalStatus(g, today);
              return (
                <li key={g.id}>
                  <button
                    className="goal-btn"
                    aria-current={g.id === activeId}
                    onClick={() => selectGoal(g.id)}
                  >
                    <span className="goal-name">{g.name}</span>
                    <span className="goal-row">
                      <span className="mini">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                      <span className="mono">{pct}%</span>
                    </span>
                    <span className="goal-row">{sub}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button
        className="btn ghost full"
        onClick={() => openOverlay({ kind: 'goal', goalId: null })}
      >
        + New goal
      </button>
      <div className="side-foot">
        <button className="btn ghost full" onClick={() => openOverlay({ kind: 'data' })}>
          Backup and restore
        </button>
        <p className={`store-note${storageOK ? '' : ' off'}`}>
          <i />
          {storageOK ? 'Saved in this browser' : 'Not saving: browser storage is blocked'}
        </p>
      </div>
    </aside>
  );
}
