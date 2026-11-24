# Product

<!-- impeccable:product-schema 1 -->

> Written from CLAUDE.md and the repository during an unattended redesign run. Every fact below comes from the repo; none was confirmed in an interview.

## Platform

web

## Users

People preparing for a defined goal on their own time: job interviews, exams, certifications, a new skill. They gather scattered resources (articles, videos, courses, practice sets, projects, habits) and need one place that says what to do next and whether they will make their date. They use it daily, often in short sessions, on a phone as much as a laptop.

## Product Purpose

Road to Goals is a study planner. A plan holds resources with time estimates, optionally grouped into phases, followed along a "preparation journey". Progress is weighted by estimated hours, never by resource count. A plan can have a start date, a deadline and daily hours, and the app reports whether the pace is on track. A study timer, a Today list and a streak heatmap support daily use. Plans can be shared (private, unlisted or public in Explore) and copied; only plan content is ever shared, never progress or dates.

## Positioning

The journey is the product: the plan is a path with a next step, and progress is measured in hours of real work. A task list or a course catalogue does not show a goal as a road with a deadline.

## Operating Context

Signed-in app on Supabase (Postgres with row-level security) behind backend-independent repository interfaces, deployed as a static site to GitHub Pages at roadtogoals.com. Explore and shared plans work signed out. Data entered by the user is arbitrary in length and language.

## Capabilities and Constraints

- Hard constraints live in CLAUDE.md: layered architecture, tokens in `src/styles/tokens.css`, `responsive.css` last, router addresses in `src/routes.ts`, importable plan files and saved data must keep loading, no browser-storage fallback.
- Dark mode follows the OS unless `[data-theme]` overrides it (set from the account menu).
- Resource types: read, watch, listen, course, practice, project, workout, habit, task, other. Each has a colour.
- Terminology: a plan is `Goal` in code; resources are not "lessons"; "journey" is the path view; "phase" is an optional group.

## Brand Commitments

Name "Road to Goals" (formerly Prepline). The existing "R" road logo (`src/assets/logo.png`, a dark green square) stays.

## Evidence on Hand

`docs/examples/ios-interview-prep.json` is a real importable plan. There are no testimonials, customer counts or metrics, and none may be invented.

## Product Principles

1. The next step is always findable within a second.
2. Progress is honest: hours, not counts. A fresh plan never looks like a failure.
3. Calm under pressure: warnings name the fix, and colour carries state, not alarm.
4. Everything works with a keyboard and on a phone, in light and dark.
5. A user's own data is theirs: nothing about progress leaves the plan owner.

## Accessibility & Inclusion

Target WCAG 2.2 AA: 4.5:1 text contrast, visible focus, 24px minimum targets with 44px on touch, reduced motion honoured, status never by colour alone.
