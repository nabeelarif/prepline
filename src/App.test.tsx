import { fireEvent, screen, within } from '@testing-library/react';
import { goal } from './test/fixtures';
import { renderApp } from './test/renderApp';
import { memory, resetApp, serverData } from './test/harness';

const createPlan = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Create Your First Plan' }));
  fireEvent.change(screen.getByLabelText('Plan Title'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
};

beforeEach(() => resetApp());

describe('App', () => {
  it('starts with an invitation to create a plan, then shows its dashboard', async () => {
    renderApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Start your preparation journey' }),
    ).toBeVisible();

    await createPlan('System design');
    expect(screen.getByRole('heading', { level: 1, name: 'System design' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your journey starts here' })).toBeVisible();
    // The toast and the saved note appear only once the backend confirmed the save.
    expect(await screen.findByText('Plan created')).toBeVisible();
    expect(await screen.findByText('All changes saved')).toBeVisible();
    expect(serverData().goals.map((g) => g.name)).toEqual(['System design']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('creates a plan that is not started, then starts it with a 30 day deadline', async () => {
    renderApp();
    await createPlan('Later');
    const overview = screen.getByRole('region', { name: 'Plan overview' });
    expect(overview).toHaveTextContent('Not started yet');
    expect(overview).not.toHaveTextContent(/behind|at risk|past/i);

    fireEvent.click(within(overview).getByRole('button', { name: 'Start plan' }));
    fireEvent.click(screen.getByRole('radio', { name: '30 days from today' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start plan' }));
    expect(await screen.findByText('Plan started')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plan overview' })).toHaveTextContent('Target:');
    expect(serverData().goals[0]!.startDate).not.toBeNull();
    expect(serverData().goals[0]!.targetDate).not.toBeNull();
  });

  it('can be shared from the create dialog, even though the new plan is still empty', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Create Your First Plan' }));
    fireEvent.change(screen.getByLabelText('Plan Title'), { target: { value: 'Open plan' } });
    fireEvent.click(screen.getByRole('radio', { name: /Public in Explore/ }));
    // Public plans are credited to a name.
    fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
    expect(await screen.findByText(/Add a display name/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
    expect(await screen.findByText('Plan created')).toBeVisible();

    const { useStore } = await import('./state/store');
    await vi.waitFor(() => {
      const [plan] = Object.values(useStore.getState().sharing.plans);
      expect(plan).toMatchObject({ visibility: 'public' });
    });
    expect(useStore.getState().sharing.displayName).toBe('Ada');
  });

  it('shows the plan at once, warns when saving fails, and saves after Retry', async () => {
    renderApp();
    await screen.findByRole('button', { name: 'Create Your First Plan' });
    memory().failNext(1);
    await createPlan('Prep');
    expect(screen.getByRole('heading', { level: 1, name: 'Prep' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your latest changes are not saved');
    expect(screen.getByText('Not saved: retry needed')).toBeVisible();
    expect(screen.queryByText('Plan created')).toBeNull();
    expect(serverData().goals).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Plan created')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(serverData().goals.map((g) => g.name)).toEqual(['Prep']);
  });

  it('shows the sign-in screen when signed out, and nothing of the last user after sign-out', async () => {
    renderApp();
    await createPlan('Private plan');
    await screen.findByText('Plan created');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Click again to sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByText('Private plan')).toBeNull();
  });

  it('says it could not load, instead of showing an empty account', async () => {
    const { useStore } = await import('./state/store');
    renderApp();
    await screen.findByRole('button', { name: 'Create Your First Plan' });
    memory().failNext(1);
    await useStore.getState().reload();
    expect(await screen.findByRole('heading', { name: 'Could not load your plans' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create Your First Plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Create Your First Plan' })).toBeVisible();
  });
});

describe('routes', () => {
  const plan = (id: string, name: string) => goal([], { id, name, hoursPerDay: null });
  const two = () =>
    resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [plan('a', 'Alpha plan'), plan('b', 'Beta plan')],
    });

  it('redirects / to the dashboard and marks the nav item', async () => {
    await two();
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha plan' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'My Plans' })).not.toHaveAttribute('aria-current');
  });

  it('takes you to the dashboard when you click the app name', async () => {
    await two();
    renderApp('/plans');
    fireEvent.click(await screen.findByRole('link', { name: 'Road to Goals home' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha plan' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens a plan directly by its id, and My Plans is the active section', async () => {
    await two();
    renderApp('/plans/b');
    expect(await screen.findByRole('heading', { level: 1, name: 'Beta plan' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'My Plans' })).toHaveAttribute('aria-current', 'page');
  });

  it('goes from My Plans to a plan with Open plan, and switches plans by address', async () => {
    await two();
    renderApp('/plans');
    fireEvent.click((await screen.findAllByRole('link', { name: 'Open plan' }))[1]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Beta plan' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Switch plan/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Alpha plan/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha plan' })).toBeVisible();
  });

  it('says so for a plan that is missing or not in the account', async () => {
    await two();
    renderApp('/plans/not-mine');
    expect(await screen.findByRole('heading', { level: 1, name: 'Plan not found' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Go to My Plans' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My Plans' })).toBeVisible();
  });

  it('shows a not-found page for an unknown address', async () => {
    await two();
    renderApp('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });
});

describe('routes: return path and deletion', () => {
  const twoPlans = () =>
    resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([], { id: 'a', name: 'Alpha plan' }), goal([], { id: 'b', name: 'Beta plan' })],
    });

  it('goes to the remembered page from /, even when it renders twice, and forgets it', async () => {
    const { rememberReturnPath, peekReturnPath } = await import('./routes');
    await twoPlans();
    rememberReturnPath('/plans/b');
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Beta plan' })).toBeVisible();
    expect(peekReturnPath()).toBeNull();
  });

  it('forgets a remembered page once signed in, so it cannot redirect a later visit', async () => {
    const { rememberReturnPath, peekReturnPath } = await import('./routes');
    await twoPlans();
    rememberReturnPath('/plans/b');
    renderApp('/plans/a');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha plan' })).toBeVisible();
    expect(peekReturnPath()).toBeNull();
  });

  it('leaves a plan page for My Plans when that plan is deleted from it', async () => {
    await twoPlans();
    renderApp('/plans/b');
    await screen.findByRole('heading', { level: 1, name: 'Beta plan' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan, phases and resources?' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My Plans' })).toBeVisible();
    expect(screen.queryByText('Beta plan')).toBeNull();
  });
});
