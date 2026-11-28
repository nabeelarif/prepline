/*
 * The one way text becomes a plan, used by pasted replies and chosen files alike: find the
 * JSON, repair the slips chat apps introduce, then check it with `previewImport()`. It has
 * no DOM or React dependency, so a future server tool (an MCP `create_plan`) can run the
 * same checks and then `mergePlans()`; a caller that already has an object needs only
 * `previewImport()`.
 */
import { AI_SKILL_HEADING } from './aiPrompt';
import { hasGoalsList, previewImport, type ImportErrorKind, type ImportPreview } from './schema';

/** Far beyond any real plan; stops a huge paste from freezing the page. */
export const MAX_PLAN_TEXT = 2_000_000;

/** How many unmatched `{` are tried before giving up, so odd input stays fast. */
const MAX_UNCLOSED = 40;

const DOUBLE_SMART = '“”„‟';
const SINGLE_SMART = '‘’‚‛';

/** The characters that can close a string opened by `open`, or null when it opens none. */
function closersOf(open: string): string | null {
  if (open === '"') return '"';
  if (DOUBLE_SMART.includes(open)) return `${DOUBLE_SMART}"`;
  if (SINGLE_SMART.includes(open)) return SINGLE_SMART;
  return null;
}

/** The next character that is not white space, from `i` on. */
function nextSolid(text: string, i: number): string {
  while (i < text.length && /\s/.test(text[i]!)) i++;
  return text[i] ?? '';
}

/**
 * Index of the quote that closes the string starting at `i`, or -1 when its line ends first
 * (no JSON string spans lines). A curly quote is only the end when JSON punctuation
 * follows, so quotes inside the text stay part of it.
 */
function stringEnd(text: string, i: number, closers: string): number {
  const straight = closers === '"';
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j]!;
    if (c === '\\') j++;
    else if (c === '\n') return -1;
    else if (closers.includes(c) && (straight || ',:}]'.includes(nextSolid(text, j + 1)))) return j;
  }
  return -1;
}

/** Index of the `}` matching the `{` at `start`, or -1 when the text ends first. */
function blockEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    const closers = closersOf(c);
    if (closers) {
      const close = stringEnd(text, i, closers);
      // A string left open is a stray or missing quote. Carrying on from the next line keeps
      // the brackets matched, so the parser gets to say where the mistake is.
      i = close >= 0 ? close : text.indexOf('\n', i);
      if (i < 0) return -1;
    } else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Fixes what chat apps and word processors do to JSON: curly quotes used as string
 * quotes, trailing commas and non-breaking spaces. Text inside strings is left alone.
 */
export function repairJson(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const closers = closersOf(c);
    if (closers) {
      const end = stringEnd(text, i, closers);
      if (end < 0) return out + text.slice(i);
      const body = text.slice(i + 1, end);
      // A straight quote inside a curly-quoted string must now be escaped.
      out +=
        closers === '"'
          ? `"${body}"`
          : `"${body.replace(/\\.|"/g, (m) => (m === '"' ? '\\"' : m))}"`;
      i = end;
    } else if (c === ',' && '}]'.includes(nextSolid(text, i + 1))) continue;
    else out += c === '\u00a0' ? ' ' : c;
  }
  return out;
}

type Parsed = { ok: true; value: unknown } | { ok: false; error: Error };

function parse(text: string): Parsed {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

/**
 * True when `...`, `…` or a comment sits where JSON expects a key or value: after a bracket
 * or comma, or at the start of a line. Elsewhere it is likely text exposed by bad quoting.
 */
function isShortened(json: string): boolean {
  // Strings are blanked within their line, so a stray quote can't upset the lines after it.
  const outside = json.replace(/"(?:\\.|[^"\\\n])*"/g, '"');
  return /(?:^|[[{,}\]])\s*(?:\.\.\.|…|\/\/|\/\*)/m.test(outside);
}

/** What is wrong with a block that will not parse, with the line when the browser gives one. */
function syntaxError(repaired: string, error: Error): string {
  if (isShortened(repaired))
    return 'The JSON was shortened with "..." or has comments in it. Every resource must be written out, with no comments.';
  const at = /position (\d+)/.exec(error.message)?.[1];
  if (at === undefined) return 'The JSON has a syntax error, such as a missing comma or quote.';
  const before = repaired.slice(0, Number(at));
  const line = before.split('\n').length;
  const near = (repaired.split('\n')[line - 1] ?? '').trim().slice(0, 80);
  return `The JSON has a syntax error on line ${line}${near ? `, near: ${near}` : ''}. A comma or quote may be missing.`;
}

/** A "goals" key, with whichever quotes. */
const GOALS_KEY = /["“”‘’]goals["“”‘’]\s*:/;
/** An object that was meant to be a plan, as opposed to a brace in a sentence. */
const looksLikePlan = (s: string) => /^\{\s*["“”‘’]/.test(s) && GOALS_KEY.test(s);
/** How a whole plan file ends: a plan's last list, the plan, "goals", then the file. */
const PLAN_END = /\]\s*\}\s*\]\s*\}$/;

export type ExtractResult =
  { ok: true; raw: unknown; notes: string[] } | { ok: false; error: string };

