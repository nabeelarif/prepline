import { useState } from 'react';
import { RESOURCE_TYPES, STATUS_TEXT } from '../domain/constants';
import { metrics } from '../domain/metrics';
import { focusResource, isDone, resStatus } from '../domain/resources';
import type { Goal, Phase, Resource, ResourceStatus, ResourceType } from '../domain/types';
import { useStore } from '../state/store';
import { TypeIcon } from './icons';
import { PhaseBand } from './PhaseBand';
import { ResourceCard } from './ResourceCard';
import { useReorderDrag } from './useReorderDrag';

const PLURAL: Record<ResourceType, string> = {
  article: 'Articles',
  video: 'Videos',
  course: 'Courses',
  practice: 'Practice',
};

interface Group {
  key: string;
  phase: Phase | null;
  /** Visible resources, in priority order. */
  rows: { r: Resource }[];
  /** Every resource of the group, however filtered. */
  all: Resource[];
}

/** One band with its cards. Reordering stays inside the group; "Move to phase" crosses it. */
function ResourceGroup({
  goal,
  group,
  open,
  onToggle,
  locked,
  selected,
  focusId,
}: {
  goal: Goal;
  group: Group;
  open: boolean;
  onToggle(): void;
  /** A filter keeps every band open. */
  locked: boolean;
  selected: string | null;
  focusId: string | null;
}) {
  const placeResource = useStore((s) => s.placeResource);
  const reorder = useReorderDrag(
    group.rows.map(({ r }) => r.id),
    placeResource,
  );
  const listId = `group-${group.key || 'none'}`;
  return (
    <section className="res-group" aria-label={group.phase ? group.phase.name : 'Unassigned'}>
      <PhaseBand
        phase={group.phase}
        met={metrics(group.all)}
        hasPhases={goal.phases.length > 0}
        open={open}
        onToggle={onToggle}
        locked={locked}
        listId={listId}
      />
      {open &&
        (group.rows.length ? (
          <ul id={listId} className={`res-list${reorder.active ? ' is-reordering' : ''}`}>
            {group.rows.map(({ r }, pos) => (
              <ResourceCard
                key={r.id}
                r={r}
                prevId={group.rows[pos - 1]?.r.id ?? null}
                nextId={group.rows[pos + 1]?.r.id ?? null}
                phases={goal.phases}
                selected={r.id === selected}
                focus={r.id === focusId}
                handle={reorder.handleProps(r.id)}
                drag={reorder.rowState(r.id)}
              />
            ))}
          </ul>
        ) : (
          <p id={listId} className="empty-note group-empty">
            No resources in this phase yet.
          </p>
        ))}
    </section>
  );
}

export function ResourceList({ goal }: { goal: Goal }) {
  const typeFilter = useStore((s) => s.ui.typeFilter);
  const phaseFilter = useStore((s) => s.ui.phaseFilter);
  const selected = useStore((s) => s.ui.selectedResourceId);
  const setTypeFilter = useStore((s) => s.setTypeFilter);
  const statusFilter = useStore((s) => s.ui.statusFilter);
  const setStatusFilter = useStore((s) => s.setStatusFilter);
  const setPhaseFilter = useStore((s) => s.setPhaseFilter);
  // The user's choice per band, which lasts only while the same resource is selected:
  // selecting another one (a journey click) opens its band again.
  const [toggled, setToggled] = useState<Record<string, { open: boolean; sel: string | null }>>({});

  const all = goal.resources;
  const inPhase = phaseFilter === null ? all : all.filter((r) => (r.phaseId ?? '') === phaseFilter);
  const counts = Object.fromEntries(
    RESOURCE_TYPES.map((t) => [t, inPhase.filter((r) => r.type === t).length]),
  ) as Record<ResourceType, number>;
  const filtered = typeFilter !== 'all' || statusFilter !== 'all';
  const visible = (r: Resource) =>
    (typeFilter === 'all' || r.type === typeFilter) &&
    (statusFilter === 'all' || resStatus(r) === statusFilter);

  // Bands follow the phase order, then the resources in no phase.
  const indexed = all.map((r) => ({ r }));
  const groups: Group[] = [
    ...goal.phases.map((phase) => ({ key: phase.id, phase })),
    { key: '', phase: null },
  ]
    .filter((g) => phaseFilter === null || g.key === phaseFilter)
    .map(({ key, phase }) => {
      const mine = indexed.filter(({ r }) => (r.phaseId ?? '') === key);
      return { key, phase, all: mine.map(({ r }) => r), rows: mine.filter(({ r }) => visible(r)) };
    })
    // A phase stays while empty so resources can be added; with no phases, or while
    // filtering, only bands with something to show remain.
    .filter((g) => (g.phase && !filtered ? true : g.rows.length > 0));
  const focusId = focusResource(all)?.id ?? null;

  const locked = filtered || phaseFilter !== null;
  const stateKey = (g: Group) => `${goal.id}:${g.key}`;
  /** Finished phases fold away. A choice by the user wins, except that a selection or a filter opens the band. */
  const isOpen = (g: Group) => {
    if (locked) return true;
    const choice = toggled[stateKey(g)];
    if (selected && g.all.some((r) => r.id === selected)) {
      return choice && choice.sel === selected ? choice.open : true;
    }
    if (choice && choice.sel === null) return choice.open;
    return !(g.all.length > 0 && g.all.every(isDone));
  };

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
      {phaseFilter !== null && (
        <button type="button" className="link-btn show-all" onClick={() => setPhaseFilter(null)}>
          Show all phases
        </button>
      )}
      {!groups.some((g) => g.rows.length) && !groups.some((g) => g.phase) ? (
        <p className="empty-note">
          {filtered ? 'Nothing matches these filters.' : 'No resources here yet.'}
        </p>
      ) : (
        <div className="res-groups">
          {groups.map((g) => (
            <ResourceGroup
              key={g.key}
              goal={goal}
              group={g}
              open={isOpen(g)}
              onToggle={() =>
                setToggled({
                  ...toggled,
                  [stateKey(g)]: {
                    open: !isOpen(g),
                    sel: selected && g.all.some((r) => r.id === selected) ? selected : null,
                  },
                })
              }
              locked={locked}
              selected={selected}
              focusId={focusId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
