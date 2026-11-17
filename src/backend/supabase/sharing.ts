import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanTags, type PlanSharing, type PlanSummary, type SharedPlan } from '../../domain/share';
import type { Phase, ResourceType } from '../../domain/types';
import { RepositoryError } from '../../repositories/errors';
import type { PlanSharingRepository } from '../../repositories/sharing';
import { call } from './call';

/** Shapes returned by the sharing functions in `supabase/schema.sql` (snake_case). */
interface SharedPlanJson {
  slug: string;
  visibility: 'unlisted' | 'public';
  name: string;
  description: string;
  author: string | null;
  tags: string[];
  published_at: string;
  copy_count: number;
  phases: Phase[];
  resources: {
    id: string;
    title: string;
    url: string;
    type: ResourceType;
    minutes: number;
    notes: string;
    phase_id: string | null;
  }[];
}
interface SummaryJson {
  slug: string;
  name: string;
  description: string;
  author: string | null;
  tags: string[];
  published_at: string;
  copy_count: number;
  phase_count: number;
  resource_count: number;
  total_minutes: number;
}
interface SettingsJson {
  visibility: PlanSharing['visibility'];
  slug: string | null;
  tags: string[];
}

const toShared = (j: SharedPlanJson): SharedPlan => ({
  slug: j.slug,
  visibility: j.visibility,
  name: j.name,
  description: j.description,
  author: j.author,
  tags: j.tags ?? [],
  publishedAt: j.published_at,
  copyCount: j.copy_count,
  phases: j.phases,
  resources: j.resources.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    type: r.type,
    minutes: r.minutes,
    notes: r.notes,
    phaseId: r.phase_id,
  })),
});

const toSummary = (j: SummaryJson): PlanSummary => ({
  slug: j.slug,
  name: j.name,
  description: j.description,
  author: j.author,
  tags: j.tags ?? [],
  publishedAt: j.published_at,
  copyCount: j.copy_count,
  phaseCount: j.phase_count,
  resourceCount: j.resource_count,
  totalMinutes: j.total_minutes,
});

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
        }),
      );
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
      for (const r of rows ?? []) {
        plans[r.goal_id as string] = {
          visibility: r.visibility as PlanSharing['visibility'],
          slug: r.slug as string,
          tags: (r.tags as string[]) ?? [],
          hidden: !!r.hidden,
          copyCount: Number(r.copy_count) || 0,
        };
      }
      return { plans, displayName: (profile?.display_name as string | null) ?? null };
    },
    async setSharing(goalId, visibility, tags) {
      const j = (await call(
        client.rpc('set_plan_sharing', {
          p_goal_id: goalId,
          p_visibility: visibility,
          p_tags: cleanTags(tags),
        }),
      )) as SettingsJson | null;
      if (!j) throw new RepositoryError('unknown', 'No answer from the server');
      return {
        visibility: j.visibility,
        slug: j.slug,
        tags: j.tags ?? [],
        hidden: false,
        copyCount: 0,
      };
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
