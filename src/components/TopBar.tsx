import {
  CalendarCheck,
  Check,
  Compass,
  Flame,
  House,
  LayoutList,
  LoaderCircle,
  Menu as MenuIcon,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { todayISO } from '../domain/dates';
import { pl } from '../domain/format';
import { currentStreak } from '../domain/studyLog';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { AccountMenu } from './AccountMenu';
import { Logo } from './icons';

/** My Plans stays active on a plan's own page, which is where its "Open plan" leads. */
const NAV: [string, string, typeof House][] = [
  [paths.dashboard, 'Dashboard', House],
  [paths.today, 'Today', CalendarCheck],
  [paths.plans, 'My Plans', LayoutList],
  [paths.explore, 'Explore', Compass],
  [paths.favorites, 'Favorites', Star],
];

const STATUS = {
  error: [TriangleAlert, 'Not saved: retry needed'],
  saving: [LoaderCircle, 'Saving…'],
  saved: [Check, 'All changes saved'],
  idle: [Check, 'Saved to your account'],
} as const;

export function TopBar() {
  const sync = useStore((s) => s.sync.status);
  const [StatusIcon, text] = STATUS[sync];
  const log = useStore((s) => s.studyLog);
  const streak = log.ready ? currentStreak(log.days, todayISO()) : null;
  const streakText = streak === null ? 'Study streak' : `Study streak: ${pl(streak, 'day')}`;

  // On phones the nav is a dropdown behind a hamburger button (CSS decides when).
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  // Back/forward while the menu is open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="topbar" ref={headerRef}>
      <button
        type="button"
        ref={toggleRef}
        className="nav-toggle"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="top-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <MenuIcon size={20} aria-hidden="true" />}
      </button>
      <Link to={paths.dashboard} className="brand" aria-label="Road to Goals home">
        <Logo />
        <span translate="no">Road to Goals</span>
      </Link>
      <nav
        aria-label="Main"
        id="top-nav"
        className={`top-nav${open ? ' open' : ''}`}
        onClick={(e) => {
          // Also closes on the link for the page you are already on, which changes no route.
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <ul className="nav">
          {NAV.map(([to, label, Icon]) => (
            <li key={to}>
              <NavLink to={to} className="nav-btn">
                <Icon size={19} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
          <li>
            <NavLink
              to={paths.streak}
              className="nav-btn"
              title={streakText}
              aria-label={streakText}
            >
              <Flame
                size={19}
                aria-hidden="true"
                className={(streak ?? 0) > 0 ? 'lit' : undefined}
              />
              {streak ?? ''}
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="top-tools">
        <p className={`sync-icon${sync === 'error' ? ' off' : ''}`} title={text} aria-live="polite">
          <StatusIcon
            size={18}
            className={sync === 'saving' ? 'spin' : undefined}
            aria-hidden="true"
          />
          <span className="sr-only">{text}</span>
        </p>
        <AccountMenu />
      </div>
    </header>
  );
}
