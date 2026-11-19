import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { AppData } from '../../domain/types';
import { useStore } from '../../state/store';
import { memory, resetApp } from '../../test/harness';
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
      targetDate: null,
      hoursPerDay: null,
      createdAt: '2026-01-01',
      resources: [],
      phases: [],
    },
  ],
};

const URL_A = 'https://example.com/posts/some-article';

/** Lets the 600 ms pause before the lookup, and the lookup itself, finish. */
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 900)));

async function openForm() {
  renderApp();
  await screen.findByText('Current plan');
  act(() => useStore.getState().openOverlay({ kind: 'resource', resourceId: null }));
  return {
    url: await screen.findByLabelText(/Resource URL/),
    title: screen.getByLabelText<HTMLInputElement>(/^Title/),
    hours: screen.getByLabelText<HTMLInputElement>(/Estimated Time/),
  };
}

beforeEach(() => resetApp(data));

describe('Add resource: details from the link', () => {
  it('fills the title and length the server found', async () => {
    memory().setUrlInfo(URL_A, { title: 'A Real Title', readMinutes: 90 });
    const f = await openForm();
    fireEvent.change(f.url, { target: { value: URL_A } });
    expect(f.title).toHaveValue('Some article'); // instant guess from the address
    await waitFor(() => expect(f.title).toHaveValue('A Real Title'), { timeout: 3000 });
    expect(f.hours).toHaveValue(1.5);
  });

  it('keeps a title and time the user typed', async () => {
    memory().setUrlInfo(URL_A, { title: 'A Real Title', minutes: 90 });
    const f = await openForm();
    fireEvent.change(f.title, { target: { value: 'My own title' } });
    fireEvent.change(f.hours, { target: { value: '2' } });
    fireEvent.change(f.url, { target: { value: URL_A } });
    await settle();
    expect(f.title).toHaveValue('My own title');
    expect(f.hours).toHaveValue(2);
  });

  it('uses an exact video length, but not a reading time, for a course link', async () => {
    memory().setUrlInfo('https://www.udemy.com/course/swift-basics', { readMinutes: 4 });
    memory().setUrlInfo('https://vimeo.com/123456', { minutes: 42 });
    const f = await openForm();
    fireEvent.change(f.url, { target: { value: 'https://www.udemy.com/course/swift-basics' } });
    await settle();
    expect(f.hours).toHaveValue(10); // the course default stays; 4 min would understate it
    fireEvent.change(f.url, { target: { value: 'https://vimeo.com/123456' } });
    await settle();
    expect(f.hours).toHaveValue(0.7);
  });

  it('does not refill a title the user cleared', async () => {
    memory().setUrlInfo(URL_A, { title: 'A Real Title' });
    const f = await openForm();
    fireEvent.change(f.url, { target: { value: URL_A } });
    fireEvent.change(f.title, { target: { value: '' } });
    await settle();
    expect(f.title).toHaveValue('');
  });

  it('leaves the guess in place when nothing is found', async () => {
    const f = await openForm();
    fireEvent.change(f.url, { target: { value: 'https://example.com/posts/unknown-page' } });
    await settle();
    expect(f.title).toHaveValue('Unknown page');
  });
});
