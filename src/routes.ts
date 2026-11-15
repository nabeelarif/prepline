/** Every address the app uses. The URL decides the screen and the selected plan. */
export const paths = {
  home: '/',
  dashboard: '/dashboard',
  plans: '/plans',
  plan: (id: string) => `/plans/${encodeURIComponent(id)}`,
};

const RETURN_KEY = 'roadtogoals:returnTo';

/**
 * Remembers where the user was heading before an OAuth sign-in leaves the site, which
 * always comes back to `/`. Session storage only; failure just means landing on the dashboard.
 */
export function rememberReturnPath(path: string): void {
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
