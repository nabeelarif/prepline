import { useOwnPlanId } from './useOwnPlanId';

/**
 * "by <author>", or "by you" in the accent color on the viewer's own plan. Renders nothing
 * when there is no author; `lead` is text put before it only when it shows.
 */
export function Byline({
  slug,
  author,
  lead = '',
}: {
  slug: string;
  author: string | null;
  lead?: string;
}) {
  const mine = useOwnPlanId(slug) !== null;
  if (mine) {
    return (
      <>
        {lead}
        <span className="by-you">by you</span>
      </>
    );
  }
  return author ? <>{`${lead}by ${author}`}</> : null;
}
