import { CircleAlert } from 'lucide-react';
import { useStore } from '../state/store';

/**
 * Shown when a save failed. The edits are still on screen, so nothing is lost until the
 * page is closed; Retry saves them again.
 */
export function SyncBanner() {
  const sync = useStore((s) => s.sync);
  const retry = useStore((s) => s.retrySync);
  if (sync.status !== 'error') return null;
  return (
    <div className="banner warn" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <p>
        <strong>Your latest changes are not saved.</strong> {sync.error} They are still on this
        screen, so keep the page open and retry.
        {sync.pending > 1 ? ` (${sync.pending} changes waiting)` : ''}
      </p>
      <button className="btn sm" onClick={retry}>
        Retry
      </button>
    </div>
  );
}
