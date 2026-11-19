import { act, fireEvent, screen } from '@testing-library/react';
import { parseAppData } from '../domain/schema';
import { useStore } from '../state/store';
import { useTimer } from '../state/timer';
import { resetApp } from '../test/harness';
import { renderApp } from '../test/renderApp';

const MIN = 60_000;

async function show() {
  await resetApp(
    parseAppData({
      goals: [
        {
          id: 'g',
          name: 'Prep',
          startDate: '2026-01-01',
          resources: [{ id: 'r', title: 'Read', minutes: 120 }],
        },
      ],
    })!,
  );
  await vi.waitFor(() => expect(useStore.getState().studyLog.ready).toBe(true));
  renderApp('/dashboard');
  await screen.findByRole('button', { name: /Start timer/ });
}

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    useTimer.setState({ timer: null });
  });
  localStorage.clear();
});

describe('Study timer', () => {
  it('starts, shows a bar, and credits whole minutes on stop', async () => {
    await show();
    const start = Date.now();
    fireEvent.click(screen.getByRole('button', { name: /Start timer/ }));
    expect(screen.getByRole('timer')).toBeTruthy();
    vi.spyOn(Date, 'now').mockReturnValue(start + 12 * MIN + 5_000);
    fireEvent.click(screen.getAllByRole('button', { name: /Stop/ })[0]!);
    expect(useTimer.getState().timer).toBeNull();
    expect(useStore.getState().data.goals[0]!.resources[0]!.doneMinutes).toBe(12);
    expect(Object.values(useStore.getState().studyLog.days)).toEqual([12]);
  });

  it("resumes a stored timer and ignores another user's", async () => {
    await show();
    const user = useStore.getState().auth.user!.id;
    const t = {
      userId: user,
      goalId: 'g',
      resourceId: 'r',
      startedAt: Date.now() - MIN,
      mode: 'free',
    };
    localStorage.setItem('roadtogoals:timer', JSON.stringify(t));
    act(() => useTimer.getState().sync());
    expect(useTimer.getState().timer?.resourceId).toBe('r');
    localStorage.setItem('roadtogoals:timer', JSON.stringify({ ...t, userId: 'someone-else' }));
    act(() => useTimer.getState().sync());
    expect(useTimer.getState().timer).toBeNull();
  });
});

describe('Study timer safety', () => {
  const stored = (over = {}) => ({
    userId: useStore.getState().auth.user!.id,
    goalId: 'g',
    resourceId: 'r',
    startedAt: Date.now() - 10 * MIN,
    mode: 'free' as const,
    ...over,
  });

  it('credits nothing when another tab already stopped the timer', async () => {
    await show();
    localStorage.setItem('roadtogoals:timer', JSON.stringify(stored()));
    act(() => useTimer.getState().sync());
    localStorage.removeItem('roadtogoals:timer'); // the other tab stopped it
    act(() => {
      useTimer.getState().stop();
    });
    expect(useTimer.getState().timer).toBeNull();
    expect(useStore.getState().data.goals[0]!.resources[0]!.doneMinutes).toBe(0);
  });

  it('keeps running, and can be discarded, when the log is not available', async () => {
    await show();
    localStorage.setItem('roadtogoals:timer', JSON.stringify(stored()));
    act(() => useTimer.getState().sync());
    act(() => useStore.setState({ studyLog: { ready: false, days: {} } }));
    let stopped = true;
    act(() => {
      stopped = useTimer.getState().stop();
    });
    expect(stopped).toBe(false);
    expect(useTimer.getState().timer).not.toBeNull();
    expect(useStore.getState().ui.toast?.text).toMatch(/Discard/);
    act(() => useTimer.getState().discard());
    expect(useTimer.getState().timer).toBeNull();
    expect(localStorage.getItem('roadtogoals:timer')).toBeNull();
  });
});
