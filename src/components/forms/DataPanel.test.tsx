import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../App';
import { STORAGE_KEY } from '../../domain/constants';
import type { AppData } from '../../domain/types';
import { useStore } from '../../state/store';

const plan = (id: string, name: string) => ({
  id,
  name,
  description: '',
  targetDate: '2099-01-01',
  hoursPerDay: null,
  createdAt: '2026-01-01',
  resources: [],
  phases: [],
});

const current: AppData = { version: 1, activeGoalId: 'c', goals: [plan('c', 'Current plan')] };

const backup = {
  version: 1,
  activeGoalId: 'b',
  exportedAt: '2026-10-20T09:15:00',
  goals: [
    {
      ...plan('b', 'Restored plan'),
      phases: [{ id: 'p', name: 'Basics', color: 'green' }],
      resources: [
        { id: 'r1', title: 'Read', phaseId: 'p' },
        { id: 'r2', title: 'Watch' },
      ],
    },
    plan('b2', 'Second'),
  ],
};

const saved = () => localStorage.getItem(STORAGE_KEY);
const dialog = () => screen.getByRole('dialog');

function open() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'My Plans' }));
  fireEvent.click(screen.getByRole('button', { name: 'Backup and restore' }));
}

function pick(contents: string, name = 'prepline-backup-2026-10-20.json') {
  const file = new File([contents], name, { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } });
}

beforeEach(() => {
  useStore.getState().restoreBackup(current);
  useStore.getState().closeOverlay();
  localStorage.setItem('other:key', 'keep me');
});

afterEach(() => {
  vi.restoreAllMocks();
  useStore.getState().deleteAllData();
  localStorage.removeItem('other:key');
});

describe('Backup and Restore', () => {
  it('downloads the backup in one click, with no JSON on screen', () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:x'));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    open();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download Backup' }));
    const a = click.mock.contexts[0] as HTMLAnchorElement;
    expect(a.download).toMatch(/^prepline-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(blob?.type).toBe('application/json');
    expect(screen.getByText('Your backup download has started.')).toBeVisible();
  });

  it('reviews a valid backup without changing anything', async () => {
    open();
    const before = saved();
    pick(JSON.stringify(backup));
    const review = await screen.findByRole('region', { name: 'Backup contents' });
    expect(within(review).getByText('prepline-backup-2026-10-20.json')).toBeVisible();
    const stats = within(review)
      .getAllByRole('definition')
      .map((d) => d.textContent);
    expect(stats.slice(0, 3)).toEqual(['2', '1', '2']);
    expect(review).toHaveTextContent('Version1 (compatible)');
    expect(review).toHaveTextContent('Created');
    expect(saved()).toBe(before);
    expect(useStore.getState().data).toEqual(current);
  });

  it('hides the creation date for backups that do not record one', async () => {
    open();
    pick(JSON.stringify({ ...backup, exportedAt: undefined }));
    const review = await screen.findByRole('region', { name: 'Backup contents' });
    expect(review).not.toHaveTextContent('Created');
  });

  it.each([
    ['not json', 'Invalid JSON'],
    ['{"version": 2, "goals": []}', 'Unsupported backup version'],
    ['{"plans": []}', 'Missing or invalid data'],
    ['{"goals": [{"resources": []}]}', 'Missing or invalid data'],
  ])('turns away %s', async (contents, reason) => {
    open();
    const before = saved();
    pick(contents);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This backup couldn't be opened.");
    expect(alert).toHaveTextContent(reason);
    expect(saved()).toBe(before);
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Choose File' })).toHaveFocus();
  });

  it('cancels from review and from the confirmation without changing data', async () => {
    open();
    const before = saved();
    pick(JSON.stringify(backup));
    await screen.findByRole('region', { name: 'Backup contents' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeVisible();

    pick(JSON.stringify(backup));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Backup' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Replace your current data?' });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    // Escape backs out of the confirmation only; the modal stays open.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.getByRole('region', { name: 'Backup contents' })).toBeVisible();
    expect(dialog()).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Restore Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('region', { name: 'Backup contents' })).toBeVisible();
    expect(saved()).toBe(before);
    expect(useStore.getState().data).toEqual(current);
  });

  it('restores after confirmation and shows the restored dashboard', async () => {
    open();
    pick(JSON.stringify(backup));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace and Restore' }));
    expect(screen.getByText('Backup restored successfully')).toBeVisible();
    expect(JSON.parse(saved()!).goals.map((g: { name: string }) => g.name)).toEqual([
      'Restored plan',
      'Second',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Dashboard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Restored plan' })).toBeVisible();
  });

  it('says so, and keeps the current data, when the browser refuses to save', async () => {
    open();
    const before = saved();
    pick(JSON.stringify(backup));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Backup' }));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replace and Restore' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      "We couldn't restore your backup.Your current data has not been replaced.",
    );
    expect(screen.queryByText('Backup restored successfully')).toBeNull();
    expect(saved()).toBe(before);
    expect(useStore.getState().data).toEqual(current);

    vi.restoreAllMocks();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Backup restored successfully')).toBeVisible();
  });
});

describe('Delete All Data', () => {
  const expand = () => fireEvent.click(screen.getByRole('button', { name: /Advanced Options/ }));

  it('is hidden under collapsed Advanced Options', () => {
    open();
    expect(screen.getByRole('button', { name: /Advanced Options/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Delete All Data' })).toBeNull();
    expect(screen.queryByText(/Reset to default/i)).toBeNull();
  });

  it('keeps everything when cancelled, by button or Escape', () => {
    open();
    expand();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete all Prepline data?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(dialog()).toBeVisible();
    expect(useStore.getState().data).toEqual(current);
  });

  it('deletes everything and shows the first-run screen, leaving other storage alone', () => {
    open();
    expand();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All Data' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Start your preparation journey' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Your First Plan' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('All Prepline data deleted');
    expect(JSON.parse(saved()!)).toEqual({ version: 1, activeGoalId: null, goals: [] });
    expect(localStorage.getItem('other:key')).toBe('keep me');
  });

  it('keeps the data and says so when deleting cannot be saved', () => {
    open();
    expand();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete All Data' }),
    );
    expect(within(dialog()).getByRole('alert')).toHaveTextContent("We couldn't delete your data.");
    expect(useStore.getState().data).toEqual(current);
  });
});
