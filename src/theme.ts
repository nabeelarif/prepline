/**
 * Color theme preference. 'system' follows the OS; 'light' and 'dark' set
 * [data-theme] on <html>, which tokens.css uses to override the OS choice.
 * Kept apart from AppData: it is a per-browser setting, not part of backups.
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'prepline:theme';

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
}
