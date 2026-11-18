import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanTags, type PlanSharing, type PublicTag } from '../../domain/share';
import { RepositoryError } from '../../repositories/errors';
import type { PlanSharingRepository } from '../../repositories/sharing';
import { call } from './call';
import {
  toShared,
  toSharing,
  toSummary,
  type SharedPlanJson,
  type SharingJson,
  type SummaryJson,
} from './rows';

/** Sharing tables and functions live here and nowhere else. */
export function createSupabaseSharing(client: SupabaseClient): PlanSharingRepository {
  return {
    async getShared(slug) {
      const j = await call(client.rpc('get_shared_plan', { p_slug: slug }));
      return j ? toShared(j as SharedPlanJson) : null;
    },
    async listPublic(q = {}) {
      const list = await call(
        client.rpc('list_public_plans', {
          p_query: q.query ?? null,
          p_tag: q.tag ?? null,
          p_limit: q.limit ?? 24,
          p_offset: q.offset ?? 0,
          p_sort: q.sort ?? 'new',
        }),
      );
      return ((list ?? []) as SummaryJson[]).map(toSummary);
    },
    async listPopularTags(limit = 20) {
      const list = await call(client.rpc('list_popular_tags', { p_limit: limit }));
      return (list ?? []) as PublicTag[];
    },
    async listSimilar(slug, limit = 6) {
      const list = await call(client.rpc('similar_plans', { p_slug: slug, p_limit: limit }));
      return ((list ?? []) as SummaryJson[]).map(toSummary);
    },
    async loadSharing() {
      const [rows, profile] = await Promise.all([
        call(
          client.from('plan_shares').select('goal_id, visibility, slug, tags, hidden, copy_count'),
        ),
        call(client.from('profiles').select('display_name').maybeSingle()),
      ]);
      const plans: Record<string, PlanSharing> = {};
      // A taken-down plan reads as not shared: the owner has nothing to switch off, and
      // sharing it again cannot bring it back (the row keeps `hidden`).
      for (const r of rows ?? []) {
        if (!r.hidden) plans[r.goal_id as string] = toSharing(r as SharingJson);
      }
      return { plans, displayName: (profile?.display_name as string | null) ?? null };
    },
    async setSharing(goalId, visibility, tags, displayName) {
      const j = (await call(
        client.rpc('set_plan_sharing', {
          p_goal_id: goalId,
          p_visibility: visibility,
          p_tags: cleanTags(tags),
          p_display_name: displayName ?? null,
        }),
      )) as SharingJson | null;
      if (!j) throw new RepositoryError('unknown', 'No answer from the server');
      return toSharing(j);
    },
    async setDisplayName(name) {
      await call(client.rpc('set_display_name', { p_name: name }));
    },
    async recordCopy(slug) {
      await call(client.rpc('record_plan_copy', { p_slug: slug }));
    },
    async report(slug, reason) {
      await call(client.rpc('report_plan', { p_slug: slug, p_reason: reason }));
    },
  };
}
