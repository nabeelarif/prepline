import { createClient } from '@supabase/supabase-js';
import type { Backend } from '../types';
import { createSupabaseAuth } from './auth';
import { createSupabaseEnricher } from './enrich';
import { createSupabaseRepository } from './repository';
import { createSupabaseSharing } from './sharing';

/** The only module that creates a Supabase client. */
export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const client = createClient(url, anonKey, {
    // The auth session (not app data) lives in browser storage, which is Supabase's default.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return {
    repo: createSupabaseRepository(client),
    sharing: createSupabaseSharing(client),
    auth: createSupabaseAuth(client),
    enricher: createSupabaseEnricher(client),
  };
}
