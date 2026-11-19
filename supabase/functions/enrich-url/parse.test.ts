import {
  decodeEntities,
  isBlockedUrl,
  isoDurationMinutes,
  readMeta,
  readingMinutes,
  youtubeId,
} from './parse';

describe('readMeta', () => {
  it('prefers Open Graph, then Twitter, then <title>', () => {
    const og = `<head><title>Plain</title><meta name="twitter:title" content="Tw">
      <meta property="og:title" content="Fish &amp; Chips"></head>`;
    expect(readMeta(og)).toEqual({ title: 'Fish & Chips' });
    expect(readMeta(`<title>Plain</title><meta name="twitter:title" content="Tw">`).title).toBe(
      'Tw',
    );
    expect(readMeta(`<title> A\n  title </title>`).title).toBe('A title');
  });
  it('reads attributes in any order, quote style or case', () => {
    const html = `<META CONTENT='Single' PROPERTY=og:title><meta name=other content=Bare>`;
    expect(readMeta(html)).toEqual({ title: 'Single' });
  });
  it('returns nothing for a page without metadata', () => {
    expect(readMeta('<p>hi</p>')).toEqual({ title: undefined });
  });
});

describe('readingMinutes', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
  it('ignores scripts and navigation, and rounds to minutes', () => {
    const html = `<nav>${words(900)}</nav><script>${words(900)}</script><article>${words(690)}</article>`;
    expect(readingMinutes(html)).toBe(3);
  });
  it('stays fast on markup with no closing tags', () => {
    const start = Date.now();
    expect(readingMinutes('<script'.repeat(50_000))).toBeUndefined();
    expect(readingMinutes('<nav>'.repeat(50_000))).toBeUndefined();
    expect(readingMinutes('<'.repeat(100_000))).toBeUndefined();
    expect(Date.now() - start).toBeLessThan(1000);
  });
  it('keeps text after a self-closed or commented-out block', () => {
    expect(readingMinutes(`<!-- ${words(900)} --><svg/><p>${words(460)}</p>`)).toBe(2);
  });
  it('is undefined for a page with little text', () => {
    expect(readingMinutes(`<p>${words(50)}</p>`)).toBeUndefined();
  });
});

describe('durations and ids', () => {
  it('reads ISO 8601 durations', () => {
    expect(isoDurationMinutes('PT1H2M3S')).toBe(63);
    expect(isoDurationMinutes('PT45S')).toBe(1);
    expect(isoDurationMinutes('P0D')).toBeUndefined();
    expect(isoDurationMinutes('junk')).toBeUndefined();
  });
  it('finds YouTube ids', () => {
    expect(youtubeId(new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'))).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeId(new URL('https://youtu.be/dQw4w9WgXcQ'))).toBe('dQw4w9WgXcQ');
    expect(youtubeId(new URL('https://www.youtube.com/shorts/abcDEF12345'))).toBe('abcDEF12345');
    expect(youtubeId(new URL('https://www.youtube.com/playlist?list=PL1'))).toBeNull();
    expect(youtubeId(new URL('https://example.com/watch?v=dQw4w9WgXcQ'))).toBeNull();
  });
  it('decodes entities', () => {
    expect(decodeEntities('a &lt;b&gt; &#39;c&#x27; &bogus; &#0;')).toBe("a <b> 'c' &bogus; &#0;");
  });
});

describe('isBlockedUrl', () => {
  it.each([
    'http://localhost/x',
    'https://127.0.0.1/',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1/',
    'http://172.20.0.1/',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[64:ff9b::a00:1]/',
    'http://[2002:a00:1::]/',
    'http://intranet/',
    'http://db.internal/',
    'http://user:pw@example.com/',
    'http://example.com:8080/',
    'ftp://example.com/',
    'file:///etc/passwd',
    'not a url',
  ])('blocks %s', (u) => expect(isBlockedUrl(u)).toBe(true));

  it.each(['https://example.com/post', 'http://www.example.co.uk/a?b=1', 'https://8.8.8.8/'])(
    'allows %s',
    (u) => expect(isBlockedUrl(u)).toBe(false),
  );
});
