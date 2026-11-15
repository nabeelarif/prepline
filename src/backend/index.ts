import type { Backend } from './types';
import { createMemoryBackend } from './memory/memoryBackend';
import { createSupabaseBackend } from './supabase';

/**
 * The one place that decides which backend the app uses. To switch backends, build a
 * different `Backend` here (implementing `AppRepository` and `AuthService`).
 *
 * A missing configuration is an error the app shows; it never falls back to browser storage.
 */
export type BackendResult = { backend: Backend } | { configError: string };

interface Env {
  MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function createBackend(env: Env): BackendResult {
  // In-memory backend: unit tests and the e2e build only, never a production build.
  if (env.MODE === 'test') {
    return { backend: createMemoryBackend({ signedInAs: 'test@example.test' }) };
  }
  if (env.MODE === 'e2e') {
    return {
      backend: createMemoryBackend({ persist: window.sessionStorage, persistKey: 'e2e-backend' }),
    };
  }
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return {
      configError:
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
    };
  }
  return { backend: createSupabaseBackend(url, key) };
}
