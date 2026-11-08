import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { parseAppData } from '../domain/schema';
import { resetApp } from '../test/harness';

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
  render(<App />);
  await screen.findByRole('region', { name: /^Resources/ });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Resource notes', () => {
  it('shows nothing extra for a resource without notes', async () => {
    await show({ Plain: '' });
    expect(resources().querySelector('.res-notes-row')).toBeNull();
    expect(resources().querySelector('.res-row')).not.toHaveClass('has-notes');
  });

  it('shows short notes on their own line under the row, with no Show more', async () => {
    await show({ Short: 'Read the intro.' });
    const line = within(resources()).getByText('Read the intro.');
    expect(line.closest('tr')).toHaveClass('res-notes-row');
    expect(line.closest('tr')!.previousElementSibling).toHaveClass('res-row', 'has-notes');
    expect(resources().querySelector('.res-name .res-notes')).toBeNull();
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

  it("alternates backgrounds by visible resource, with notes in their row's color", async () => {
    await resetApp(
      parseAppData({
        goals: [
          {
            name: 'Prep',
            resources: [
              { title: 'A', type: 'video', notes: 'Watch closely.' },
              { title: 'B', type: 'article' },
              { title: 'C', type: 'video', notes: 'Again.' },
            ],
          },
        ],
      })!,
    );
    render(<App />);
    await screen.findByRole('region', { name: /^Resources/ });
    const alt = () =>
      [...resources().querySelectorAll('tbody tr')].map(
        (tr) =>
          `${tr.className.includes('res-notes-row') ? 'notes' : 'row'}:${tr.classList.contains('alt')}`,
      );
    expect(alt()).toEqual(['row:false', 'notes:false', 'row:true', 'row:false', 'notes:false']);

    // Filtered, the visible rows alternate from the first one.
    fireEvent.click(within(resources()).getByRole('button', { name: /^Videos/ }));
    expect(alt()).toEqual(['row:false', 'notes:false', 'row:true', 'notes:true']);
  });
});
