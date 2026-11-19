import { TYPES } from './constants';
import { toISO, pad } from './dates';
import { fmtHours, pl } from './format';
import { metrics } from './metrics';
import { phaseResources } from './roadmap';
import type { PlanSharing } from './share';
import type { Goal, Resource } from './types';

/** Local time with its UTC offset, like `2026-11-18T14:32:05-05:00`. */
export function localTimestamp(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return (
    `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * The plan as an importable Road to Goals file: content only. Progress, start date,
 * deadline and fork source are left out, so the file is the same plan, not started.
 * `sharing` is added only when the plan is shared.
 */
export function planToJson(goal: Goal, sharing: PlanSharing | undefined, now: Date): string {
  const file = {
    version: 1,
    exportedAt: localTimestamp(now),
    generatedBy: { tool: 'Road to Goals' },
    goals: [
      {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        hoursPerDay: goal.hoursPerDay,
        ...(sharing && sharing.visibility !== 'private'
          ? { sharing: { visibility: sharing.visibility, tags: sharing.tags } }
          : {}),
        phases: goal.phases.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          color: p.color,
        })),
        resources: goal.resources.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          type: r.type,
          minutes: r.minutes,
          notes: r.notes,
          phaseId: r.phaseId,
        })),
      },
    ],
  };
  return JSON.stringify(file, null, 2) + '\n';
}

interface Section {
  name: string | null;
  description: string;
  resources: Resource[];
}

/** Resources grouped by phase in phase order, then the unassigned ones; empty groups dropped. */
function sections(goal: Goal): Section[] {
  const out: Section[] = goal.phases.map((p) => ({
    name: p.name,
    description: p.description,
    resources: phaseResources(goal, p.id),
  }));
  // Also catches a resource whose phase is missing, so the list always matches the count.
  const known = new Set(goal.phases.map((p) => p.id));
  const loose = goal.resources.filter((r) => !r.phaseId || !known.has(r.phaseId));
  if (loose.length)
    out.push({ name: goal.phases.length ? 'Unassigned' : null, description: '', resources: loose });
  return out.filter((s) => s.resources.length);
}

const resourceLabel = (r: Resource) => `${TYPES[r.type]}, ${fmtHours(r.minutes)}`;

const summary = (goal: Goal) => {
  const m = metrics(goal.resources);
  return `${pl(m.count, 'resource')} · ${fmtHours(m.total)} estimated`;
};

/** One line of Markdown text: whitespace collapsed, and characters that carry meaning escaped. */
const mdInline = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]<>]/g, '\\$&');

/** Several lines of Markdown text, each kept on its own line and kept from becoming a heading or list. */
const mdBlock = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => mdInline(l).replace(/^([#>+-]|\d+[.)])/, '\\$1'))
    .filter(Boolean)
    .join('  \n');

/** A link target that cannot end the link early. */
const mdUrl = (u: string) =>
  u
    .trim()
    .replace(/[\s()<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));

/** A readable outline of the plan. Done resources get a ticked box. */
export function planToMarkdown(goal: Goal): string {
  const lines: string[] = [`# ${mdInline(goal.name)}`, ''];
  if (goal.description) lines.push(mdBlock(goal.description), '');
  lines.push(`_${summary(goal)}_`, '');
  for (const s of sections(goal)) {
    if (s.name) lines.push(`## ${mdInline(s.name)}`, '');
    if (s.description) lines.push(mdBlock(s.description), '');
    for (const r of s.resources) {
      const text = mdInline(r.title);
      const title = r.url ? `[${text}](${mdUrl(r.url)})` : text;
      lines.push(`- [${r.done ? 'x' : ' '}] ${title} (${resourceLabel(r)})`);
      if (r.notes) for (const l of mdBlock(r.notes).split('\n')) lines.push(`  > ${l}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only http(s) links become anchors; anything else is shown as text. */
const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? esc(url) : null);

const PRINT_CSS = `
  body{font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
  h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:24px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
  .meta{color:#555;margin:0 0 16px}ul{list-style:none;padding:0;margin:8px 0}
  li{margin:6px 0;break-inside:avoid}.box{display:inline-block;width:1em;margin-right:6px}
  .kind{color:#555}.notes{color:#444;margin:2px 0 0 1.6em;white-space:pre-wrap}
  a{color:#1d4ed8}
`;

/** A standalone printable page of the plan, for "Save as PDF". All text is escaped. */
export function planToHtml(goal: Goal): string {
  const body = sections(goal)
    .map((s) => {
      const items = s.resources
        .map((r) => {
          const href = safeHref(r.url);
          const title = href ? `<a href="${href}">${esc(r.title)}</a>` : esc(r.title);
          const notes = r.notes ? `<div class="notes">${esc(r.notes)}</div>` : '';
          return `<li><span class="box">${r.done ? '&#9745;' : '&#9744;'}</span>${title} <span class="kind">(${resourceLabel(r)})</span>${notes}</li>`;
        })
        .join('');
      const head = s.name ? `<h2>${esc(s.name)}</h2>` : '';
      const desc = s.description ? `<p>${esc(s.description)}</p>` : '';
      return `${head}${desc}<ul>${items}</ul>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(goal.name)}</title><style>${PRINT_CSS}</style></head><body><h1>${esc(goal.name)}</h1>${goal.description ? `<p>${esc(goal.description)}</p>` : ''}<p class="meta">${esc(summary(goal))}</p>${body}</body></html>`;
}

/** A safe file name for the plan, like `ios-interview-prep.json`. */
export function exportFileName(goal: Goal, ext: string): string {
  const slug = goal.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'plan'}.${ext}`;
}
