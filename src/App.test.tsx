import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the sample goal on first run', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Senior iOS interview prep' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    expect(screen.getByText('Saved in this browser')).toBeVisible();
  });
});
