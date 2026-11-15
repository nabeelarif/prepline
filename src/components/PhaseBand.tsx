import type { CSSProperties, ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { fmtHours } from '../domain/format';
import type { Metrics } from '../domain/metrics';
import type { Phase } from '../domain/types';
import { useStore } from '../state/store';

interface Props {
  /** The phase, or null for resources in no phase. */
  phase: Phase | null;
  met: Metrics;
  /** Whether the plan has any phase; decides the hint under "Unassigned". */
  hasPhases: boolean;
  open: boolean;
  onToggle(): void;
  /** A filter keeps the band open. */
  locked: boolean;
  /** Id of the list this band shows and hides. */
  listId: string;
}

/** Full-width header of a group of resources: a phase, or the resources in no phase. */
export function PhaseBand({ phase, met, hasPhases, open, onToggle, locked, listId }: Props) {
  const { openOverlay } = useStore.getState();
  const complete = met.count > 0 && met.doneCount === met.count;
  const name = phase ? phase.name : 'Unassigned';
  const hint = phase
    ? phase.description
    : hasPhases
      ? `${met.count} ${met.count === 1 ? 'resource needs' : 'resources need'} a phase`
      : 'Group your resources into phases to see milestones on the journey';
  let progress: ReactNode = null;
  if (complete) {
    progress = (
      <span className="band-done">
        <Check size={13} aria-hidden="true" /> {met.doneCount} of {met.count} completed · 100%
      </span>
    );
  } else if (met.count) {
    progress = <span className="band-pct">{met.pct}% complete</span>;
  }

  return (
    <div
      className="phase-band"
      style={{ '--ph': phase ? `var(--ph-${phase.color})` : 'var(--ph-gray)' } as CSSProperties}
    >
      <button
        type="button"
        className="band-toggle"
        aria-expanded={open}
        aria-controls={listId}
        disabled={locked}
        onClick={onToggle}
      >
        {open ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
        <i className="band-bar" aria-hidden="true" />
        <span className="band-text">
          <span className="band-name">
            {name}
            {met.count > 0 && !complete && (
              <small>
                {met.doneCount} of {met.count} completed · {fmtHours(met.total)}
              </small>
            )}
          </span>
          {hint && <span className="band-hint">{hint}</span>}
        </span>
      </button>
      {progress}
      <div className="band-actions">
        {!phase && !hasPhases && (
          <button
            type="button"
            className="btn sm"
            onClick={() => openOverlay({ kind: 'phase', phaseId: null })}
          >
            <Plus size={14} aria-hidden="true" /> Create phase
          </button>
        )}
        {!phase && hasPhases && (
          <button
            type="button"
            className="link-btn"
            onClick={() => openOverlay({ kind: 'phase', phaseId: null })}
          >
            New phase
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label={phase ? `Add resource to ${phase.name}` : 'Add unassigned resource'}
          title={phase ? 'Add resource to this phase' : 'Add resource without a phase'}
          onClick={() =>
            openOverlay({ kind: 'resource', resourceId: null, phaseId: phase?.id ?? null })
          }
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        {phase && (
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Edit phase ${phase.name}`}
              title="Edit phase"
              onClick={() => openOverlay({ kind: 'phase', phaseId: phase.id })}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
