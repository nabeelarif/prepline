import { todayISO } from '../domain/dates';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { roadmap } from '../domain/roadmap';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { ContinueCard } from './ContinueCard';
import { DashboardHeader } from './DashboardHeader';
import { Journey } from './Journey';
import { ProgressSummary } from './ProgressSummary';
import { ResourceList } from './ResourceList';

/** Dashboard for one plan: header, progress summary, journey, and resources. */
export function GoalView({ goal }: { goal: Goal }) {
  const view = useStore((s) => s.ui.view);
  const today = todayISO();
  const met = metrics(goal.resources);
  const p = pace(goal, met, today);
  const nodes = roadmap(goal, view);

  return (
    <>
      <DashboardHeader goal={goal} today={today} />
      <ProgressSummary goal={goal} met={met} pace={p} today={today} />
      <Journey goal={goal} nodes={nodes} />
      {goal.resources.length > 0 && (
        <>
          <ContinueCard goal={goal} />
          <ResourceList goal={goal} />
        </>
      )}
    </>
  );
}
