// Supabase Edge Function (Deno). POST { url } -> { title?, minutes?, readMinutes? }.
// Best effort: any failure returns {} so the form just keeps what the user typed.
import {
  isBlockedIpv4,
  isBlockedIpv6,
  isBlockedUrl,
  isVimeo,
  isoDurationMinutes,
  readMeta,
  readingMinutes,
  secondsToMinutes,
  youtubeId,
  type PageInfo,
} from './parse.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  resolveDns(name: string, type: 'A' | 'AAAA'): Promise<string[]>;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = 'RoadToGoalsBot/1.0 (+https://roadtogoals.com)';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/** The gateway accepts the public anon key too, so confirm a real signed-in user. */
async function isSignedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  const base = Deno.env.get('SUPABASE_URL');
  const apikey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!auth || !base || !apikey) return false;
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
    return r.ok;
  } catch {
    return false;
  }
}

/** A name that resolves to a private address is as bad as a private literal. */
async function resolvesPublic(host: string): Promise<boolean> {
  if (/^[\d.]+$/.test(host) || host.includes(':')) return true; // literals were checked already
  try {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(host, 'A').catch(() => [] as string[]),
      Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]),
    ]);
    if (v4.length + v6.length === 0) return false;
    return !v4.some(isBlockedIpv4) && !v6.some(isBlockedIpv6);
  } catch {
    return false;
  }
}

/** GET with a timeout; follows redirects by hand so every hop is checked. */
async function safeFetch(start: string, accept: string, checkDns = true): Promise<Response | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isBlockedUrl(url)) return null;
    // Redirect targets are always checked, even for fixed API addresses.
    if ((checkDns || hop > 0) && !(await resolvesPublic(new URL(url).hostname))) return null;
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'en' },
    });
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url).href;
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

async function readText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const dec = new TextDecoder();
  let out = '';
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += dec.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return out;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  // Only called with fixed provider API addresses, so no DNS check is needed.
  const res = await safeFetch(url, 'application/json', false);
  if (!res) return null;
  try {
    return JSON.parse(await readText(res)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface YouTubeItem {
  snippet?: { title?: unknown };
  contentDetails?: { duration?: string };
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

async function youtube(id: string, link: string): Promise<PageInfo> {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (key) {
    const api = new URL('https://www.googleapis.com/youtube/v3/videos');
    api.search = new URLSearchParams({ part: 'snippet,contentDetails', id, key }).toString();
    const items = (await getJson(api.href))?.items;
    const item = (Array.isArray(items) ? items[0] : undefined) as YouTubeItem | undefined;
    if (item) {
      return {
        title: str(item.snippet?.title),
        minutes: isoDurationMinutes(item.contentDetails?.duration),
      };
    }
  }
  // No key (or no match): the keyless oEmbed gives the title but not the length.
  const o = await getJson(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`,
  );
  return { title: str(o?.title) };
}

async function vimeo(link: string): Promise<PageInfo> {
  const o = await getJson(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}`);
  return {
    title: str(o?.title),
    minutes: secondsToMinutes(o?.duration),
  };
}

async function page(link: string): Promise<PageInfo> {
  const res = await safeFetch(link, 'text/html,application/xhtml+xml');
  if (!res || !/html/i.test(res.headers.get('Content-Type') ?? '')) return {};
  const html = await readText(res);
  return { ...readMeta(html), readMinutes: readingMinutes(html) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!(await isSignedIn(req))) return json({ error: 'unauthorized' }, 401);

  let link = '';
  try {
    const body = (await req.json()) as { url?: unknown };
    link = typeof body.url === 'string' ? body.url.trim().slice(0, 2048) : '';
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!link || isBlockedUrl(link)) return json({}, 200);

  try {
    const u = new URL(link);
    const id = youtubeId(u);
    const info = id ? await youtube(id, link) : isVimeo(u) ? await vimeo(link) : await page(link);
    return json(info);
  } catch {
    return json({});
  }
});
