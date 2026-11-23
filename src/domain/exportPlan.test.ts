import {
  exportFileName,
  localTimestamp,
  planToHtml,
  planToJson,
  planToMarkdown,
} from './exportPlan';
import { previewImport } from './schema';
import { goal, res } from '../test/fixtures';

const plan = goal(
  [
    res({
      id: 'a',
      title: 'Intro',
      url: 'https://example.com/a',
      phaseId: 'p',
      minutes: 90,
      done: true,
      doneAt: '2026-03-02',
      notes: 'line1\nline2',
    }),
    res({
      id: 'b',
      title: 'Loose <b>one</b>',
      url: 'javascript:alert(1)',
      type: 'watch',
      minutes: 30,
    }),
    res({
      id: 'c',
      title: 'Deep dive',
      type: 'course',
      minutes: 600,
      phaseId: 'p',
      startedAt: '2026-03-03',
      doneMinutes: 60,
    }),
  ],
  {
    name: 'iOS Interview Prep!',
    description: 'Get ready',
    phases: [{ id: 'p', name: 'Basics', description: 'Start here', color: 'green' }],
  },
);

describe('planToJson', () => {
  it('re-imports with no repairs and carries no progress or dates', () => {
    const text = planToJson(plan, undefined, new Date());
    const out = previewImport(JSON.parse(text));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.preview.notes).toEqual([]);
    expect(out.preview.shares).toEqual([null]);
    const g = out.preview.data.goals[0]!;
    expect(g.name).toBe(plan.name);
    expect(g.resources.map((r) => r.title)).toEqual(['Intro', 'Loose <b>one</b>', 'Deep dive']);
    expect(g.resources.every((r) => !r.done && r.doneMinutes === 0 && !r.startedAt)).toBe(true);
    expect(g.startDate).toBeNull();
    expect(g.targetDate).toBeNull();
    expect(text).not.toMatch(/startDate|targetDate|doneAt|startedAt|doneMinutes|"source"/);
  });

  it('adds sharing only for a shared plan', () => {
    const text = planToJson(
      plan,
      { visibility: 'public', slug: 's', tags: ['ios'], hidden: false, copyCount: 0 },
      new Date(),
    );
    expect(JSON.parse(text).goals[0].sharing).toEqual({ visibility: 'public', tags: ['ios'] });
    expect(planToJson(plan, undefined, new Date())).not.toContain('sharing');
  });
});

describe('localTimestamp', () => {
  it('is local time with an offset', () => {
    expect(localTimestamp(new Date(2026, 10, 18, 14, 32, 5))).toMatch(
      /^2026-11-18T14:32:05[+-]\d{2}:\d{2}$/,
    );
  });
});

describe('planToMarkdown', () => {
  const md = planToMarkdown(plan);

  it('groups by phase then unassigned, in priority order', () => {
    expect(md.indexOf('## Basics')).toBeLessThan(md.indexOf('## Unassigned'));
    expect(md.indexOf('Intro')).toBeLessThan(md.indexOf('Deep dive'));
    expect(md).toContain('- [x] [Intro](https://example.com/a) (Read, 1.5h)');
    expect(md).toContain('- [ ] Deep dive (Course, 10h)');
    expect(md).toContain('  > line2');
    expect(md).toContain('3 resources');
  });

  it('has no heading for the resources of a plan without phases', () => {
    const flat = planToMarkdown(goal([res({ id: 'x' })]));
    expect(flat).not.toContain('##');
  });
});

describe('planToMarkdown escaping', () => {
  it('keeps links, headings and lists from breaking', () => {
    const md = planToMarkdown(
      goal(
        [
          res({
            id: 'w',
            title: 'Arrays [part 1]',
            url: 'https://en.wikipedia.org/wiki/Foo_(bar) baz',
            notes: '# not a heading\n- not a list',
          }),
        ],
        { name: 'Two\nlines', description: 'a\n# b' },
      ),
    );
    expect(md).toContain('# Two lines');
    expect(md).toContain(
      '[Arrays \\[part 1\\]](https://en.wikipedia.org/wiki/Foo_%28bar%29%20baz)',
    );
    expect(md).toContain('a  \n\\# b');
    expect(md).toContain('  > \\# not a heading  \n  > \\- not a list');
  });

  it('lists a resource whose phase is missing', () => {
    const md = planToMarkdown(goal([res({ id: 'x', title: 'Lost', phaseId: 'gone' })]));
    expect(md).toContain('Lost');
  });
});

describe('planToHtml', () => {
  const html = planToHtml(plan);

  it('escapes text and only links http(s) urls', () => {
    expect(html).not.toContain('<b>one</b>');
    expect(html).toContain('Loose &lt;b&gt;one&lt;/b&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://example.com/a">Intro</a>');
  });
});

describe('exportFileName', () => {
  it('slugs the name and falls back to plan', () => {
    expect(exportFileName(plan, 'json')).toBe('ios-interview-prep.json');
    expect(exportFileName(goal([], { name: '!!!' }), 'md')).toBe('plan.md');
  });
});
