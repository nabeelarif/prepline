import { z } from 'zod';
import { RATINGS, TYPES } from './constants';
import { addDays, todayISO, validISO } from './dates';
import { num, uid } from './format';
import type { AppData, Goal, Rating, Resource, ResourceType, Section } from './types';

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

export const SectionSchema: z.ZodType<Section, unknown> = z.object({
  id,
  title: text(() => 'Section'),
  minutes: minutes(30),
  done: flag,
  doneAt: optDate,
});

export const ResourceSchema: z.ZodType<Resource, unknown> = z.object({
  id,
  title: text(() => 'Untitled'),
  url: text(() => ''),
  type: field((v): ResourceType =>
    typeof v === 'string' && v in TYPES ? (v as ResourceType) : 'article',
  ),
  minutes: minutes(15),
  notes: text(() => ''),
  done: flag,
  doneAt: optDate,
  rating: field((v): Rating | null => (RATINGS.includes(v as Rating) ? (v as Rating) : null)),
  sections: listOf(SectionSchema),
});

export const GoalSchema: z.ZodType<Goal, unknown> = z.object({
  id,
  name: text(() => 'Untitled goal', 120),
  targetDate: date(() => addDays(todayISO(), 30)),
  hoursPerDay: field((v) => num(v, 0.25, 16, 2)),
  sample: flag,
  createdAt: date(todayISO),
  resources: listOf(ResourceSchema),
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
