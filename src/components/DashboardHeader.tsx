import { CalendarDays, Check, ChevronDown, FileText, Flag, Pencil, Plus } from 'lucide-react';
import { diffDays, fmtDate } from '../domain/dates';
import { pl } from '../domain/format';
import type { Goal, ISODate } from '../domain/types';
import { useStore } from '../state/store';
import { Menu } from './Menu';

/** "(6 weeks)" from two weeks out, otherwise days. */
function until(today: ISODate, target: ISODate): string {
  const dl = diffDays(today, target);
  if (dl < 0) return 'passed';
  if (dl === 0) return 'today';
  return dl >= 14 ? pl(Math.round(dl / 7), 'week') : pl(dl, 'day');
}

export function DashboardHeader({ goal, today }: { goal: Goal; today: ISODate }) {
  const goals = useStore((s) => s.data.goals);
  const { selectGoal, openOverlay } = useStore.getState();

  return (
    <header className="dash-head">
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
              onSelect: () => selectGoal(g.id),
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
          aria-label="Edit plan"
          title="Edit plan"
          onClick={() => openOverlay({ kind: 'goal', goalId: goal.id })}
        >
          <Pencil size={16} />
        </button>
      </div>

      <div className="target">
        <CalendarDays size={22} aria-hidden="true" />
        <div>
          <p className="target-label">Target Date</p>
          <p className="target-date">
            <strong>{fmtDate(goal.targetDate, true)}</strong>{' '}
            <span className="muted">({until(today, goal.targetDate)})</span>
          </p>
        </div>
      </div>

      <Menu
        triggerClass="btn primary"
        align="end"
        menuClass="add-menu"
        trigger={
          <>
            <Plus size={18} aria-hidden="true" /> Add <ChevronDown size={16} aria-hidden="true" />
          </>
        }
        items={[
          {
            label: 'Add Resource',
            sub: 'Add an article, video, course or practice',
            icon: <FileText size={18} />,
            onSelect: () => openOverlay({ kind: 'resource', resourceId: null }),
          },
          {
            label: 'Add Phase (Optional)',
            sub: 'Group resources into milestones',
            icon: <Flag size={18} />,
            onSelect: () => openOverlay({ kind: 'phase', phaseId: null }),
          },
        ]}
      />
    </header>
  );
}
