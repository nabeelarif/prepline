import { z } from 'zod';
import { exportedAtOf, generatedByOf, type GeneratedBy } from './backup';
import {
  LEGACY_TYPES,
  MAX_HOURS_PER_DAY,
  MIN_HOURS_PER_DAY,
  PHASE_COLORS,
  TYPES,
} from './constants';
import { todayISO, validISO } from './dates';
import { num, uid } from './format';
import { readImportSharing, type ImportShare } from './share';
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
    type: field((v): ResourceType => {
      // A missing type is a Read, like the form's default; only an unknown name is Other.
      if (typeof v !== 'string' || !v) return 'read';
      const key = v;
      if (Object.hasOwn(TYPES, key)) return key as ResourceType;
      return Object.hasOwn(LEGACY_TYPES, key) ? LEGACY_TYPES[key]! : 'other';
    }),
    minutes: minutes(30),
    doneMinutes: field((v) => Math.max(0, Math.round(Number(v)) || 0)),
    notes: text(() => ''),
    done: flag,
    doneAt: optDate,
    startedAt: optDate,
    loggedOn: optDate,
    loggedMinutes: field((v) => Math.max(0, Math.round(Number(v)) || 0)),
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
    startDate: optDate,
    targetDate: optDate,
    hoursPerDay: field((v) =>
      v == null || v === '' ? null : num(v, MIN_HOURS_PER_DAY, MAX_HOURS_PER_DAY, 2),
    ),
    source: field((v) => {
      const o = v as { slug?: unknown; name?: unknown } | null;
      return o && typeof o.slug === 'string' && o.slug && typeof o.name === 'string'
        ? { slug: o.slug.slice(0, 64), name: o.name.slice(0, 120) }
        : null;
    }),
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
    // Plans saved before manual start had a deadline and were already running.
    // The start is never after the deadline (the database refuses that), so a deadline
    // earlier than the creation date becomes the start.
    const startDate =
      g.startDate ?? (g.targetDate && (g.createdAt < g.targetDate ? g.createdAt : g.targetDate));
    // An own plan has no `source` key at all, so it equals what the app built in memory.
    const { source, ...rest } = g;
    return { ...rest, ...(source ? { source } : {}), startDate, phases, resources };
  });

const AppDataSchema = z
  .object({ activeGoalId: field((v) => v), goals: listOf(GoalSchema) })
  .transform(({ activeGoalId, goals }): AppData => {
    const active = goals.some((g) => g.id === activeGoalId)
      ? (activeGoalId as string)
      : (goals[0]?.id ?? null);
    return { version: 1, activeGoalId: active, goals };
  });

/** Whether this has the one thing every Road to Goals file has: a `goals` list. */
export const hasGoalsList = (v: unknown): v is { goals: unknown[] } & object =>
  isObject(v) && Array.isArray((v as { goals?: unknown }).goals);

/** Returns cleaned data, or null when the input is not a Road to Goals backup (no `goals` array). */
export function parseAppData(raw: unknown): AppData | null {
  if (!hasGoalsList(raw)) return null;
  return AppDataSchema.parse(raw);
}

export interface ImportPreview {
  data: AppData;
  plans: number;
  resources: number;
  phases: number;
  version: 1;
  /** When the backup was downloaded, if the file says so (local "YYYY-MM-DDTHH:MM:SS"). */
  exportedAt: string | null;
  /** Which AI and skill made the file, if it says so. */
  generatedBy: GeneratedBy | null;
  /** Who can open each plan once added, aligned with `data.goals`; null keeps it private. */
  shares: (ImportShare | null)[];
  /** What was repaired or converted, in plain words. Empty for a clean backup. */
  notes: string[];
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** How many problems are listed; a badly wrong file would otherwise list hundreds. */
const MAX_ERRORS = 10;

/**
 * Like `z.array`, but stops once one entry more than can be listed has failed. `z.array`
 * collects every problem and passes a nested list's up in a single function call, which
 * overflows the stack when a large list is badly wrong.
 */
const entries = (item: z.ZodType) =>
  z.array(z.unknown()).superRefine((list, ctx) => {
    let failed = 0;
    for (let i = 0; i < list.length && failed <= MAX_ERRORS; i++) {
      const result = item.safeParse(list[i]);
      if (result.success) continue;
      failed++;
      for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: [i, ...issue.path] });
    }
  });

