import { Menu as MenuIcon, Target } from 'lucide-react';
import { DataPanel } from './components/forms/DataPanel';
import { GoalForm } from './components/forms/GoalForm';
import { PhaseForm } from './components/forms/PhaseForm';
import { ResourceDetails } from './components/forms/ResourceDetails';
import { ResourceForm } from './components/forms/ResourceForm';
import { EmptyState } from './components/EmptyState';
import { GoalView } from './components/GoalView';
import { Logo } from './components/icons';
import { MyPlans } from './components/MyPlans';
import { Overlay } from './components/Overlay';
import { Sidebar } from './components/Sidebar';
import { AuthGate } from './components/AuthGate';
import { NewPasswordScreen } from './components/NewPasswordScreen';
import { AccountPanel } from './components/forms/AccountPanel';
import { ConfigErrorScreen, LoadErrorScreen, LoadingScreen } from './components/StatusScreens';
import { SyncBanner } from './components/SyncBanner';
import { Toast } from './components/Toast';
import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { clearReturnPath, paths, peekReturnPath } from './routes';
import { backendConfigError, useActiveGoal, useStore } from './state/store';

function OverlayContent() {
  const overlay = useStore((s) => s.ui.overlay);
  const goal = useActiveGoal();
  if (!overlay) return null;

  let content;
  if (overlay.kind === 'goal') {
    const g = useStore.getState().data.goals.find((x) => x.id === overlay.goalId) ?? null;
    content = <GoalForm goal={g} />;
  } else if (overlay.kind === 'data') {
    content = <DataPanel />;
  } else if (overlay.kind === 'account') {
    content = <AccountPanel />;
  } else {
    if (!goal) return null;
    if (overlay.kind === 'resource') {
      const r = goal.resources.find((x) => x.id === overlay.resourceId) ?? null;
      content = <ResourceForm resource={r} phases={goal.phases} presetPhase={overlay.phaseId} />;
    } else if (overlay.kind === 'phase') {
      const p = goal.phases.find((x) => x.id === overlay.phaseId) ?? null;
      content = <PhaseForm goal={goal} phase={p} />;
    } else {
      const r = goal.resources.find((x) => x.id === overlay.resourceId);
      if (!r) return null;
      content = <ResourceDetails r={r} phases={goal.phases} />;
    }
  }
  return (
    <Overlay key={overlay.kind} wide={overlay.kind === 'data'}>
      {content}
    </Overlay>
  );
}

function NoPlans() {
  const openOverlay = useStore((s) => s.openOverlay);
  return (
    <section className="card welcome">
      <EmptyState
        level={1}
        icon={<Target />}
        title="Start your preparation journey"
        action={
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => openOverlay({ kind: 'goal', goalId: null })}
            >
              Create Your First Plan
            </button>
            <button className="btn ghost" onClick={() => openOverlay({ kind: 'data' })}>
              Restore from a backup
            </button>
          </div>
        }
      >
        Create your first plan, set a target date, and add the resources you want to complete.
      </EmptyState>
    </section>
  );
}

/** `/`: on to the page asked for before sign-in, else the dashboard. */
function Home() {
  // Render must not change anything (StrictMode renders twice), so the path is only read here;
  // Shell forgets it once the app is up.
  return <Navigate to={peekReturnPath() ?? paths.dashboard} replace />;
}

function Dashboard() {
  const goal = useActiveGoal();
  return goal ? <GoalView goal={goal} /> : <NoPlans />;
}

function NotFound({ plan = false }: { plan?: boolean }) {
  return (
    <section className="card welcome">
      <EmptyState
        level={1}
        icon={<Target />}
        title={plan ? 'Plan not found' : 'Page not found'}
        action={
          <Link className="btn primary" to={plan ? paths.plans : paths.dashboard}>
            {plan ? 'Go to My Plans' : 'Go to the Dashboard'}
          </Link>
        }
      >
        {plan
          ? 'This plan does not exist, or it is not in your account.'
          : 'There is nothing at this address.'}
      </EmptyState>
    </section>
  );
}

/** A plan's own page. The address decides which plan, and that plan becomes the current one. */
function PlanPage() {
  const { planId } = useParams();
  const exists = useStore((s) => s.data.goals.some((g) => g.id === planId));
  const goal = useActiveGoal();
  const busy = useStore((s) => s.busy);
  const current = goal?.id === planId;

  useEffect(() => {
    if (planId && exists && !current && !busy) useStore.getState().selectGoal(planId);
  }, [planId, exists, current, busy]);

  if (!exists) return <NotFound plan />;
  return goal && current ? <GoalView goal={goal} /> : null;
}

function Shell() {
  const { pathname } = useLocation();
  const navOpen = useStore((s) => s.ui.navOpen);
  const setNavOpen = useStore((s) => s.setNavOpen);

  // Back, Forward and links leave no form open for a plan that is no longer on screen.
  useEffect(() => useStore.getState().closeOverlay(), [pathname]);

  // Signed in with the app showing: a remembered page was used or is stale (an abandoned
  // OAuth attempt, then a password sign-in), and must not hijack a later visit to `/`.
  useEffect(clearReturnPath, []);

  return (
    <>
      <div className="app">
        <div className="topbar">
          <button
            className="icon-btn"
            aria-label="Open menu"
            aria-controls="sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon size={22} />
          </button>
          <span className="brand">
            <Logo />
            Road to Goals
          </span>
        </div>
        <Sidebar />
        <main className="main">
          <SyncBanner />
          <Routes>
            <Route path={paths.home} element={<Home />} />
            <Route path={paths.dashboard} element={<Dashboard />} />
            <Route path={paths.plans} element={<MyPlans />} />
            <Route path={`${paths.plans}/:planId`} element={<PlanPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <OverlayContent />
      <Toast />
    </>
  );
}

/** What to show before the app itself: configuration, sign-in and loading states. */
export function App() {
  const auth = useStore((s) => s.auth.status);
  const load = useStore((s) => s.load.status);
  const recovery = useStore((s) => s.recovery);

  useEffect(() => (backendConfigError ? undefined : useStore.getState().init()), []);

  if (backendConfigError) return <ConfigErrorScreen />;
  if (auth === 'loading') return <LoadingScreen label="Loading…" />;
  if (auth === 'signedOut') return <AuthGate />;
  if (recovery) return <NewPasswordScreen />;
  if (load === 'error') return <LoadErrorScreen />;
  if (load !== 'ready') return <LoadingScreen />;
  return <Shell />;
}
