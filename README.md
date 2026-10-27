# Prepline

Collect the articles, videos and courses you plan to get through, and Prepline turns them into a day-by-day plan toward a target date.

## Features

- Multiple goals, each with a target date and hours per day
- Resources by link, with type and title guessed from the URL (YouTube → video, Udemy/Coursera → course, everything else → article)
- Courses can have sections, each ticked off on its own
- Progress weighted by hours, not item count
- Readiness score from a 1–5 self-rating after each finished item
- Timeline that schedules unfinished work in priority order and shows whether you'll make your date
- Data saved in the browser (localStorage), with JSON export and import for backups

## Architecture

Prepline runs entirely in the browser. It has four layers (UI, state, domain and storage), one-way data flow and a core of pure functions.

![Prepline architecture and data flow](docs/architecture.png)

## Development

Requires Node 22 or newer.

```bash
npm install
npm run dev          # dev server at http://localhost:5173/prepline/
npm test             # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright); run `npx playwright install chromium` once first
npm run lint
npm run typecheck
npm run build        # production build in dist/
```

Built with Vite, React, TypeScript, Zustand and Zod.

## Deploy to GitHub Pages

1. Push the repo to GitHub. If it is not named `prepline`, change `base` in `vite.config.ts` to `/<repo-name>/`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` builds and deploys the site through `.github/workflows/deploy.yml`. It is live at `https://<your-username>.github.io/prepline/`.

## Data

Everything lives in your browser's localStorage under the key `prepline:v1`. Clearing site data erases it, and it does not sync between browsers or devices. Use **Backup and restore** to export a JSON file now and then.
