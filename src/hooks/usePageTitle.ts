import { useEffect } from 'react';
import { setPageTitle } from '../pageTitle';

/**
 * Names the browser tab for the page on screen. `null` leaves the title to a page that names
 * itself (a shared plan), because a parent's effect runs after its child's and would overwrite it.
 */
export function usePageTitle(page?: string | null) {
  useEffect(() => {
    if (page !== null) setPageTitle(page);
  }, [page]);
}
