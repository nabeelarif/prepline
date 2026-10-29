# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Prepline is a static study planner. Users create plans (called `Goal` in code) with a target date and optional daily study hours, collect articles, videos, courses and practice under them, optionally group them into phases, and follow them on a snake-shaped "preparation journey". Progress is weighted by estimated hours, never by resource count. Vite + React 18 + TypeScript (strict) + Zustand + Zod + lucide-react, deployed to GitHub Pages by GitHub Actions. Data lives in localStorage; the storage layer is abstracted so a sync backend can be added later.

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

- **`src/domain/`**: pure functions, no React. Types (`types.ts`), date helpers on local `YYYY-MM-DD` strings (`dates.ts`; never use UTC/`toISOString`), URL heuristics, and the calculations:
  - `resources.ts`: `resTotal` / `resDone` / `isDone` / `resStatus`. Durations are stored in minutes and shown as hours. `done` credits the full estimate; otherwise `doneMinutes` is partial progress. Status is derived, never stored: Completed when `done`, In Progress when `startedAt` is set or any time is recorded (so starting credits nothing), else Not Started. Any number of resources can be In Progress. All status moves go through `statusPatch()` / `progressPatch()` (reopen restores earlier partial progress; Not Started clears it, and the UI confirms first via `statusLosesProgress()`). `focusResource()` picks what Continue Learning shows.
  - `metrics(resources)`: weighted progress over any list (plan, phase, or one resource). Every progress figure in the UI goes through it; don't recompute progress elsewhere.
  - `pace()`: schedule feasibility (on track / at risk / behind). Without `hoursPerDay` it reports only the required pace.
  - `roadmap.ts`: `roadmap(goal, view)` builds journey steps (resources, or phases plus an "Unorganized" group) with states `done` / `active` / `upcoming` and a separate `next` flag (the first unfinished step in priority order, independent of status); `snakeLayout(n, width)` is the pure geometry (columns by width, marker points, SVG segments, U-turns). Components only draw what it returns.
  - Order in `goal.resources` is priority order and drives the journey. `goal.phases` order is display order only. Resources point to phases by `phaseId` (null = no phase); phases are optional.
- **`src/domain/schema.ts`**: Zod schemas that replace the legacy `normalize()`. They are deliberately lenient: every field uses the `field()` helper so missing or bad values fall back to defaults instead of failing. All data from storage or imported backups goes through `parseAppData()`. **Any new persisted field must be added here**, or it is dropped on reload/import. Zod 4 rejects missing keys unless the field is `.optional()`, which `field()` handles. It also migrates older data: course `sections` fold into `minutes`/`doneMinutes`, `rating` and `sample` are dropped, and `phaseId`s pointing at missing phases become null. Backups go through `previewImport()` instead, which rejects non-Prepline or other-version files and lists every repair so the user confirms before data is replaced.
- **`src/storage/`**: `StorageAdapter` interface (`load`/`save`/`available`) with `localStorageAdapter` under key `prepline:v1`. Saved data keeps the legacy field names (`minutes`, `done`, `doneAt`) so the legacy app can still read it, but the legacy app drops phases and partial progress if it saves.
- **`src/state/store.ts`**: one Zustand store. `data` (persisted `AppData`) is changed only through `commit(recipe, ui?)`, which applies an Immer recipe, saves via the adapter, and optionally patches `ui`. Note `commit` updates memory even when saving fails. Replacing all data (`restoreBackup`, `deleteAllData`) goes through `replaceData` instead, which saves first and leaves memory untouched if that fails, so a failed restore or delete never looks like it worked. The one empty state is `createEmptyAppData()` in `src/domain/backup.ts`. `ui` (page, journey view, filters, selected resource, open overlay, toast, mobile nav) is never persisted. Pages are a `ui.page` value, not routes, so GitHub Pages never sees deep links. `createAppStore(adapter)` lets tests inject an in-memory adapter. First run starts with no plans.
- **`src/components/`**: React components that read the store via selectors; actions are taken from `useStore.getState()` or selectors. `GoalView` (the dashboard) computes metrics, pace and journey nodes once per render and passes them down. Overlays (plan, resource, phase, resource details, backup) are chosen by `ui.overlay` in `App.tsx` and wrapped in `Overlay` (focus trap, Escape, scroll lock); each names itself with an `h2 id={DIALOG_TITLE}`. Dropdowns use `Menu` (keyboard and outside-click handling). The resource list reorders by dragging a row handle (`useReorderDrag`: pointer events for mouse and touch, arrow keys on the handle) via `placeResource`, which drops next to a visible row so filtered lists still work. Destructive actions use `ConfirmButton` (click twice within 4s), also inside menus via the `confirm` item option. The backup overlay (`forms/DataPanel.tsx`) is the exception: one-click download, restore as an explicit state machine (`useRestoreFlow`: pick → check → review → confirm → result), and Delete All Data below the two cards, with both confirmations in `ConfirmPanel`, where Escape cancels only the confirmation (it calls `preventDefault()`, which `Overlay` respects). Backup files add an `exportedAt` key that loading ignores. Icons come from `lucide-react`.
- **`src/styles/`**: global CSS split by area, imported in order from `index.css` (`responsive.css` must stay last). Class names are global, not CSS Modules. Colors are custom properties in `tokens.css` (indigo accent, navy sidebar, type colors `--t-*`, phase colors `--ph-*`) with dark-mode overrides; use the tokens, not literal colors. Dark follows the OS unless `[data-theme]` on `<html>` overrides it; `src/theme.ts` sets that from the sidebar's theme switch and saves it under `prepline:theme`, separate from app data and backups. Below 680px the resource table becomes stacked cards; below 560px the journey becomes a vertical stepper and modals become bottom sheets.

## Testing notes

- `src/test/setup.ts` replaces `localStorage` with an in-memory one, because Node 25+'s built-in `localStorage` shadows jsdom's.
- Unit tests sit next to the code (`*.test.ts[x]`); browser tests live in `e2e/`. `src/test/fixtures.ts` has `res()` / `goal()` builders for domain tests.
