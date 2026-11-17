import { act, fireEvent, screen, within } from '@testing-library/react';
import { parseAppData } from '../domain/schema';
import { renderApp } from '../test/renderApp';
import { resetApp } from '../test/harness';
import { useStore } from '../state/store';

const resources = () => screen.getByRole('region', { name: /^Resources/ });

async function show(notes: Record<string, string>) {
  const data = parseAppData({
    goals: [
      {
        id: 'g',
        name: 'Prep',
        resources: Object.entries(notes).map(([title, n]) => ({ id: title, title, notes: n })),
      },
    ],
  })!;
  await resetApp(data);
  renderApp();
  await screen.findByRole('region', { name: /^Resources/ });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Resource notes', () => {
  it('shows nothing extra for a resource without notes', async () => {
    await show({ Plain: '' });
    expect(resources().querySelector('.res-notes-line')).toBeNull();
  });

  it('shows short notes inside the card, with no Show more', async () => {
    await show({ Short: 'Read the intro.' });
    const line = within(resources()).getByText('Read the intro.');
    expect(line.closest('.res-card')).not.toBeNull();
    expect(line.closest('.res-notes-line')).not.toBeNull();
    expect(within(resources()).queryByRole('button', { name: /Show/ })).toBeNull();
  });

  it('opens multi-line notes in full and closes them again with the same button', async () => {
    const notes = 'Understand memory.\n\n- Read ARC\n- Fix a retain cycle';
    await show({ Memory: notes });
    const toggle = within(resources()).getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    fireEvent.click(toggle);

    expect(toggle).toHaveAccessibleName('Show less');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    const text = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(text.textContent).toBe(notes);
    expect(text).toHaveClass('open');

    fireEvent.click(toggle);
    expect(toggle).toHaveAccessibleName('Show more');
    expect(text).not.toHaveClass('open');
  });

  it('offers Show more when one long line overflows the preview', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(36);
    await show({ Long: 'A very long single line of notes. '.repeat(10) });
    expect(within(resources()).getByRole('button', { name: 'Show more' })).toBeVisible();
  });

  it('offers Show more again after Show less', async () => {
    // A detached element measures as empty, as in a browser.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.isConnected ? 80 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(36);
    // Observers report a size change whenever the test says so.
    type Entry = { target: Element; contentRect: { width: number } };
    const live = new Set<() => void>();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        fire = () => {};
        constructor(private cb: (e: Entry[]) => void) {}
        observe(target: Element) {
          this.fire = () => this.cb([{ target, contentRect: { width: 800 } }]);
          live.add(this.fire);
        }
        disconnect() {
          live.delete(this.fire);
        }
      },
    );
    await show({ Long: 'A very long single line of notes. '.repeat(10) });
    const resize = () => act(() => live.forEach((cb) => cb()));

    fireEvent.click(within(resources()).getByRole('button', { name: 'Show more' }));
    resize();
    fireEvent.click(within(resources()).getByRole('button', { name: 'Show less' }));
    resize();
    expect(within(resources()).getByRole('button', { name: 'Show more' })).toBeVisible();
  });

  it('shows notes as plain text, never as HTML', async () => {
    await show({ Markup: '<b>bold</b>' });
    expect(within(resources()).getByText('<b>bold</b>')).toBeVisible();
    expect(resources().querySelector('.res-notes b')).toBeNull();
  });
});

