import { Check, Compass, House, LayoutList, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { AccountMenu } from './AccountMenu';
import { Logo } from './icons';

/** My Plans stays active on a plan's own page, which is where its "Open plan" leads. */
const NAV: [string, string, typeof House][] = [
  [paths.dashboard, 'Dashboard', House],
  [paths.plans, 'My Plans', LayoutList],
  [paths.explore, 'Explore', Compass],
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
