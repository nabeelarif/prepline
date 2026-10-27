import { useEffect, useState, type FormEvent } from 'react';
import { Check, ExternalLink, Pencil, Play, RotateCcw } from 'lucide-react';
import { STATUS_TEXT, TYPES } from '../../domain/constants';
import { fmtDate } from '../../domain/dates';
import { fmtHours } from '../../domain/format';
import { resDone, resStatus, statusLosesProgress } from '../../domain/resources';
import type { Phase, Resource } from '../../domain/types';
import { safeUrl } from '../../domain/urls';
import { useStore } from '../../state/store';
import { ConfirmButton } from '../ConfirmButton';
import { TypeIcon } from '../icons';
import { DIALOG_TITLE } from '../Overlay';
import { ProgressRing } from '../ProgressRing';
import { changeStatus } from '../statusActions';

const hrs = (m: number) => Math.round((m / 60) * 100) / 100;

/** One resource: its link and notes, its status, and progress recorded in hours. */
export function ResourceDetails({ r, phases }: { r: Resource; phases: Phase[] }) {
  const { setProgress, setStatus, openOverlay, closeOverlay, showToast } = useStore.getState();
  const done = resDone(r);
  const status = resStatus(r);
  const pct = Math.round((done / r.minutes) * 100);
  const href = safeUrl(r.url);
  const phase = phases.find((p) => p.id === r.phaseId);
  const [value, setValue] = useState(String(hrs(done)));
  const [error, setError] = useState('');

  // Keep the field in step when a status change moves the progress.
  useEffect(() => setValue(String(hrs(done))), [done]);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const h = parseFloat(value);
    if (!(h >= 0)) return setError('Enter the hours you have completed, for example 1.5.');
    if (h * 60 > r.minutes)
      return setError(`That is more than the ${fmtHours(r.minutes)} estimate.`);
    setError('');
    setProgress(r.id, h * 60);
    showToast(h * 60 >= r.minutes ? 'Marked as completed' : 'Progress updated');
  };

  return (
    <div className="details">
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <TypeIcon type={r.type} size={22} />
        {r.title}
      </h2>
      <p className="details-meta">
        <span className={`tag t-${r.type}`}>{TYPES[r.type]}</span>
        <span className={`status s-${status}`}>{STATUS_TEXT[status]}</span>
        {phase && <span className="muted">Phase: {phase.name}</span>}
        {r.doneAt && <span className="muted">Finished {fmtDate(r.doneAt)}</span>}
      </p>
      {href && (
        <a className="btn sm" href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden="true" /> Open resource
        </a>
      )}
      {r.notes && <p className="details-notes">{r.notes}</p>}

      <form className="progress-box" noValidate onSubmit={save}>
        <ProgressRing pct={pct} size={64} stroke={7} label={`${pct}% done`}>
          <strong className="small">{pct}%</strong>
        </ProgressRing>
        <div className="progress-edit">
          <label className="field">
            <span>Hours completed</span>
            <span className="suffixed">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={hrs(r.minutes)}
                step={0.25}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <span aria-hidden="true">of {fmtHours(r.minutes)}</span>
            </span>
          </label>
          <button type="submit" className="btn sm">
            Update progress
          </button>
        </div>
      </form>
      <p className="msg err" role="alert">
        {error}
      </p>

      <div className="sheet-actions">
        <button
          type="button"
          className="btn"
          onClick={() => openOverlay({ kind: 'resource', resourceId: r.id })}
        >
          <Pencil size={15} aria-hidden="true" /> Edit
        </button>
        {status !== 'not_started' && (
          <ConfirmButton
            className="btn ghost"
            confirmText={statusLosesProgress(r, 'not_started') ? 'Clear progress?' : 'Reset?'}
            onConfirm={() => setStatus(r.id, 'not_started')}
          >
            Reset to Not Started
          </ConfirmButton>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={closeOverlay}>
          Close
        </button>
        {status === 'not_started' && (
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
      </div>
    </div>
  );
}
