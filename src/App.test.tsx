import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { todayISO } from './domain/dates';
import type { Goal } from './domain/types';
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

  it('toggles the menu button and closes it with Escape', async () => {
    await two();
    renderApp('/');
    const toggle = await screen.findByRole('button', { name: /^Menu$/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu on any nav link, even the current page, and on an outside press', async () => {
    await two();
    renderApp('/plans');
    const toggle = await screen.findByRole('button', { name: /^Menu$/ });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('link', { name: 'My Plans' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
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
  const plan = (id: string, name: string, titles: string[], o: Partial<Goal> = {}) =>
    goal(
      titles.map((t) => res({ id: t, title: t, minutes: 60 })),
      { id, name, hoursPerDay: 1, targetDate: null, ...o },
    );
  /** Two plans in progress and one not started; the first is the current plan. */
  const three = () =>
    resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        plan('a', 'Alpha plan', ['Alpha one', 'Alpha two']),
        plan('b', 'Beta plan', ['Beta one', 'Beta two']),
        plan('c', 'Gamma plan', ['Gamma one'], { startDate: null }),
      ],
    });
  const section = (name: string) => screen.getByRole('region', { name });

  it('lists every plan in progress with its own tasks, and one total', async () => {
    await three();
    renderApp('/today');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/2 plans in progress/)).toHaveTextContent('2h a day');
    expect(within(section('Alpha plan')).getByText('Alpha one')).toBeVisible();
    expect(within(section('Beta plan')).getByText('Beta one')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Gamma plan' })).toBeNull();
    expect(screen.getByRole('img', { name: '0h of 2h studied today' })).toBeVisible();
  });

  it('shows 100% on the ring only once the target is met', async () => {
    const studied = { doneMinutes: 598, loggedOn: todayISO(), loggedMinutes: 598 };
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'long', minutes: 1000, ...studied })], {
          id: 'a',
          hoursPerDay: 10,
          targetDate: null,
        }),
      ],
    });
    renderApp('/today');
    const ring = await screen.findByRole('img', { name: /studied today/ });
    expect(ring).toHaveTextContent('99%');
  });

  it('records progress in a plan that is not the current one', async () => {
    await three();
    renderApp('/today');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Beta one done' }));
    expect(await screen.findByRole('button', { name: 'Reopen Beta one' })).toBeVisible();
    expect(screen.getByRole('img', { name: '1h of 2h studied today' })).toBeVisible();
    await waitFor(() => expect(serverData().goals[1]!.resources[0]!.done).toBe(true));
    expect(useStore.getState().data.activeGoalId).toBe('a');
  });

  it('opens Update progress for a resource in another plan, and saves it there', async () => {
    await three();
    renderApp('/today');
    const beta = await screen.findByRole('region', { name: 'Beta plan' });
    fireEvent.click(within(beta).getByRole('button', { name: 'Start' }));
    fireEvent.click(await within(beta).findByRole('button', { name: 'Update progress' }));
    const dialog = screen.getByRole('dialog', { name: 'Beta one' });
    fireEvent.change(within(dialog).getByLabelText(/Hours completed/), {
      target: { value: '0.5' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update progress' }));
    await waitFor(() => expect(serverData().goals[1]!.resources[0]!.doneMinutes).toBe(30));
  });

  it('steps through the days, read-only after today, and keeps the day in the address', async () => {
    await three();
    renderApp('/today');
    expect(await screen.findByText('Alpha one')).toBeVisible();
    const previous = screen.getByRole('button', { name: 'Previous day' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Alpha two')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Tomorrow' })).toBeVisible();
    expect(screen.getByText('Alpha two')).toBeVisible();
    expect(screen.getByText('Beta two')).toBeVisible();
    expect(screen.queryByText('Alpha one')).toBeNull();
    expect(screen.getByText('Assumes you finish the days before.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Mark/ })).toBeNull();
    expect(screen.queryByRole('img', { name: /studied today/ })).toBeNull();

    // Both plans are finished by the day after.
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('heading', { name: 'Nothing planned for this day' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  });

  it('opens on the day in the address, and treats anything else as today', async () => {
    await three();
    const first = renderApp('/today?day=1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tomorrow' })).toBeVisible();
    first.unmount();
    for (const at of ['/today?day=7', '/today?day=x', '/today?range=week']) {
      const view = renderApp(at);
      expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
      view.unmount();
    }
  });

  it('stops at six days ahead', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a', minutes: 6000 })], { id: 'a', hoursPerDay: 1, targetDate: null }),
      ],
    });
    renderApp('/today?day=6');
    const next = await screen.findByRole('button', { name: 'Next day' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    const heading = screen.getByRole('heading', { level: 1 }).textContent;
    fireEvent.click(next);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading!);
  });

  it('keeps a plan finished today on the list', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [plan('a', 'Alpha plan', ['Alpha one'])],
    });
    renderApp('/today');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Alpha one done' }));
    expect(await screen.findByText(/Every resource in this plan is complete/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reopen Alpha one' })).toBeVisible();
  });

  it('shows the day ring and a tick on each item', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [plan('a', 'Alpha plan', ['Intro'])],
    });
    renderApp('/today');
    expect(await screen.findByText('Intro')).toBeVisible();
    expect(screen.getByRole('img', { name: '0h of 1h studied today' })).toBeVisible();
    act(() => useStore.getState().setProgress('Intro', 30));
    expect(await screen.findByRole('img', { name: '30m of 1h studied today' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Intro done' })[0]!);
    expect(await screen.findByRole('button', { name: 'Reopen Intro' })).toBeVisible();
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

  it('offers to start a plan when none is in progress', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [plan('a', 'Alpha plan', ['Intro'], { startDate: null })],
    });
    renderApp('/today');
    expect(await screen.findByRole('heading', { name: 'No plan in progress' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Next day' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Alpha plan' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('tells a passed deadline apart from having none', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        plan('a', 'Alpha plan', ['Alpha one'], { hoursPerDay: null, targetDate: '2026-01-31' }),
        plan('b', 'Beta plan', ['Beta one'], { hoursPerDay: null }),
      ],
    });
    renderApp('/today');
    const alpha = await screen.findByRole('region', { name: 'Alpha plan' });
    expect(alpha).toHaveTextContent('The deadline has passed');
    expect(
      within(alpha).getByRole('button', { name: 'Pick a new date for Alpha plan' }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Beta plan' })).toHaveTextContent(
      'No daily hours or deadline',
    );
  });

  it('says all is done when every plan is complete', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a', done: true, doneAt: '2026-01-01' })], { id: 'a' })],
    });
    renderApp('/today');
    expect(await screen.findByText('Every plan is complete.')).toBeVisible();
  });
});

