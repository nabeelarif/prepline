import { useEffect, useState, type FormEvent } from 'react';
import { Compass, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { PublicSort, PublicTag } from '../../domain/share';
import { useStore } from '../../state/store';
import { EmptyState } from '../EmptyState';
import { PlanCard } from './PlanCard';
import { useAsync } from './useAsync';
import { usePagedList } from './usePagedList';

const PAGE = 24;

/** Public plans anyone can look through. Content only: nothing about the author's progress. */
export function ExplorePage() {
  const fetchPublic = useStore((s) => s.fetchPublic);
  const fetchPopularTags = useStore((s) => s.fetchPopularTags);
  // Search, tag and sort live in the address, so a view can be shared and survives a reload.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const sortParam = params.get('sort');
  const sort: PublicSort = sortParam === 'popular' || sortParam === 'favorites' ? sortParam : 'new';
  const [draft, setDraft] = useState(query);
  // Back/forward or Clear changes the address; keep the box in step with it.
  useEffect(() => setDraft(query), [query]);
  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const [tags] = useAsync<PublicTag[]>(
    () => fetchPopularTags().catch(() => []),
    [fetchPopularTags],
  );
  const { result, loadMore, loadingMore } = usePagedList(
    (offset) => fetchPublic({ query, tag, sort, limit: PAGE, offset }),
    PAGE,
    [fetchPublic, query, tag, sort],
  );

  const search = (e: FormEvent) => {
    e.preventDefault();
    update('q', draft.trim());
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
          placeholder="Search by title, description or tag…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn primary" type="submit">
          <Search size={18} aria-hidden="true" /> Search
        </button>
      </form>
      <div className="explore-controls">
        <label>
          Sort by{' '}
          <select
            value={sort}
            onChange={(e) => update('sort', e.target.value === 'new' ? '' : e.target.value)}
          >
            <option value="new">Newest</option>
            <option value="popular">Most copied</option>
            <option value="favorites">Most favorited</option>
          </select>
        </label>
      </div>
      {tags.status === 'ready' && tags.data.length > 0 && (
        <p className="explore-tags" aria-label="Popular tags">
          {tags.data.map((t) => (
            <button
              key={t.tag}
              className="badge"
              aria-pressed={t.tag === tag}
              onClick={() => update('tag', t.tag === tag ? '' : t.tag)}
            >
              {t.tag} ({t.count})
            </button>
          ))}
        </p>
      )}
      {tag && (
        <p className="explore-filter">
          Tag: <span className="badge">{tag}</span>{' '}
          <button className="btn sm" onClick={() => update('tag', '')}>
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
      {result.status === 'ready' && result.data.items.length === 0 && (
        <section className="card">
          <EmptyState level={2} icon={<Compass />} title="No plans found">
            {query || tag ? 'Try a different search.' : 'Nobody has shared a plan yet.'}
          </EmptyState>
        </section>
      )}
      {result.status === 'ready' && result.data.items.length > 0 && (
        <>
          <ul className="plan-grid">
            {result.data.items.map((p) => (
              <PlanCard key={p.slug} plan={p} onTag={(t) => update('tag', t)} />
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
