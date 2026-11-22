import { progressOf, resDone } from '../domain/resources';
import type { Resource, ResourceStatus } from '../domain/types';
import { useStore } from '../state/store';

const find = (id: string) =>
  useStore
    .getState()
    .data.goals.flatMap((g) => g.resources)
    .find((x) => x.id === id);

/**
 * Moves a resource to a status from the UI. Reopening never opens the details
 * panel; the user records progress when they choose to.
 */
export function changeStatus(r: Resource, to: ResourceStatus) {
  const { setStatus, restoreProgress, showToast } = useStore.getState();
  setStatus(r.id, to);
  const after = find(r.id);
  if (to === 'completed' && !r.done && after) {
    // Undo restores exactly what was there, and only while nothing else has changed it.
    const [before, now] = [progressOf(r), progressOf(after)];
    showToast('Marked done', () => restoreProgress(r.id, now, before));
  }
  if (r.done && to === 'in_progress') {
    showToast(after && resDone(after) > 0 ? 'Reopened with your earlier progress' : 'Reopened');
  }
}
