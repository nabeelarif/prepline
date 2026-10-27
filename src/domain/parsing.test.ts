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
    ['https://leetcode.com/problems/two-sum/', 'practice'],
    ['https://www.hackerrank.com/challenges/x', 'practice'],
    ['https://medium.com/@a/swift-actors', 'article'],
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
