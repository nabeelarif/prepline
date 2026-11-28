import skill from '../../public/ai/skill-v1.md?raw';
import example from '../../public/ai/example-plan-v1.json?raw';
import { buildFullPrompt, emptyAiForm, toPlanRequest } from './aiPrompt';
import { extractPlanJson, fixItMessage, MAX_PLAN_TEXT, readPlanText, repairJson } from './planText';

const plan = {
  version: 1,
  goals: [
    {
      name: 'Git',
      resources: [{ title: 'Basics', minutes: 30, notes: 'Run `git log` {often}, then diff.' }],
    },
  ],
};
const json = JSON.stringify(plan, null, 2);

const raw = (text: string) => {
  const r = extractPlanJson(text);
  if (!r.ok) throw new Error(r.error);
  return r.raw;
};
const errors = (text: string) => {
  const r = readPlanText(text);
  return r.ok ? [] : r.errors;
};

describe('extractPlanJson', () => {
  it('reads plain JSON', () => {
    expect(raw(json)).toEqual(plan);
    expect(raw(`\ufeff  ${json}\n`)).toEqual(plan);
  });

  it.each([
    ['a json fence', `\`\`\`json\n${json}\n\`\`\``],
    ['a bare fence', `\`\`\`\n${json}\n\`\`\``],
    [
      'a whole reply',
      `Here is your plan:\n\n\`\`\`json\n${json}\n\`\`\`\n\nClick Copy on the box above, then paste it into Road to Goals → Paste plan.`,
    ],
    ['sentences without a fence', `Sure! ${json} Good luck.`],
    ['braces in the sentences', `Settings {goal: git}, as asked.\n${json}\nEnjoy {this}.`],
    ['an unmatched brace before it', `Use { to open.\n${json}`],
    ['another JSON object first', `{"level": "beginner"}\n${json}`],
  ])('finds the plan inside %s', (_, text) => {
    expect(raw(text)).toEqual(plan);
  });

  it('takes the first of several plans and says so', () => {
    const second = JSON.stringify({ version: 1, goals: [{ name: 'Part 2' }] });
    const r = extractPlanJson(`${json}\n\n${second}`);
    expect(r).toMatchObject({ ok: true, raw: plan });
    expect(r.ok && r.notes[0]).toContain('2 separate plans');
  });

  it('removes trailing commas', () => {
    expect(raw('{"version": 1, "goals": [{"name": "A", "resources": [],},\n],}')).toEqual({
      version: 1,
      goals: [{ name: 'A', resources: [] }],
    });
  });

  it('replaces curly quotes used as JSON quotes', () => {
    expect(raw('{“version”: 1, “goals”: [{‘name’: ‘Ana’s plan’}]}')).toEqual({
      version: 1,
      goals: [{ name: 'Ana’s plan' }],
    });
  });

  it('escapes straight quotes inside a curly-quoted string', () => {
    expect(raw('{“goals”: [{“name”: “The "big" one”}]}')).toEqual({
      goals: [{ name: 'The "big" one' }],
    });
  });

  it('leaves the text inside strings alone while repairing', () => {
    const repaired = repairJson('{"goals": [{"name": "Say “hi”, ] then ,}",}]}');
    expect(JSON.parse(repaired)).toEqual({ goals: [{ name: 'Say “hi”, ] then ,}' }] });
  });

  it('turns non-breaking spaces between values into spaces', () => {
    expect(raw('{\u00a0"goals":\u00a0[]}')).toEqual({ goals: [] });
  });

  it.each([
    ['', 'nothing to import'],
    ['I could not open the link.', 'No plan JSON was found'],
    [json.slice(0, -20), 'cut off'],
    [`\`\`\`json\n${json.slice(0, json.indexOf('"notes"'))}`, 'cut off'],
    ['{"goals": [{"name": "A", "resources": [ ... ]}]}', 'shortened'],
    ['{"goals": [{"name": "A"} // the rest\n]}', 'shortened'],
    ['{"goals": [{"name": "A" "description": "b"}]}', 'syntax error'],
  ])('explains why %j has no usable JSON', (text, message) => {
    expect(extractPlanJson(text)).toMatchObject({ ok: false });
    expect(errors(text)[0]).toContain(message);
  });

  const minified = JSON.stringify(JSON.parse(example));
  /** The example with one slip in it. */
  const slip = (text: string, from: string, to: string) => {
    expect(text).toContain(from);
    return text.replace(from, to);
  };

  it.each([
    ['a missing closing quote', slip(example, 'About 2 hours.",', 'About 2 hours.,')],
    ['a stray quote', slip(example, 'Know what', 'Know "what')],
    [
      'a stray quote in a fenced reply',
      `\`\`\`json\n${slip(example, 'Know what', 'Know "what')}\`\`\`\nClick Copy on the box above.`,
    ],
    ['a stray quote in one-line JSON', slip(minified, 'Know what', 'Know "what')],
    ['a missing quote in one-line JSON', slip(minified, 'About 2 hours."', 'About 2 hours.')],
  ])('reports %s as a syntax error, not a cut-off reply', (_, text) => {
    const [first, ...more] = errors(text);
    expect(first).toContain('syntax error');
    expect(more).toEqual([]);
  });

  it('names the line of a stray quote', () => {
    const [first] = errors(slip(example, 'Know what', 'Know "what'));
    expect(first).toMatch(/on line \d+, near: "notes": "Know "what/);
  });

  it.each([
    '"notes": "Search "git basics..." and see what it solves"',
    '"notes": "Read "the docs" at https://git-scm.com today"',
  ])('does not call badly quoted text shortened: %s', (field) => {
    expect(errors(`{"goals": [{"name": "A",\n${field}\n}]}`)[0]).toContain('syntax error');
  });

  it.each([
    '{"goals": [{"name": "A", "resources": [\n// remaining resources\n]}]}',
    '{"goals": [{"name": "A", "resources": [{"title": "a"}, …]}]}',
    '{"goals": [{"name": "A", /* more */ "resources": []}]}',
  ])('calls a left-out part shortened: %s', (text) => {
    expect(errors(text)[0]).toContain('shortened');
  });

  const complete = JSON.stringify(plan);
  it.each([
    ['cut off', `${complete}\n\n${json.slice(0, -40)}`],
    ['broken', `${complete}\n\n{"version": 1, "goals": [{"name": "B" "resources": []}]}`],
    ['broken, and comes first', `{"goals": [{"name": "B" "x": 1}]}\n\n${complete}`],
  ])('warns when another plan beside the imported one is %s', (_, text) => {
    const r = extractPlanJson(text);
    expect(r).toMatchObject({ ok: true, raw: plan });
    expect(r.ok && r.notes).toEqual([expect.stringContaining('left out')]);
  });

  it('says so when the instructions were pasted instead of the reply', () => {
    const form = toPlanRequest({ ...emptyAiForm(), goal: 'Learn Git' });
    const prompt = form.ok ? buildFullPrompt(form.request, skill) : '';
    for (const text of [prompt, skill])
      expect(errors(text)).toEqual([expect.stringContaining('instructions for your AI')]);
  });

  it('does not call "..." inside a string shortened', () => {
    expect(errors('{"goals": [{"name": "Wait..." "x": 1}]}')[0]).toContain('syntax error');
  });

  it('refuses to search text that is far too large, but still reads clean JSON', () => {
    const padding = ' '.repeat(MAX_PLAN_TEXT);
    expect(errors(`Here: ${padding}${json}`)[0]).toContain('too large');
    expect(raw(`{"goals": [],${padding}"version": 1}`)).toEqual({ version: 1, goals: [] });
  });

  it('cuts a very long name in its error messages', () => {
    const [first] = errors(
      JSON.stringify({ goals: [{ name: 'n'.repeat(5000), resources: [{}] }] }),
    );
    expect(first!.length).toBeLessThan(150);
  });
});

