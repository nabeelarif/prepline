import { useStore } from '../../state/store';

/** The id of the viewer's own plan behind this shared link, or null if it is someone else's. */
export function useOwnPlanId(slug: string): string | null {
  return useStore((s) => {
    // `sharing.plans` can still hold a plan that was just deleted; only a plan that exists counts.
    const own = s.data.goals.find((g) => s.sharing.plans[g.id]?.slug === slug);
    return own?.id ?? null;
  });
}
