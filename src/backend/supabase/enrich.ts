import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanUrlInfo, type UrlEnricher } from '../../repositories/enrich';

/** Calls the `enrich-url` Edge Function (supabase/functions/enrich-url). Best effort. */
export function createSupabaseEnricher(client: SupabaseClient): UrlEnricher {
  return {
    async enrich(url) {
      try {
        const { data, error } = await client.functions.invoke('enrich-url', { body: { url } });
        return error ? null : cleanUrlInfo(data);
      } catch {
        return null;
      }
    },
  };
}
