import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { EmptyState } from '../EmptyState';
import { PlanCard } from './PlanCard';
import { usePagedList } from './usePagedList';

const PAGE = 24;

/**
 * The plans the signed-in user starred, newest star first. A plan stays on the page after
 * it is un-starred, so a slip can be undone; it is gone on the next visit.
 */
export function FavoritesPage() {
  const fetchFavorites = useStore((s) => s.fetchFavorites);
  const { result, loadMore, loadingMore } = usePagedList(
    (offset) => fetchFavorites({ limit: PAGE, offset }),
    PAGE,
    [fetchFavorites],
  );

  return (
    <>
      <header className="page-head">
        <h1>Favorites</h1>
      </header>
      <p className="muted explore-note">
        Plans you starred in Explore, so you can come back and add them later.
      </p>
      {result.status === 'loading' && <p role="status">Loading favorites…</p>}
      {result.status === 'error' && (
        <p className="msg err" role="alert">
          {result.message}
        </p>
      )}
      {result.status === 'ready' && result.data.items.length === 0 && (
        <section className="card">
          <EmptyState
            level={2}
            icon={<Star />}
            title="No favorites yet"
            action={
              <Link className="btn primary" to={paths.explore}>
                Explore plans
              </Link>
            }
          >
            Star a plan to keep it here. Plans the owner stops sharing disappear from this list.
          </EmptyState>
        </section>
      )}
      {result.status === 'ready' && result.data.items.length > 0 && (
        <>
          <ul className="plan-grid">
            {result.data.items.map((p) => (
              <PlanCard key={p.slug} plan={p} />
            ))}
          </ul>
          {result.data.more && (
            <p className="explore-more">
              <button className="btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </p>
          )}
        </>
      )}
    </>
  );
}
