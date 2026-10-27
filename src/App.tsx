import { DataPanel } from './components/forms/DataPanel';
import { GoalForm } from './components/forms/GoalForm';
import { ResourceForm } from './components/forms/ResourceForm';
import { EmptyState } from './components/EmptyState';
import { GoalView } from './components/GoalView';
import { Overlay } from './components/Overlay';
import { Sidebar } from './components/Sidebar';
import { useActiveGoal, useStore } from './state/store';

function OverlayContent() {
  const overlay = useStore((s) => s.ui.overlay);
  const goal = useActiveGoal();
  if (!overlay) return null;

  let content;
  if (overlay.kind === 'goal') {
    content = <GoalForm goal={overlay.goalId ? goal : null} />;
  } else if (overlay.kind === 'resource') {
    if (!goal) return null;
    const r = goal.resources.find((x) => x.id === overlay.resourceId) ?? null;
    content = <ResourceForm resource={r} />;
  } else {
    content = <DataPanel />;
  }
  return <Overlay key={overlay.kind}>{content}</Overlay>;
}

export function App() {
  const goal = useActiveGoal();
  return (
    <>
      <div className="app">
        <Sidebar />
        <main className="main">{goal ? <GoalView goal={goal} /> : <EmptyState />}</main>
      </div>
      <OverlayContent />
    </>
  );
}
