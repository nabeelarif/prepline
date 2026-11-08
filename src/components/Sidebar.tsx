import { House, LayoutList, UserRound } from 'lucide-react';
import { useStore, type Page } from '../state/store';
import { Logo } from './icons';
import { ThemeSwitch } from './ThemeSwitch';

const NAV: [Page, string, typeof House][] = [
  ['dashboard', 'Dashboard', House],
  ['plans', 'My Plans', LayoutList],
];

export function Sidebar() {
  const page = useStore((s) => s.ui.page);
  const navOpen = useStore((s) => s.ui.navOpen);
  const sync = useStore((s) => s.sync.status);
  const email = useStore((s) => s.auth.user?.email);
  const openOverlay = useStore((s) => s.openOverlay);
  const setPage = useStore((s) => s.setPage);
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
            {NAV.map(([p, label, Icon]) => (
              <li key={p}>
                <button
                  className="nav-btn"
                  aria-current={page === p ? 'page' : undefined}
                  onClick={() => setPage(p)}
                >
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </button>
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
