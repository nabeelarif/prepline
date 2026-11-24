---
name: Road to Goals
description: A study planner drawn as a trail, with one amber step to take next.
colors:
  pine: '#1F6B52'
  pine-deep: '#123D2F'
  pine-text: '#1A5E48'
  pine-wash: '#DCEBE2'
  lake: '#276C8C'
  lake-wash: '#DAE9F0'
  summit: '#F0B43C'
  summit-ink: '#15281F'
  flag: '#A33723'
  flag-wash: '#F5DDD5'
  mist: '#F1F4EF'
  paper: '#FBFCFA'
  moss-mist: '#E8EDE6'
  ink: '#15281F'
  stone: '#4F6158'
  hairline: '#D3DBD0'
  control-edge: '#6F8377'
typography:
  display:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: '2.125rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.015em'
  headline:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: '1.625rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.01em'
  title:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.86rem'
    fontWeight: 600
    lineHeight: 1.3
rounded:
  xs: '6px'
  sm: '8px'
  md: '10px'
  lg: '14px'
  pill: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  xxl: '48px'
components:
  button-primary:
    backgroundColor: '{colors.pine}'
    textColor: '{colors.paper}'
    rounded: '{rounded.sm}'
    padding: '8px 16px'
    height: '40px'
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '8px 16px'
    height: '40px'
  card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '22px 26px'
  top-bar:
    backgroundColor: '{colors.pine-deep}'
    textColor: '{colors.pine-wash}'
    padding: '10px 28px'
  chip-selected:
    backgroundColor: '{colors.pine}'
    textColor: '{colors.paper}'
    rounded: '{rounded.pill}'
    height: '32px'
  next-tag:
    backgroundColor: '{colors.summit}'
    textColor: '{colors.summit-ink}'
    rounded: '{rounded.pill}'
---

# Design System: Road to Goals

## Overview

**Creative North Star: "The Trailhead"**

A study plan is a road with a date at the end of it, so the interface is drawn like a trail map kept in a field notebook: a deep pine bar, a cool mist ground, serif plan titles, and a path of waypoints. Finished stretches of the path are solid pine. What is left is a line of dotted footprints. Exactly one waypoint is amber: the next step. The system exists to make that one step findable in a second, and to keep everything else calm.

It is a working product, so the world lends type, palette, density and one signature move, the trail. Navigation and controls stay standard (top bar, buttons, menus, tabs). Faint topographic contour lines sit behind the plan header, the empty states and the sign-in aside; nowhere else.

**Key Characteristics:**

- Pine does the work (actions, finished steps, shell). Lake blue means in progress. Amber means next. Red means real schedule risk, and only that.
- Serif for what is named (plans, phases, headings); a humanist sans for everything operated.
- Flat sheets with a hairline edge. Depth comes from tint and a soft offset shadow, never from blur or glow.
- Dark mode is a re-lit version of the same trail, not an inversion.

## Colors

A green-grey field with a pine shell, one cool blue, one warm amber and one brick red, each with a single job.

### Primary

