import { Target } from 'lucide-react';
import { DataPanel } from './components/forms/DataPanel';
import { GoalForm } from './components/forms/GoalForm';
import { PhaseForm } from './components/forms/PhaseForm';
import { StartPlanDialog } from './components/forms/StartPlanDialog';
import { ShareDialog } from './components/forms/ShareDialog';
import { LazyPage } from './components/explore/LazyPage';
import { useRequestSignIn } from './components/explore/useRequestSignIn';
import { Logo } from './components/icons';
import { ResourceDetails } from './components/forms/ResourceDetails';
import { ResourceViewer } from './components/forms/ResourceViewer';
import { ResourceForm } from './components/forms/ResourceForm';
import { EmptyState } from './components/EmptyState';
import { GoalView } from './components/GoalView';
import { MyPlans } from './components/MyPlans';
import { Overlay } from './components/Overlay';
import { TopBar } from './components/TopBar';
import { AuthGate } from './components/AuthGate';
import { NewPasswordScreen } from './components/NewPasswordScreen';
import { AccountPanel } from './components/forms/AccountPanel';
import { ConfigErrorScreen, LoadErrorScreen, LoadingScreen } from './components/StatusScreens';
import { SyncBanner } from './components/SyncBanner';
import { Toast } from './components/Toast';
import { lazy, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { clearReturnPath, paths, peekReturnPath } from './routes';
import { backendConfigError, useActiveGoal, useStore } from './state/store';

// Explore is a side trip for most people, so it loads when first opened.
const ExplorePage = lazy(() =>
  import('./components/explore/ExplorePage').then((m) => ({ default: m.ExplorePage })),
);
const SharedPlanPage = lazy(() =>
  import('./components/explore/SharedPlanPage').then((m) => ({ default: m.SharedPlanPage })),
);

/** The two Explore addresses, shared by the signed-in and the public shell. */
const exploreRoutes = (
  <>
    <Route
      path={paths.explore}
      element={
        <LazyPage>
          <ExplorePage />
        </LazyPage>
      }
    />
    <Route
      path={`${paths.explore}/:slug`}
      element={
        <LazyPage>
          <SharedPlanPage />
        </LazyPage>
      }
    />
  </>
);

const SHEET_SIZE: Record<string, 'wide' | 'viewer' | undefined> = {
  data: 'wide',
  viewer: 'viewer',
};

function OverlayContent() {
  const overlay = useStore((s) => s.ui.overlay);
  const goal = useActiveGoal();
  if (!overlay) return null;

  let content;
  if (overlay.kind === 'goal') {
    const g = useStore.getState().data.goals.find((x) => x.id === overlay.goalId) ?? null;
    content = <GoalForm goal={g} />;
  } else if (overlay.kind === 'start') {
    const g = useStore.getState().data.goals.find((x) => x.id === overlay.goalId);
    if (!g) return null;
    content = <StartPlanDialog goal={g} />;
  } else if (overlay.kind === 'share') {
    const g = useStore.getState().data.goals.find((x) => x.id === overlay.goalId);
    if (!g) return null;
    content = <ShareDialog goal={g} />;
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
    } else if (overlay.kind === 'viewer') {
      const r = goal.resources.find((x) => x.id === overlay.resourceId);
      if (!r) return null;
      content = <ResourceViewer r={r} />;
    } else {
      const r = goal.resources.find((x) => x.id === overlay.resourceId);
      if (!r) return null;
      content = <ResourceDetails r={r} phases={goal.phases} />;
    }
  }
  return (
    <Overlay key={overlay.kind} size={SHEET_SIZE[overlay.kind]}>
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
        Create your first plan, add the resources you want to complete, and start it when you are
        ready.
      </EmptyState>
    </section>
  );
}

/** `/` and `/signin`: on to the page asked for before sign-in, else the dashboard. */
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

  // Back, Forward and links leave no form open for a plan that is no longer on screen.
  useEffect(() => useStore.getState().closeOverlay(), [pathname]);

  // Signed in with the app showing: a remembered page was used or is stale (an abandoned
  // OAuth attempt, then a password sign-in), and must not hijack a later visit to `/`.
  useEffect(clearReturnPath, []);

  return (
    <>
      <div className="app">
        <TopBar />
        <main className="main">
          <SyncBanner />
          <Routes>
            <Route path={paths.home} element={<Home />} />
            <Route path={paths.signIn} element={<Home />} />
            <Route path={paths.dashboard} element={<Dashboard />} />
            <Route path={paths.plans} element={<MyPlans />} />
            <Route path={`${paths.plans}/:planId`} element={<PlanPage />} />
            {exploreRoutes}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      <OverlayContent />
      <Toast />
    </>
  );
}

/** Explore and shared plans work without an account, so they get their own small shell. */
function PublicShell() {
  const requestSignIn = useRequestSignIn();
  return (
    <div className="app">
      <header className="topbar">
        <Link to={paths.explore} className="brand" aria-label="Road to Goals Explore">
          <Logo />
          <span>Road to Goals</span>
        </Link>
        <div className="top-tools">
          <button className="btn primary" onClick={requestSignIn}>
            Sign in
          </button>
        </div>
      </header>
      <main className="main">
        <Routes>
          {exploreRoutes}
          <Route path="*" element={<Navigate to={paths.explore} replace />} />
        </Routes>
      </main>
    </div>
  );
}

const isExplore = (pathname: string) =>
  pathname === paths.explore || pathname.startsWith(`${paths.explore}/`);

/** What to show before the app itself: configuration, sign-in and loading states. */
export function App() {
  const auth = useStore((s) => s.auth.status);
  const load = useStore((s) => s.load.status);
  const recovery = useStore((s) => s.recovery);
  const { pathname } = useLocation();

  useEffect(() => (backendConfigError ? undefined : useStore.getState().init()), []);

  if (backendConfigError) return <ConfigErrorScreen />;
  if (auth === 'loading') return <LoadingScreen label="Loading…" />;
  if (auth === 'signedOut') {
    return isExplore(pathname) ? <PublicShell /> : <AuthGate />;
  }
  if (recovery) return <NewPasswordScreen />;
  if (load === 'error') return <LoadErrorScreen />;
  if (load !== 'ready') return <LoadingScreen />;
  return <Shell />;
}
