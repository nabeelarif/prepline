import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { Bot, ClipboardPaste, Copy, ExternalLink } from 'lucide-react';
import {
  AI_PROVIDERS,
  AI_SKILL_HEADING,
  AI_SKILL_PATH,
  buildFullPrompt,
  buildPlanPrompt,
  LEVELS,
  MAX_AI_DAYS,
  MAX_AI_GOAL,
  MAX_AI_NOTES,
  MAX_DAYS_OFF,
  providerLink,
  RESOURCE_PREFERENCES,
  toPlanRequest,
  type AiField,
  type AiForm,
  type AiProvider,
  type Level,
  type PlanRequest,
} from '../../domain/aiPrompt';
import { addDays, diffDays, fmtDate, todayISO, validISO } from '../../domain/dates';
import { pl } from '../../domain/format';
import { MAX_HOURS_PER_DAY, MIN_HOURS_PER_DAY } from '../../domain/constants';
import { appUrl } from '../../routes';
import { useStore } from '../../state/store';
import { copyText } from '../copyText';
import { DIALOG_TITLE } from '../Overlay';
import { CopyFallback } from './CopyFallback';

const FIELD_ID: Record<AiField, string> = {
  goal: 'aiGoal',
  days: 'aiDays',
  hoursPerDay: 'aiHours',
  startDate: 'aiStart',
  daysOff: 'aiDaysOff',
};
/** Fields inside "More options", which must be open before one can take focus. */
const IN_MORE: AiField[] = ['startDate', 'daysOff'];

const PREFERENCE_LABEL = { videos: 'Videos', articles: 'Articles', courses: 'Courses' } as const;

/** The hosted skill's text, or null when it can't be loaded. One copy: the file AIs read. */
async function loadSkill(): Promise<string | null> {
  try {
    const res = await fetch(appUrl(AI_SKILL_PATH));
    const text = res.ok ? await res.text() : '';
    // A missing file would come back as the app's own HTML page.
    return text.startsWith(AI_SKILL_HEADING) ? text : null;
  } catch {
    return null;
  }
}

/**
 * What a start date really does: it only sets the deadline, because an added plan with a
 * deadline is already running.
 */
function StartDateNote({ startDate, days }: { startDate: string; days: number }) {
  const today = todayISO();
  const later = validISO(startDate) && startDate > today && Number.isInteger(days) && days > 0;
  const deadline = later ? addDays(startDate, days - 1) : '';
  return (
    <p className="small muted" aria-live="polite">
      {later
        ? `The plan starts as soon as you add it, not on ${fmtDate(startDate, true)}. With a deadline of ${fmtDate(deadline, true)}, you would have ${pl(diffDays(today, deadline) + 1, 'day')} rather than ${days}.`
        : 'A start date only sets the deadline, counted from that day. The plan starts as soon as you add it. Without a date, you start it when you are ready.'}
    </p>
  );
}

