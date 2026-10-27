import { House, LayoutList } from 'lucide-react';
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
  const storageOK = useStore((s) => s.storageOK);
  const setPage = useStore((s) => s.setPage);
  const setNavOpen = useStore((s) => s.setNavOpen);

  return (
    <>
      <aside className={`side${navOpen ? ' open' : ''}`} id="sidebar">
        <div className="brand">
          <Logo />
          <span>Prepline</span>
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
          <p className={`store-note${storageOK ? '' : ' off'}`}>
            <i />
            {storageOK ? 'Saved in this browser' : 'Not saving: browser storage is blocked'}
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
