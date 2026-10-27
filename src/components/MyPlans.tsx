import {
  CalendarDays,
  Copy,
  DatabaseBackup,
  Ellipsis,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { fmtDate, todayISO } from '../domain/dates';
import { fmtHours } from '../domain/format';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { useStore } from '../state/store';
import { EmptyState } from './EmptyState';
import { Menu } from './Menu';
import { daysLeftText, paceText } from './paceText';
import { ProgressRing } from './ProgressRing';

export function MyPlans() {
  const goals = useStore((s) => s.data.goals);
  const activeId = useStore((s) => s.data.activeGoalId);
  const { selectGoal, openOverlay, duplicateGoal, deleteGoal } = useStore.getState();
  const today = todayISO();
  const newPlan = () => openOverlay({ kind: 'goal', goalId: null });

  return (
    <>
      <header className="page-head">
        <h1>My Plans</h1>
        <div className="btn-row">
          <button className="btn" onClick={() => openOverlay({ kind: 'data' })}>
            <DatabaseBackup size={17} aria-hidden="true" /> Backup and restore
          </button>
          <button className="btn primary" onClick={newPlan}>
            <Plus size={18} aria-hidden="true" /> New plan
          </button>
        </div>
      </header>
      {!goals.length ? (
        <section className="card">
          <EmptyState
            icon={<Target />}
            title="Start your preparation journey"
            action={
              <button className="btn primary" onClick={newPlan}>
                Create Your First Plan
              </button>
            }
          >
            Create your first plan, set a target date, and organize the resources you want to
            complete.
          </EmptyState>
        </section>
      ) : (
        <ul className="plan-grid">
          {goals.map((g) => {
            const m = metrics(g.resources);
            const p = pace(g, m, today);
            const active = g.id === activeId;
            return (
              <li key={g.id} className={`card plan-card${active ? ' is-active' : ''}`}>
                <div className="plan-top">
                  <ProgressRing pct={m.pct} size={56} stroke={6} label={`${m.pct}% complete`}>
                    <strong className="small">{m.pct}%</strong>
                  </ProgressRing>
                  <div className="plan-title">
                    <h2>{g.name}</h2>
                    {active && <span className="badge">Current</span>}
                  </div>
                  <Menu
                    label={`Actions for ${g.name}`}
                    triggerClass="icon-btn"
                    trigger={<Ellipsis size={18} />}
                    align="end"
                    items={[
                      {
                        label: 'Edit plan',
                        icon: <Pencil size={16} />,
                        onSelect: () => openOverlay({ kind: 'goal', goalId: g.id }),
                      },
                      {
                        label: 'Duplicate plan',
                        icon: <Copy size={16} />,
                        onSelect: () => duplicateGoal(g.id),
                      },
                      'divider',
                      {
                        label: 'Delete plan',
                        icon: <Trash2 size={16} />,
                        danger: true,
                        confirm: 'Delete plan, phases and resources?',
                        onSelect: () => deleteGoal(g.id),
                      },
                    ]}
                  />
                </div>
                {g.description && <p className="plan-desc">{g.description}</p>}
                <dl className="plan-facts">
                  <div>
                    <dt>
                      <CalendarDays size={15} aria-hidden="true" /> Target
                    </dt>
                    <dd>
                      {fmtDate(g.targetDate, true)} · {daysLeftText(today, g.targetDate)}
                    </dd>
                  </div>
                  <div>
                    <dt>Resources</dt>
                    <dd>
                      {m.doneCount} / {m.count} completed
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{fmtHours(m.remaining)}</dd>
                  </div>
                </dl>
                <div className="plan-foot">
                  <span className={`pace pace-${p.kind}`}>
                    <span className="pill">{paceText(p, g).label}</span>
                  </span>
                  <button className="btn sm primary" onClick={() => selectGoal(g.id)}>
                    Open plan
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
