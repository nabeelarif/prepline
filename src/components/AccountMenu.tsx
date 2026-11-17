import { useState } from 'react';
import { DatabaseBackup, LogOut, Monitor, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { loadTheme, saveTheme, type Theme } from '../theme';
import { useStore } from '../state/store';
import { Menu, type MenuEntry } from './Menu';
import { useSignOut } from './useSignOut';

const THEMES: [Theme, string, typeof Sun][] = [
  ['system', 'Auto', Monitor],
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

/** Profile button: signed-in email, theme, backup and restore, account settings and sign out. */
export function AccountMenu() {
  const email = useStore((s) => s.auth.user?.email);
  const openOverlay = useStore((s) => s.openOverlay);
  const [theme, setTheme] = useState(loadTheme);
  const signOut = useSignOut();

  const items: MenuEntry[] = [
    { heading: email ?? 'Signed in', plain: true },
    'divider',
    { heading: 'Theme' },
    ...THEMES.map(([t, label, Icon]): MenuEntry => ({
      label,
      icon: <Icon size={16} aria-hidden="true" />,
      checked: theme === t,
      onSelect: () => {
        setTheme(t);
        saveTheme(t);
      },
    })),
    'divider',
    {
      label: 'Backup and restore',
      icon: <DatabaseBackup size={16} aria-hidden="true" />,
      onSelect: () => openOverlay({ kind: 'data' }),
    },
    {
      label: 'Account settings',
      icon: <Settings size={16} aria-hidden="true" />,
      onSelect: () => openOverlay({ kind: 'account' }),
    },
    {
      label: 'Sign out',
      icon: <LogOut size={16} aria-hidden="true" />,
      danger: true,
      confirm: 'Click again to sign out',
      onSelect: () => void signOut(),
    },
  ];

  return (
    <Menu
      label="Account menu"
      triggerClass="avatar-btn"
      trigger={
        email ? (
          <span aria-hidden="true">{email[0]!.toUpperCase()}</span>
        ) : (
          <UserRound size={18} aria-hidden="true" />
        )
      }
      items={items}
      align="end"
    />
  );
}
