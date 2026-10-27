import { useStore } from '../state/store';

export function EmptyState() {
  const openOverlay = useStore((s) => s.openOverlay);
  const loadSample = useStore((s) => s.loadSample);
  return (
    <section className="empty">
      <p className="eyebrow">Prepline</p>
      <h1>What are you preparing for?</h1>
      <p>
        Create a goal, add the articles, videos and courses you plan to get through, and Prepline
        turns them into a day-by-day plan with a target date.
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={() => openOverlay({ kind: 'goal', goalId: null })}>
          Create a goal
        </button>
        <button className="btn ghost" onClick={loadSample}>
          Load the sample goal
        </button>
      </div>
    </section>
  );
}
