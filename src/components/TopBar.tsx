import {
  CalendarCheck,
  Check,
  Compass,
  Flame,
  House,
  LayoutList,
  LoaderCircle,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
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

  return (
    <header className="topbar">
      <Link to={paths.dashboard} className="brand" aria-label="Road to Goals home">
        <Logo />
        <span>Road to Goals</span>
      </Link>
      <nav aria-label="Main" className="top-nav">
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
