import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from './backup';
import { progressPatch, statusPatch } from './resources';
import {
  addStudy,
  currentStreak,
  heatLevel,
  heatmapWeeks,
  longestStreak,
  studyDelta,
} from './studyLog';
import { goal, res } from '../test/fixtures';

const TODAY = '2026-03-10'; // a Tuesday

const data = (...rs: ReturnType<typeof res>[]) => ({
  ...createEmptyAppData(),
  goals: [goal(rs)],
});

describe('studyDelta', () => {
  it('is the minutes gained today by progress changes', () => {
    const r = res({ id: 'a' });
    const next = data({ ...r, ...progressPatch(r, 25, TODAY) });
    expect(studyDelta(data(r), next, TODAY)).toBe(25);
  });

  it('counts only the increase when progress is raised again', () => {
    const r = res({ id: 'a', doneMinutes: 20, loggedOn: TODAY, loggedMinutes: 20 });
    const next = data({ ...r, ...progressPatch(r, 50, TODAY) });
    expect(studyDelta(data(r), next, TODAY)).toBe(30);
  });

  it('counts a completion as the remaining estimate', () => {
    const r = res({ id: 'a', doneMinutes: 10, loggedOn: '2026-03-09', loggedMinutes: 10 });
    const next = data({ ...r, ...statusPatch(r, 'completed', TODAY) });
    expect(studyDelta(data(r), next, TODAY)).toBe(50);
  });

  it('is negative when today’s progress is taken back', () => {
    const r = res({ id: 'a', doneMinutes: 20, loggedOn: TODAY, loggedMinutes: 20 });
    const next = data({ ...r, ...statusPatch(r, 'not_started', TODAY) });
    expect(studyDelta(data(r), next, TODAY)).toBe(-20);
  });

  it('ignores new and deleted resources and unrelated edits', () => {
    const r = res({ id: 'a', loggedOn: TODAY, loggedMinutes: 15 });
    expect(studyDelta(data(r), data(), TODAY)).toBe(0);
    expect(studyDelta(data(), data(r), TODAY)).toBe(0);
    expect(studyDelta(data(r), data({ ...r, title: 'Renamed' }), TODAY)).toBe(0);
  });
});

describe('addStudy', () => {
  it('adds, never goes below zero, and drops an empty day', () => {
    expect(addStudy({}, TODAY, 30)).toEqual({ [TODAY]: 30 });
    expect(addStudy({ [TODAY]: 30 }, TODAY, 15)).toEqual({ [TODAY]: 45 });
    expect(addStudy({ [TODAY]: 30 }, TODAY, -100)).toEqual({});
    // A 30-hour course finished in one go still fits the day.
    expect(addStudy({}, TODAY, 1800)).toEqual({ [TODAY]: 1440 });
  });
});

describe('streaks', () => {
  const log = {
    '2026-03-10': 20,
    '2026-03-09': 5,
    '2026-03-08': 60,
    '2026-03-05': 1,
    '2026-03-04': 9,
  };

  it('counts back from today', () => {
    expect(currentStreak(log, TODAY)).toBe(3);
  });

  it('keeps yesterday’s streak while today is still empty', () => {
    expect(currentStreak(addStudy(log, TODAY, -20), TODAY)).toBe(2);
  });

  it('is zero after a missed day', () => {
    expect(currentStreak({ '2026-03-07': 30 }, TODAY)).toBe(0);
    expect(currentStreak({}, TODAY)).toBe(0);
  });

  it('finds the longest run', () => {
    expect(longestStreak(log)).toBe(3);
    expect(longestStreak({})).toBe(0);
  });
});

describe('heatmap', () => {
  it('levels minutes', () => {
    expect([0, 1, 29, 30, 59, 60, 119, 120].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('lays out weeks Monday first and ends at today', () => {
    const weeks = heatmapWeeks({ [TODAY]: 45 }, TODAY, 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[0]![0]!.day).toBe('2026-02-23');
    const last = weeks[2]!;
    expect(last[0]!.day).toBe('2026-03-09');
    expect(last[1]).toEqual({ day: TODAY, minutes: 45, level: 2 });
    expect(last.slice(2)).toEqual([null, null, null, null, null]);
  });
});
