/**
 * Color theme preference. 'system' follows the OS; 'light' and 'dark' set
 * [data-theme] on <html>, which tokens.css uses to override the OS choice.
 * Kept apart from AppData: it is a per-browser setting, not part of backups.
 */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'roadtogoals:theme';

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** The top bar colour in each theme (`--side-bg` in tokens.css), shown by the browser's own chrome. */
const BAR_COLOR = { light: '#123D2F', dark: '#0A130F' } as const;

/** An explicit choice overrides both `theme-color` tags; Auto restores each tag's own colour. */
function syncThemeColor(theme: Theme) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const own = meta.media.includes('dark') ? BAR_COLOR.dark : BAR_COLOR.light;
    meta.content = theme === 'system' ? own : BAR_COLOR[theme];
  });
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  syncThemeColor(theme);
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