/*
 * Strict shape of a backup, checked before anything is repaired. Unknown keys are
 * allowed (older and newer fields), but every plan, resource and phase must be an
 * object with its name or title, and known fields must have the right type.
 */
const named = z.string().trim().min(1);
const BackupShape = z.looseObject({
  version: z.literal(1).optional(),
  activeGoalId: z.string().nullable().optional(),
  goals: entries(
    z.looseObject({
      name: named,
      description: z.string().optional(),
      startDate: z.string().nullable().optional(),
      targetDate: z.string().nullable().optional(),
      hoursPerDay: z.number().nullable().optional(),
      resources: entries(
        z.looseObject({
          title: named,
          url: z.string().optional(),
          notes: z.string().optional(),
          type: z.string().optional(),
          phaseId: z.string().nullable().optional(),
          minutes: z.number().optional(),
          doneMinutes: z.number().optional(),
          done: z.boolean().optional(),
          sections: entries(z.looseObject({ minutes: z.number().optional() })).optional(),
        }),
      ).optional(),
      phases: entries(
        z.looseObject({
          name: named,
          description: z.string().optional(),
          color: z.string().optional(),
        }),
      ).optional(),
    }),
  ),
});

const NOUN: Record<string, string> = {
  goals: 'Plan',
  resources: 'Resource',
  phases: 'Phase',
  sections: 'Section',
};

/** Display name of a backup entry, if it has one. */
function labelOf(v: unknown): string {
  const o = isObject(v) ? (v as { name?: unknown; title?: unknown }) : {};
  const n = typeof o.name === 'string' ? o.name : typeof o.title === 'string' ? o.title : '';
  // Cut, because the name is repeated in every message about the entry.
  return n.trim() ? ` "${n.trim().slice(0, 80)}"` : '';
}

const MUST_BE: Record<string, string> = {
  string: 'text in quotes',
  number: 'a number without quotes',
  boolean: 'true or false',
  array: 'a list',
  object: 'an object',
};

/**
 * Turns one schema failure into a clause naming the entry and the field,
 * e.g. 'Resource 3 in Plan 1 "Prep" has no title'.
 */
function describeIssue(raw: unknown, path: PropertyKey[], expected?: string): string {
  const where: string[] = [];
  let node: unknown = raw;
  let field = '';
  path.forEach((key, i) => {
    node = isObject(node) ? (node as Record<PropertyKey, unknown>)[key] : undefined;
    if (typeof key === 'number') {
      where.unshift(`${NOUN[String(path[i - 1])] ?? 'Entry'} ${key + 1}${labelOf(node)}`);
      field = '';
    } else field = String(key);
  });
  const subject = where.join(' in ') || 'This backup';
  const blank = node === undefined || (typeof node === 'string' && !node.trim());
  const must = expected ? MUST_BE[expected] : undefined;
  const problem = !field
    ? 'is not a valid entry'
    : (field === 'name' || field === 'title') && blank
      ? `has no ${field}`
      : NOUN[field]
        ? `has "${field}" that is not a list`
        : `has an invalid "${field}"${must ? ` (it must be ${must})` : ''}`;
  return `${subject} ${problem}`;
}

function describeIssues(raw: unknown, issues: z.core.$ZodIssue[]): string[] {
  const shown = new Set<string>();
  let used = 0;
  // Only as many are worded as will be shown: a bad file can have a huge number of them.
  for (; used < issues.length && shown.size < MAX_ERRORS; used++) {
    const { code, path, ...rest } = issues[used]!;
    const expected = code === 'invalid_type' ? (rest as { expected?: string }).expected : undefined;
    shown.add(`${describeIssue(raw, path, expected)}.`);
  }
  // `entries` stops early, so how many more there are is not known.
  return used < issues.length ? [...shown, 'There are more problems like these.'] : [...shown];
}

