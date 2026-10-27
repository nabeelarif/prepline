import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { useStore } from './state/store';

const createPlan = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Create Your First Plan' }));
  fireEvent.change(screen.getByLabelText('Plan Title'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));
};

afterEach(() => {
  vi.restoreAllMocks();
  useStore.getState().resetAll();
});

describe('App', () => {
  it('starts with an invitation to create a plan, then shows its dashboard', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Start your preparation journey' }),
    ).toBeVisible();
    expect(screen.getByText('Saved in this browser')).toBeVisible();

    createPlan('System design');
    expect(screen.getByRole('heading', { level: 1, name: 'System design' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your journey starts here' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Plan created');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns when the browser refuses to save', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    render(<App />);
    createPlan('Prep');
    expect(screen.getByRole('alert')).toHaveTextContent('Changes are not being saved');
    expect(screen.getByText('Not saving: browser storage is blocked')).toBeVisible();
  });
});
