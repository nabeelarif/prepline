/** The folder the app is served from, without a trailing slash ('' at the root). */
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Every address the app uses. The URL decides the screen and the selected plan. */
export const paths = {
  home: '/',
  dashboard: '/dashboard',
  /** What to study today and this week, for the current plan. */
  today: '/today',
  /** The sign-in screen; it works signed out and goes back to the page asked for. */
  signIn: '/signin',
  plans: '/plans',
  plan: (id: string) => `/plans/${encodeURIComponent(id)}`,
  /** Public gallery, and one shared plan by its link. Both work without an account. */
  explore: '/explore',
  shared: (slug: string) => `/explore/${encodeURIComponent(slug)}`,
  /** The plans the signed-in user starred in Explore. */
  favorites: '/favorites',
  /** Year-long study heatmap and streak. */
  streak: '/streak',
  /** Explore filtered to one tag. */
  exploreTag: (tag: string) => `/explore?tag=${encodeURIComponent(tag)}`,
};

/** The full address of an in-app path, for links that leave the app. */
export const appUrl = (path: string) => `${window.location.origin}${basePath}${path}`;

const RETURN_KEY = 'roadtogoals:returnTo';

/**
 * Remembers where the user was heading before an OAuth sign-in leaves the site, which
 * always comes back to `/`. Session storage only; failure just means landing on the dashboard.
 */
export function rememberReturnPath(path: string): void {
  // The sign-in screen is where the user is heading from, never where to come back to.
  if (path.split('?')[0] === paths.signIn) return;
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* storage blocked: the user lands on the dashboard */
  }
}

/** The remembered path, if any. Only in-app paths are accepted, never another site. */
export function peekReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    return path && /^\/(?!\/|\\)/.test(path) && path !== paths.home ? path : null;
  } catch {
    return null;
  }
}

/** Forgets the remembered path, once it has been used. */
export function clearReturnPath(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* nothing to clear */
  }
}
