import { CircleAlert } from 'lucide-react';
import { useStore } from '../state/store';

/** Shown when the browser refuses to save, so changes are not silently lost on reload. */
export function StorageBanner() {
  const ok = useStore((s) => s.storageOK);
  const openOverlay = useStore((s) => s.openOverlay);
  if (ok) return null;
  return (
    <div className="banner warn" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <p>
        <strong>Changes are not being saved.</strong> This browser is blocking storage (private mode
        or full storage), so your work is lost when you close the tab. Export a backup to keep it.
      </p>
      <button className="btn sm" onClick={() => openOverlay({ kind: 'data' })}>
        Backup
      </button>
    </div>
  );
}
