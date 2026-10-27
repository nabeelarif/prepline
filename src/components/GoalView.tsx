import { todayISO } from '../domain/dates';
import { metrics } from '../domain/metrics';
import { pace } from '../domain/pace';
import { schedule } from '../domain/schedule';
import type { Goal } from '../domain/types';
import { RatingBanner, SampleBanner } from './Banners';
import { GoalHeader } from './GoalHeader';
import { ResourceList } from './ResourceList';
import { Stats } from './Stats';
import { Timeline } from './Timeline';
import { TodayPlan } from './TodayPlan';

/** Dashboard for one goal: progress figures, today's plan, the resource queue, and the timeline. */
export function GoalView({ goal }: { goal: Goal }) {
  const today = todayISO();
  const met = metrics(goal, today);
  const sch = schedule(goal, met, today);
  const p = pace(goal, met, sch, today);

  return (
    <>
      <RatingBanner goal={goal} />
      <SampleBanner goal={goal} />
      <GoalHeader goal={goal} pace={p} today={today} />
      <Stats met={met} />
      <div className="board">
        <div className="col">
          <TodayPlan met={met} sch={sch} today={today} />
          <ResourceList goal={goal} />
        </div>
        <div className="col">
          <Timeline goal={goal} met={met} sch={sch} today={today} />
        </div>
      </div>
    </>
  );
}
