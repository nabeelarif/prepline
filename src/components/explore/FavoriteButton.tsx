import { Star } from 'lucide-react';
import type { FavoriteState } from './useFavorite';

/** The star toggle. Hide it on the viewer's own plan; the caller decides. */
export function FavoriteButton({
  state,
  size = 'sm',
}: {
  state: FavoriteState;
  size?: 'sm' | 'md';
}) {
  const { on, pending, toggle, error } = state;
  return (
    <>
      <button
        type="button"
        className={`btn ${size === 'sm' ? 'sm ' : ''}ghost fav-btn${on ? ' on' : ''}`}
        aria-pressed={on}
        onClick={toggle}
        disabled={pending}
      >
        <Star
          size={size === 'sm' ? 15 : 18}
          aria-hidden="true"
          fill={on ? 'currentColor' : 'none'}
        />{' '}
        {on ? 'Favorited' : 'Favorite'}
      </button>
      {error && (
        <span className="msg err" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
