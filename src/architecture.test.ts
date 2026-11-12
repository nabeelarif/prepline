import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Source files outside tests, relative to src/. */
function sources(dir = join(__dirname)): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [relative(__dirname, path)]
      : [];
  });
}
const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('architecture', () => {
  it('keeps Supabase code inside backend/supabase', () => {
    const offenders = sources().filter(
      (f) => !f.startsWith('backend/supabase/') && /@supabase\/|supabase\.co/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps persistence out of the domain and the UI', () => {
    const layers = sources().filter(
      (f) => f.startsWith('domain/') || f.startsWith('components/') || f === 'App.tsx',
    );
    const offenders = layers.filter((f) =>
      /backend\/|repositories\/|localStorage|indexedDB/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('stores no app data in the browser: only the theme uses localStorage', () => {
    const users = sources().filter(
      (f) => /localStorage|sessionStorage|indexedDB/.test(read(f)) && !f.startsWith('test/'),
    );
    // theme.ts: the UI preference. The backend factory: sessionStorage for the e2e build only.
    expect(users.sort()).toEqual(['backend/index.ts', 'theme.ts']);
    expect(read('backend/index.ts')).toMatch(/MODE === 'e2e'/);
  });

  it('has no leftover browser-storage persistence of app data', () => {
    expect(sources().some((f) => f.startsWith('storage/'))).toBe(false);
    expect(sources().filter((f) => /roadtogoals:v1|STORAGE_KEY/.test(read(f)))).toEqual([]);
  });

  it('never refers to a service-role key', () => {
    expect(sources().filter((f) => /service_role|SERVICE_ROLE/.test(read(f)))).toEqual([]);
  });
});
