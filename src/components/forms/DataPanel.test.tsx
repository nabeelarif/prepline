import { fireEvent, screen, within } from '@testing-library/react';
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

/** The backend's copy of the data, as text so before/after can be compared. */
const saved = () => JSON.stringify(serverData());
const dialog = () => screen.getByRole('dialog');

async function open() {
  renderApp();
  fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Import plans' }));
}

function pick(contents: string, name = 'roadtogoals-backup-2026-10-20.json') {
  const file = new File([contents], name, { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Plan file'), { target: { files: [file] } });
}

beforeEach(() => resetApp(current));
afterEach(() => vi.restoreAllMocks());

describe('Import plans', () => {
  it('reviews a valid backup without changing anything', async () => {
    await open();
    const before = saved();
    pick(JSON.stringify(backup));
    const review = await screen.findByRole('region', { name: 'File contents' });
    expect(within(review).getByText('roadtogoals-backup-2026-10-20.json')).toBeVisible();
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
    await open();
    pick(JSON.stringify({ ...backup, exportedAt: undefined }));
    const review = await screen.findByRole('region', { name: 'File contents' });
    expect(review).not.toHaveTextContent('Created');
  });

  it.each([
    ['not json', 'Invalid JSON'],
    ['{"version": 2, "goals": []}', 'Unsupported file version'],
    ['{"plans": []}', 'Missing or invalid data'],
    ['{"goals": [{"resources": []}]}', 'Missing or invalid data'],
  ])('turns away %s', async (contents, reason) => {
    await open();
    const before = saved();
    pick(contents);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This file couldn't be opened.");
    expect(alert).toHaveTextContent(reason);
    expect(saved()).toBe(before);
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Choose File' })).toHaveFocus();
  });

  it('has no backup download and no replace option', async () => {
    await open();
    expect(screen.queryByRole('button', { name: /Download Backup/ })).toBeNull();
    pick(JSON.stringify(backup));
    await screen.findByRole('region', { name: 'File contents' });
    expect(screen.queryByRole('button', { name: 'Replace All Data' })).toBeNull();
    expect(screen.queryByText(/Delete All Data/)).toBeNull();
  });

  it('cancels from review without changing data', async () => {
    await open();
    const before = saved();
    pick(JSON.stringify(backup));
    await screen.findByRole('region', { name: 'File contents' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeVisible();
    expect(saved()).toBe(before);
    expect(useStore.getState().data).toEqual(current);
  });

  it.each([
    ['photo.png', 'image/png'],
    ['clip.mp4', 'video/mp4'],
    ['notes.txt', 'text/plain'],
  ])('turns away %s without reading it', async (name, type) => {
    await open();
    const before = saved();
    const file = new File([JSON.stringify(backup)], name, { type });
    fireEvent.change(screen.getByLabelText('Plan file'), { target: { files: [file] } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Not a .json file');
    expect(saved()).toBe(before);
  });
});

describe('Add to My Plans', () => {
  const names = () => useStore.getState().data.goals.map((g) => g.name);

  it('adds the plans next to the current ones, with no confirmation', async () => {
    await open();
    pick(JSON.stringify(backup), 'roadtogoals-plan-ios.json');
    fireEvent.click(await screen.findByRole('button', { name: 'Add to My Plans' }));
    expect(await screen.findByText('Plans added successfully')).toBeVisible();
    expect(names()).toEqual(['Current plan', 'Restored plan', 'Second']);
    const added = useStore.getState().data.goals[1]!;
    expect(added.id).not.toBe('b');
    expect(added.resources[0]!.phaseId).toBe(added.phases[0]!.id);
    expect(JSON.parse(saved()!).goals).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Dashboard' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Restored plan' })).toBeVisible();
  });

  it('keeps the current data when the server refuses to save, then retries', async () => {
    await open();
    const before = saved();
    pick(JSON.stringify(backup));
    const add = await screen.findByRole('button', { name: 'Add to My Plans' });
    memory().failNext(1);
    fireEvent.click(add);
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      "We couldn't add these plans.",
    );
    expect(saved()).toBe(before);
    expect(useStore.getState().data).toEqual(current);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Plans added successfully')).toBeVisible();
    expect(names()).toEqual(['Current plan', 'Restored plan', 'Second']);
  });
});
