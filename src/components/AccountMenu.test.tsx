import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../App';
import { useStore } from '../state/store';
import { renderApp } from '../test/renderApp';

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

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

  it('changes the display name from account settings', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account settings' }));
    const input = await screen.findByLabelText(/Display name/);
    await waitFor(() => expect(input).toBeEnabled());
    const save = screen.getByRole('button', { name: 'Save name' });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: '  Ada  ' } });
    fireEvent.click(save);
    expect(await screen.findByText('Name saved.')).toBeVisible();
    expect(useStore.getState().sharing.displayName).toBe('Ada');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Enter a name.')).toBeVisible();
  });

  it('leaves the signed-in address on sign out', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/plans']}>
          <App />
          <Where />
        </MemoryRouter>
      </StrictMode>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Click again to sign out' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/));
  });
});
