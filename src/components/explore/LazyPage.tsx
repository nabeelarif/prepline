import { Component, Suspense, type ReactNode } from 'react';

/** Shown when a page's code could not be fetched, e.g. a stale tab after a new deploy. */
class LoadFailed extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card welcome" role="alert">
        <h1>This page could not load</h1>
        <p className="muted">
          Check your connection. If the app was just updated, reloading fetches the new version.
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </section>
    );
  }
}

/** A lazily loaded page: a loading note while its code arrives, and a way out if it cannot. */
export function LazyPage({ children }: { children: ReactNode }) {
  return (
    <LoadFailed>
      <Suspense fallback={<p role="status">Loading…</p>}>{children}</Suspense>
    </LoadFailed>
  );
}
