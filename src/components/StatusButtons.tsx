import { Check, Play, RotateCcw } from 'lucide-react';
import { resStatus } from '../domain/resources';
import type { Resource } from '../domain/types';
import { changeStatus } from './statusActions';

/** Start (when not started) and Mark completed / Reopen, for sheet footers. */
export function StatusButtons({ r }: { r: Resource }) {
  return (
    <>
      {resStatus(r) === 'not_started' && (
        <button type="button" className="btn" onClick={() => changeStatus(r, 'in_progress')}>
          <Play size={15} aria-hidden="true" /> Start
        </button>
      )}
      <button
        type="button"
        className="btn primary"
        onClick={() => changeStatus(r, r.done ? 'in_progress' : 'completed')}
      >
        {r.done ? (
          <>
            <RotateCcw size={15} aria-hidden="true" /> Reopen
          </>
        ) : (
          <>
            <Check size={15} aria-hidden="true" /> Mark completed
          </>
        )}
      </button>
    </>
  );
}
