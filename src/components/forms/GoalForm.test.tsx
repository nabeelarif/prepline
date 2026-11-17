import { act, fireEvent, screen } from '@testing-library/react';
import type { AppData } from '../../domain/types';
import { useStore } from '../../state/store';
import { resetApp } from '../../test/harness';
import { renderApp } from '../../test/renderApp';

const data: AppData = {
  version: 1,
  activeGoalId: 'c',
  goals: [
    {
      id: 'c',
      name: 'Current plan',
      description: '',
      startDate: '2026-02-01',
      targetDate: '2099-01-01',
      hoursPerDay: null,
      createdAt: '2026-01-01',
      resources: [],
      phases: [],
    },
  ],
};

beforeEach(() => resetApp(data));

describe('Edit plan deadline', () => {
  it('refuses a deadline before the day the plan started', async () => {
    renderApp();
    await screen.findByText('Current plan');
    act(() => useStore.getState().openOverlay({ kind: 'goal', goalId: 'c' }));
    fireEvent.change(await screen.findByLabelText(/Deadline/), { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/cannot be before the day the plan started/)).toBeVisible();
    expect(useStore.getState().data.goals[0]!.targetDate).toBe('2099-01-01');
  });
});
