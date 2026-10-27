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
    return 'article';
  }
  if (VIDEO_HOSTS.test(h)) return 'video';
  if (/(^|\.)developer\.apple\.com$/.test(h) && p.startsWith('/videos')) return 'video';
  if (COURSE_HOSTS.test(h)) return 'course';
  if (/(^|\.)linkedin\.com$/.test(h) && p.startsWith('/learning')) return 'course';
  if (/(^|\.)leetcode\.com$/.test(h) && (p.startsWith('/studyplan') || p.startsWith('/explore')))
    return 'course';
  if (/(^|\.)leetcode\.com$/.test(h) || PRACTICE_HOSTS.test(h)) return 'practice';
  return 'article';
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
