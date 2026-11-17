import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export type Async<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/**
 * Runs `load` when `deps` change and tracks it as loading, error or ready. An answer that
 * arrives after the inputs changed or the page closed is dropped. The setter lets a page
 * add to what it has, such as the next page of a list.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): [Async<T>, Dispatch<SetStateAction<Async<T>>>] {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    setState((s) => (s.status === 'loading' ? s : { status: 'loading' }));
    load().then(
      (data) => current && setState({ status: 'ready', data }),
      (e: Error) => current && setState({ status: 'error', message: e.message }),
    );
    return () => {
      current = false;
    };
    // `load` is rebuilt every render; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, setState];
}
