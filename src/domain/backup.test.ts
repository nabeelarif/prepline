import { createEmptyAppData, exportedAtOf, mergePlans } from './backup';
import { parseAppData, previewImport } from './schema';
import type { AppData } from './types';

const data: AppData = {
  version: 1,
  activeGoalId: 'g',
  goals: [
    {
      id: 'g',
      name: 'Prep',
      description: 'd',
      startDate: '2026-01-01',
      targetDate: '2026-12-01',
      hoursPerDay: 2,
      createdAt: '2026-10-01',
      phases: [{ id: 'p', name: 'Basics', description: '', color: 'green' }],
      resources: [
        {
          id: 'r',
          title: 'Course',
          url: 'https://example.com',
          type: 'course',
          minutes: 120,
          doneMinutes: 30,
          notes: 'n',
          done: false,
          doneAt: null,
          startedAt: '2026-10-02',
          phaseId: 'p',
          createdAt: '2026-10-01',
        },
      ],
    },
  ],
};

describe('backup', () => {
  it('reads a plan file with everything that is saved, plus the export time', () => {
    const exportedAt = '2026-10-28T14:32:05+05:00';
    const raw = JSON.parse(JSON.stringify({ ...data, exportedAt }));
    const r = previewImport(raw);
    expect(r.ok && r.preview).toMatchObject({
      data,
      plans: 1,
      phases: 1,
      resources: 1,
      exportedAt,
      notes: [],
    });
  });

  it('reads an empty app', () => {
    const r = previewImport(JSON.parse(JSON.stringify(createEmptyAppData())));
    expect(r.ok && r.preview).toMatchObject({ data: createEmptyAppData(), plans: 0 });
  });

  it('has one empty state that round-trips through parsing', () => {
    const empty = createEmptyAppData();
    expect(parseAppData(JSON.parse(JSON.stringify(empty)))).toEqual(empty);
  });

  it('reads the export time only when it is a real date', () => {
    expect(exportedAtOf({ exportedAt: '2026-10-28T14:32:05+05:30' })).toBe(
      '2026-10-28T14:32:05+05:30',
    );
    expect(exportedAtOf({ exportedAt: '2026-10-28T09:02:05Z' })).toBe('2026-10-28T09:02:05Z');
    expect(exportedAtOf({ exportedAt: '2026-10-28T14:32:05' })).toBe('2026-10-28T14:32:05');
    expect(exportedAtOf({ exportedAt: '2026-10-28T14:32' })).toBe('2026-10-28T14:32');
    expect(exportedAtOf({ exportedAt: 'yesterday' })).toBeNull();
    expect(exportedAtOf({ exportedAt: '2026-10-28T14:32:05 PST' })).toBeNull();
    expect(exportedAtOf({ exportedAt: '2026-13-45T99:99:99' })).toBeNull();
    expect(exportedAtOf({ exportedAt: 123 })).toBeNull();
    expect(exportedAtOf({})).toBeNull();
    expect(exportedAtOf(null)).toBeNull();
  });
});

describe('mergePlans', () => {
  const twice = { ...data, goals: [data.goals[0]!, { ...data.goals[0]!, name: 'Again' }] };

  it('adds the plans after the current ones with new ids and makes the first active', () => {
    const merged = mergePlans(data, twice);
    expect(merged.goals.map((g) => g.name)).toEqual(['Prep', 'Prep', 'Again']);
    expect(merged.goals[0]).toBe(data.goals[0]);
    const [, a, b] = merged.goals;
    expect(merged.activeGoalId).toBe(a!.id);
    const ids = merged.goals.flatMap((g) => [
      g.id,
      ...g.phases.map((p) => p.id),
      ...g.resources.map((r) => r.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of [a!, b!]) expect(g.resources[0]!.phaseId).toBe(g.phases[0]!.id);
    expect(a!.resources[0]).toMatchObject({ title: 'Course', minutes: 120, doneMinutes: 30 });
    expect(parseAppData(merged)).toEqual(merged);
  });

  it('works on empty data and keeps resources without a phase out of phases', () => {
    const loose = parseAppData({
      goals: [{ name: 'New', resources: [{ title: 'A' }, { title: 'B', phaseId: 'p' }] }],
    })!;
    const merged = mergePlans(createEmptyAppData(), loose);
    expect(merged.activeGoalId).toBe(merged.goals[0]!.id);
    expect(merged.goals[0]!.resources.map((r) => r.phaseId)).toEqual([null, null]);
  });

  it('changes nothing when the file has no plans', () => {
    expect(mergePlans(data, createEmptyAppData())).toEqual(data);
  });
});
