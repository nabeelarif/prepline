import { vi } from 'vitest';
import type { MemoryBackend } from '../backend/memory/memoryBackend';
import { createEmptyAppData } from '../domain/backup';
import type { AppData } from '../domain/types';
import { currentBackend, useStore } from '../state/store';

/** The in-memory backend the store is wired to under Vitest. */
export const memory = () => currentBackend as MemoryBackend;

/** What the backend holds for the signed-in test user. */
export const serverData = () => memory().dataOf(memory().userId()!);

const TEST_USER = 'test@example.test';
let started = false;

/**
 * Puts the app in a known state through its public paths: signs out (which clears the
 * store), signs back in, seeds the backend, and loads. Call from `beforeEach`.
 */
export async function resetApp(data: AppData = createEmptyAppData()) {
  if (!started) {
    started = true;
    useStore.getState().init();
  }
  const s = () => useStore.getState();
  memory().failNext(0);
  await s().signOut();
  await vi.waitFor(() => expect(s().auth.status).toBe('signedOut'));
  await s().signInWithPassword(TEST_USER, 'pw');
  await vi.waitFor(() => expect(s().load.status).toBe('ready'));
  await memory().repo.replaceAll(data);
  await s().reload();
  await vi.waitFor(() => expect(s().load.status).toBe('ready'));
}
