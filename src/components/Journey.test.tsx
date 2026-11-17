import { fireEvent, screen } from '@testing-library/react';
import { parseAppData } from '../domain/schema';
import { resetApp } from '../test/harness';
import { renderApp } from '../test/renderApp';

const plan = () =>
  resetApp(
    parseAppData({
      goals: [
        {
          id: 'g',
          name: 'Prep',
          phases: [
            { id: 'p1', name: 'Basics', color: 'blue' },
            { id: 'p2', name: 'Advanced', color: 'green' },
          ],
          resources: [
            { title: 'A', phaseId: 'p1', done: true, minutes: 60 },
            { title: 'B', phaseId: 'p2', minutes: 60 },
          ],
        },
      ],
    })!,
  );

describe('Journey phases', () => {
  // The journey draws nothing until it has a width, and jsdom has no layout.
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 900 });
  });
  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  });

  it('jumps to a phase without hiding the others, and the band can still be folded', async () => {
    await plan();
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /^Phases/ }));

    // The finished phase starts folded.
    const basics = () =>
      screen.getByRole('region', { name: 'Basics' }).querySelector('.band-toggle')!;
    expect(basics()).toHaveAttribute('aria-expanded', 'false');

    const step = () => screen.getByTitle('Basics');
    fireEvent.click(step());
    expect(basics()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Advanced' })).toBeInTheDocument();

    // Not locked: the user can fold it, and picking it again opens it again.
    fireEvent.click(basics());
    expect(basics()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(step());
    expect(basics()).toHaveAttribute('aria-expanded', 'true');
  });
});
