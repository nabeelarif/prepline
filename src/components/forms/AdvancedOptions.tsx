import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings, Trash2, TriangleAlert } from 'lucide-react';
import { useStore } from '../../state/store';
import { ConfirmPanel } from './ConfirmPanel';

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

/** Collapsed by default; holds the only destructive action, Delete All Data. */
export function AdvancedOptions() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DeleteState>('idle');
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // On a phone the section opens below the fold; bring it into view.
  useEffect(() => {
    if (open) body.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);

  const cancel = () => {
    setState('idle');
    requestAnimationFrame(() => deleteBtn.current?.focus());
  };
  // On success the store closes the modal and the empty onboarding screen shows.
  const remove = () => {
    setState('deleting');
    if (!useStore.getState().deleteAllData()) setState('error');
  };

  return (
    <section className="advanced">
      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={open}
        aria-controls="advancedBody"
        onClick={() => setOpen(!open)}
      >
        <Settings size={20} aria-hidden="true" />
        <span>
          <strong>Advanced Options</strong>
          <small>For advanced users.</small>
        </span>
        <ChevronDown size={18} className="chev" aria-hidden="true" />
      </button>
      {open && (
        <div id="advancedBody" ref={body}>
          {state === 'confirming' || state === 'deleting' ? (
            <ConfirmPanel
              danger
              title="Delete all Prepline data?"
              confirmLabel={state === 'deleting' ? 'Deleting…' : 'Delete All Data'}
              busy={state === 'deleting'}
              onConfirm={remove}
              onCancel={cancel}
            >
              <p>
                This will permanently delete all plans, phases, resources, and preparation progress
                saved in this browser.
              </p>
              <p className="backup-warn">This action cannot be undone unless you have a backup.</p>
            </ConfirmPanel>
          ) : state === 'error' ? (
            <div className="danger-zone" role="alert">
              <span className="tile bad" aria-hidden="true">
                <TriangleAlert size={22} />
              </span>
              <div>
                <h3>We couldn't delete your data.</h3>
                <p>
                  Nothing was deleted. This browser refused to save the change, which can happen in
                  private browsing or when storage is blocked.
                </p>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={cancel}>
                    Cancel
                  </button>
                  <button type="button" className="btn danger-solid" onClick={remove}>
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="danger-zone">
              <span className="tile bad" aria-hidden="true">
                <Trash2 size={22} />
              </span>
              <div>
                <h3>Delete All Data</h3>
                <p>Permanently delete your preparation data saved in this browser.</p>
                <button
                  ref={deleteBtn}
                  type="button"
                  className="btn danger-solid"
                  onClick={() => setState('confirming')}
                >
                  Delete All Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
