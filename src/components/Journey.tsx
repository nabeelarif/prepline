import { Flag, Plus, Route } from 'lucide-react';
import { JOURNEY_LIMIT } from '../domain/constants';
import type { RoadmapNode, RoadmapView } from '../domain/roadmap';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { EmptyState } from './EmptyState';
import { SnakeRoadmap } from './SnakeRoadmap';

interface Props {
  goal: Goal;
  nodes: RoadmapNode[];
}

/** The plan as a winding path: resources in simple view, phases in phases view. */
export function Journey({ goal, nodes }: Props) {
  const view = useStore((s) => s.ui.view);
  const showAll = useStore((s) => s.ui.showFullJourney);
  const selectedRes = useStore((s) => s.ui.selectedResourceId);
  const phaseFilter = useStore((s) => s.ui.phaseFilter);
  const { setView, toggleFullJourney, openOverlay, selectResource, setPhaseFilter } =
    useStore.getState();

  const views: [RoadmapView, string][] = [
    ['simple', 'Simple view'],
    ['phases', goal.phases.length ? `Phases (${goal.phases.length})` : 'Phases'],
  ];
  const clipped = !showAll && nodes.length > JOURNEY_LIMIT;
  const shown = clipped ? nodes.slice(0, JOURNEY_LIMIT) : nodes;

  const pick = (n: RoadmapNode) => {
    if (n.kind === 'resource') {
      // The row scrolls itself into view once it is selected.
      selectResource(n.id);
    } else {
      setPhaseFilter(phaseFilter === n.id ? null : n.id);
      document.getElementById('resH')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  let body;
  if (!goal.resources.length && view === 'simple') {
    body = (
      <EmptyState
        icon={<Route />}
        title="Your journey starts here"
        action={
          <button
            className="btn primary"
            onClick={() => openOverlay({ kind: 'resource', resourceId: null })}
          >
            <Plus size={18} aria-hidden="true" /> Add Resource
          </button>
        }
      >
        Add an article, video, course or practice activity to build your preparation roadmap.
      </EmptyState>
    );
  } else if (!nodes.length) {
    body = (
      <EmptyState
        icon={<Flag />}
        title="Organize your journey into milestones"
        action={
          <button
            className="btn primary"
            onClick={() => openOverlay({ kind: 'phase', phaseId: null })}
          >
            <Plus size={18} aria-hidden="true" /> Add Phase
          </button>
        }
      >
        Phases are optional. You can keep using individual resources, or group them when your plan
        grows.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <SnakeRoadmap
          nodes={shown}
          finish={!clipped}
          selectedId={view === 'simple' ? selectedRes : phaseFilter}
          onPick={pick}
        />
        {nodes.length > JOURNEY_LIMIT && (
          <div className="journey-more">
            <button className="btn sm" onClick={toggleFullJourney} aria-expanded={showAll}>
              {showAll ? 'Show less' : `View full journey (${nodes.length} steps)`}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="card journey" aria-labelledby="jH">
      <div className="card-head">
        <div>
          <h2 id="jH">Your Preparation Journey</h2>
          <p className="card-sub">
            {view === 'simple'
              ? 'Follow the path step by step. Each dot is a learning resource.'
              : 'Each stop is a phase. Select one to see its resources.'}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Journey view">
          {views.map(([v, label]) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {body}
    </section>
  );
}
