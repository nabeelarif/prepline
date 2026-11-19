import { Link } from 'react-router-dom';
import { fmtHours, pl, shareCounts } from '../../domain/format';
import type { PlanSummary } from '../../domain/share';
import { paths } from '../../routes';
import { Byline } from './Byline';
import { FavoriteButton } from './FavoriteButton';
import { ForkedFrom } from './ForkedFrom';
import { useFavorite } from './useFavorite';
import { useOwnPlanId } from './useOwnPlanId';

/** One shared plan in a list. Tags are buttons only when `onTag` is given. */
export function PlanCard({ plan: p, onTag }: { plan: PlanSummary; onTag?: (tag: string) => void }) {
  const fav = useFavorite(p);
  const own = useOwnPlanId(p.slug) !== null;
  return (
    <li className="card plan-card">
      <div className="plan-title">
        <h2>{p.name}</h2>
      </div>
      {p.description && <p className="plan-desc">{p.description}</p>}
      {p.tags.length > 0 && (
        <p className="explore-tags">
          {p.tags.map((t) =>
            onTag ? (
              <button key={t} className="badge" onClick={() => onTag(t)}>
                {t}
              </button>
            ) : (
              <span key={t} className="badge">
                {t}
              </span>
            ),
          )}
        </p>
      )}
      <p className="muted">
        {pl(p.resourceCount, 'resource')} · {fmtHours(p.totalMinutes)}
        {p.phaseCount > 0 && ` · ${pl(p.phaseCount, 'phase')}`}
        <Byline slug={p.slug} author={p.author} lead=" · " />
        {` · ${shareCounts(p.copyCount, fav.count)}`}
      </p>
      {p.source && (
        <p className="muted">
          <ForkedFrom source={p.source} />
        </p>
      )}
      <div className="plan-foot">
        <span>{!own && <FavoriteButton state={fav} />}</span>
        <Link className="btn sm primary" to={paths.shared(p.slug)}>
          View plan
        </Link>
      </div>
    </li>
  );
}
