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
import { TypeBreakdown } from './TypeBreakdown';
import { VelocityStrip } from './VelocityStrip';

/**
 * Dashboard for one plan: plan box, what to do now, the journey, then the pace and the mix of
 * time behind it, and the resources. The next step and the trail come before the explanation.
 */
export function GoalView({ goal }: { goal: Goal }) {
  const view = useStore((s) => s.ui.view);
  const today = todayISO();
  const met = metrics(goal.resources);
  const p = pace(goal, met, today);
  const nodes = roadmap(goal, view);

  return (
    <>
      <PlanBox goal={goal} met={met} pace={p} today={today} />
      <ContinueCard goal={goal} />
      <Journey goal={goal} nodes={nodes} />
      <div className="insights">
        <VelocityStrip goal={goal} met={met} pace={p} />
        <TypeBreakdown resources={goal.resources} />
      </div>
      {goal.resources.length > 0 && <ResourceList goal={goal} />}
    </>
  );
}
