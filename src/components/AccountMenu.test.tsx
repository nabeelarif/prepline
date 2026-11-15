import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('AccountMenu', () => {
  it('shows the email only inside the menu, and saves the theme', async () => {
    renderApp();
    const btn = await screen.findByRole('button', { name: 'Account menu' });
    expect(screen.queryByText('test@example.test')).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText('test@example.test')).toBeVisible();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Auto' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('opens account settings', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account settings' }));
    expect(await screen.findByRole('dialog', { name: 'Account' })).toBeVisible();
  });
});
