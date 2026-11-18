import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAME_ADJECTIVES, NAME_NOUNS } from './share';

/** The words inside the array literal that follows `marker` in schema.sql. */
function sqlWords(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const body = sql.slice(start, sql.indexOf('] as w', start));
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe('random display name word lists', () => {
  const sql = readFileSync('supabase/schema.sql', 'utf8');
  it('are the same in schema.sql and share.ts', () => {
    expect(sqlWords(sql, "'Curious'")).toEqual(NAME_ADJECTIVES);
    expect(sqlWords(sql, "'Pathfinder'")).toEqual(NAME_NOUNS);
  });
});