describe('readPlanText', () => {
  it('previews a good reply', () => {
    const r = readPlanText(`\`\`\`json\n${json}\n\`\`\``);
    expect(r.ok && r.preview).toMatchObject({ plans: 1, resources: 1, notes: [] });
  });

  it('lists every problem, naming the entry, the field and the expected type', () => {
    expect(
      errors(
        JSON.stringify({
          version: 1,
          goals: [
            {
              name: 'Git',
              hoursPerDay: '1',
              resources: [{ title: 'a' }, { url: '' }, { title: 'c', minutes: '45' }],
            },
          ],
        }),
      ),
    ).toEqual([
      'Plan 1 "Git" has an invalid "hoursPerDay" (it must be a number without quotes).',
      'Resource 2 in Plan 1 "Git" has no title.',
      'Resource 3 "c" in Plan 1 "Git" has an invalid "minutes" (it must be a number without quotes).',
    ]);
  });

  it('stops listing after ten problems', () => {
    const list = (bad: number) =>
      errors(
        JSON.stringify({
          goals: [{ name: 'A', resources: Array.from({ length: bad }, () => ({})) }],
        }),
      );
    expect(list(10)).toHaveLength(10);
    expect(list(10).at(-1)).toContain('Resource 10');
    expect(list(25)).toHaveLength(11);
    expect(list(25).at(-1)).toBe('There are more problems like these.');
  });

  describe('very large input', () => {
    const many = (n: number, item: string) => Array<string>(n).fill(item).join(',');
    /** Enough entries to overflow the stack if they are all passed to one function call. */
    const BAD = many(400_000, '0');

    it.each([
      ['resources', `{"goals":[{"name":"A","resources":[${BAD}]}]}`],
      ['phases', `{"goals":[{"name":"A","phases":[${BAD}]}]}`],
      ['plans', `{"goals":[${BAD}]}`],
      [
        'course sections',
        `{"goals":[{"name":"A","resources":[{"title":"t","sections":[${BAD}]}]}]}`,
      ],
    ])('lists the first problems among a huge number of bad %s', (_, text) => {
      const list = errors(text);
      expect(list).toHaveLength(11);
      expect(list[0]).toContain('is not a valid entry');
      expect(list.at(-1)).toBe('There are more problems like these.');
    });

    it('collects a huge number of notes', () => {
      const r = readPlanText(`{"goals":[${many(200_000, '{"name":"a","sharing":1}')}]}`);
      expect(r.ok && r.preview.notes).toHaveLength(200_000);
    }, 30_000);

    it('keeps the version error short, whatever the version is', () => {
      const [first] = errors(`{"version":"${'9'.repeat(100_000)}","goals":[]}`);
      expect(first!.length).toBeLessThan(200);
    });

    it('answers with an error, not an exception, when checking itself fails', () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Nested too deeply to be turned into an id.
      const deep = `${'['.repeat(100_000)}${']'.repeat(100_000)}`;
      expect(errors(`{"goals":[{"name":"A","id":${deep}}]}`)).toEqual([
        expect.stringContaining('could not be checked'),
      ]);
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  });

  it('explains a made-up format and a wrong version', () => {
    expect(errors('{"plan": {"days": []}}')[0]).toContain('no "goals" list');
    expect(errors('{"version": "1", "goals": []}')[0]).toContain(
      '"version" must be the number 1, not "1".',
    );
  });

  it('writes a message to paste back to the AI', () => {
    expect(fixItMessage(['One.', 'Two.'])).toBe(
      'Your JSON had these errors:\n- One.\n- Two.\nPlease fix them and return only the corrected JSON, complete, in one ```json code block.',
    );
  });
});