describe('Resource links', () => {
  const link = (title: string, url: string) =>
    resetApp(
      parseAppData({
        goals: [{ id: 'g', name: 'Prep', resources: [{ title, url }] }],
      })!,
    );

  it('opens a YouTube title in the viewer, with a separate new-tab link', async () => {
    await link('Talk', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    const tab = within(resources()).getByRole('link', { name: 'Open Talk in a new tab' });
    expect(tab).toHaveAttribute('target', '_blank');
    expect(tab.querySelector('svg.ext')).not.toBeNull();
    const start = within(resources()).getByRole('button', { name: 'Start' });
    expect(start.querySelector('svg.lucide-external-link')).toBeNull();

    fireEvent.click(within(resources()).getByRole('button', { name: 'Talk' }));
    const dialog = await screen.findByRole('dialog', { name: 'Talk' });
    expect(within(dialog).getByTitle('Talk')).toHaveAttribute(
      'src',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(within(dialog).getByRole('link', { name: /Open in new tab/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  it.each(['https://a.dev/x', 'https://leetcode.com/problems/two-sum/'])(
    'opens %s straight in a new tab, with no viewer',
    async (url) => {
      await link('Doc', url);
      renderApp();
      await screen.findByRole('region', { name: /^Resources/ });
      const a = within(resources()).getByRole('link', { name: 'Doc' });
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('href', url);
      expect(within(resources()).queryByRole('button', { name: 'Doc' })).toBeNull();
    },
  );
});

describe('Resource groups', () => {
  const plan = (resources: object[], phases: object[] = []) =>
    resetApp(parseAppData({ goals: [{ id: 'g', name: 'Prep', phases, resources }] })!);
  const bands = () =>
    [...resources().querySelectorAll('.phase-band .band-name')].map((n) =>
      n.firstChild?.textContent?.trim(),
    );

  it('offers to create a phase when the plan has none', async () => {
    await plan([{ title: 'A' }]);
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    expect(bands()).toEqual(['Unassigned']);
    expect(within(resources()).getByText(/Group your resources into phases/)).toBeVisible();
    fireEvent.click(within(resources()).getByRole('button', { name: 'Create phase' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('groups by phase in phase order, with unassigned last and hidden when empty', async () => {
    await plan(
      [
        { id: 'a', title: 'A', phaseId: 'p2' },
        { id: 'b', title: 'B', phaseId: 'p1' },
        { id: 'c', title: 'C' },
      ],
      [
        { id: 'p1', name: 'First', color: 'blue' },
        { id: 'p2', name: 'Second', color: 'green' },
      ],
    );
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    expect(bands()).toEqual(['First', 'Second', 'Unassigned']);
    expect(within(resources()).getByText('1 resource needs a phase')).toBeVisible();
    expect(within(resources()).getByRole('button', { name: /Assign C to a phase/ })).toBeVisible();

    fireEvent.click(within(resources()).getByRole('button', { name: /Assign C to a phase/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'First' }));
    expect(bands()).toEqual(['First', 'Second']);
  });

  it('folds a finished phase and opens it again on click', async () => {
    await plan(
      [
        { title: 'Done one', phaseId: 'p1', done: true, minutes: 30 },
        { title: 'Todo', phaseId: 'p2' },
      ],
      [
        { id: 'p1', name: 'Finished', color: 'blue' },
        { id: 'p2', name: 'Open', color: 'green' },
      ],
    );
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    expect(within(resources()).queryByText('Done one')).toBeNull();
    expect(within(resources()).getByText('Todo')).toBeVisible();
    fireEvent.click(within(resources()).getByRole('button', { name: /^Finished/ }));
    expect(within(resources()).getByText('Done one')).toBeVisible();
  });

  it('moves a card within its band, and disables Move up on the first card of a band', async () => {
    await plan(
      [
        { id: 'a', title: 'A', phaseId: 'p1' },
        { id: 'b', title: 'B', phaseId: 'p2' },
        { id: 'c', title: 'C', phaseId: 'p2' },
      ],
      [
        { id: 'p1', name: 'One', color: 'blue' },
        { id: 'p2', name: 'Two', color: 'green' },
      ],
    );
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    fireEvent.click(within(resources()).getByRole('button', { name: 'Actions for B' }));
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(within(resources()).getByRole('button', { name: 'Actions for B' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));
    const titles = () => [...resources().querySelectorAll('.res-title')].map((n) => n.textContent);
    expect(titles()).toEqual(['A', 'C', 'B']);
  });

  it('adds a resource without a phase from the Unassigned band', async () => {
    await plan([{ title: 'A' }], [{ id: 'p1', name: 'One', color: 'blue' }]);
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    fireEvent.click(within(resources()).getByRole('button', { name: 'Add unassigned resource' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('lets the user fold a band that a selected resource opened', async () => {
    await plan(
      [{ id: 'a', title: 'Done one', phaseId: 'p1', done: true, minutes: 30 }],
      [{ id: 'p1', name: 'Finished', color: 'blue' }],
    );
    renderApp();
    await screen.findByRole('region', { name: /^Resources/ });
    act(() => useStore.getState().selectResource('a'));
    expect(within(resources()).getByText('Done one')).toBeVisible();
    fireEvent.click(within(resources()).getByRole('button', { name: /^Finished/ }));
    expect(within(resources()).queryByText('Done one')).toBeNull();
  });
});
