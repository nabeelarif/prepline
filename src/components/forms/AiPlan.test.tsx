import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import skill from '../../../public/ai/skill-v1.md?raw';
import example from '../../../public/ai/example-plan-v1.json?raw';
import { addDays, fmtDate, todayISO } from '../../domain/dates';
import type { AppData } from '../../domain/types';
import { useStore } from '../../state/store';
import { goal } from '../../test/fixtures';
import { memory, resetApp, serverData } from '../../test/harness';
import { renderApp } from '../../test/renderApp';

const current: AppData = {
  version: 1,
  activeGoalId: 'c',
  goals: [
    goal([], {
      id: 'c',
      name: 'Current plan',
      startDate: null,
      targetDate: null,
      hoursPerDay: null,
    }),
  ],
};
const reply = `Here you go:\n\n\`\`\`json\n${example}\`\`\`\n\nClick Copy on the box above.`;

let clipboard: { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  await resetApp(current);
  clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(reply),
  };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(skill) }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const dialog = () => screen.getByRole('dialog');
const press = (name: string | RegExp) =>
  fireEvent.click(within(dialog()).getByRole('button', { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } });
const link = (name: string) =>
  within(dialog()).getByRole('link', { name: `Generate with ${name}` });

async function openFromMyPlans(button: string) {
  renderApp('/plans');
  fireEvent.click(await screen.findByRole('button', { name: button }));
}

describe('Use your own AI', () => {
  it('asks for a goal before opening an AI or copying', async () => {
    await openFromMyPlans('Use my own AI');
    expect(fireEvent.click(link('ChatGPT'))).toBe(false);
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Say what you want to learn');
    await waitFor(() => expect(within(dialog()).getByLabelText('Goal or topic')).toHaveFocus());
    press('Copy prompt');
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('prefills ChatGPT and Claude, and copies for the others', async () => {
    await openFromMyPlans('Use my own AI');
    type('Goal or topic', 'Learn Git');
    const href = link('ChatGPT').getAttribute('href')!;
    expect(href).toMatch(/^https:\/\/chatgpt\.com\/\?q=/);
    expect(new URL(href).searchParams.get('q')).toContain('/ai/skill-v1.md');
    expect(link('Claude').getAttribute('href')).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
    expect(link('ChatGPT')).toHaveAttribute('target', '_blank');
    expect(link('Gemini')).toHaveAttribute('href', 'https://gemini.google.com/app');

    fireEvent.click(link('Gemini'));
    await waitFor(() =>
      expect(useStore.getState().ui.toast?.text).toBe('Prompt copied — paste it into the chat'),
    );
    expect(clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining('Learn Git'));
  });

  it('copies the hosted skill with the settings for an AI that cannot open links', async () => {
    await openFromMyPlans('Use my own AI');
    type('Goal or topic', 'Learn Git');
    press(/copy full instructions/);
    expect(await within(dialog()).findByText(/Full instructions copied/)).toBeVisible();
    const text = clipboard.writeText.mock.lastCall![0] as string;
    expect(text).toContain(skill.trim());
    expect(text).toContain('- Goal: Learn Git');
  });

  it('does not copy the app’s own page when the skill is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('<!doctype html>') }),
    );
    await openFromMyPlans('Use my own AI');
    type('Goal or topic', 'Learn Git');
    press(/copy full instructions/);
    expect(await within(dialog()).findByText(/could not be loaded/)).toBeVisible();
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows the text to copy by hand when the browser refuses', async () => {
    clipboard.writeText.mockRejectedValue(new Error('denied'));
    await openFromMyPlans('Use my own AI');
    type('Goal or topic', 'Learn Git');
    press('Copy prompt');
    const box = await within(dialog()).findByLabelText(/didn’t allow copying/);
    expect((box as HTMLTextAreaElement).value).toContain('- Goal: Learn Git');
  });

  it('keeps the form while the user goes to paste and comes back', async () => {
    await openFromMyPlans('Use my own AI');
    type('Goal or topic', 'Learn Git');
    press('Paste plan');
    press('No plan yet? Use my own AI');
    expect(within(dialog()).getByLabelText('Goal or topic')).toHaveValue('Learn Git');
  });

  it('starts at ten days', async () => {
    await openFromMyPlans('Use my own AI');
    expect(within(dialog()).getByLabelText('Duration (days)')).toHaveValue(10);
  });

  it('says a later start date does not delay the plan', async () => {
    await openFromMyPlans('Use my own AI');
    expect(dialog()).toHaveTextContent('The plan starts as soon as you add it.');
    expect(dialog()).not.toHaveTextContent('rather than');
    type('Duration (days)', '30');
    const start = addDays(todayISO(), 60);
    expect(within(dialog()).getByLabelText(/Start date/)).toHaveAttribute('min', todayISO());
    type(/Start date/, start);
    expect(dialog()).toHaveTextContent(
      `not on ${fmtDate(start, true)}. With a deadline of ${fmtDate(addDays(start, 29), true)}, you would have 90 days rather than 30.`,
    );
  });

  it('lets the hours go as low as the form accepts', async () => {
    await openFromMyPlans('Use my own AI');
    const hours = within(dialog()).getByLabelText<HTMLInputElement>('Hours per day');
    type('Hours per day', '0.25');
    expect(hours.checkValidity()).toBe(true);
    type('Hours per day', '1.5');
    expect(hours.checkValidity()).toBe(true);
  });

  it('is offered from the new plan form', async () => {
    await openFromMyPlans('New plan');
    press('Use my own AI');
    expect(within(dialog()).getByRole('heading', { name: /Use your own AI/ })).toBeVisible();
  });
});

