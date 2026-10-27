import { parseAppData } from './schema';

describe('parseAppData', () => {
  it('rejects data without a goals list', () => {
    expect(parseAppData(null)).toBeNull();
    expect(parseAppData({})).toBeNull();
    expect(parseAppData({ goals: 'nope' })).toBeNull();
  });

  it('accepts a minimal backup with only goals', () => {
    const data = parseAppData({ goals: [{ name: 'Prep' }] })!;
    expect(data.activeGoalId).toBe(data.goals[0]!.id);
    expect(data.goals[0]).toMatchObject({
      name: 'Prep',
      hoursPerDay: 2,
      sample: false,
      resources: [],
    });
  });

  it('fills defaults and clamps bad values, like the old normalize()', () => {
    const data = parseAppData({
      activeGoalId: 'missing',
      goals: [
        null,
        {
          id: 'g1',
          name: 'x'.repeat(200),
          targetDate: 'tomorrow',
          hoursPerDay: 99,
          resources: [
            { id: 'r1', type: 'podcast', minutes: -5, rating: 7, doneAt: '2026-01-02' },
            'junk',
            { sections: [{ title: 'S', minutes: '45' }, 3] },
          ],
        },
      ],
    })!;
    expect(data.version).toBe(1);
    expect(data.activeGoalId).toBe('g1');
    expect(data.goals).toHaveLength(1);
    const g = data.goals[0]!;
    expect(g.name).toHaveLength(120);
    expect(g.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.hoursPerDay).toBe(16);
    expect(g.resources).toHaveLength(2);
    expect(g.resources[0]).toMatchObject({
      id: 'r1',
      title: 'Untitled',
      type: 'article',
      minutes: 15,
      rating: null,
      done: false,
      doneAt: '2026-01-02',
      sections: [],
    });
    expect(g.resources[1]!.id).toEqual(expect.any(String));
    expect(g.resources[1]!.sections).toEqual([
      { id: expect.any(String), title: 'S', minutes: 45, done: false, doneAt: null },
    ]);
  });

  it('round-trips valid data unchanged', () => {
    const input = {
      version: 1,
      activeGoalId: 'g',
      goals: [
        {
          id: 'g',
          name: 'Prep',
          targetDate: '2026-05-01',
          hoursPerDay: 1.5,
          sample: false,
          createdAt: '2026-04-01',
          resources: [
            {
              id: 'r',
              title: 'T',
              url: 'https://a.dev',
              type: 'course',
              minutes: 60,
              notes: 'n',
              done: false,
              doneAt: null,
              rating: 4,
              sections: [{ id: 's', title: 'S', minutes: 60, done: true, doneAt: '2026-04-02' }],
            },
          ],
        },
      ],
    };
    expect(parseAppData(input)).toEqual(input);
  });
});
