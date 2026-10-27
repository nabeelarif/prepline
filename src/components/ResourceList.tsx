import type { CSSProperties } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { RESOURCE_TYPES, STATUS_TEXT } from '../domain/constants';
import { fmtHours } from '../domain/format';
import { metrics } from '../domain/metrics';
import { phaseResources } from '../domain/roadmap';
import { resStatus } from '../domain/resources';
import type { Goal, ResourceStatus, ResourceType } from '../domain/types';
import { useStore } from '../state/store';
import { TypeIcon } from './icons';
import { ResourceRow } from './ResourceRow';

const PLURAL: Record<ResourceType, string> = {
  article: 'Articles',
  video: 'Videos',
  course: 'Courses',
  practice: 'Practice',
};

/** The selected phase's name, description and progress, with shortcuts. */
function PhasePanel({ goal, phaseId }: { goal: Goal; phaseId: string }) {
  const { setPhaseFilter, openOverlay } = useStore.getState();
  const phase = goal.phases.find((p) => p.id === phaseId);
  const m = metrics(phaseResources(goal, phase ? phase.id : null));
  return (
    <div
      className="phase-panel"
      style={phase ? ({ '--ph': `var(--ph-${phase.color})` } as CSSProperties) : undefined}
    >
      <div className="phase-panel-main">
        <p className="phase-panel-title">
          {phase && <i className="ph-dot" aria-hidden="true" />}
          {phase ? phase.name : 'Unorganized resources'}
        </p>
        {phase?.description && <p className="muted">{phase.description}</p>}
        <p className="muted small">
          {m.doneCount} / {m.count} resources · {fmtHours(m.done)} of {fmtHours(m.total)} · {m.pct}%
        </p>
      </div>
      <div className="btn-row">
        <button
          className="btn sm"
          onClick={() =>
            openOverlay({ kind: 'resource', resourceId: null, phaseId: phase?.id ?? null })
          }
        >
          <Plus size={15} aria-hidden="true" /> Add resource{phase ? ' to this phase' : ''}
        </button>
        {phase && (
          <button
            className="btn sm ghost"
            onClick={() => openOverlay({ kind: 'phase', phaseId: phase.id })}
          >
            <Pencil size={15} aria-hidden="true" /> Edit phase
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Show all resources"
          onClick={() => setPhaseFilter(null)}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export function ResourceList({ goal }: { goal: Goal }) {
  const typeFilter = useStore((s) => s.ui.typeFilter);
  const phaseFilter = useStore((s) => s.ui.phaseFilter);
  const selected = useStore((s) => s.ui.selectedResourceId);
  const setTypeFilter = useStore((s) => s.setTypeFilter);
  const statusFilter = useStore((s) => s.ui.statusFilter);
  const setStatusFilter = useStore((s) => s.setStatusFilter);

  const all = goal.resources;
  const inPhase = phaseFilter === null ? all : all.filter((r) => (r.phaseId ?? '') === phaseFilter);
  const counts = Object.fromEntries(
    RESOURCE_TYPES.map((t) => [t, inPhase.filter((r) => r.type === t).length]),
  ) as Record<ResourceType, number>;
  const rows = all
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r }) =>
        inPhase.includes(r) &&
        (typeFilter === 'all' || r.type === typeFilter) &&
        (statusFilter === 'all' || resStatus(r) === statusFilter),
    );
  const filtered = typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <section className="card resources" aria-labelledby="resH">
      <div className="card-head">
        <h2 id="resH">Resources ({all.length})</h2>
        <div className="chips" role="group" aria-label="Filter by type">
          <button aria-pressed={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
            All ({inPhase.length})
          </button>
          {RESOURCE_TYPES.map((t) => (
            <button key={t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
              <TypeIcon type={t} size={14} />
              {PLURAL[t]} ({counts[t]})
            </button>
          ))}
          <select
            className="status-filter"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ResourceStatus | 'all')}
          >
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_TEXT) as ResourceStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_TEXT[st]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {phaseFilter !== null && <PhasePanel goal={goal} phaseId={phaseFilter} />}
      {!rows.length ? (
        <p className="empty-note">
          {filtered ? 'Nothing matches these filters.' : 'No resources here yet.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table className="res-table">
            <thead>
              <tr>
                <th className="c-check">
                  <span className="sr-only">Done</span>
                </th>
                <th>Title</th>
                <th className="c-type">Type</th>
                <th className="c-time">Est. Time</th>
                <th className="c-status">Status</th>
                <th className="c-phase">Phase</th>
                <th className="c-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, i }) => (
                <ResourceRow
                  key={r.id}
                  r={r}
                  index={i}
                  count={all.length}
                  phases={goal.phases}
                  selected={r.id === selected}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
