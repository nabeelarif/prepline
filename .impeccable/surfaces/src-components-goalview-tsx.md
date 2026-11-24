---
version: 1
slug: 'src-components-goalview-tsx'
primary_target: 'src/components/GoalView.tsx'
related_targets: []
---

# Surface: the app shell and dashboard (Operate)

Scope: the whole signed-in app, led by the plan dashboard. Mode: Operate. Visitor: someone who opens the plan to find the next step and check their pace.

## Direction contract

THESIS: The plan is a trail, and the dashboard shows where you stand on it before it shows anything else. It refuses the stat-tile dashboard: ring, three metric tiles and a banner stacked above the work.

OWN-WORLD: Trailhead. Pine top bar over a cool mist ground (`#F1F4EF`), ink `#15281F`, pine `#1F6B52` for actions and finished work, lake blue for in-progress, summit amber `#F0B43C` only for the single next step, flag red `#A83A25` only for real schedule risk. Newsreader for plan titles and headings, Plus Jakarta Sans for everything operated. Cards are flat sheets with a hairline and a soft offset shadow; phases are camps along the trail; faint contour lines sit behind the plan header and empty states.

STORY: A returning user sees the plan name, one calm line of pace, and the trail with the amber next step, then taps Continue. A new user sees an empty trail inviting a first resource. Nobody sees red on a plan with no progress yet.

FIRST VIEWPORT: Pine bar (logo, five nav items, streak, save state, avatar). Plan header: title with switcher and icon actions on the left, Add Phase and Add Resource on the right. Under it one status line and a full-width progress bar with hours. Next, the Continue card with the amber marker, then the journey trail at full width, filling the fold at 1440px. Resources start below.

FORM: Operate shell kept as a top bar; the world lends type, palette, density and one signature move, the journey trail with an amber next waypoint. seed: none (pinned) — the user chose "Go with A" from three proposed directions.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
