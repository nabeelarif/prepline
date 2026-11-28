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
import { formatGeneratedBy } from '../../domain/backup';
import { fmtHours, pl } from '../../domain/format';
import { metrics } from '../../domain/metrics';
import type { Goal } from '../../domain/types';
import { useStepFocus } from '../../hooks/useStepFocus';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { ErrorList } from './ErrorList';
import type { RestoreFailure, RestoreFlow } from './useRestoreFlow';

const REASON: Record<RestoreFailure, string> = {
  type: 'Not a .json file',
  json: 'Invalid JSON',
  version: 'Unsupported file version',
  'not-backup': 'Missing or invalid data',
  invalid: 'Missing or invalid data',
  read: 'File could not be read',
};

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
            {state.source.kind === 'file' && <p className="file-name">{state.source.fileName}</p>}
            <p>
              <strong>{REASON[state.reason]}.</strong>
            </p>
            <ErrorList errors={state.errors} />
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

/** How many resources the preview names for each plan. */
const FIRST_RESOURCES = 3;

/** One plan as it will arrive: its size, and the first things to do. */
function PlanPreview({ goal, pasted }: { goal: Goal; pasted: boolean }) {
  const { count, total } = metrics(goal.resources);
  const more = count - FIRST_RESOURCES;
  return (
    <li>
      <h4>{goal.name}</h4>
      {count ? (
        <>
          <p className="muted">
            {pl(count, 'resource')} · {fmtHours(total)} estimated
            {goal.phases.length > 0 && ` · ${pl(goal.phases.length, 'phase')}`}
          </p>
          <ol>
            {goal.resources.slice(0, FIRST_RESOURCES).map((r) => (
              <li key={r.id}>
                {r.title} <span className="muted">({fmtHours(r.minutes)})</span>
              </li>
            ))}
          </ol>
          {more > 0 && <p className="muted">and {more} more</p>}
        </>
      ) : (
        <p className="plan-preview-empty">
          No resources.
          {pasted &&
            ' If your AI made up its own format, open Use my own AI, choose “copy full instructions” and ask again.'}
        </p>
      )}
    </li>
  );
}

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
        {state.unshared.length > 0 && (
          <p role="alert" className="backup-notes">
            Sharing could not be turned on for {state.unshared.map((n) => `"${n}"`).join(', ')}.
            They are private. Use the Share button on each plan to try again.
          </p>
        )}
        <button type="button" className="btn primary wide-btn" onClick={done}>
          Continue to Dashboard
        </button>
      </div>
    );
  }
  if (!('preview' in state)) return null;
  const { preview, source } = state;
  const fromFile = source.kind === 'file';

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
    <div
      className="flow-panel"
      role="region"
      aria-label={fromFile ? 'File contents' : 'Plan preview'}
    >
      <div className="confirm-head">
        <span className="tile good" aria-hidden="true">
          <FileCheck size={22} />
        </span>
        <div>
          <h3 ref={heading} tabIndex={-1}>
            {fromFile ? 'File ready to import' : 'Plan ready to import'}
          </h3>
          {fromFile && <p className="file-name">{source.fileName}</p>}
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
      <ul className="plan-preview">
        {preview.data.goals.map((g) => (
          <PlanPreview key={g.id} goal={g} pasted={!fromFile} />
        ))}
      </ul>
      <dl className="backup-meta">
        {preview.exportedAt && (
          <div>
            <dt>Created</dt>
            <dd>{fmtExported(preview.exportedAt)}</dd>
          </div>
        )}
        {preview.generatedBy && (
          <div>
            <dt>Made by</dt>
            <dd>{formatGeneratedBy(preview.generatedBy)}</dd>
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
      {preview.shares.some(Boolean) && (
        <div className="backup-share">
          <h4>Will be shared</h4>
          <ul className="backup-notes">
            {preview.data.goals.map((g, i) => {
              const share = preview.shares[i];
              return (
                share && (
                  <li key={g.id}>
                    "{g.name}":{' '}
                    {share.visibility === 'public' ? 'public in Explore' : 'anyone with the link'}
                    {share.tags.length > 0 && ` · tags: ${share.tags.join(', ')}`}
                    {share.visibility === 'public' &&
                      g.resources.length === 0 &&
                      ' (listed once it has a resource)'}
                  </li>
                )
              );
            })}
          </ul>
        </div>
      )}
      <p className="muted">
        Add to My Plans keeps everything saved in your account and adds{' '}
        {fromFile ? 'the plans from this file' : preview.plans === 1 ? 'this plan' : 'these plans'}.
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
