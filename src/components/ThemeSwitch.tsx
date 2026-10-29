import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { loadTheme, saveTheme, type Theme } from '../theme';

const OPTIONS: [Theme, string, typeof Sun][] = [
  ['system', 'Auto', Monitor],
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

/** Segmented control for the color theme, shown in the sidebar footer. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState(loadTheme);

  const pick = (t: Theme) => {
    setTheme(t);
    saveTheme(t);
  };

  return (
    <div className="theme-switch" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(([t, label, Icon]) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          aria-label={label}
          title={label}
          onClick={() => pick(t)}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
