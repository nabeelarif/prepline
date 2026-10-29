import { useEffect, useId, useRef, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
  /** Disables both buttons while the action runs, so it cannot be sent twice. */
  busy?: boolean;
  /** Red confirm button for deletes; the accent color otherwise. */
  danger?: boolean;
}

/**
 * Confirmation shown inside the open modal. Focuses Cancel, and Escape cancels only
 * this step (the modal stays open).
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger,
}: Props) {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);

  return (
    <section
      className={`confirm-panel${danger ? ' danger' : ''}`}
      role="alertdialog"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="confirm-head">
        <span className="tile warn" aria-hidden="true">
          <TriangleAlert size={22} />
        </span>
        <h3 id={`${id}-t`}>{title}</h3>
      </div>
      <div id={`${id}-d`} className="confirm-body">
        {children}
      </div>
      <div className="btn-row confirm-actions">
        <button ref={cancel} type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'danger-solid' : 'primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}
