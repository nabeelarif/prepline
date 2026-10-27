import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, saveTheme } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    applyTheme('system');
  });

  it('follows the system by default', () => {
    expect(loadTheme()).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('saves and applies an explicit choice', () => {
    saveTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(loadTheme()).toBe('light');
  });

  it('going back to system clears the override', () => {
    saveTheme('dark');
    saveTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(loadTheme()).toBe('system');
  });

  it('ignores unknown saved values', () => {
    localStorage.setItem('prepline:theme', 'sepia');
    expect(loadTheme()).toBe('system');
  });
});
