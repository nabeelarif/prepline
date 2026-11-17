import { embedUrl } from './urls';

describe('embedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=90', 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    [
      'https://www.youtube.com/playlist?list=PL123abc',
      'https://www.youtube.com/embed/videoseries?list=PL123abc',
    ],
    ['https://youtu.be/dQw4w9WgXcQ?t=1m30s', 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90'],
    [
      'https://youtu.be/dQw4w9WgXcQ?t=&start=60',
      'https://www.youtube.com/embed/dQw4w9WgXcQ?start=60',
    ],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789'],
    [
      'https://vimeo.com/123456789/abcdef1234',
      'https://player.vimeo.com/video/123456789?h=abcdef1234',
    ],
    [
      'https://player.vimeo.com/video/123456789?h=abc123',
      'https://player.vimeo.com/video/123456789?h=abc123',
    ],
    ['https://www.loom.com/share/abc123def', 'https://www.loom.com/embed/abc123def'],
  ])('embeds %s', (url, src) => {
    expect(embedUrl(url)).toBe(src);
  });

  it.each([
    'https://leetcode.com/problems/two-sum/',
    'https://example.com/post',
    'https://developer.apple.com/videos/play/wwdc2024/10100/',
    'https://www.udemy.com/course/x/',
    'https://www.youtube.com/@channel',
    'https://vimeo.com/channels/staffpicks',
    'https://vimeo.com/showcase/1234567',
    'https://vimeo.com/channels/staffpicks/123456789',
    'ftp://example.com/file',
    'not a url',
  ])('does not embed %s', (url) => {
    expect(embedUrl(url)).toBeNull();
  });
});
