import { resDone } from '../domain/resources';
import type { Resource, ResourceStatus } from '../domain/types';
import { useStore } from '../state/store';

/**
 * Moves a resource to a status from the UI. Reopening never opens the details
 * panel; the user records progress when they choose to.
 */
export function changeStatus(r: Resource, to: ResourceStatus) {
  const { setStatus, showToast } = useStore.getState();
  setStatus(r.id, to);
  if (r.done && to === 'in_progress') {
    const after = useStore
      .getState()
      .data.goals.flatMap((g) => g.resources)
      .find((x) => x.id === r.id);
    showToast(after && resDone(after) > 0 ? 'Reopened with your earlier progress' : 'Reopened');
  }
}
