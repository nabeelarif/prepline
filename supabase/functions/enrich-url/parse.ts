// Pure helpers for the enrich-url Edge Function. No Deno or DOM APIs, so Vitest can run them.

export interface PageInfo {
  title?: string;
  /** The real length of a video. */
  minutes?: number;
  /** Reading time estimated from a page's text. Only meaningful for an article. */
  readMinutes?: number;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      } catch {
        return m;
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string | undefined, max: number): string | undefined => {
  const t = decodeEntities(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t.slice(0, max) : undefined;
};

/** `name="value"`, `name='value'` or `name=value` pairs inside one tag. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (let m = re.exec(tag); m; m = re.exec(tag)) {
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** Title from Open Graph / Twitter / `<title>`, in that order. */
export function readMeta(html: string): Pick<PageInfo, 'title'> {
  const head = html.slice(0, 200_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? '').toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  const tag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? tag, 160),
  };
}

const WORDS_PER_MINUTE = 230;
const SKIPPED = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
]);
const MAX_SCAN = 200_000;

/**
 * Reading time of the visible text, or undefined when the page has too little text to trust.
 * One linear pass (every search moves forward), so malformed HTML cannot make it slow.
 */
export function readingMinutes(html: string): number | undefined {
  const src = html.slice(0, MAX_SCAN);
  const lower = src.toLowerCase();
  let words = 0;
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const text = src.slice(i, lt < 0 ? src.length : lt);
    words += text.match(/\S+/g)?.length ?? 0;
    if (lt < 0) break;
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    const gt = src.indexOf('>', lt);
    if (gt < 0) break;
    const name = /^<([a-z][a-z0-9]*)/.exec(lower.slice(lt, gt))?.[1];
    i = gt + 1;
    if (name && SKIPPED.has(name) && src[gt - 1] !== '/') {
      const close = lower.indexOf(`</${name}`, i);
      const end = close < 0 ? -1 : src.indexOf('>', close);
      i = end < 0 ? src.length : end + 1;
    }
  }
  return words < 200 ? undefined : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** ISO 8601 duration (YouTube's `PT1H2M3S`) to whole minutes, rounded up. Undefined if unreadable. */
export function isoDurationMinutes(iso: string | undefined): number | undefined {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m) return undefined;
  const sec =
    Number(m[1] ?? 0) * 86400 +
    Number(m[2] ?? 0) * 3600 +
    Number(m[3] ?? 0) * 60 +
    Number(m[4] ?? 0);
  return sec > 0 ? Math.ceil(sec / 60) : undefined;
}

export function secondsToMinutes(sec: unknown): number | undefined {
  return typeof sec === 'number' && sec > 0 ? Math.ceil(sec / 60) : undefined;
}

/**
 * The video id of a YouTube link (watch, youtu.be, shorts, embed, live), or null.
 * Keep in step with `embedUrl` in src/domain/urls.ts (the function cannot import from src/).
 */
export function youtubeId(u: URL): string | null {
  const h = u.hostname.replace(/^www\./, '').toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  let id: string | null | undefined = null;
  if (h === 'youtu.be') id = parts[0];
  else if (h === 'youtube.com' || h === 'm.youtube.com')
    id =
      parts[0] === 'watch'
        ? u.searchParams.get('v')
        : ['shorts', 'embed', 'live'].includes(parts[0] ?? '')
          ? parts[1]
          : null;
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

export function isVimeo(u: URL): boolean {
  return /^(www\.|player\.)?vimeo\.com$/i.test(u.hostname);
}

/**
 * True for an address the function must never fetch: not http(s), a name that is local
 * by convention, or an IP literal in a private, loopback or link-local range.
 * (Names that resolve to such IPs are checked after DNS lookup, in index.ts.)
 */
export function isBlockedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  if (u.username || u.password) return true;
  if (u.port && u.port !== '80' && u.port !== '443') return true;
  return isBlockedHost(u.hostname);
}

function isBlockedHost(host: string): boolean {
  const h = host
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(h)) return true;
  if (h.includes(':')) return isBlockedIpv6(h);
  if (/^[\d.]+$/.test(h)) return isBlockedIpv4(h);
  return !h.includes('.'); // single-label names are internal
}

export function isBlockedIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isBlockedIpv6(ip: string): boolean {
  const h = ip.toLowerCase();
  if (h === '::' || h === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h); // IPv4-mapped
  if (mapped) return isBlockedIpv4(mapped[1]!);
  if (/^::ffff:[0-9a-f]+:[0-9a-f]+$/.test(h)) return true; // hex-form mapped: refuse
  if (/^(64:ff9b:|2002:)/.test(h)) return true; // NAT64 and 6to4 can wrap private IPv4
  return /^(fc|fd|fe[89ab])/.test(h); // unique-local and link-local
}
