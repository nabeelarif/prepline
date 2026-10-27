import { z } from 'zod';
import { PHASE_COLORS, TYPES } from './constants';
import { addDays, todayISO, validISO } from './dates';
import { num, uid } from './format';
import type { AppData, Goal, Phase, PhaseColor, Resource, ResourceType } from './types';

/*
 * Lenient schemas for anything read from storage or imported from a backup.
 * Bad or missing fields fall back to defaults instead of failing, so an old or
 * hand-edited backup still loads. Add every new persisted field here, or it is
 * dropped on reload and import.
 */

/** A field that accepts anything, including a missing key, and maps it to a clean value. */
const field = <T>(fn: (v: unknown) => T) => z.unknown().optional().transform(fn);

const text = (def: () => string, max?: number) =>
  field((v) => {
    const s = v ? String(v) : def();
    return max ? s.slice(0, max) : s;
  });
const id = text(uid);
const flag = field((v) => !!v);
const date = (def: () => string) => field((v) => (validISO(v) ? v : def()));
const optDate = field((v) => (validISO(v) ? v : null));
const minutes = (def: number) => field((v) => Math.round(num(v, 1, 100000, def)));
const isObject = (v: unknown): v is object => !!v && typeof v === 'object';
/** Keeps only object entries; anything that is not an array becomes []. */
const listOf = <T>(item: z.ZodType<T, unknown>) =>
  field((v): unknown[] => (Array.isArray(v) ? v.filter(isObject) : [])).pipe(z.array(item));

/** Course sections from older versions; folded into the resource's minutes and progress. */
const LegacySectionSchema = z.object({ minutes: minutes(30), done: flag });

export const ResourceSchema: z.ZodType<Resource, unknown> = z
  .object({
    id,
    title: text(() => 'Untitled'),
    url: text(() => ''),
    type: field((v): ResourceType =>
      typeof v === 'string' && v in TYPES ? (v as ResourceType) : 'article',
    ),
    minutes: minutes(30),
    doneMinutes: field((v) => Math.max(0, Math.round(Number(v)) || 0)),
    notes: text(() => ''),
    done: flag,
    doneAt: optDate,
    startedAt: optDate,
    phaseId: field((v) => (v ? String(v) : null)),
    createdAt: date(todayISO),
    sections: listOf(LegacySectionSchema),
  })
  .transform(({ sections, ...r }): Resource => {
    if (sections.length) {
      r.minutes = sections.reduce((a, s) => a + s.minutes, 0);
      r.doneMinutes = sections.reduce((a, s) => a + (s.done ? s.minutes : 0), 0);
      r.done = sections.every((s) => s.done);
    }
    r.doneMinutes = Math.min(r.doneMinutes, r.minutes);
    if (!r.done) r.doneAt = null;
    return r;
  });

export const PhaseSchema: z.ZodType<Phase, unknown> = z.object({
  id,
  name: text(() => 'Phase', 80),
  description: text(() => '', 500),
  color: field((v): PhaseColor =>
    PHASE_COLORS.includes(v as PhaseColor) ? (v as PhaseColor) : 'blue',
  ),
});

export const GoalSchema: z.ZodType<Goal, unknown> = z
  .object({
    id,
    name: text(() => 'Untitled plan', 120),
    description: text(() => '', 1000),
    targetDate: date(() => addDays(todayISO(), 30)),
    hoursPerDay: field((v) => (v == null || v === '' ? null : num(v, 0.25, 16, 2))),
    createdAt: date(todayISO),
    resources: listOf(ResourceSchema),
    phases: listOf(PhaseSchema),
  })
  .transform((g): Goal => {
    // Drop duplicate phases and detach resources from phases that do not exist.
    const seen = new Set<string>();
    const phases = g.phases.filter((p) => !seen.has(p.id) && !!seen.add(p.id));
    const resources = g.resources.map((r) =>
      r.phaseId && !seen.has(r.phaseId) ? { ...r, phaseId: null } : r,
    );
    return { ...g, phases, resources };
  });

const AppDataSchema = z
  .object({ activeGoalId: field((v) => v), goals: listOf(GoalSchema) })
  .transform(({ activeGoalId, goals }): AppData => {
    const active = goals.some((g) => g.id === activeGoalId)
      ? (activeGoalId as string)
      : (goals[0]?.id ?? null);
    return { version: 1, activeGoalId: active, goals };
  });

/** Returns cleaned data, or null when the input is not a Prepline backup (no `goals` array). */
export function parseAppData(raw: unknown): AppData | null {
  if (!isObject(raw) || !Array.isArray((raw as { goals?: unknown }).goals)) return null;
  return AppDataSchema.parse(raw);
}

export interface ImportPreview {
  data: AppData;
  plans: number;
  resources: number;
  phases: number;
  /** What was repaired or converted, in plain words. Empty for a clean backup. */
  notes: string[];
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Checks a backup before it replaces saved data. Anything that is not a Prepline
 * backup is rejected; a real backup with bad or old fields is repaired as on load,
 * and the repairs are listed so the user can decide before confirming.
 */
export function previewImport(
  raw: unknown,
): { ok: true; preview: ImportPreview } | { ok: false; error: string } {
  if (!isObject(raw) || !Array.isArray((raw as { goals?: unknown }).goals))
    return { ok: false, error: 'This file has no "goals" list, so it is not a Prepline backup.' };
  const version = (raw as { version?: unknown }).version;
  if (version !== undefined && version !== 1)
    return {
      ok: false,
      error: `This backup was made by a different version of Prepline (version ${String(version)}) and cannot be imported here.`,
    };
  const goals = (raw as { goals: unknown[] }).goals;
  if (goals.length && !goals.some(isObject))
    return { ok: false, error: 'This backup has no valid plans in it.' };

  const notes: string[] = [];
  const skipped = (n: number, what: string) => {
    if (n) notes.push(`${n} invalid ${what}${n === 1 ? '' : 's'} will be skipped.`);
  };
  const rawGoals = goals.filter(isObject) as Record<string, unknown>[];
  const rawRes = rawGoals.flatMap((g) => arr(g.resources));
  skipped(goals.length - rawGoals.length, 'plan');
  skipped(rawRes.filter((r) => !isObject(r)).length, 'resource');
  skipped(rawGoals.flatMap((g) => arr(g.phases)).filter((p) => !isObject(p)).length, 'phase');
  const res = rawRes.filter(isObject) as Record<string, unknown>[];
  const withSections = res.filter((r) => arr(r.sections).length).length;
  if (withSections)
    notes.push(
      `${withSections} course${withSections === 1 ? '' : 's'} with sections will be converted to hours completed.`,
    );
  if (res.some((r) => r.rating != null))
    notes.push('Self-ratings from an older version are not kept.');

  const data = AppDataSchema.parse(raw);
  const linked = res.filter((r) => r.phaseId).length;
  const kept = data.goals.flatMap((g) => g.resources).filter((r) => r.phaseId).length;
  if (linked > kept)
    notes.push(
      `${linked - kept} resource${linked - kept === 1 ? '' : 's'} pointing to a missing phase will have no phase.`,
    );

  const count = (f: (g: Goal) => number) => data.goals.reduce((a, g) => a + f(g), 0);
  return {
    ok: true,
    preview: {
      data,
      plans: data.goals.length,
      resources: count((g) => g.resources.length),
      phases: count((g) => g.phases.length),
      notes,
    },
  };
}
