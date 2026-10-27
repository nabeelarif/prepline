import { RATE_LABELS, RATINGS } from '../domain/constants';
import { isDone } from '../domain/resources';
import type { Goal } from '../domain/types';
import { useStore } from '../state/store';
import { ConfirmButton } from './ConfirmButton';

/** Asks for a 1–5 self-rating right after a resource is finished. */
export function RatingBanner({ goal }: { goal: Goal }) {
  const ratingFor = useStore((s) => s.ui.ratingFor);
  const rate = useStore((s) => s.rate);
  const skip = useStore((s) => s.skipRating);
  const r = ratingFor ? goal.resources.find((x) => x.id === ratingFor) : undefined;
  if (!r || !isDone(r)) return null;

  return (
    <div className="rate-banner" role="status">
      <p>
        Finished <strong>{r.title}</strong>. How well do you understand it?
      </p>
      <div className="rate-opts">
        {RATINGS.map((v) => (
          <button key={v} className="rate-btn" onClick={() => rate(r.id, v)}>
            <b>{v}</b>
            <span>{RATE_LABELS[v]}</span>
          </button>
        ))}
        <button className="btn ghost sm" onClick={skip}>
          Skip
        </button>
      </div>
    </div>
  );
}

export function SampleBanner({ goal }: { goal: Goal }) {
  const openOverlay = useStore((s) => s.openOverlay);
  const deleteGoal = useStore((s) => s.deleteGoal);
  if (!goal.sample) return null;

  return (
    <div className="notice">
      <p>
        This is a sample goal so you can see how the plan works. Tick things off, then clear it when
        you are ready to add your own.
      </p>
      <button className="btn sm" onClick={() => openOverlay({ kind: 'goal', goalId: null })}>
        Create my goal
      </button>
      <ConfirmButton
        className="btn ghost sm"
        confirmText="Delete the sample?"
        onConfirm={() => deleteGoal(goal.id)}
      >
        Clear sample
      </ConfirmButton>
    </div>
  );
}
