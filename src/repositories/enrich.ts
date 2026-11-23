/** What we could learn about a link. Every field is optional: this is best effort. */
export interface UrlInfo {
  title?: string;
  /** The real length of a video. */
  minutes?: number;
  /** Reading time estimated from the page's text: only meaningful for a Read. */
  readMinutes?: number;
}

/**
 * Looks a link up on the server (the browser cannot fetch other sites: CORS). It never
 * throws: a failure, a signed-out user or an unreadable page all return null.
 */
export interface UrlEnricher {
  enrich(url: string): Promise<UrlInfo | null>;
}

/** Keeps only well-formed fields, whatever the server sent. */
export function cleanUrlInfo(raw: unknown): UrlInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
  const info: UrlInfo = {};
  const title = text(r.title, 160);
  if (title) info.title = title;
  const minutes = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 1
      ? Math.min(Math.round(v), 6000)
      : undefined;
  const length = minutes(r.minutes);
  const reading = minutes(r.readMinutes);
  if (length) info.minutes = length;
  if (reading) info.readMinutes = reading;
  return Object.keys(info).length ? info : null;
}
