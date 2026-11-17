import { useNavigate } from 'react-router-dom';
import { paths } from '../routes';
import { useStore, type AuthOutcome } from '../state/store';
import { confirmSignOut } from './confirmSignOut';

/**
 * Signs out after the pending-saves check, then leaves the signed-in address: otherwise the
 * sign-in screen would sit at `/dashboard`, and the next user could land on this user's plan.
 * Only an explicit sign-out resets the address; an expired session keeps it, so signing back
 * in returns to the same page. Resolves to null when the user backs out.
 */
export function useSignOut(): () => Promise<AuthOutcome | null> {
  const navigate = useNavigate();
  return async () => {
    if (!confirmSignOut()) return null;
    const out = await useStore.getState().signOut();
    if (out.ok) navigate(paths.home, { replace: true });
    return out;
  };
}
