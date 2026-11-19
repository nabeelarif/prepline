import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyAppData } from '../../domain/backup';
import { useStore } from '../../state/store';
import { goal, res } from '../../test/fixtures';
import { resetApp } from '../../test/harness';
import { renderApp } from '../../test/renderApp';

const mine = goal([res({ id: 'r1', title: 'Read' })], { id: 'g1', name: 'Swift basics' });

describe('FavoritesPage', () => {
  beforeEach(async () => {
    await resetApp({ ...createEmptyAppData(), goals: [mine], activeGoalId: 'g1' });
  });

  it('is empty until a plan is starred, then lists it with both counts', async () => {
    const s = () => useStore.getState();
    await waitFor(() => expect(s().sharing.status).toBe('ready'));
    await s().setPlanSharing('g1', 'public', []);
    const slug = s().sharing.plans['g1']!.slug!;
    await s().signOut();
    await s().signUpWithPassword('e@example.test', 'password1');
    await waitFor(() => expect(s().load.status).toBe('ready'));

    const first = renderApp('/favorites');
    expect(await screen.findByText('No favorites yet')).toBeVisible();
    first.unmount();

    expect(await s().setFavorite(slug, true)).toBeNull();
    renderApp('/favorites');
    expect(await screen.findByRole('heading', { name: 'Swift basics' })).toBeVisible();
    expect(screen.getByText(/0 forks · 1 favorite$/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Favorited' })).toBeVisible();
  });
});
