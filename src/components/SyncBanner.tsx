import { CircleAlert } from 'lucide-react';
import { useStore } from '../state/store';

/**
 * Shown when a save failed. The edits are still on screen, so nothing is lost until the
 * page is closed; Retry saves them again.
 */
export function SyncBanner() {
  const sync = useStore((s) => s.sync);
  const retry = useStore((s) => s.retrySync);
  const discard = useStore((s) => s.discardUnsaved);
  if (sync.status !== 'error') return null;
  return (
    <div className="banner warn" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <p>
        <strong>Your latest changes are not saved.</strong> {sync.error}{' '}
        {sync.retryable
          ? 'They are still on this screen, so keep the page open and retry.'
          : 'Retrying will not help. Discard them to go back to what is saved.'}
        {sync.pending > 1 ? ` (${sync.pending} changes waiting)` : ''}
      </p>
      {sync.retryable ? (
        <button className="btn sm" onClick={retry}>
          Retry
        </button>
      ) : (
        <button className="btn sm" onClick={() => void discard()}>
          Discard changes
        </button>
      )}
    </div>
  );
}
