import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paths, rememberReturnPath } from '../../routes';

/**
 * Lets a page that works without an account open the sign-in screen (`/signin`). It
 * remembers the page, so signing in comes back to it.
 */
export function useRequestSignIn(): () => void {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return useCallback(() => {
    rememberReturnPath(pathname + search);
    navigate(paths.signIn);
  }, [pathname, search, navigate]);
}
