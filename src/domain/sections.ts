import { uid } from './format';
import type { Section } from './types';

/** "1h 30m" → 90, "2h" → 120, "45m" → 45, "45" → 45; 0 when nothing parses. */
export function parseDuration(s: string): number {
  s = String(s).toLowerCase();
  let m = 0;
  let found = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  if (h) {
    m += parseFloat(h[1]!) * 60;
    found = true;
  }
  const mm = s.match(/(\d+)\s*m/);
  if (mm) {
    m += parseInt(mm[1]!, 10);
    found = true;
  }
  if (!found && /^\s*\d+\s*$/.test(s)) m = parseInt(s, 10);
  return Math.round(m);
}

const SEC_RE =
  /^(.*?)[\s,;:|(\-–—]+(\d+(?:\.\d+)?\s*h(?:ours?|rs?)?(?:\s*\d+\s*m(?:in(?:ute)?s?)?)?|\d+\s*m(?:in(?:ute)?s?)?)\)?\s*$/i;

/** One section per line, with an optional trailing time ("Networking, 2h"). Lines without one get 30m. */
export function parseSections(text: string): Section[] {
  return String(text || '')
    .split(/\n/)
    .map((l) => l.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const m = line.match(SEC_RE);
      let title = line;
      let minutes = 30;
      if (m && m[1]!.trim()) {
        title = m[1]!.trim();
        minutes = parseDuration(m[2]!) || 30;
      }
      return { id: uid(), title: title.slice(0, 160), minutes, done: false, doneAt: null };
    });
}
