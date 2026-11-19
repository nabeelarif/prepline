import { useState } from 'react';
import { useStore } from '../../state/store';
import { useRequestSignIn } from './useRequestSignIn';

export interface FavoriteInput {
  slug: string;
  favorited: boolean;
  favoriteCount: number;
}

/**
 * The star on a shared plan. A click shows at once (`override`) and is dropped if the server
 * refuses. Signed out, `toggle` opens the sign-in screen instead (the page is remembered,
 * and the user stars it again after returning, as with Add to My Plans). Pass null while the
 * plan is still loading.
 */
export function useFavorite(plan: FavoriteInput | null) {
  const signedIn = useStore((s) => s.auth.status === 'signedIn');
  const requestSignIn = useRequestSignIn();
  // Tied to a slug: the page can show another plan without remounting.
  const [override, setOverride] = useState<{ slug: string; on: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const server = plan?.favorited ?? false;
  const on = override && override.slug === plan?.slug ? override.on : server;
  // The server's count includes the viewer's own star exactly when `favorited` is true.
  const count = (plan?.favoriteCount ?? 0) + Number(on) - Number(server);

  const toggle = async () => {
    if (!plan || pending) return;
    if (!signedIn) {
      requestSignIn();
      return;
    }
    const next = !on;
    setOverride({ slug: plan.slug, on: next });
    setPending(true);
    setError('');
    const failure = await useStore.getState().setFavorite(plan.slug, next);
    setPending(false);
    if (failure) {
      setOverride({ slug: plan.slug, on: !next });
      setError(failure);
    }
  };

  return { on, count, pending, error, toggle };
}

export type FavoriteState = ReturnType<typeof useFavorite>;
