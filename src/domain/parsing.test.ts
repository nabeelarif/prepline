import { parseDuration, parseSections } from './sections';
import { detectType, normUrl, safeUrl, titleFromUrl } from './urls';

describe('detectType', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'video'],
    ['https://youtu.be/abc', 'video'],
    ['https://developer.apple.com/videos/play/wwdc2021/10132/', 'video'],
    ['https://developer.apple.com/documentation/swift', 'article'],
    ['https://www.udemy.com/course/swift/', 'course'],
    ['https://www.linkedin.com/learning/swift', 'course'],
    ['https://leetcode.com/studyplan/top-interview-150/', 'course'],
    ['https://leetcode.com/problems/two-sum/', 'article'],
    ['not a url', 'article'],
  ])('%s → %s', (url, type) => {
    expect(detectType(url)).toBe(type);
  });
});

describe('urls', () => {
  it('normalizes bare domains', () => {
    expect(normUrl('  example.com/post ')).toBe('https://example.com/post');
    expect(normUrl('http://x.io')).toBe('http://x.io');
  });

  it('rejects non-http URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('https://ok.dev/a')).toBe('https://ok.dev/a');
  });

  it('guesses titles from the path', () => {
    expect(titleFromUrl('https://blog.dev/posts/understanding-swift-actors.html')).toBe(
      'Understanding swift actors',
    );
    expect(titleFromUrl('https://blog.dev/docs/12345')).toBe('blog.dev');
    expect(titleFromUrl('https://www.youtube.com/watch?v=x')).toBe('');
  });
});

describe('sections', () => {
  it('parses durations', () => {
    expect(parseDuration('1h 30m')).toBe(90);
    expect(parseDuration('2.5h')).toBe(150);
    expect(parseDuration('45 min')).toBe(45);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('soon')).toBe(0);
  });

  it('parses one section per line with optional times', () => {
    const s = parseSections('- Networking layer, 2h\n2. Caching (1h 30m)\n\nMock interview');
    expect(s.map((x) => [x.title, x.minutes])).toEqual([
      ['Networking layer', 120],
      ['Caching', 90],
      ['Mock interview', 30],
    ]);
  });
});
