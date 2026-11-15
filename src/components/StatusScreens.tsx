import { CircleAlert } from 'lucide-react';
import { backendConfigError, useStore } from '../state/store';
import { Logo } from './icons';

export function LoadingScreen({ label = 'Loading your plans…' }: { label?: string }) {
  return (
    <main className="auth-page">
      <p className="muted" role="status">
        <Logo /> {label}
      </p>
    </main>
  );
}

/** The backend settings are missing. Nothing is saved anywhere else instead. */
export function ConfigErrorScreen() {
  return (
    <main className="auth-page">
      <section className="card auth-card" role="alert">
        <h1>Backend not configured</h1>
        <p>{backendConfigError}</p>
        <p className="muted">See docs/supabase-setup.md.</p>
      </section>
    </main>
  );
}

/** Loading failed, which is different from having no plans: nothing is shown as empty. */
export function LoadErrorScreen() {
  const error = useStore((s) => s.load.error);
  const reload = useStore((s) => s.reload);
  const signOut = useStore((s) => s.signOut);
  return (
    <main className="auth-page">
      <section className="card auth-card" role="alert">
        <span className="banner-icon">
          <CircleAlert aria-hidden="true" />
        </span>
        <h1>Could not load your plans</h1>
        <p>{error} Your saved data is not affected.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => void reload()}>
            Try again
          </button>
          <button className="btn ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
