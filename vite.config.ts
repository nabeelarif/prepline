import { copyFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * GitHub Pages has no rewrite rules, but serves 404.html for any unknown path. A copy of
 * index.html there makes /plans/abc, refreshed or pasted into a new tab, load the app, which
 * then reads the address. (Pages answers with status 404 but still renders the page.)
 */
const spaFallback = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'spa-fallback',
    apply: 'build',
    configResolved: (c) => void (outDir = c.build.outDir),
    closeBundle: () => copyFileSync(`${outDir}/index.html`, `${outDir}/404.html`),
  };
};

export default defineConfig({
  // The root, for roadtogoals.com and local dev. deploy.yml overrides it with --base for the
  // GitHub Pages dev site, which is served from /<repo>/.
  base: '/',
  plugins: [react(), spaFallback()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
