import { parseAppData, previewImport } from './schema';

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
      description: '',
      hoursPerDay: null,
      resources: [],
      phases: [],
    });
  });

  it('fills defaults and clamps bad values', () => {
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
            { id: 'r1', type: 'podcast', minutes: -5, doneMinutes: 999, doneAt: '2026-01-02' },
            'junk',
          ],
        },
      ],
    })!;
    expect(data.version).toBe(1);
    expect(data.activeGoalId).toBe('g1');
    const g = data.goals[0]!;
    expect(g.name).toHaveLength(120);
    expect(g.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.hoursPerDay).toBe(16);
    expect(g.resources).toHaveLength(1);
    expect(g.resources[0]).toMatchObject({
      id: 'r1',
      title: 'Untitled',
      type: 'article',
      minutes: 30,
      doneMinutes: 30,
      done: false,
      doneAt: null,
      phaseId: null,
    });
  });

  it('round-trips valid data unchanged', () => {
    const input = {
      version: 1,
      activeGoalId: 'g',
      goals: [
        {
          id: 'g',
          name: 'Prep',
          description: 'Senior iOS',
          targetDate: '2026-05-01',
          hoursPerDay: 1.5,
          createdAt: '2026-04-01',
          resources: [
            {
              id: 'r',
              title: 'T',
              url: 'https://a.dev',
              type: 'practice',
              minutes: 600,
              doneMinutes: 120,
              notes: 'n',
              done: false,
              doneAt: null,
              startedAt: '2026-04-02',
              phaseId: 'p',
              createdAt: '2026-04-01',
            },
          ],
          phases: [{ id: 'p', name: 'Foundations', description: 'Basics', color: 'green' }],
        },
      ],
    };
    expect(parseAppData(input)).toEqual(input);
  });

  it('migrates data from earlier versions: sections become partial progress, ratings go', () => {
    const g = parseAppData({
      version: 1,
      activeGoalId: 'g',
      goals: [
        {
          id: 'g',
          name: 'Prep',
          hoursPerDay: 2,
          sample: true,
          resources: [
            { id: 'a', title: 'A', minutes: 45, done: true, doneAt: '2026-01-02', rating: 4 },
            {
              id: 'c',
              title: 'Course',
              type: 'course',
              minutes: 15,
              sections: [
                { title: 'S1', minutes: 90, done: true, doneAt: '2026-01-03' },
                { title: 'S2', minutes: 30, done: false },
              ],
            },
            {
              id: 'd',
              type: 'course',
              sections: [{ title: 'S', minutes: 60, done: true }],
            },
          ],
        },
      ],
    })!.goals[0]!;
    expect(g).not.toHaveProperty('sample');
    expect(g.hoursPerDay).toBe(2);
    expect(g.resources[0]).toMatchObject({ minutes: 45, done: true, doneAt: '2026-01-02' });
    expect(g.resources[0]).not.toHaveProperty('rating');
    expect(g.resources[1]).toMatchObject({ minutes: 120, doneMinutes: 90, done: false });
    expect(g.resources[1]).not.toHaveProperty('sections');
    expect(g.resources[2]).toMatchObject({ minutes: 60, done: true });
  });

  it('repairs phases: drops duplicates and junk, detaches dangling references', () => {
    const g = parseAppData({
      goals: [
        {
          phases: [
            { id: 'a', name: 'A', color: 'teal' },
            { id: 'a', name: 'Again' },
            'junk',
            { name: '' },
          ],
          resources: [
            { id: 'r1', phaseId: 'a' },
            { id: 'r2', phaseId: 'gone' },
          ],
        },
      ],
    })!.goals[0]!;
    expect(g.phases).toHaveLength(2);
    expect(g.phases[0]).toEqual({ id: 'a', name: 'A', description: '', color: 'blue' });
    expect(g.phases[1]).toMatchObject({ name: 'Phase' });
    expect(g.resources.map((r) => r.phaseId)).toEqual(['a', null]);
  });
});

