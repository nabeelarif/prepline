import { render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { vi } from 'vitest';
import { LazyPage } from './LazyPage';

describe('LazyPage', () => {
  it('shows a way out when the page code cannot be fetched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch module')));
    render(
      <LazyPage>
        <Broken />
      </LazyPage>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not load');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  });

  it('shows the page once it arrives', async () => {
    const Fine = lazy(() => Promise.resolve({ default: () => <p>Loaded page</p> }));
    render(
      <LazyPage>
        <Fine />
      </LazyPage>,
    );
    expect(await screen.findByText('Loaded page')).toBeVisible();
  });
});
