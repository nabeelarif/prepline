import { resDone } from '../domain/resources';
import type { Resource, ResourceStatus } from '../domain/types';
import { useStore } from '../state/store';

/**
 * Moves a resource to a status from the UI. Reopening a resource with no earlier
 * partial progress opens its details, so the user records the amount instead of
 * the app guessing it.
 */
export function changeStatus(r: Resource, to: ResourceStatus) {
  const { setStatus, openOverlay, showToast } = useStore.getState();
  setStatus(r.id, to);
  if (r.done && to === 'in_progress') {
    const after = useStore
      .getState()
      .data.goals.flatMap((g) => g.resources)
      .find((x) => x.id === r.id);
    if (after && resDone(after) === 0) {
      openOverlay({ kind: 'details', resourceId: r.id });
      showToast('Reopened. Record the hours you have completed.');
    } else showToast('Reopened with your earlier progress');
  }
}