/** Why a backup was rejected: not a Road to Goals file, another version, or malformed entries. */
export type ImportErrorKind = 'not-backup' | 'version' | 'invalid';

/** A wrong value as it can be quoted in a message: short, and never walking into a list. */
const shortValue = (v: unknown): string =>
  typeof v === 'object' && v !== null
    ? Array.isArray(v)
      ? 'a list'
      : 'an object'
    : JSON.stringify(typeof v === 'string' ? v.slice(0, 20) : v);

export type ImportResult =
  | { ok: true; preview: ImportPreview }
  /** `errors` lists the problems as sentences, to show and to hand back to an AI. */
  | { ok: false; kind: ImportErrorKind; errors: string[] };

/**
 * Checks a plan before it is added. Anything that is not a well-formed Road to Goals
 * file is rejected, listing the problems found. A valid file from an older version is
 * converted as on load, and the conversions are listed so the user can decide before
 * confirming.
 */
export function previewImport(raw: unknown): ImportResult {
  if (!hasGoalsList(raw))
    return {
      ok: false,
      kind: 'not-backup',
      errors: [
        'There is no "goals" list at the top level, so this is not a Road to Goals plan. One looks like {"version": 1, "goals": [{"name": "…", "resources": [{"title": "…"}]}]}.',
      ],
    };
  const version = (raw as { version?: unknown }).version;
  if (version !== undefined && version !== 1)
    return {
      ok: false,
      kind: 'version',
      errors: [
        `This was made for a different version of Road to Goals: "version" must be the number 1, not ${shortValue(version)}.`,
      ],
    };
  if ((raw as { goals: unknown[] }).goals.length === 0)
    return {
      ok: false,
      kind: 'invalid',
      errors: ['The "goals" list is empty, so there is no plan to add.'],
    };
  const checked = BackupShape.safeParse(raw);
  if (!checked.success)
    return { ok: false, kind: 'invalid', errors: describeIssues(raw, checked.error.issues) };

  const notes: string[] = [];
  const goals = (raw as { goals: Record<string, unknown>[] }).goals;
  const res = goals.flatMap((g) => arr(g.resources)) as Record<string, unknown>[];
  const withSections = res.filter((r) => arr(r.sections).length).length;
  if (withSections)
    notes.push(
      `${withSections} course${withSections === 1 ? '' : 's'} with sections will be converted to hours completed.`,
    );
  if (res.some((r) => r.rating != null))
    notes.push('Self-ratings from an older version are not kept.');

  // A file cannot claim to be a copy of a shared plan: the label is only set by copying.
  const data = AppDataSchema.parse({
    ...raw,
    goals: goals.map((goal) => ({ ...goal, source: null })),
  });
  const linked = res.filter((r) => r.phaseId).length;
  const kept = data.goals.flatMap((g) => g.resources).filter((r) => r.phaseId).length;
  if (linked > kept)
    notes.push(
      `${linked - kept} resource${linked - kept === 1 ? '' : 's'} pointing to a missing phase will have no phase.`,
    );

  // One entry per plan, in file order: `BackupShape` has already rejected any non-object plan, so
  // `data.goals` has the same plans in the same order.
  const shared = goals.map((g, i) => readImportSharing(g.sharing, data.goals[i]!.name));
  // One at a time: spreading a very long list into `push` overflows the stack.
  for (const x of shared) for (const note of x.notes) notes.push(note);

  const count = (f: (g: Goal) => number) => data.goals.reduce((a, g) => a + f(g), 0);
  return {
    ok: true,
    preview: {
      data,
      plans: data.goals.length,
      resources: count((g) => g.resources.length),
      phases: count((g) => g.phases.length),
      version: 1,
      exportedAt: exportedAtOf(raw),
      generatedBy: generatedByOf(raw),
      shares: shared.map((x) => x.share),
      notes,
    },
  };
}
