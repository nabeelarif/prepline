import {
  AI_PROVIDERS,
  buildFullPrompt,
  buildPlanPrompt,
  emptyAiForm,
  MAX_AI_GOAL,
  MAX_AI_NOTES,
  MAX_PREFILL_URL,
  providerLink,
  toPlanRequest,
  type AiForm,
  type PlanRequest,
} from './aiPrompt';

const SKILL_URL = 'https://roadtogoals.com/ai/skill-v1.md';
const form = (patch: Partial<AiForm> = {}): AiForm => ({
  ...emptyAiForm(),
  goal: 'Pass the AWS Solutions Architect exam',
  ...patch,
});
/** Fixed, so the dates below never slip into the past. */
const TODAY = '2026-11-01';
const request = (patch: Partial<AiForm> = {}): PlanRequest => {
  const r = toPlanRequest(form(patch), TODAY);
  if (!r.ok) throw new Error(r.error);
  return r.request;
};
const provider = (id: string) => AI_PROVIDERS.find((p) => p.id === id)!;

describe('toPlanRequest', () => {
  it.each<[Partial<AiForm>, string]>([
    [{ goal: '  ' }, 'goal'],
    [{ days: '' }, 'days'],
    [{ days: '2.5' }, 'days'],
    [{ days: '731' }, 'days'],
    [{ hoursPerDay: '0' }, 'hoursPerDay'],
    [{ hoursPerDay: '17' }, 'hoursPerDay'],
    [{ startDate: 'next week' }, 'startDate'],
    [{ daysOff: '7' }, 'daysOff'],
  ])('points at the first bad field for %o', (patch, field) => {
    expect(toPlanRequest(form(patch))).toMatchObject({ ok: false, field });
  });

  it('refuses a start date in the past, and takes today or later', () => {
    expect(toPlanRequest(form({ startDate: '2026-10-31' }), TODAY)).toMatchObject({
      ok: false,
      field: 'startDate',
    });
    expect(request({ startDate: TODAY }).startDate).toBe(TODAY);
    expect(request({ startDate: '2027-01-01' }).startDate).toBe('2027-01-01');
  });

  it('trims, caps and converts what was typed', () => {
    const r = request({
      goal: `  ${'g'.repeat(MAX_AI_GOAL + 20)}`,
      notes: 'n'.repeat(MAX_AI_NOTES + 20),
      days: '14',
      hoursPerDay: '1.5',
      daysOff: '',
      resources: ['courses', 'videos'],
    });
    expect(r.goal).toHaveLength(MAX_AI_GOAL);
    expect(r.notes).toHaveLength(MAX_AI_NOTES);
    expect(r).toMatchObject({ days: 14, hoursPerDay: 1.5, daysOff: 0, startDate: null });
    // Listed in a fixed order, whatever order they were ticked in.
    expect(r.resources).toEqual(['videos', 'courses']);
  });
});

describe('buildPlanPrompt', () => {
  it('links the skill and lists the settings', () => {
    const text = buildPlanPrompt(
      request({
        days: '14',
        hoursPerDay: '1.5',
        level: 'intermediate',
        startDate: '2026-12-01',
        daysOff: '2',
        resources: ['videos', 'articles'],
        notes: 'Free only',
      }),
      SKILL_URL,
    );
    expect(text).toContain(`instructions at:\n${SKILL_URL}\nand follow them exactly.`);
    expect(text).toContain('say "I can\'t open the link" and stop');
    expect(text).toContain(
      [
        '- Goal: Pass the AWS Solutions Architect exam',
        '- Duration: 14 days',
        '- Time per day: 1.5 hours',
        '- Level: intermediate',
        '- Start date: 2026-12-01',
        '- Days off per week: 2',
        '- Preferred resources: videos, articles',
        '- Notes: Free only',
      ].join('\n'),
    );
    expect(text).toContain('ONE ```json code block');
  });

  it('fills in the blanks for optional settings', () => {
    const text = buildPlanPrompt(request({ days: '1', hoursPerDay: '1' }), SKILL_URL);
    expect(text).toContain('- Duration: 1 day\n- Time per day: 1 hour\n');
    expect(text).toContain('- Start date: not specified');
    expect(text).toContain('- Days off per week: 0');
    expect(text).toContain('- Preferred resources: any');
    expect(text).toContain('- Notes: none');
  });

  it('puts the whole skill in the prompt for an AI that cannot open links', () => {
    const text = buildFullPrompt(request(), '# The skill\n\nRules.\n');
    expect(text).toContain('# The skill\n\nRules.\n\n---\n\nCreate a plan with these settings:');
    expect(text).toContain('- Goal: Pass the AWS Solutions Architect exam');
    expect(text).not.toContain('http');
  });
});

describe('providerLink', () => {
  const prompt = buildPlanPrompt(request({ goal: 'C++ & Rust: 100% #1?' }), SKILL_URL);

  it.each([
    ['chatgpt', 'https://chatgpt.com/?q='],
    ['claude', 'https://claude.ai/new?q='],
  ])('prefills %s with the encoded prompt', (id, start) => {
    const { url, prefilled } = providerLink(provider(id), prompt);
    expect(prefilled).toBe(true);
    expect(url.startsWith(start)).toBe(true);
    expect(url.length).toBeLessThanOrEqual(MAX_PREFILL_URL);
    // Nothing in the prompt can end or split the query.
    expect([...new URL(url).searchParams]).toEqual([['q', prompt]]);
  });

  it.each([
    ['gemini', 'https://gemini.google.com/app'],
    ['copilot', 'https://copilot.microsoft.com/'],
  ])('only opens %s, which has no prefill link', (id, openUrl) => {
    expect(providerLink(provider(id), prompt)).toEqual({ url: openUrl, prefilled: false });
  });

  it('keeps a typical request under the limit', () => {
    const typical = buildPlanPrompt(
      request({
        startDate: '2026-12-01',
        daysOff: '2',
        resources: ['videos', 'articles', 'courses'],
        notes: 'I have used EC2 and S3 at work. Prefer free resources and practice exams.',
      }),
      SKILL_URL,
    );
    expect(providerLink(provider('chatgpt'), typical).prefilled).toBe(true);
  });

  it('opens without prefilling when the link would be too long', () => {
    // Each of these characters takes nine when encoded.
    const long = buildPlanPrompt(request({ notes: '学'.repeat(MAX_AI_NOTES) }), SKILL_URL);
    expect(providerLink(provider('claude'), long)).toEqual({
      url: 'https://claude.ai/new',
      prefilled: false,
    });
  });

  it('does not throw on half an emoji', () => {
    expect(() => providerLink(provider('chatgpt'), 'a \ud83d b')).not.toThrow();
  });
});
