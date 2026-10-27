import { useEffect } from 'react';
import { CircleCheck } from 'lucide-react';
import { useStore } from '../state/store';

/** Brief confirmation after a save; hides itself after a few seconds. */
export function Toast() {
  const toast = useStore((s) => s.ui.toast);
  const dismiss = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 2600);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <CircleCheck size={18} aria-hidden="true" />
          {toast.text}
        </div>
      )}
    </div>
  );
}