describe('previewImport', () => {
  it('rejects anything that is not a Prepline backup', () => {
    expect(previewImport('hello')).toMatchObject({ ok: false });
    expect(previewImport({ plans: [] })).toMatchObject({ ok: false });
    expect(previewImport({ version: 2, goals: [] })).toMatchObject({
      ok: false,
      error: expect.stringContaining('version 2'),
    });
  });

  it('accepts a clean backup with counts and no notes', () => {
    const r = previewImport({
      version: 1,
      goals: [
        {
          name: 'A',
          phases: [{ id: 'p', name: 'P' }],
          resources: [{ title: 'r', phaseId: 'p' }],
        },
      ],
    });
    expect(r.ok && r.preview).toMatchObject({ plans: 1, resources: 1, phases: 1, notes: [] });
  });

  it('rejects malformed backups, naming the first problem', () => {
    const err = (raw: unknown) => {
      const r = previewImport(raw);
      return r.ok ? null : r.error;
    };
    expect(err({ goals: [{ foo: 1 }] })).toBe(
      "Plan 1 has no name, so this file can't be imported.",
    );
    expect(err({ goals: [{ name: 'Prep' }, { name: '  ' }] })).toBe(
      "Plan 2 has no name, so this file can't be imported.",
    );
    expect(err({ goals: [{ name: 'Prep', resources: [{ title: 'a' }, { url: 'x' }] }] })).toBe(
      'Resource 2 in Plan 1 "Prep" has no title, so this file can\'t be imported.',
    );
    expect(err({ goals: [{ name: 'Prep', resources: 'none' }] })).toBe(
      'Plan 1 "Prep" has "resources" that is not a list, so this file can\'t be imported.',
    );
    expect(err({ goals: [{ name: 'Prep', resources: [{ title: 'a', minutes: '45' }] }] })).toBe(
      'Resource 1 "a" in Plan 1 "Prep" has an invalid "minutes", so this file can\'t be imported.',
    );
    expect(err({ goals: ['junk'] })).toBe(
      "Plan 1 is not a valid entry, so this file can't be imported.",
    );
    expect(err({ goals: [{ name: 'Prep', phases: [{ name: 'P' }, null] }] })).toBe(
      'Phase 2 in Plan 1 "Prep" is not a valid entry, so this file can\'t be imported.',
    );
  });

  it('accepts a real backup from an older version and lists what it converts', () => {
    const r = previewImport({
      version: 1,
      activeGoalId: 'g',
      goals: [
        {
          id: 'g',
          name: 'Prep',
          hoursPerDay: 2,
          sample: true,
          resources: [
            {
              title: 'Course',
              type: 'course',
              minutes: 15,
              sections: [
                { title: 'A', minutes: 30, done: true, doneAt: '2026-01-03' },
                { title: 'B', minutes: 30, done: false, doneAt: null },
              ],
            },
            { title: 'Article', rating: 3, done: true, doneAt: '2026-01-02', phaseId: 'gone' },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.notes).toEqual([
      '1 course with sections will be converted to hours completed.',
      'Self-ratings from an older version are not kept.',
      '1 resource pointing to a missing phase will have no phase.',
    ]);
    expect(r.preview.data.goals[0]!.resources[0]).toMatchObject({
      minutes: 60,
      doneMinutes: 30,
      done: false,
    });
  });

  it('accepts what this version exports', () => {
    const exported = parseAppData({
      goals: [
        {
          name: 'Prep',
          hoursPerDay: null,
          phases: [{ id: 'p', name: 'P', color: 'green' }],
          resources: [{ title: 'r', phaseId: 'p', startedAt: '2026-01-01' }, { title: 's' }],
        },
      ],
    });
    const r = previewImport(JSON.parse(JSON.stringify(exported)));
    expect(r.ok && r.preview).toMatchObject({ plans: 1, resources: 2, phases: 1, notes: [] });
  });
});
