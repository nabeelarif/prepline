import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { useStore } from './state/store';
import { goal, res } from './test/fixtures';
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
    // The author is the account's own name; the dialog never asks for one.
    expect(screen.queryByLabelText('Display name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
    expect(await screen.findByText('Plan created')).toBeVisible();

    const { useStore } = await import('./state/store');
    await vi.waitFor(() => {
      const [plan] = Object.values(useStore.getState().sharing.plans);
      expect(plan).toMatchObject({ visibility: 'public' });
    });
    expect(useStore.getState().sharing.displayName).toMatch(/^\S+ \S+ \d{2}$/);
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

  it('opens sign-in at its own address from a public page, and comes back to that page', async () => {
    await useStore.getState().signOut();
    await waitFor(() => expect(useStore.getState().auth.status).toBe('signedOut'));
    const Where = () => <output data-testid="where">{useLocation().pathname}</output>;
    render(
      <MemoryRouter initialEntries={['/explore']}>
        <App />
        <Where />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByTestId('where')).toHaveTextContent('/signin');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Explore plans' })).toBeVisible();
    expect(screen.getByTestId('where')).toHaveTextContent('/explore');
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

describe('Today', () => {
  it('lays the week out as seven day sections and marks today', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a', title: 'Intro', minutes: 90 })], {
          id: 'a',
          hoursPerDay: 1,
          targetDate: null,
        }),
      ],
    });
    const { container } = renderApp('/today?range=week');
    await screen.findByRole('heading', { level: 1, name: 'This week' });
    const grid = container.querySelector('.today-days.week');
    expect(grid?.querySelectorAll('section.today-day')).toHaveLength(7);
    expect(grid?.querySelectorAll('.is-today')).toHaveLength(1);
  });

  it('fills the day from the plan, and switches to the week', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal(
          [res({ id: 'a', title: 'Intro', minutes: 90 }), res({ id: 'b', title: 'Deep dive' })],
          {
            id: 'a',
            hoursPerDay: 1,
            targetDate: null,
          },
        ),
      ],
    });
    renderApp('/today');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Intro')).toBeVisible();
    expect(screen.queryByText('Deep dive')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeVisible();
    expect(screen.getAllByText('Deep dive')).toHaveLength(2);
  });

  it('opens on the week from the address, and shows the day ring and a tick on each item', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a', title: 'Intro', minutes: 120 })], {
          id: 'a',
          hoursPerDay: 1,
          targetDate: null,
        }),
      ],
    });
    renderApp('/today');
    expect(await screen.findByText('Intro')).toBeVisible();
    expect(screen.getByRole('img', { name: '0h of 1h studied today' })).toBeVisible();
    act(() => useStore.getState().setProgress('a', 30));
    expect(await screen.findByRole('img', { name: '30m of 1h studied today' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Intro done' })[0]!);
    expect(await screen.findByRole('button', { name: 'Reopen Intro' })).toBeVisible();
  });

  it('keeps the week range in the address', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a', title: 'Intro', minutes: 60 })], { id: 'a', hoursPerDay: 1 })],
    });
    renderApp('/today?range=week');
    expect(await screen.findByRole('heading', { level: 1, name: 'This week' })).toBeVisible();
  });

  it('counts progress recorded today and stops filling the day once the goal is met', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a', title: 'Intro', minutes: 180 })], {
          id: 'a',
          hoursPerDay: 1,
          targetDate: null,
        }),
      ],
    });
    renderApp('/today');
    expect(await screen.findByText('Intro')).toBeVisible();
    act(() => useStore.getState().setProgress('a', 60));
    expect(await screen.findByText(/done today/)).toHaveTextContent('1h of 1h done today');
    expect(screen.getByText(/goal reached/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Done today' })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Open|Continue/ })).toBeNull();
  });

  it('asks to start a plan that has not started', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a' })], { id: 'a', startDate: null, targetDate: null })],
    });
    renderApp('/today');
    expect(await screen.findByText('This plan has not started')).toBeVisible();
  });
});

describe('Study log', () => {
  it('shows the streak in the top bar and the year grid on its page', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a', title: 'Intro', minutes: 90 })], { id: 'a' })],
    });
    renderApp('/dashboard');
    const link = await screen.findByRole('link', { name: 'Study streak: 0 days' });
    expect(screen.queryByRole('region', { name: 'Study log' })).toBeNull();
    act(() => useStore.getState().setProgress('a', 30));
    expect(await screen.findByRole('link', { name: 'Study streak: 1 day' })).toBeVisible();
    fireEvent.click(link);
    const page = await screen.findByRole('region', { name: 'Study log' });
    expect(within(page).getByText('current streak')).toBeVisible();
    expect(within(page).getByRole('img', { name: /last year: 1 day studied/ })).toBeVisible();
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