describe('My Plans', () => {
  const card = (name: string) => screen.getByRole('heading', { name }).closest('li')!;

  it('shows where each plan stands instead of a current one', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a' })], { id: 'a', name: 'Alpha plan' }),
        goal([res({ id: 'b' })], { id: 'b', name: 'Beta plan' }),
        goal([res({ id: 'c' })], {
          id: 'c',
          name: 'Gamma plan',
          startDate: null,
          targetDate: null,
        }),
        goal([res({ id: 'd', done: true })], { id: 'd', name: 'Delta plan' }),
      ],
    });
    renderApp('/plans');
    await screen.findByRole('heading', { level: 1, name: 'My Plans' });
    expect(screen.queryByText('Current')).toBeNull();
    for (const name of ['Alpha plan', 'Beta plan']) {
      expect(within(card(name)).getByText('In progress')).toBeVisible();
    }
    expect(within(card('Gamma plan')).queryByText('In progress')).toBeNull();
    expect(within(card('Delta plan')).getByText('Completed')).toBeVisible();
    expect(within(card('Delta plan')).queryByText('Complete')).toBeNull();
  });

  it('labels each plan private, shared or public, with counts on public ones only', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [
        goal([res({ id: 'a' })], { id: 'a', name: 'Alpha plan' }),
        goal([res({ id: 'b' })], { id: 'b', name: 'Beta plan' }),
        goal([res({ id: 'c' })], { id: 'c', name: 'Gamma plan' }),
      ],
    });
    const { setPlanSharing } = useStore.getState();
    await vi.waitFor(() => expect(useStore.getState().sharing.status).toBe('ready'));
    expect(await setPlanSharing('a', 'public', [])).toBeNull();
    expect(await setPlanSharing('b', 'unlisted', [])).toBeNull();
    renderApp('/plans');
    await screen.findByRole('heading', { level: 1, name: 'My Plans' });
    expect(within(card('Alpha plan')).getByText('0 forks · 0 favorites')).toBeVisible();
    expect(within(card('Alpha plan')).getByText('Public')).toBeVisible();
    expect(within(card('Beta plan')).getByText('Shared')).toBeVisible();
    expect(within(card('Gamma plan')).getByText('Private')).toBeVisible();
    expect(within(card('Beta plan')).queryByText(/forks/)).toBeNull();
    expect(within(card('Gamma plan')).queryByText(/forks/)).toBeNull();
  });

  it('says when sharing cannot load, calls no plan private, and recovers on Retry', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a' })], { id: 'a', name: 'Alpha plan' })],
    });
    await vi.waitFor(() => expect(useStore.getState().sharing.status).toBe('ready'));
    const load = vi.spyOn(memory().sharing, 'loadSharing').mockRejectedValue(new Error('down'));
    // A failed first load, as opposed to a failed refresh, which keeps what was read.
    useStore.setState({ sharing: { status: 'error', plans: {}, displayName: null } });
    renderApp('/plans');
    expect(await screen.findByText('Sharing info couldn’t load.')).toBeVisible();
    expect(within(card('Alpha plan')).queryByText('Private')).toBeNull();
    load.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await within(card('Alpha plan')).findByText('Private')).toBeVisible();
    expect(screen.queryByText('Sharing info couldn’t load.')).toBeNull();
  });

  it('reads the counts again when the page opens', async () => {
    await resetApp({
      version: 1,
      activeGoalId: 'a',
      goals: [goal([res({ id: 'a' })], { id: 'a', name: 'Alpha plan' })],
    });
    await vi.waitFor(() => expect(useStore.getState().sharing.status).toBe('ready'));
    // Shared behind the store's back, as a change made elsewhere would be.
    await memory().sharing.setSharing('a', 'public', []);
    renderApp('/plans');
    expect(await screen.findByText('0 forks · 0 favorites')).toBeVisible();
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
