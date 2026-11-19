import { Link } from 'react-router-dom';
import { fmtHours, pl } from '../../domain/format';
import type { PlanSummary } from '../../domain/share';
import { paths } from '../../routes';
import { Byline } from './Byline';
import { ForkedFrom } from './ForkedFrom';

/** One shared plan in a list. Tags are buttons only when `onTag` is given. */
export function PlanCard({ plan: p, onTag }: { plan: PlanSummary; onTag?: (tag: string) => void }) {
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
        {p.copyCount > 0 && ` · copied ${pl(p.copyCount, 'time')}`}
      </p>
      {p.source && (
        <p className="muted">
          <ForkedFrom source={p.source} />
        </p>
      )}
      <div className="plan-foot">
        <span />
        <Link className="btn sm primary" to={paths.shared(p.slug)}>
          View plan
        </Link>
      </div>
    </li>
  );
}
