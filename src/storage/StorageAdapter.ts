import type { AppData } from '../domain/types';

/**
 * Where app data is persisted. The store only talks to this interface, so a
 * different backend (IndexedDB, a sync service) can replace localStorage
 * without touching the UI.
 */
export interface StorageAdapter {
  /** Raw saved data, or null when nothing is saved. Validation happens in the caller. */
  load(): unknown;
  /**
   * Returns false when the data could not be saved (storage blocked or full). False must
   * mean nothing was written, so the previously saved data is still intact.
   */
  save(data: AppData): boolean;
  /** False when the backend is unavailable, e.g. localStorage blocked by the browser. */
  readonly available: boolean;
}
