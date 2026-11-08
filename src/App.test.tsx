import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { memory, resetApp, serverData } from './test/harness';

const createPlan = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Create Your First Plan' }));
  fireEvent.change(screen.getByLabelText('Plan Title'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
};

beforeEach(() => resetApp());

describe('App', () => {
  it('starts with an invitation to create a plan, then shows its dashboard', async () => {
    render(<App />);
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

  it('shows the plan at once, warns when saving fails, and saves after Retry', async () => {
    render(<App />);
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
    render(<App />);
    await createPlan('Private plan');
    await screen.findByText('Plan created');
    fireEvent.click(screen.getByRole('button', { name: /test@example.test/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByText('Private plan')).toBeNull();
  });

  it('says it could not load, instead of showing an empty account', async () => {
    const { useStore } = await import('./state/store');
    render(<App />);
    await screen.findByRole('button', { name: 'Create Your First Plan' });
    memory().failNext(1);
    await useStore.getState().reload();
    expect(await screen.findByRole('heading', { name: 'Could not load your plans' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create Your First Plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Create Your First Plan' })).toBeVisible();
  });
});
