import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyAppData } from '../../domain/backup';
import { useStore } from '../../state/store';
import { goal, res } from '../../test/fixtures';
import { resetApp } from '../../test/harness';
import { renderApp } from '../../test/renderApp';

const mine = goal([res({ id: 'r1', title: 'Read' })], { id: 'g1', name: 'My plan' });

describe('SharedPlanPage', () => {
  beforeEach(async () => {
    await resetApp({ ...createEmptyAppData(), goals: [mine], activeGoalId: 'g1' });
  });

  it('shows "by you" and no Add button on your own plan', async () => {
    const s = () => useStore.getState();
    await waitFor(() => expect(s().sharing.status).toBe('ready'));
    expect(await s().setPlanSharing('g1', 'public', [])).toBeNull();
    const slug = s().sharing.plans['g1']!.slug!;

    renderApp(`/explore/${slug}`);
    expect(await screen.findByRole('heading', { name: 'My plan' })).toBeVisible();
    expect(screen.getByText('by you')).toHaveClass('by-you');
    expect(screen.queryByRole('button', { name: /Add to My Plans/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open in My Plans' })).toHaveAttribute(
      'href',
      '/plans/g1',
    );
    expect(screen.getByText(/already in My Plans/)).toBeVisible();
  });

  it('offers Add to My Plans on someone else’s plan', async () => {
    const s = () => useStore.getState();
    await waitFor(() => expect(s().sharing.status).toBe('ready'));
    await s().setPlanSharing('g1', 'public', []);
    const slug = s().sharing.plans['g1']!.slug!;
    const shared = (await s().fetchShared(slug))!;
    await s().signOut();
    await s().signUpWithPassword('b@example.test', 'password1');
    await waitFor(() => expect(s().load.status).toBe('ready'));

    renderApp(`/explore/${slug}`);
    expect(await screen.findByRole('button', { name: /Add to My Plans/ })).toBeVisible();
    expect(screen.queryByText('by you')).toBeNull();
    expect(screen.getByText(`by ${shared.author}`)).toBeVisible();
  });

  it('shows where a shared copy was forked from', async () => {
    const s = () => useStore.getState();
    await waitFor(() => expect(s().sharing.status).toBe('ready'));
    await s().setPlanSharing('g1', 'public', []);
    const original = (await s().fetchShared(s().sharing.plans['g1']!.slug!))!;
    await s().signOut();
    await s().signUpWithPassword('c@example.test', 'password1');
    await waitFor(() => expect(s().load.status).toBe('ready'));
    expect(await s().copySharedPlan(original)).toBeNull();
    const copyId = s().data.goals[0]!.id;
    await waitFor(() => expect(s().sharing.status).toBe('ready'));
    await s().setPlanSharing(copyId, 'public', []);
    const copySlug = s().sharing.plans[copyId]!.slug!;

    renderApp(`/explore/${copySlug}`);
    const link = await screen.findByRole('link', { name: 'My plan' });
    expect(link).toHaveAttribute('href', `/explore/${original.slug}`);
    expect(screen.getByText(/Forked from/)).toBeVisible();
  });
});
