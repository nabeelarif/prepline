import { useRef, useState } from 'react';
import { useAsync, type Async } from './useAsync';

export interface Paged<T> {
  items: T[];
  more: boolean;
}

/**
 * A list read a page at a time: the first page loads when `deps` change, `loadMore`
 * appends the next. A slow "Load more" for inputs that have since changed is dropped.
 */
export function usePagedList<T>(
  fetchPage: (offset: number) => Promise<T[]>,
  pageSize: number,
  deps: readonly unknown[],
): { result: Async<Paged<T>>; loadMore: () => Promise<void>; loadingMore: boolean } {
  const [result, setResult] = useAsync<Paged<T>>(
    () => fetchPage(0).then((items) => ({ items, more: items.length === pageSize })),
    deps,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const key = useRef('');
  key.current = JSON.stringify(deps);

  const loadMore = async () => {
    if (result.status !== 'ready') return;
    const started = key.current;
    const { items } = result.data;
    setLoadingMore(true);
    try {
      const next = await fetchPage(items.length);
      if (started !== key.current) return;
      setResult({
        status: 'ready',
        data: { items: [...items, ...next], more: next.length === pageSize },
      });
    } catch (e) {
      if (started === key.current) setResult({ status: 'error', message: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };
  return { result, loadMore, loadingMore };
}
