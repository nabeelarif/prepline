import { describe, expect, it } from 'vitest';
import { MAX_DISPLAY_NAME, randomDisplayName } from './share';

describe('randomDisplayName', () => {
  it('is an adjective, a noun and a two-digit number', () => {
    for (let i = 0; i < 200; i++) {
      const name = randomDisplayName();
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
      expect(name.length).toBeLessThanOrEqual(MAX_DISPLAY_NAME);
    }
  });

  it('pads the number and reaches both ends of every list', () => {
    expect(randomDisplayName(() => 0)).toMatch(/ 00$/);
    const last = randomDisplayName(() => 0.999999);
    expect(last).toMatch(/ 99$/);
    expect(randomDisplayName(() => 0)).not.toBe(last);
  });

  it('varies between calls', () => {
    const names = new Set(Array.from({ length: 50 }, () => randomDisplayName()));
    expect(names.size).toBeGreaterThan(40);
  });
});
