# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Prepline is a static study planner: users collect articles/videos/courses under a goal with a target date and hours per day, and the app lays unfinished work out day by day. Vite + React 18 + TypeScript (strict) + Zustand + Zod, deployed to GitHub Pages by GitHub Actions. Data lives in localStorage; the storage layer is abstracted so a sync backend can be added later.

`legacy/index.html` is the original single-file version, kept only for comparison. Don't edit it.

## Commands

```bash
npm run dev                         # dev server at /prepline/
npm test                            # Vitest, all unit tests
npx vitest run src/domain/schedule.test.ts   # one test file
npx vitest run -t "splits long units"        # tests matching a name
npm run test:e2e                    # Playwright (builds, then serves dist at :4173/prepline/)
npm run lint && npm run typecheck && npm run format:check
npm run build
```

CI (`.github/workflows/ci.yml`) runs all of the above; `deploy.yml` publishes `dist/` to Pages on push to `main`. `base: '/prepline/'` in `vite.config.ts` must match the repo name.

## Architecture

Layers, in dependency order. Lower layers never import higher ones.

- **`src/domain/`**: pure functions, no React. Types (`types.ts`), date helpers on local `YYYY-MM-DD` strings (`dates.ts`; never use UTC/`toISOString`), URL heuristics, section parsing, and the core calculations: `metrics()` → `schedule()` → `pace()`. Each takes an optional `today` argument for tests. Resource order in `goal.resources` is priority order. When a resource has sections, its own `minutes`/`done` are ignored and derived from the sections (`resTotal`, `resDone`, `isDone`).
- **`src/domain/schema.ts`**: Zod schemas that replace the legacy `normalize()`. They are deliberately lenient: every field uses the `field()` helper so missing or bad values fall back to defaults instead of failing. All data from storage or imported backups goes through `parseAppData()`. **Any new persisted field must be added here**, or it is dropped on reload/import. Zod 4 rejects missing keys unless the field is `.optional()`, which `field()` handles.
- **`src/storage/`**: `StorageAdapter` interface (`load`/`save`/`available`) with `localStorageAdapter` under key `prepline:v1`. Saved data must stay backward-compatible with the legacy app's format.
- **`src/state/store.ts`**: one Zustand store. `data` (persisted `AppData`) is changed only through `commit(recipe, ui?)`, which applies an Immer recipe, saves via the adapter, and optionally patches `ui`. `ui` (filter, rating prompt, collapsed sections, open overlay) is never persisted. `createAppStore(adapter)` lets tests inject an in-memory adapter.
- **`src/components/`**: React components that read the store via selectors; actions are taken from `useStore.getState()` or selectors. `GoalView` computes metrics/schedule/pace once per render and passes them down. Overlays (goal form, resource form, backup panel) are chosen by `ui.overlay` in `App.tsx` and wrapped in `Overlay` (focus, Escape, scroll lock). Destructive actions use `ConfirmButton` (click twice within 4s).
- **`src/styles/`**: global CSS split by area, imported in order from `index.css` (`responsive.css` must stay last). Class names are global, not CSS Modules. Colors are custom properties in `tokens.css` with dark-mode overrides; use the tokens, not literal colors.

## Testing notes

- `src/test/setup.ts` replaces `localStorage` with an in-memory one, because Node 25+'s built-in `localStorage` shadows jsdom's.
- Unit tests sit next to the code (`*.test.ts[x]`); browser tests live in `e2e/`.
