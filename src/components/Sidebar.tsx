import { House, LayoutList, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { paths } from '../routes';
import { useStore } from '../state/store';
import { Logo } from './icons';
import { ThemeSwitch } from './ThemeSwitch';

/** My Plans stays active on a plan's own page, which is where its "Open plan" leads. */
const NAV: [string, string, typeof House][] = [
  [paths.dashboard, 'Dashboard', House],
  [paths.plans, 'My Plans', LayoutList],
];

export function Sidebar() {
  const navOpen = useStore((s) => s.ui.navOpen);
  const sync = useStore((s) => s.sync.status);
  const email = useStore((s) => s.auth.user?.email);
  const openOverlay = useStore((s) => s.openOverlay);
  const setNavOpen = useStore((s) => s.setNavOpen);

  return (
    <>
      <aside className={`side${navOpen ? ' open' : ''}`} id="sidebar">
        <div className="brand">
          <Logo />
          <span>Road to Goals</span>
        </div>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map(([to, label, Icon]) => (
              <li key={to}>
                <NavLink to={to} className="nav-btn" onClick={() => setNavOpen(false)}>
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="side-foot">
          <ThemeSwitch />
          <button className="nav-btn" onClick={() => openOverlay({ kind: 'account' })}>
            <UserRound size={19} aria-hidden="true" />
            <span className="acct-label">{email ?? 'Account'}</span>
          </button>
          <p className={`store-note${sync === 'error' ? ' off' : ''}`}>
            <i />
            {sync === 'error'
              ? 'Not saved: retry needed'
              : sync === 'saving'
                ? 'Saving…'
                : sync === 'saved'
                  ? 'All changes saved'
                  : 'Saved to your account'}
          </p>
          <p className="tagline">
            Prepare today,
            <br />
            perform tomorrow.
          </p>
        </div>
      </aside>
      {navOpen && <div className="side-scrim" onClick={() => setNavOpen(false)} />}
    </>
  );
}
