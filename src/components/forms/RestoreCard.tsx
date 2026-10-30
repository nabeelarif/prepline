import { useEffect, useRef, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CloudUpload,
  FileCheck,
  FileJson,
  TriangleAlert,
} from 'lucide-react';
import { useStore } from '../../state/store';
import { ConfirmPanel } from './ConfirmPanel';
import type { RestoreFailure, RestoreFlow } from './useRestoreFlow';

const REASON: Record<RestoreFailure, string> = {
  json: 'Invalid JSON',
  version: 'Unsupported backup version',
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

/** The Restore Backup card: pick or drop a file, then see it checked or turned away. */
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
      aria-label="Backup file"
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
          <h3 id="restoreTitle">Restore Backup</h3>
          <p className="muted">
            Recover a previously downloaded backup, or add plans from a Prepline file.
          </p>
        </div>
      </div>

      {state.step === 'validating' ? (
        <div className="dropzone busy" role="status">
          <span className="spinner" aria-hidden="true" />
          <p className="file-name">{state.fileName}</p>
          <p>Checking your backup…</p>
        </div>
      ) : state.step === 'invalid' ? (
        <div className="restore-invalid" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <div>
            <h4 ref={heading} tabIndex={-1}>
              This backup couldn't be opened.
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
            if (f) check(f);
          }}
        >
          <FileJson size={30} className="muted" aria-hidden="true" />
          <p className="dz-title">Choose a backup file</p>
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
  const { state, reset, add, restore, retry, confirm, backToReview } = flow;
  const heading = useStepFocus(state.step);

  if (state.step === 'success') {
    const done = () => {
      const { closeOverlay, setPage } = useStore.getState();
      setPage('dashboard');
      closeOverlay();
    };
    const added = state.mode === 'add';
    return (
      <div className="flow-panel center" role="status">
        <span className="tile good round" aria-hidden="true">
          <CircleCheck size={30} />
        </span>
        <h3 ref={heading} tabIndex={-1}>
          {added ? 'Plans added successfully' : 'Backup restored successfully'}
        </h3>
        <p className="muted">
          {added
            ? 'The new plans are next to your existing ones.'
            : 'Your preparation plans and progress are ready.'}
        </p>
        <button type="button" className="btn primary wide-btn" onClick={done}>
          Continue to Dashboard
        </button>
      </div>
    );
  }
  if (!('preview' in state)) return null;
  const { preview, fileName } = state;

  if (state.step === 'confirming' || (state.step === 'restoring' && state.mode === 'replace'))
    return (
      <div className="flow-panel">
        <ConfirmPanel
          title="Replace your current data?"
          confirmLabel={state.step === 'restoring' ? 'Restoring your data…' : 'Replace and Restore'}
          busy={state.step === 'restoring'}
          onConfirm={restore}
          onCancel={backToReview}
        >
          <p>
            All existing Prepline plans, phases, resources, and progress in this browser will be
            replaced with the selected backup.
          </p>
          <p className="backup-warn">This cannot be undone unless you have another backup.</p>
        </ConfirmPanel>
      </div>
    );

  if (state.step === 'error')
    return (
      <div className="flow-panel" role="alert">
        <div className="confirm-head">
          <span className="tile bad" aria-hidden="true">
            <TriangleAlert size={22} />
          </span>
          <h3 ref={heading} tabIndex={-1}>
            {state.mode === 'add'
              ? "We couldn't add these plans."
              : "We couldn't restore your backup."}
          </h3>
        </div>
        <p>
          Your current data has not been changed. This browser refused to save, which can happen in
          private browsing or when storage is full.
        </p>
        <div className="btn-row confirm-actions">
          <button type="button" className="btn" onClick={reset}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={retry}>
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
        Add to My Plans keeps everything saved in this browser and adds the plans from this file.
      </p>
      <p className="backup-warn">
        Replace All Data deletes everything saved in this browser and restores this file instead.
      </p>
      <div className="btn-row confirm-actions">
        <button type="button" className="btn" onClick={reset}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={confirm}>
          Replace All Data
        </button>
        <button type="button" className="btn primary" onClick={add}>
          Add to My Plans
        </button>
      </div>
    </div>
  );
}
