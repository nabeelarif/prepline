/*
 * "Use your own AI": the prompt the user takes to their AI, and where each AI can be
 * opened. The app makes no AI calls itself. The format and rules live in the hosted skill
 * (public/ai/skill-v1.md); the prompt only links to it, which keeps prefill URLs short.
 */
import { MAX_HOURS_PER_DAY, MIN_HOURS_PER_DAY } from './constants';
import { todayISO, validISO } from './dates';
import { pl } from './format';
import type { ISODate } from './types';

/** The versioned skill the prompt points at, relative to the app's base. */
export const AI_SKILL_PATH = '/ai/skill-v1.md';
/** How the skill file starts. Anything else at that address is not the skill. */
export const AI_SKILL_HEADING = '# Road to Goals Plan Skill (v1)';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export const LEVELS: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const RESOURCE_PREFERENCES = ['videos', 'articles', 'courses'] as const;
export type ResourcePreference = (typeof RESOURCE_PREFERENCES)[number];

/** Short enough that a typical prefill link stays under `MAX_PREFILL_URL`. */
export const MAX_AI_GOAL = 200;
export const MAX_AI_NOTES = 500;
export const MAX_AI_DAYS = 730;
export const MAX_DAYS_OFF = 6;

/** The form as typed. Numbers stay text until checked, so a half-typed value is kept. */
export interface AiForm {
  goal: string;
  days: string;
  hoursPerDay: string;
  level: Level;
  startDate: string;
  daysOff: string;
  resources: ResourcePreference[];
  notes: string;
}

export const emptyAiForm = (): AiForm => ({
  goal: '',
  days: '30',
  hoursPerDay: '1',
  level: 'beginner',
  startDate: '',
  daysOff: '0',
  resources: [],
  notes: '',
});

export interface PlanRequest {
  goal: string;
  days: number;
  hoursPerDay: number;
  level: Level;
  startDate: ISODate | null;
  daysOff: number;
  resources: ResourcePreference[];
  notes: string;
}

export type AiField = 'goal' | 'days' | 'hoursPerDay' | 'startDate' | 'daysOff';

export type PlanRequestResult =
  { ok: true; request: PlanRequest } | { ok: false; field: AiField; error: string };

const between = (n: number, min: number, max: number) => n >= min && n <= max;

/** Checks the form, returning the first problem with the field to focus. */
export function toPlanRequest(f: AiForm, today: ISODate = todayISO()): PlanRequestResult {
  const bad = (field: AiField, error: string): PlanRequestResult => ({ ok: false, field, error });
  const goal = f.goal.trim();
  if (!goal) return bad('goal', 'Say what you want to learn or prepare for.');
  const days = Number(f.days);
  if (!Number.isInteger(days) || !between(days, 1, MAX_AI_DAYS))
    return bad('days', `Duration must be a whole number of days, from 1 to ${MAX_AI_DAYS}.`);
  const hoursPerDay = Number(f.hoursPerDay);
  if (!between(hoursPerDay, MIN_HOURS_PER_DAY, MAX_HOURS_PER_DAY))
    return bad(
      'hoursPerDay',
      `Hours per day must be from ${MIN_HOURS_PER_DAY} to ${MAX_HOURS_PER_DAY}.`,
    );
  const startDate = f.startDate.trim();
  if (startDate && !validISO(startDate))
    return bad('startDate', 'Pick a valid start date, or clear it.');
  // A past start would give the plan a deadline that is partly or wholly gone.
  if (startDate && startDate < today)
    return bad('startDate', 'The start date can’t be in the past. Pick today or later.');
  const daysOff = f.daysOff.trim() ? Number(f.daysOff) : 0;
  if (!Number.isInteger(daysOff) || !between(daysOff, 0, MAX_DAYS_OFF))
    return bad('daysOff', `Days off per week must be a whole number from 0 to ${MAX_DAYS_OFF}.`);
  return {
    ok: true,
    request: {
      goal: goal.slice(0, MAX_AI_GOAL),
      days,
      hoursPerDay,
      level: f.level,
      startDate: startDate || null,
      daysOff,
      resources: RESOURCE_PREFERENCES.filter((r) => f.resources.includes(r)),
      notes: f.notes.trim().slice(0, MAX_AI_NOTES),
    },
  };
}

const CLOSING = `Give me the complete plan as ONE \`\`\`json code block in the chat
(not Canvas, not an Artifact, not a file) so I can copy it with the Copy button.
Write out every resource in full, don't shorten anything, and add no text except the
one closing line the instructions ask for.`;

function settings(r: PlanRequest): string {
  return [
    'Create a plan with these settings:',
    `- Goal: ${r.goal}`,
    `- Duration: ${pl(r.days, 'day')}`,
    `- Time per day: ${pl(r.hoursPerDay, 'hour')}`,
    `- Level: ${r.level}`,
    `- Start date: ${r.startDate ?? 'not specified'}`,
    `- Days off per week: ${r.daysOff}`,
    `- Preferred resources: ${r.resources.join(', ') || 'any'}`,
    `- Notes: ${r.notes || 'none'}`,
  ].join('\n');
}

/** The short prompt, for an AI that can open links. */
export function buildPlanPrompt(r: PlanRequest, skillUrl: string): string {
  return `Read the Road to Goals plan instructions at:
${skillUrl}
and follow them exactly.

If you cannot open that link, say "I can't open the link" and stop — do not guess the format.

${settings(r)}

${CLOSING}`;
}

/** The whole skill followed by the settings, for an AI that cannot open links. */
export function buildFullPrompt(r: PlanRequest, skillText: string): string {
  return `Follow these instructions exactly.

${skillText.trim()}

---

${settings(r)}

${CLOSING}`;
}

export interface AiProvider {
  id: string;
  name: string;
  /** Where the chat opens. */
  openUrl: string;
  /**
   * The query parameter that fills the chat box, where one is known to work. These are not
   * documented guarantees, so the prompt is copied too. Remove this if one stops working.
   */
  promptParam?: string;
}

/** Add or fix an AI here. */
export const AI_PROVIDERS: AiProvider[] = [
  { id: 'chatgpt', name: 'ChatGPT', openUrl: 'https://chatgpt.com/', promptParam: 'q' },
  { id: 'claude', name: 'Claude', openUrl: 'https://claude.ai/new', promptParam: 'q' },
  { id: 'gemini', name: 'Gemini', openUrl: 'https://gemini.google.com/app' },
  { id: 'copilot', name: 'Copilot', openUrl: 'https://copilot.microsoft.com/' },
];

/** Longer links get cut off or refused by some browsers and servers. */
export const MAX_PREFILL_URL = 2000;

/** The link for one AI, and whether it arrives with the prompt already typed in. */
export function providerLink(p: AiProvider, prompt: string): { url: string; prefilled: boolean } {
  if (p.promptParam) {
    // A lone half of an emoji would make encodeURIComponent throw.
    const safe = prompt.replace(/\p{Surrogate}/gu, '\ufffd');
    const url = `${p.openUrl}?${p.promptParam}=${encodeURIComponent(safe)}`;
    if (url.length <= MAX_PREFILL_URL) return { url, prefilled: true };
  }
  return { url: p.openUrl, prefilled: false };
}
