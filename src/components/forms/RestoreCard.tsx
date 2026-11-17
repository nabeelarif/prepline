import { useEffect, useRef, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CloudUpload,
  FileCheck,
  FileJson,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import type { RestoreFailure, RestoreFlow } from './useRestoreFlow';

const REASON: Record<RestoreFailure, string> = {
  type: 'Not a .json file',
  json: 'Invalid JSON',
  version: 'Unsupported file version',
  'not-backup': 'Missing or invalid data',
  invalid: 'Missing or invalid data',
  read: 'File could not be read',
};

/** Moves focus to a step's heading when the step changes, so screen readers follow along. */
function useStepFocus(step: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [step]);
  return ref;
}

/** The import card: pick or drop a file, then see it checked or turned away. */
export function RestoreCard({ flow }: { flow: RestoreFlow }) {
  const { state, check, reset } = flow;
  const input = useRef<HTMLInputElement>(null);
  const chooseBtn = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  const heading = useStepFocus(state.step);
  const pick = () => input.current?.click();

  // Back to idle after a cancel: put focus on the file button again.
  const wasIdle = useRef(true);
  useEffect(() => {
    if (state.step === 'idle' && !wasIdle.current) chooseBtn.current?.focus();
    wasIdle.current = state.step === 'idle';
  }, [state.step]);

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".json,application/json"
      aria-label="Plan file"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) check(f);
      }}
    />
  );

  return (
    <section className="backup-card restore" aria-labelledby="restoreTitle">
      <div className="backup-card-head">
        <span className="tile info" aria-hidden="true">
          <CloudUpload size={26} />
        </span>
        <div>
          <h3 id="restoreTitle">Choose a plan file</h3>
          <p className="muted">Only .json files can be imported.</p>
        </div>
      </div>

      {state.step === 'validating' ? (
        <div className="dropzone busy" role="status">
          <span className="spinner" aria-hidden="true" />
          <p className="file-name">{state.fileName}</p>
          <p>Checking your file…</p>
        </div>
      ) : state.step === 'invalid' ? (
        <div className="restore-invalid" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h4 ref={heading} tabIndex={-1}>
              This file couldn't be opened.
            </h4>
            <p className="file-name">{state.fileName}</p>
            <p>
              <strong>{REASON[state.reason]}.</strong> {state.detail}
            </p>
            <p className="muted">Nothing was changed.</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={pick}>
                Choose Another File
              </button>
              {fileInput}
              <button type="button" className="btn" onClick={reset}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) check(f); // non-.json files are turned away by the flow
          }}
        >
          <FileJson size={30} className="muted" aria-hidden="true" />
          <p className="dz-title">Choose a plan file</p>
          <p className="muted">Drag and drop your .json file here, or click to browse.</p>
          {fileInput}
          <button
            ref={chooseBtn}
            type="button"
            className="btn outline"
            onClick={(e) => {
              e.stopPropagation();
              pick();
            }}
          >
            Choose File
          </button>
        </div>
      )}
    </section>
  );
}

const noun = (n: number, word: string) => (n === 1 ? word : `${word}s`);

const fmtExported = (s: string) =>
  new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Review, confirm, and the outcome, shown full width in place of the cards. */
export function RestoreFlowPanel({ flow }: { flow: RestoreFlow }) {
  const { state, reset, add } = flow;
  const heading = useStepFocus(state.step);
  const navigate = useNavigate();

  if (state.step === 'success') {
    const done = () => {
      useStore.getState().closeOverlay();
      navigate(paths.dashboard);
    };
    return (
      <div className="flow-panel center" role="status">
        <span className="tile good round" aria-hidden="true">
          <CircleCheck size={30} />
        </span>
        <h3 ref={heading} tabIndex={-1}>
          Plans added successfully
        </h3>
        <p className="muted">The new plans are next to your existing ones.</p>
        <button type="button" className="btn primary wide-btn" onClick={done}>
          Continue to Dashboard
        </button>
      </div>
    );
  }
  if (!('preview' in state)) return null;
  const { preview, fileName } = state;

  if (state.step === 'error')
    return (
      <div className="flow-panel" role="alert">
        <div className="confirm-head">
          <span className="tile bad" aria-hidden="true">
            <TriangleAlert size={22} />
          </span>
          <h3 ref={heading} tabIndex={-1}>
            We couldn't add these plans.
          </h3>
        </div>
        <p>
          Your current data has not been changed. The server did not confirm the save, so check your
          connection and try again.
        </p>
        <div className="btn-row confirm-actions">
          <button type="button" className="btn" onClick={reset}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={add}>
            Retry
          </button>
        </div>
      </div>
    );

  return (
    <div className="flow-panel" role="region" aria-label="File contents">
      <div className="confirm-head">
        <span className="tile good" aria-hidden="true">
          <FileCheck size={22} />
        </span>
        <div>
          <h3 ref={heading} tabIndex={-1}>
            File ready to import
          </h3>
          <p className="file-name">{fileName}</p>
        </div>
      </div>
      <dl className="backup-stats">
        <div>
          <dt>{noun(preview.plans, 'Plan')}</dt>
          <dd>{preview.plans}</dd>
        </div>
        <div>
          <dt>{noun(preview.phases, 'Phase')}</dt>
          <dd>{preview.phases}</dd>
        </div>
        <div>
          <dt>{noun(preview.resources, 'Resource')}</dt>
          <dd>{preview.resources}</dd>
        </div>
      </dl>
      <dl className="backup-meta">
        {preview.exportedAt && (
          <div>
            <dt>Created</dt>
            <dd>{fmtExported(preview.exportedAt)}</dd>
          </div>
        )}
        <div>
          <dt>Version</dt>
          <dd>{preview.version} (compatible)</dd>
        </div>
      </dl>
      {preview.notes.length > 0 && (
        <ul className="backup-notes">
          {preview.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="muted">
        Add to My Plans keeps everything saved in your account and adds the plans from this file.
      </p>
      <div className="btn-row confirm-actions">
        <button type="button" className="btn" onClick={reset}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={add}>
          Add to My Plans
        </button>
      </div>
    </div>
  );
}
