---
status: resolved
trigger: "on my tasks page (maybe on other places as well, i dont know), when i have the task sidebar open, i can scroll past the content on the bottom. Maybe some element is not closed? figure out what is happening and ifx it"
created: 2026-11-12
updated: 2026-11-12
---

## Symptoms
- expected: scrolling stops at the end of the page content
- actual: with the peek (task sidebar) open on My Tasks, scrolling continues into blank space below the content
- errors: none reported
- timeline: unknown
- reproduction: My Tasks → open a task in the peek panel → scroll to bottom

## Current Focus
hypothesis: width-dependent `@max-[860px]:sr-only` labels (MyTaskRow Flagged / MR chips) become position:absolute once the peek narrows <main>; no positioned scroll ancestor → they extend an outer scroll height (same family as sr-only-scroller-needs-relative, 4fb10333)
test: probe.js in the real WKWebView — which element over-scrolls, what is its lowest descendant
expecting: lowest descendant is an sr-only span (position:absolute) far below the in-flow content
next_action: get probe output from the running app

## Evidence
- timestamp: 2026-11-12 — MyTaskRow.tsx:343,363 use `@max-[860px]:sr-only`; MyTasksPage list scroller and <main> are not positioned
- timestamp: 2026-11-12 — synthetic repro (nested non-positioned scrollers + Tailwind v4 sr-only) in Playwright WebKit 2370 and Chromium: document/main scrollHeight NOT inflated → hypothesis unconfirmed in synthetic layout

## Eliminated

## Resolution
root_cause: `@max-[860px]:sr-only` labels in MyTaskRow turn position:absolute once the peek narrows <main> below 860px; with no positioned scroll ancestor they resolved against an outer containing block and extended its scroll height into blank space (same family as 4fb10333). Synthetic Playwright repro did not inflate scrollHeight, so the real WKWebView layout differs — confirmed by user in-app.
fix: `relative` on <main> (app-wide safety net), the My Tasks list scroller, and the AIO cycle detail scroller
verification: user confirmed in app (approved 2026-11-12)
files_changed: taskflow/src/main.tsx, taskflow/src/routes/my-tasks/MyTasksPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