/** Take a prompt to your own AI, then come back and paste its reply. No AI runs here. */
export function AiPlanPanel() {
  const form = useStore((s) => s.ui.aiForm);
  const { setAiForm, openOverlay } = useStore.getState();
  const set = (patch: Partial<AiForm>) => {
    setAiForm({ ...form, ...patch });
    setProblem(null);
    setStatus('');
    setUncopied(null);
  };
  const [problem, setProblem] = useState<{ field: AiField; error: string } | null>(null);
  const [status, setStatus] = useState('');
  const [uncopied, setUncopied] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(
    () => !!(form.startDate || form.notes || form.resources.length || form.daysOff !== '0'),
  );
  const [skill, setSkill] = useState<string | null>(null);

  // Loaded ahead of time: some browsers only allow copying straight from the click.
  useEffect(() => {
    let live = true;
    void loadSkill().then((text) => live && setSkill(text));
    return () => {
      live = false;
    };
  }, []);

  const checked = toPlanRequest(form);

  // After the render, so "More options" is open before a field inside it takes focus.
  useEffect(() => {
    if (problem) document.getElementById(FIELD_ID[problem.field])?.focus();
  }, [problem]);

  /** The checked form, or null after pointing at the first problem. */
  const request = (): PlanRequest | null => {
    if (checked.ok) return checked.request;
    setProblem(checked);
    setStatus('');
    if (IN_MORE.includes(checked.field)) setMoreOpen(true);
    return null;
  };

  const copy = async (text: string, done: string) => {
    const ok = await copyText(text);
    setUncopied(ok ? null : text);
    setStatus(ok ? done : '');
    return ok;
  };

  const prompt = (r: PlanRequest) => buildPlanPrompt(r, appUrl(AI_SKILL_PATH));

  const openAi = (e: MouseEvent<HTMLAnchorElement>, p: AiProvider) => {
    const r = request();
    if (!r) return e.preventDefault();
    const text = prompt(r);
    const { prefilled } = providerLink(p, text);
    // Copied even when prefilled, in case the AI stops reading the link's prompt.
    void copy(
      text,
      prefilled
        ? `${p.name} is opening with your prompt. It is also copied, in case the chat is empty.`
        : `Prompt copied. Paste it into the ${p.name} chat.`,
    ).then((ok) => {
      if (ok && !prefilled) useStore.getState().showToast('Prompt copied — paste it into the chat');
    });
  };

  const copyPrompt = () => {
    const r = request();
    if (r) void copy(prompt(r), 'Prompt copied. Paste it into your AI’s chat.');
  };

  const copyFull = async () => {
    const r = request();
    if (!r) return;
    const text = skill ?? (await loadSkill());
    if (!text) {
      setStatus('The instructions could not be loaded. Check your connection and try again.');
      return;
    }
    setSkill(text);
    void copy(
      buildFullPrompt(r, text),
      'Full instructions copied. Paste them into your AI’s chat.',
    );
  };

  const invalid = (field: AiField) =>
    problem?.field === field
      ? { 'aria-invalid': true, 'aria-describedby': 'aiProblem' }
      : undefined;

  return (
    <>
      <h2 id={DIALOG_TITLE} className="sheet-title">
        <Bot aria-hidden="true" />
        Use your own AI — free
      </h2>
      <p className="muted">
        Works with ChatGPT, Claude, Gemini, Copilot, and any AI that can read a link.
      </p>

      <ol className="ai-steps">
        <li>
          <h3>Fill in your plan details and click your AI.</h3>
          <form noValidate onSubmit={(e: FormEvent) => e.preventDefault()}>
            <label className="field">
              <span>Goal or topic</span>
              <input
                id="aiGoal"
                type="text"
                maxLength={MAX_AI_GOAL}
                value={form.goal}
                placeholder="e.g. Pass the AWS Solutions Architect exam"
                onChange={(e) => set({ goal: e.target.value })}
                {...invalid('goal')}
              />
            </label>
            <div className="row3">
              <label className="field">
                <span>Duration (days)</span>
                <input
                  id="aiDays"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_AI_DAYS}
                  value={form.days}
                  onChange={(e) => set({ days: e.target.value })}
                  {...invalid('days')}
                />
              </label>
              <label className="field">
                <span>Hours per day</span>
                <input
                  id="aiHours"
                  type="number"
                  inputMode="decimal"
                  min={MIN_HOURS_PER_DAY}
                  max={MAX_HOURS_PER_DAY}
                  step={MIN_HOURS_PER_DAY}
                  value={form.hoursPerDay}
                  onChange={(e) => set({ hoursPerDay: e.target.value })}
                  {...invalid('hoursPerDay')}
                />
              </label>
              <label className="field">
                <span>Current level</span>
                <select
                  value={form.level}
                  onChange={(e) => set({ level: e.target.value as Level })}
                >
                  {Object.entries(LEVELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <details
              className="ai-more"
              open={moreOpen}
              onToggle={(e) => setMoreOpen(e.currentTarget.open)}
            >
              <summary>More options</summary>
              <div className="row2">
                <label className="field">
                  <span>
                    Start date <small>(optional)</small>
                  </span>
                  <input
                    id="aiStart"
                    type="date"
                    min={todayISO()}
                    value={form.startDate}
                    onChange={(e) => set({ startDate: e.target.value })}
                    {...invalid('startDate')}
                  />
                </label>
                <label className="field">
                  <span>
                    Days off per week <small>(optional)</small>
                  </span>
                  <input
                    id="aiDaysOff"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_DAYS_OFF}
                    value={form.daysOff}
                    onChange={(e) => set({ daysOff: e.target.value })}
                    {...invalid('daysOff')}
                  />
                </label>
              </div>
              <StartDateNote startDate={form.startDate} days={Number(form.days)} />
              <fieldset className="field ai-prefs">
                <legend>
                  Preferred resources <small>(optional)</small>
                </legend>
                {RESOURCE_PREFERENCES.map((p) => (
                  <label key={p} className="choice">
                    <input
                      type="checkbox"
                      checked={form.resources.includes(p)}
                      onChange={(e) =>
                        set({
                          resources: e.target.checked
                            ? [...form.resources, p]
                            : form.resources.filter((x) => x !== p),
                        })
                      }
                    />
                    <span>{PREFERENCE_LABEL[p]}</span>
                  </label>
                ))}
              </fieldset>
              <label className="field">
                <span>
                  Notes <small>(optional)</small>
                </span>
                <textarea
                  rows={2}
                  maxLength={MAX_AI_NOTES}
                  value={form.notes}
                  placeholder="e.g. I know the basics. Free resources only."
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </label>
            </details>

            <p id="aiProblem" className="msg err" role="alert">
              {problem?.error}
            </p>

            {/* Real addresses, so a new tab opens without a popup blocker. */}
            <div className="ai-providers" role="group" aria-label="Generate with your AI">
              {AI_PROVIDERS.map((p) => (
                <a
                  key={p.id}
                  className="btn outline"
                  href={checked.ok ? providerLink(p, prompt(checked.request)).url : p.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openAi(e, p)}
                >
                  Generate with {p.name}
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              ))}
            </div>
            <div className="ai-copies">
              <button type="button" className="btn" onClick={copyPrompt}>
                <Copy size={16} aria-hidden="true" /> Copy prompt
              </button>
              <button type="button" className="link-btn" onClick={copyFull}>
                My AI can’t open links → copy full instructions
              </button>
            </div>
            <p className="msg" role="status">
              {status}
            </p>
            {uncopied && <CopyFallback text={uncopied} />}
          </form>
        </li>
        <li>
          <h3>When it replies, click Copy on the code box and paste it here.</h3>
          <button
            type="button"
            className="btn primary wide-btn"
            onClick={() => openOverlay({ kind: 'import', source: 'paste' })}
          >
            <ClipboardPaste size={18} aria-hidden="true" /> Paste plan
          </button>
        </li>
      </ol>

      <details className="ai-help">
        <summary>Having trouble?</summary>
        <ul>
          <li>The AI made up its own format: use “copy full instructions”.</li>
          <li>The AI says it can’t open links: use “copy full instructions”.</li>
          <li>Import shows errors: click “Copy fix-it message” and paste it back to your AI.</li>
        </ul>
      </details>
    </>
  );
}