describe('Paste plan', () => {
  const box = () => within(dialog()).getByLabelText<HTMLTextAreaElement>('Your AI’s reply');

  it('previews a whole reply, saves only on confirm, then opens the new plan', async () => {
    await openFromMyPlans('Paste plan');
    type('Your AI’s reply', reply);
    press('Import');
    const preview = within(dialog()).getByRole('region', { name: 'Plan preview' });
    expect(preview).toHaveTextContent('Git Basics in 5 Days');
    expect(preview).toHaveTextContent('6 resources · 3.9h estimated · 2 phases');
    expect(preview).toHaveTextContent('About Version Control (Pro Git)');
    expect(preview).toHaveTextContent('and 3 more');
    expect(preview).not.toHaveTextContent('Learn Git Branching');
    expect(serverData().goals).toHaveLength(1);

    press('Add to My Plans');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Git Basics in 5 Days' }),
    ).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(serverData().goals).toHaveLength(2);
  });

  it('lists the errors, copies a fix-it message and keeps the text', async () => {
    await openFromMyPlans('Paste plan');
    const bad = '{"version": 1, "goals": [{"name": "A", "hoursPerDay": "2"}]}';
    type('Your AI’s reply', bad);
    press('Import');
    const alert = within(dialog()).getByRole('alert');
    expect(alert).toHaveTextContent('"hoursPerDay" (it must be a number without quotes)');
    press('Copy fix-it message');
    expect(await within(dialog()).findByText(/Copied\. Paste it/)).toBeVisible();
    expect(clipboard.writeText).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Your JSON had these errors:\n- Plan 1 "A"/),
    );
    expect(box().value).toBe(bad);
    expect(serverData().goals).toHaveLength(1);
  });

  it('keeps the text after Cancel on the preview', async () => {
    await openFromMyPlans('Paste plan');
    type('Your AI’s reply', reply);
    press('Import');
    press('Cancel');
    expect(box().value).toBe(reply);
  });

  it('warns about a plan with no resources', async () => {
    await openFromMyPlans('Paste plan');
    type('Your AI’s reply', '{"goals": [{"name": "Made up", "days": [{"tasks": []}]}]}');
    press('Import');
    expect(dialog()).toHaveTextContent(
      'No resources. If your AI made up its own format, open Use my own AI',
    );
  });

  it('gives no AI advice about an empty plan from a file', async () => {
    await openFromMyPlans('Import plan');
    const file = new File(['{"goals": [{"name": "Empty"}]}'], 'plan.json');
    fireEvent.change(screen.getByLabelText('Plan file'), { target: { files: [file] } });
    const contents = await screen.findByRole('region', { name: 'File contents' });
    expect(contents).toHaveTextContent('No resources.');
    expect(contents).not.toHaveTextContent('your AI');
  });

  it('pastes from the clipboard', async () => {
    await openFromMyPlans('Paste plan');
    press('Paste from clipboard');
    await waitFor(() => expect(box().value).toBe(reply));
  });

  it('says how to paste by hand when the clipboard is refused', async () => {
    clipboard.readText.mockRejectedValue(new Error('denied'));
    await openFromMyPlans('Paste plan');
    press('Paste from clipboard');
    expect(await within(dialog()).findByText(/didn’t allow reading/)).toBeVisible();
    expect(box()).toHaveFocus();
  });

  it('stays open with Retry when the save fails', async () => {
    await openFromMyPlans('Paste plan');
    type('Your AI’s reply', reply);
    press('Import');
    memory().failNext(1);
    press('Add to My Plans');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      "We couldn't add these plans.",
    );
    press('Retry');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Git Basics in 5 Days' }),
    ).toBeVisible();
  });

  it('opens the new plan from another plan’s own page', async () => {
    renderApp('/plans/c');
    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import plans' }));
    press('Paste plan');
    type('Your AI’s reply', reply);
    press('Import');
    press('Add to My Plans');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Git Basics in 5 Days' }),
    ).toBeVisible();
  });

  it('runs a chosen file through the same repairs', async () => {
    await openFromMyPlans('Import plan');
    const file = new File([reply], 'plan.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Plan file'), { target: { files: [file] } });
    expect(await screen.findByRole('region', { name: 'File contents' })).toHaveTextContent(
      'Git Basics in 5 Days',
    );
  });
});
