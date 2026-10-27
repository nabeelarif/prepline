import { ExternalLink, Gauge, Play } from 'lucide-react';
import { fmtHours } from '../domain/format';
import { focusResource, resDone, resStatus } from '../domain/resources';
import type { Goal } from '../domain/types';
import { safeUrl } from '../domain/urls';
import { useStore } from '../state/store';
import { TypeIcon } from './icons';

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
        {href && (
          <a
            className="btn sm primary"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => !active && setStatus(r.id, 'in_progress')}
          >
            <ExternalLink size={15} aria-hidden="true" /> {active ? 'Continue' : 'Start and open'}
          </a>
        )}
      </div>
    </section>
  );
}
