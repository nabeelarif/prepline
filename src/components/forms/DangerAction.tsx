import { useRef, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ConfirmPanel } from './ConfirmPanel';

type State = 'idle' | 'confirming' | 'deleting' | 'error';

interface Props {
  icon: ReactNode;
  /** Heading and button label, e.g. "Delete Account". */
  label: string;
  description: string;
  confirmTitle: string;
  confirmBody: ReactNode;
  errorTitle: string;
  /** Runs the action. Resolves to an error message, or null on success. */
  run(): Promise<string | null>;
}

/**
 * A destructive action behind a confirmation: button, confirm panel, and a retryable
 * error. Used by the Privacy section of Account settings.
 */
export function DangerAction({
  icon,
  label,
  description,
  confirmTitle,
  confirmBody,
  errorTitle,
  run,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    setState('idle');
    requestAnimationFrame(() => button.current?.focus());
  };
  const confirm = async () => {
    setState('deleting');
    const err = await run();
    if (err === null) return; // the store closes the modal or signs out
    setError(err);
    setState('error');
  };

  return (
    <section className="delete-all">
      {state === 'confirming' || state === 'deleting' ? (
        <ConfirmPanel
          danger
          title={confirmTitle}
          confirmLabel={state === 'deleting' ? 'Deleting…' : label}
          busy={state === 'deleting'}
          onConfirm={confirm}
          onCancel={cancel}
        >
          {confirmBody}
          <p className="danger-note">This action cannot be undone.</p>
        </ConfirmPanel>
      ) : state === 'error' ? (
        <div className="danger-zone" role="alert">
          <span className="tile bad" aria-hidden="true">
            <TriangleAlert size={22} />
          </span>
          <div>
            <h3>{errorTitle}</h3>
            <p>{error}</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className="btn danger-solid" onClick={confirm}>
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="danger-zone">
          <span className="tile bad" aria-hidden="true">
            {icon}
          </span>
          <div>
            <h3>{label}</h3>
            <p>{description}</p>
            <button
              ref={button}
              type="button"
              className="btn danger-solid"
              onClick={() => setState('confirming')}
            >
              {label}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