- **Pine** (#1F6B52): buttons, links, selected chips, finished steps, the progress bar. Its text variant **Pine Text** (#1A5E48) is used for small text on tinted grounds.
- **Deep Pine** (#123D2F): the top bar and the sign-in aside.

### Secondary

- **Lake** (#276C8C): in-progress status, the ring around an active step, partial progress bars.

### Tertiary

- **Summit Amber** (#F0B43C): the next step only: its journey marker, its tag, and the ring around the Continue card. Text on it is **Summit Ink** (#15281F).
- **Flag Red** (#A33723): behind schedule, destructive actions, form errors.

### Neutral

- **Mist** (#F1F4EF): page ground. **Paper** (#FBFCFA): cards and dialogs. **Moss Mist** (#E8EDE6): inset wells, phase bands, tracks.
- **Ink** (#15281F): text. **Stone** (#4F6158): secondary text (5.95:1 on Mist).
- **Hairline** (#D3DBD0): card and divider edges. **Control Edge** (#6F8377): the edge of inputs and buttons (3.9:1 on Paper).
- Resource types and phases keep their own colours (`--t-*`, `--ph-*`), tuned so every type label reads at 4.5:1 or better on all three grounds.

### Named Rules

**The One Amber Rule.** Amber marks the next step and nothing else. If two things on a screen are amber, one of them is wrong.

**The No-Alarm Rule.** Red appears only when the pace maths says the date is at risk. A plan with no progress yet is never red.

**The Token Rule.** Colours come from the custom properties in `tokens.css`. A literal colour in a component is a bug.

## Typography

**Display Font:** Newsreader (with Georgia, serif)
**Body Font:** Plus Jakarta Sans (with system-ui, sans-serif)

**Character:** a bookish serif for the things a person names, set against a clear, slightly warm sans for the things they press. Both load from Google Fonts with `display=swap`.

### Hierarchy

- **Wordmark** (600, 1.4rem): "Road to Goals" in the top bar and the sign-in aside.
- **Display** (600, 2.125rem, 1.15): plan title, page titles.
- **Headline** (600, 1.625rem, 1.2): card headings, empty-state titles, sheet titles.
- **Title** (600, 1.25rem, 1.25): phase names, the Continue card's resource, plan card titles.
- **Body** (400, 0.9375rem, 1.55): everything else. Prose is held to 60 to 75 characters.
- **Label** (600, 0.86rem): chips, status pills, form labels, metadata. Sentence case; no tracked capitals.

### Named Rules

**The Tabular Rule.** Every figure that changes or sits in a column uses tabular numerals.

**The No Eyebrow Rule.** A heading carries its own weight. No small capitalised label above it.

## Layout

A single centred column, 1180px at most, on a 4px-based scale (4, 8, 12, 16, 24, 32, 48). Below the top bar, the dashboard reads in one order: plan header and progress, the Continue card, the trail, the pace and mix behind it, then the resource list. At 1440 by 900 the first three fit the first screen.

The journey is a snake on wide screens (five columns above 900px, then four, three) and a vertical stepper below 560px. Below 680px the top bar folds behind a hamburger, menus open as bottom sheets so none can run off the edge, dialogs become bottom sheets below 560px, and the resource table becomes stacked cards. Touch targets are 44px wherever the pointer is coarse.

## Elevation & Depth

Flat by default. Cards are a hairline and a faint offset shadow (`0 1px 0 rgba(21,40,31,.04), 0 2px 8px rgba(21,40,31,.06)`). Menus, toasts, the timer and dialogs lift with one larger soft shadow (`0 14px 44px rgba(14,30,23,.2)`) and a stronger edge. The next-step Continue card adds a 3px amber ring at low opacity: a ring with an offset, not a glow.

### Named Rules

**The No-Glow Rule.** No zero-offset coloured halos, no blur as decoration, no gradients.

## Shapes

Radii form a short scale (heat-map cells and thin progress bars are the exceptions: 2px cells, fully rounded bars): 6px (menu items), 8px (buttons, inputs), 10px (rows, menus), 14px (cards, dialogs), full pill (chips, tags, status). Markers on the trail and phase camps are circles. Nothing wears a one-sided coloured edge; a state is a full border, a tint, or a leading dot.

## Components

### Buttons

- **Shape:** gently rounded (8px), 40px tall, 44px on touch.
- **Primary:** Pine fill, Paper text. **Secondary:** Paper fill, Control Edge border. **Ghost:** no fill until hover.
- **Hover / Focus:** primary darkens toward Ink; secondary tints to Moss Mist and darkens its border; focus is a 2px Pine outline with a 2px offset (white on the top bar).

### Chips and segmented controls

- Chips are pills with a Control Edge border; the selected chip fills Pine. The segmented control sits in a Moss Mist well and lifts the selected option onto Paper.

### Cards

- **Corner Style:** 14px. **Background:** Paper. **Border:** Hairline. **Padding:** 22px by 26px (16px on phones). Cards are never nested.

### Inputs / Fields

- 42px tall, Control Edge border, Paper fill, 8px radius. Hover darkens the edge to Ink; focus is a 2px Pine outline and a Pine edge. Errors are Flag Red text linked to the field.

### Navigation

- A Deep Pine bar with the wordmark in Newsreader, five labelled destinations, the streak, a save-state icon and the avatar. The current page is a Pine pill with white text. A skip link is the first tab stop.

### The Trail (signature)

- Steps sit on one SVG path. Finished stretches are 4px solid Pine; upcoming ones are dotted Hairline-strong footprints. Done steps are Pine circles with a check; the active step is a Lake ring holding its number; the next step is an Amber circle with a double ring and a "Next up" tag. Phases appear as camps (a coloured dot) in the same grammar.

### Study timer

- A pill fixed at the bottom of the screen with a tabular clock, what is being timed, Stop and Discard. Pages leave 112px of room under their content so it never covers the last row.

## Do's and Don'ts

### Do:

- **Do** use amber for the single next step and pine for finished work.
- **Do** keep red for real schedule risk, and word it with a way out ("Raise your daily hours or move the target date").
- **Do** set plan and phase names in Newsreader and operate everything in Plus Jakarta Sans.
- **Do** give every control a 40px target (44px on touch) and a visible 2px focus ring.
- **Do** read colours from `tokens.css` and keep the light, OS-dark and `[data-theme='dark']` blocks in step.

### Don't:

- **Don't** add a gradient, a glow, glass or a decorative blur.
- **Don't** put a coloured bar down one side of a rounded box. Use a tint, a full border, or a leading dot.
- **Don't** place a small capitalised label above a heading.
- **Don't** nest cards, or turn the trail into a row of identical tiles.
- **Don't** show red, or the word "behind", for a plan that has no progress yet.