/**
 * Finds the plan JSON in what someone pasted or chose: the whole text if it is JSON,
 * otherwise the first `{ … }` block with a "goals" list (code fences and sentences
 * around it are ignored).
 */
export function extractPlanJson(text: string): ExtractResult {
  const clean = text.replace(/^\ufeff/, '').trim();
  const whole = parse(clean);
  if (whole.ok) return { ok: true, raw: whole.value, notes: [] };
  // The instructions hold sample JSON, which must not be taken for the reply.
  if (clean.includes(AI_SKILL_HEADING))
    return {
      ok: false,
      error:
        'These are the instructions for your AI, not its reply. Paste them into your AI’s chat, then copy the code box it sends back.',
    };
  // Only the search below is limited: a large file of clean JSON still imports.
  if (text.length > MAX_PLAN_TEXT)
    return { ok: false, error: 'This is too large to be a plan. It should hold only the JSON.' };

  const plans: unknown[] = [];
  let other: { value: object; size: number } | undefined;
  const broken = { size: 0, error: '' };
  let cutOff = false;
  /** A plan that can't be read, which matters even when another one can. */
  let lostPlan = false;
  let unclosed = 0;
  /** Parses a block, keeping the error of the largest one that fails. */
  const attempt = (block: string): Parsed => {
    // Repair leaves valid JSON as it is.
    const repaired = repairJson(block);
    const result = parse(repaired);
    if (!result.ok && block.length > broken.size)
      Object.assign(broken, { size: block.length, error: syntaxError(repaired, result.error) });
    return result;
  };
  for (let i = clean.indexOf('{'); i >= 0; i = clean.indexOf('{', i + 1)) {
    const end = blockEnd(clean, i);
    if (end < 0) {
      const rest = clean.slice(i);
      if (looksLikePlan(rest)) lostPlan = true;
      if (GOALS_KEY.test(rest)) {
        // Quotes can also fail to match in one-line JSON. If it still ends like a whole
        // plan, nothing was cut off, and the parser can say what is wrong.
        const upToFence = rest.split(/\n\s*```/)[0]!.trimEnd();
        if (!PLAN_END.test(upToFence) || attempt(upToFence).ok) cutOff = true;
      }
      if (++unclosed >= MAX_UNCLOSED) break;
      continue;
    }
    const block = clean.slice(i, end + 1);
    const result = attempt(block);
    if (!result.ok) {
      if (looksLikePlan(block)) lostPlan = true;
    } else if (hasGoalsList(result.value)) plans.push(result.value);
    else other ??= { value: result.value as object, size: block.length };
    i = end;
  }

  if (plans.length) {
    const notes: string[] = [];
    if (plans.length > 1)
      notes.push(
        `There are ${plans.length} separate plans here and only the first is imported. Import the others one at a time.`,
      );
    if (lostPlan)
      notes.push(
        'Another plan here is cut off or has errors, so it is left out. Check that this is the plan you wanted.',
      );
    return { ok: true, raw: plans[0], notes };
  }
  // A cut-off reply can still hold complete inner blocks, so this is checked before them.
  if (cutOff)
    return {
      ok: false,
      error:
        'The JSON is cut off: it ends before its last closing bracket. Copy the whole code box, or ask your AI to send the complete plan again.',
    };
  // A small brace in a sentence, like {topic}, must not hide the object that does parse.
  if (broken.size && (lostPlan || broken.size > (other?.size ?? 0)))
    return { ok: false, error: broken.error };
  if (other) return { ok: true, raw: other.value, notes: [] };
  return {
    ok: false,
    error: clean
      ? 'No plan JSON was found. A plan starts with { and ends with }; in an AI’s reply, it is the code box.'
      : 'There is nothing to import: it is empty.',
  };
}

export type PlanTextResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; kind: ImportErrorKind | 'json'; errors: string[] };

/** Extracts, repairs and checks plan text. Nothing is saved, and it never throws. */
export function readPlanText(text: string): PlanTextResult {
  try {
    return checkPlanText(text);
  } catch (e) {
    // A last resort for input nobody foresaw. Without it the dialog would seem to do nothing.
    console.error('Checking a plan failed:', e);
    return {
      ok: false,
      kind: 'invalid',
      errors: [
        'This could not be checked: it is too large or too unusual. It should hold only a Road to Goals plan.',
      ],
    };
  }
}

function checkPlanText(text: string): PlanTextResult {
  const found = extractPlanJson(text);
  if (!found.ok) return { ok: false, kind: 'json', errors: [found.error] };
  const checked = previewImport(found.raw);
  if (!checked.ok) return { ok: false, kind: checked.kind, errors: checked.errors };
  return {
    ok: true,
    preview: { ...checked.preview, notes: [...found.notes, ...checked.preview.notes] },
  };
}

/** What the user pastes back to their AI when the import is refused. */
export function fixItMessage(errors: string[]): string {
  return [
    'Your JSON had these errors:',
    ...errors.map((e) => `- ${e}`),
    'Please fix them and return only the corrected JSON, complete, in one ```json code block.',
  ].join('\n');
}
