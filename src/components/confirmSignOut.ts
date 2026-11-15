import { useStore } from '../state/store';

/** False when the user backs out of signing out while saves are still pending. */
export function confirmSignOut(): boolean {
  if (useStore.getState().sync.pending === 0) return true;
  return window.confirm('Some changes are not saved yet and will be lost. Sign out anyway?');
}
