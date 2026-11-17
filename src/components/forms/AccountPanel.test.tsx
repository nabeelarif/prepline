import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AppData } from '../../domain/types';
import { useStore } from '../../state/store';
import { memory, resetApp, serverData } from '../../test/harness';
import { renderApp } from '../../test/renderApp';

const plan = (id: string, name: string) => ({
  id,
  name,
  description: '',
  startDate: '2026-01-01',
  targetDate: '2099-01-01',
  hoursPerDay: null,
  createdAt: '2026-01-01',
  resources: [],
  phases: [],
});

const current: AppData = { version: 1, activeGoalId: 'c', goals: [plan('c', 'Current plan')] };

const saved = () => JSON.stringify(serverData());
const dialog = () => screen.getByRole('dialog');

async function open() {
  renderApp();
  fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Account settings' }));
}

beforeEach(() => resetApp(current));
afterEach(() => vi.restoreAllMocks());

describe('Privacy settings', () => {
  it('offers Delete All Data and Delete Account under Privacy', async () => {
    await open();
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete All Data' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeVisible();
  });

  describe('Delete All Data', () => {
    it('keeps everything when cancelled, by button or Escape', async () => {
      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
      const confirm = screen.getByRole('alertdialog', { name: 'Delete all Road to Goals data?' });
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(dialog()).toBeVisible();
      expect(useStore.getState().data).toEqual(current);
    });

    it('deletes everything and shows the first-run screen, and removes it from the backend', async () => {
      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All Data' }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        screen.getByRole('heading', { level: 1, name: 'Start your preparation journey' }),
      ).toBeVisible();
      expect(await screen.findByText('All Road to Goals data deleted')).toBeVisible();
      expect(JSON.parse(saved())).toEqual({ version: 1, activeGoalId: null, goals: [] });
    });

    it('keeps the data and says so when deleting fails', async () => {
      await open();
      memory().failNext(1);
      fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All Data' }),
      );
      expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
        "We couldn't delete your data.",
      );
      expect(useStore.getState().data).toEqual(current);
    });
  });

  describe('Delete Account', () => {
    it('keeps the account when cancelled', async () => {
      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
      const confirm = screen.getByRole('alertdialog', { name: 'Delete your account?' });
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeVisible();
      expect(memory().userId()).not.toBeNull();
    });

    it('keeps the account and says so when deleting fails', async () => {
      await open();
      vi.spyOn(memory().auth, 'deleteAccount').mockRejectedValue(new Error('offline'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete Account' }),
      );
      expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
        "We couldn't delete your account.",
      );
      expect(memory().userId()).not.toBeNull();
    });

    // Last: the account no longer exists for the next `resetApp`.
    it('deletes the account and its data, and signs out', async () => {
      await open();
      const id = memory().userId()!;
      fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete Account' }),
      );
      await waitFor(() => expect(useStore.getState().auth.status).toBe('signedOut'));
      expect(memory().userId()).toBeNull();
      expect(memory().dataOf(id).goals).toEqual([]);
    });
  });
});
