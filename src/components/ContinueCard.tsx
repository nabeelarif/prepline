import { ExternalLink, Gauge, Play } from 'lucide-react';
import { fmtHours } from '../domain/format';
import { focusResource, resDone, resStatus } from '../domain/resources';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { safeUrl } from '../domain/urls';
import { DoneTick } from './DoneTick';
import { TypeIcon } from './icons';
import { ResourceLink } from './ResourceLink';
import { TimerButton } from './TimerButton';

/**
 * One line pointing at what to do now: the first In Progress resource, or the next
 * one to start. Starting another resource never pauses this one.
 */
export function ContinueCard({ goal }: { goal: Goal }) {
  const { setStatus, openOverlay } = useStore.getState();
  const r = focusResource(goal.resources);
  if (!r) return null;
  const active = resStatus(r) === 'in_progress';
  const href = safeUrl(r.url);
  const others = goal.resources.filter((x) => x !== r && resStatus(x) === 'in_progress').length;

  return (
    <section className="card focus" aria-labelledby="focusH">
      <DoneTick r={r} />
      <TypeIcon type={r.type} size={22} />
      <div className="focus-main">
        <h2 id="focusH">{active ? 'Continue Learning' : 'Up Next'}</h2>
        <p>
          <strong>{r.title}</strong>{' '}
          <span className="muted">
            {active
              ? `${fmtHours(resDone(r))} of ${fmtHours(r.minutes)} completed`
              : `${fmtHours(r.minutes)} estimated`}
            {others > 0 && ` · ${others} more in progress`}
          </span>
        </p>
      </div>
      <div className="btn-row">
        <TimerButton goalId={goal.id} r={r} />
        {active && (
          <button
            className="btn sm"
            onClick={() => openOverlay({ kind: 'details', resourceId: r.id })}
          >
            <Gauge size={15} aria-hidden="true" /> Update progress
          </button>
        )}
        {!active && !href && (
          <button className="btn sm primary" onClick={() => setStatus(r.id, 'in_progress')}>
            <Play size={15} aria-hidden="true" /> Start
          </button>
        )}
        <ResourceLink
          r={r}
          className="btn sm primary"
          onOpen={() => !active && setStatus(r.id, 'in_progress')}
        >
          <ExternalLink size={15} aria-hidden="true" /> {active ? 'Continue' : 'Start and open'}
        </ResourceLink>
      </div>
    </section>
  );
}
