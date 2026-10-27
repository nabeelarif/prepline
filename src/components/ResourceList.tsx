import { isDone } from '../domain/resources';
import type { Goal } from '../domain/types';
import { useStore, type Filter } from '../state/store';
import { ResourceItem } from './ResourceItem';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['todo', 'To do'],
  ['done', 'Done'],
];

export function ResourceList({ goal }: { goal: Goal }) {
  const filter = useStore((s) => s.ui.filter);
  const setFilter = useStore((s) => s.setFilter);
  const openOverlay = useStore((s) => s.openOverlay);

  const all = goal.resources;
  const n = all.length;
  const todo = all.filter((r) => !isDone(r)).length;
  const counts: Record<Filter, number> = { all: n, todo, done: n - todo };
  const rows = all
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => filter === 'all' || (filter === 'done') === isDone(r));

  return (
    <section className="card" aria-labelledby="resH">
      <div className="card-head">
        <h2 id="resH">Resources</h2>
        {n > 0 && (
          <div className="seg" role="group" aria-label="Filter">
            {FILTERS.map(([v, label]) => (
              <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>
                {label} <span className="mono">{counts[v]}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className="btn primary sm"
          onClick={() => openOverlay({ kind: 'resource', resourceId: null })}
        >
          + Add
        </button>
      </div>
      {n > 0 && filter === 'all' && (
        <p className="empty-note" style={{ marginTop: -4 }}>
          Your plan follows this order. Use the arrows to change priority.
        </p>
      )}
      {!n ? (
        <p className="empty-note">
          Paste a link to an article, a YouTube video or a course to start your plan.
        </p>
      ) : !rows.length ? (
        <p className="empty-note">
          {filter === 'done' ? 'Nothing finished yet.' : 'Nothing left to do.'}
        </p>
      ) : (
        <ol className="res-list">
          {rows.map(({ r, i }) => (
            <ResourceItem key={r.id} r={r} index={i} count={n} />
          ))}
        </ol>
      )}
    </section>
  );
}
