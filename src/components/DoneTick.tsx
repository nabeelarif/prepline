import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Resource } from '../domain/types';
import { changeStatus } from './statusActions';

/** One-click toggle: mark a resource done, or reopen it when it already is. */
export function DoneTick({ r }: { r: Resource }) {
  // The pop plays only after a click, never for rows that load already done.
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      className={`done-tick${r.done ? ' on' : ''}${pop && r.done ? ' pop' : ''}`}
      aria-pressed={r.done}
      aria-label={r.done ? `Reopen ${r.title}` : `Mark ${r.title} done`}
      title={r.done ? 'Reopen' : 'Mark done'}
      onAnimationEnd={() => setPop(false)}
      onClick={() => {
        setPop(!r.done);
        changeStatus(r, r.done ? 'in_progress' : 'completed');
      }}
    >
      <Check size={16} aria-hidden="true" />
    </button>
  );
}
