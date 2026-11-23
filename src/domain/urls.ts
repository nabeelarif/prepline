import type { ResourceType } from './types';

/** Adds https:// to bare domains like "example.com/post". */
export function normUrl(s: string): string {
  s = String(s || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+/.test(s)) s = 'https://' + s;
  return s;
}

/** Returns the URL only if it is http(s); use this for every href. */
export function safeUrl(u: string): string {
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch {
    return '';
  }
}

export function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const AUDIO_HOSTS =
  /(^|\.)(spotify\.com|podcasts\.apple\.com|soundcloud\.com|overcast\.fm|pocketcasts\.com|audible\.com|anchor\.fm|castbox\.fm)$/;
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com|twitch\.tv)$/;
const PRACTICE_HOSTS =
  /(^|\.)(hackerrank\.com|codewars\.com|exercism\.org|neetcode\.io|codesignal\.com|pramp\.com|interviewing\.io)$/;
const COURSE_HOSTS =
  /(^|\.)(udemy\.com|coursera\.org|edx\.org|pluralsight\.com|educative\.io|frontendmasters\.com|kodeco\.com|skillshare\.com|datacamp\.com|codecademy\.com|egghead\.io|designcode\.io|teachable\.com|thinkific\.com|domestika\.org|objc\.io)$/;

export function detectType(url: string): ResourceType {
  let h: string;
  let p: string;
  try {
    const x = new URL(url);
    h = x.hostname.toLowerCase();
    p = x.pathname.toLowerCase();
  } catch {
    return 'read';
  }
  if (AUDIO_HOSTS.test(h)) return 'listen';
  if (VIDEO_HOSTS.test(h)) return 'watch';
  if (/(^|\.)developer\.apple\.com$/.test(h) && p.startsWith('/videos')) return 'watch';
  if (COURSE_HOSTS.test(h)) return 'course';
  if (/(^|\.)linkedin\.com$/.test(h) && p.startsWith('/learning')) return 'course';
  if (/(^|\.)leetcode\.com$/.test(h) && (p.startsWith('/studyplan') || p.startsWith('/explore')))
    return 'course';
  if (/(^|\.)leetcode\.com$/.test(h) || PRACTICE_HOSTS.test(h)) return 'practice';
  return 'read';
}

const GENERIC_SEGMENT =
  /^(index|learn|course|courses|watch|video|videos|play|post|posts|blog|article|articles|lecture|lectures|documentation|docs|p|en|en-us)$/i;

/** Guesses a title from the last meaningful path segment; falls back to the host. */
export function titleFromUrl(url: string): string {
  let x: URL;
  try {
    x = new URL(url);
  } catch {
    return '';
  }
  const h = x.hostname.replace(/^www\./, '');
  if (/youtube\.com$|youtu\.be$/.test(h)) return '';
  const segs = x.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  for (let i = segs.length - 1; i >= 0; i--) {
    let s = segs[i]!.replace(/\.(html?|php|aspx?|md)$/i, '');
    if (/^\d+$/.test(s) || s.length < 3) continue;
    if (GENERIC_SEGMENT.test(s)) continue;
    if (/^[a-f0-9-]{16,}$/i.test(s)) continue;
    s = s
      .replace(/[-_+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return h;
}

/** Start time as YouTube writes it: 90, 90s, 1m30s or 1h2m3s. 0 when unreadable. */
function seconds(v: string | null): number {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(v ?? '');
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

const YT_ID = /^[\w-]{6,20}$/;

/**
 * The official embed address for links we know allow embedding (YouTube, Vimeo,
 * Loom), or null. Everything else opens in a new tab: most sites refuse to be
 * framed, and a blocked frame cannot be detected. Input must already pass safeUrl().
 */
export function embedUrl(url: string): string | null {
  let x: URL;
  try {
    x = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(x.protocol)) return null;
  const h = x.hostname.replace(/^www\./, '').toLowerCase();
  const parts = x.pathname.split('/').filter(Boolean);

  if (h === 'youtu.be' || h === 'youtube.com' || h === 'm.youtube.com') {
    const id =
      h === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? x.searchParams.get('v')
          : parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live'
            ? parts[1]
            : null;
    const list = x.searchParams.get('list');
    const start = seconds(x.searchParams.get('t')) || seconds(x.searchParams.get('start'));
    const q = new URLSearchParams();
    if (start > 0) q.set('start', String(start));
    if (id && YT_ID.test(id)) {
      if (list && /^[\w-]+$/.test(list)) q.set('list', list);
      const qs = q.toString();
      return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ''}`;
    }
    if (parts[0] === 'playlist' && list && /^[\w-]+$/.test(list))
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    return null;
  }
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    // Only plain video links: /ID, /ID/HASH (unlisted) or player.vimeo.com/video/ID.
    // Showcases, albums, channels and groups hold other numbers, so they open in a tab.
    const player = h === 'player.vimeo.com';
    if (player !== (parts[0] === 'video')) return null;
    const [id, hash] = player ? [parts[1], x.searchParams.get('h')] : [parts[0], parts[1]];
    if (!id || !/^\d+$/.test(id) || parts.length > 2) return null;
    if (hash && !/^\w+$/.test(hash)) return null;
    return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`;
  }
  if (h === 'loom.com') {
    const id = parts[0] === 'share' || parts[0] === 'embed' ? parts[1] : null;
    return id && /^[\w-]+$/.test(id) ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}
