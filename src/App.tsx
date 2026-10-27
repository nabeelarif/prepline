import { Menu as MenuIcon, Target } from 'lucide-react';
import { DataPanel } from './components/forms/DataPanel';
import { GoalForm } from './components/forms/GoalForm';
import { PhaseForm } from './components/forms/PhaseForm';
import { ResourceDetails } from './components/forms/ResourceDetails';
import { ResourceForm } from './components/forms/ResourceForm';
import { EmptyState } from './components/EmptyState';
import { GoalView } from './components/GoalView';
import { Logo } from './components/icons';
import { MyPlans } from './components/MyPlans';
import { Overlay } from './components/Overlay';
import { Sidebar } from './components/Sidebar';
import { StorageBanner } from './components/StorageBanner';
import { Toast } from './components/Toast';
import { useActiveGoal, useStore } from './state/store';

function OverlayContent() {
  const overlay = useStore((s) => s.ui.overlay);
  const goal = useActiveGoal();
  if (!overlay) return null;

  let content;
  if (overlay.kind === 'goal') {
    const g = useStore.getState().data.goals.find((x) => x.id === overlay.goalId) ?? null;
    content = <GoalForm goal={g} />;
  } else if (overlay.kind === 'data') {
    content = <DataPanel />;
  } else {
    if (!goal) return null;
    if (overlay.kind === 'resource') {
      const r = goal.resources.find((x) => x.id === overlay.resourceId) ?? null;
      content = <ResourceForm resource={r} phases={goal.phases} presetPhase={overlay.phaseId} />;
    } else if (overlay.kind === 'phase') {
      const p = goal.phases.find((x) => x.id === overlay.phaseId) ?? null;
      content = <PhaseForm goal={goal} phase={p} />;
    } else {
      const r = goal.resources.find((x) => x.id === overlay.resourceId);
      if (!r) return null;
      content = <ResourceDetails r={r} phases={goal.phases} />;
    }
  }
  return <Overlay key={overlay.kind}>{content}</Overlay>;
}

function NoPlans() {
  const openOverlay = useStore((s) => s.openOverlay);
  return (
    <section className="card welcome">
      <EmptyState
        level={1}
        icon={<Target />}
        title="Start your preparation journey"
        action={
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => openOverlay({ kind: 'goal', goalId: null })}
            >
              Create Your First Plan
            </button>
            <button className="btn ghost" onClick={() => openOverlay({ kind: 'data' })}>
              Restore from a backup
            </button>
          </div>
        }
      >
        Create your first plan, set a target date, and organize the resources you want to complete.
      </EmptyState>
    </section>
  );
}

export function App() {
  const goal = useActiveGoal();
  const page = useStore((s) => s.ui.page);
  const navOpen = useStore((s) => s.ui.navOpen);
  const setNavOpen = useStore((s) => s.setNavOpen);

  return (
    <>
      <div className="app">
        <div className="topbar">
          <button
            className="icon-btn"
            aria-label="Open menu"
            aria-controls="sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon size={22} />
          </button>
          <span className="brand">
            <Logo />
            Prepline
          </span>
        </div>
        <Sidebar />
        <main className="main">
          <StorageBanner />
          {page === 'plans' ? <MyPlans /> : goal ? <GoalView goal={goal} /> : <NoPlans />}
        </main>
      </div>
      <OverlayContent />
      <Toast />
    </>
  );
}
