import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read from disk: Vitest does not process CSS, so importing it would give empty text.
const dir = import.meta.dirname;
const sheets = readdirSync(dir)
  .filter((f) => f.endsWith('.css'))
  .map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const);

describe('stylesheets', () => {
  /*
   * Browsers without :has() (Firefox before 121) drop a whole rule when one
   * selector in its list is invalid, so the selectors next to it would stop
   * working too; the same goes for :has() inside a list such as :not(a, :has(b)).
   * Give each :has() selector a rule of its own, with no commas.
   */
  it('finds the stylesheets', () => {
    expect(sheets.map(([f]) => f)).toContain('table.css');
    expect(sheets.every(([, css]) => css.length > 0)).toBe(true);
  });

  it.each(sheets)('%s keeps :has() out of selector lists', (_, css) => {
    const preludes = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g) ?? [];
    const mixed = preludes
      .map((p) => p.trim())
      .filter((p) => p.includes(':has(') && p.includes(','));
    expect(mixed).toEqual([]);
  });
});
