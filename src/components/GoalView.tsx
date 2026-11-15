import { todayISO } from '../domain/dates';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { roadmap } from '../domain/roadmap';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { ContinueCard } from './ContinueCard';
import { Journey } from './Journey';
import { PlanBox } from './PlanBox';
import { ResourceList } from './ResourceList';

/** Dashboard for one plan: plan box, journey, and resources. */
export function GoalView({ goal }: { goal: Goal }) {
  const view = useStore((s) => s.ui.view);
  const today = todayISO();
  const met = metrics(goal.resources);
  const p = pace(goal, met, today);
  const nodes = roadmap(goal, view);

  return (
    <>
      <PlanBox goal={goal} met={met} pace={p} today={today} />
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
