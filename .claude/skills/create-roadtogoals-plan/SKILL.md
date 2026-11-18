---
name: create-roadtogoals-plan
description: Create or convert learning plans into importable Road to Goals (formerly Prepline) version 1 JSON files when the user supplies a topic, outline, resources, or planning instructions.
metadata:
  version: '1.1.0'
---

# Create a Road to Goals plan

Read [the authoritative format and planning rules](references/agent-plan-format.md) before generating a plan, and keep to that import contract exactly. The reference is bundled with this skill; do not depend on a previous chat or an attachment. It is copied from `docs/agent-plan-format.md` in the app repository (`npm run sync-skill`), so never edit the copy by hand.

## Ask first

Accept a topic or an existing outline, syllabus, resource list, or written plan. Map supplied content into plans, phases and resources rather than replacing the user's intent. Honor requested level, priorities, language and free/paid preferences.

Ask **once**, in one short message, for anything not already known:

- Topic, level and language.
- Daily study hours (optional).
- Description (optional).
- Target date (optional). Without one the plan arrives "Not started" with no deadline. If a date is given, it must be in the future: clarify a past or same-day date.
- Who can open the plan: **Private** (the default), **Anyone with the link**, or **Public in Explore**.
- If shared: up to 5 tags. Suggest some. Lowercase, 24 characters or fewer.
- Free or paid preference.

Use the user's local current date, never the example's. Use answers already in the conversation. If asking is impossible, apply the reference's fallbacks and say so in the plan's `description`. Never ask for a display name: the author shown is the one on the user's account.

## Build

Research resources and open every included URL during the current task. Never invent URLs or claim verification without opening the page. Replace an inaccessible, login-blocked or unverifiable resource with a verifiable one, or hold it for clarification. Empty URLs are only for genuinely offline practice or materials. Use the source's real title. Paid items say "Paid." in notes.

Follow the reference's types, estimates, field limits, ordering and phase colors. Use phases for plans with about 8 or more resources, and give each phase description a rough hours total. Keep each phase's resources contiguous. Scope large courses to named sections and align minutes to that scope. Avoid duplicated content and double-counted effort. Only when the plan has both a `targetDate` and numeric `hoursPerDay`, keep total minutes within 80% of capacity (calendar days from today to the target, without an extra day).

New plans omit all progress and timestamp keys (`done`, `doneMinutes`, `doneAt`, `startedAt`, `loggedOn`, `loggedMinutes`, `createdAt`, `startDate`). Include only supported keys. Add `sharing: { "visibility": "unlisted" | "public", "tags": [...] }` only when the plan is not private. Use unique stable strings for phase IDs, and make every `phaseId` resolve within the same plan.

## Stamp the file

Set top-level `exportedAt` to the user's current local time with its UTC offset (for example `2026-11-18T14:32:05-05:00`). Set `generatedBy` to `{ "tool", "model", "skill" }`: the AI and model you actually are (leave a key out if unsure, never guess) and `skill` to `create-roadtogoals-plan` plus this skill's `metadata.version`. These show as "Created" and "Made by" on the import review and are not stored.

## Validate and deliver

Before delivery, parse the JSON and check: root `version` is 1 with a `goals` array, a valid `exportedAt`, and `generatedBy` holding only the keys the reference lists, as short text; required fields and types; integer minute bounds; string limits; `targetDate` absent or a valid future date; allowed colors and resource types; unique IDs and resolving phase references; `sharing` absent or valid, with at most 5 tags; no progress keys; the capacity rule above. If the app repository is available, also run the file through `previewImport()` and require no repairs (`notes` empty). The example `docs/examples/ios-interview-prep.json` shows a clean file. If execution tools prevent programmatic validation, say so; do not claim it ran. Keep the evidence of the link checks. If research access is unavailable, ask for verified source material or report the limitation instead of fabricating a researched plan.

Deliver a UTF-8 file named `roadtogoals-plan-<topic>.json`, containing only JSON (no Markdown fences or commentary). Keep the reply brief: link the file, mention substantial scope omissions, and give the import path **My Plans → Import plan → Choose File → Add to My Plans**. Add one line on sharing when it is on: the import screen lists "Will be shared" for confirmation, and a public plan is listed in Explore once it has a resource. Do not claim to have imported or synced anything: this skill creates import files and has no live connection to the app.
