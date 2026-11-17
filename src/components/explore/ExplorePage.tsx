import { useRef, useState, type FormEvent } from 'react';
import { Compass, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fmtHours, pl } from '../../domain/format';
import type { PlanSummary } from '../../domain/share';
import { paths } from '../../routes';
import { useStore } from '../../state/store';
import { EmptyState } from '../EmptyState';
import { useAsync } from './useAsync';

const PAGE = 24;

interface Listing {
  plans: PlanSummary[];
  more: boolean;
}

/** Public plans anyone can look through. Content only: nothing about the author's progress. */
export function ExplorePage() {
  const fetchPublic = useStore((s) => s.fetchPublic);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [result, setResult] = useAsync<Listing>(
    () =>
      fetchPublic({ query, tag, limit: PAGE }).then((plans) => ({
        plans,
        more: plans.length === PAGE,
      })),
    [fetchPublic, query, tag],
  );
  const [loadingMore, setLoadingMore] = useState(false);

  // What is being searched now, so a slow "Load more" for an older search is dropped.
  const searchKey = useRef('');
  searchKey.current = `${query}\u0000${tag}`;

  const loadMore = async () => {
    if (result.status !== 'ready') return;
    const { plans } = result.data;
    const key = searchKey.current;
    setLoadingMore(true);
    try {
      const next = await fetchPublic({ query, tag, limit: PAGE, offset: plans.length });
      if (key !== searchKey.current) return;
      setResult({
        status: 'ready',
        data: { plans: [...plans, ...next], more: next.length === PAGE },
      });
    } catch (e) {
      if (key === searchKey.current) setResult({ status: 'error', message: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    setQuery(draft.trim());
  };

  return (
    <>
      <header className="page-head">
        <h1>Explore plans</h1>
      </header>
      <p className="muted explore-note">
        Plans other people chose to share. You see the plan only, never anyone&apos;s progress.
      </p>
      <form className="explore-search" role="search" onSubmit={search}>
        <label className="sr-only" htmlFor="exQuery">
          Search plans
        </label>
        <input
          id="exQuery"
          type="search"
          value={draft}
          placeholder="Search by title or description"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn primary" type="submit">
          <Search size={18} aria-hidden="true" /> Search
        </button>
      </form>
      {tag && (
        <p className="explore-filter">
          Tag: <span className="badge">{tag}</span>{' '}
          <button className="btn sm" onClick={() => setTag('')}>
            Clear
          </button>
        </p>
      )}

      {result.status === 'loading' && <p role="status">Loading plans…</p>}
      {result.status === 'error' && (
        <p className="msg err" role="alert">
          {result.message}
        </p>
      )}
      {result.status === 'ready' && result.data.plans.length === 0 && (
        <section className="card">
          <EmptyState icon={<Compass />} title="No plans found">
            {query || tag ? 'Try a different search.' : 'Nobody has shared a plan yet.'}
          </EmptyState>
        </section>
      )}
      {result.status === 'ready' && result.data.plans.length > 0 && (
        <>
          <ul className="plan-grid">
            {result.data.plans.map((p) => (
              <li key={p.slug} className="card plan-card">
                <div className="plan-title">
                  <h2>{p.name}</h2>
                </div>
                {p.description && <p className="plan-desc">{p.description}</p>}
                {p.tags.length > 0 && (
                  <p className="explore-tags">
                    {p.tags.map((t) => (
                      <button key={t} className="badge" onClick={() => setTag(t)}>
                        {t}
                      </button>
                    ))}
                  </p>
                )}
                <p className="muted">
                  {pl(p.resourceCount, 'resource')} · {fmtHours(p.totalMinutes)}
                  {p.phaseCount > 0 && ` · ${pl(p.phaseCount, 'phase')}`}
                  {p.author && ` · by ${p.author}`}
                </p>
                <div className="plan-foot">
                  <span />
                  <Link className="btn sm primary" to={paths.shared(p.slug)}>
                    View plan
                  </Link>
                </div>
              </li>
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
