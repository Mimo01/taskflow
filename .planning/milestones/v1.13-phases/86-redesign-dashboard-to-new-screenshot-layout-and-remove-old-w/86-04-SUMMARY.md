---
plan: 86-04
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
status: complete
type: execute
wave: 3
requirements: [D-10, D-14]
tasks_total: 1
tasks_done: 1
---

# 86-04 — Human UAT: dashboard redesign in Tauri WebKit

## Outcome

**Approved by user** after iterative UAT. The redesigned dashboard renders correctly
in the real Tauri WebKit runtime and matches the intended design across all three
regions (hero greeting, My Issues + Upcoming Releases cards, Past-7-days hours/commits
chart). Assumptions A1 (Recharts `responsive` on the diverging chart) and A2
(WebKit-rendered labels) are resolved.

This was a `checkpoint:human-verify` plan — no production code was planned, but UAT
surfaced a substantial set of visual/behavioral refinements that were applied inline
across 16 review rounds and committed under `fix(86-04)`.

## What changed during UAT (inline fixes)

**Hero**
- Restored the centered `text-6xl` greeting over the ambient orange/cyan curve background.
- Sprint-day subline counts working days only (weekends excluded; holidays via a
  `SPRINT_HOLIDAYS` extension point — not yet fed from the Tempo schedule). Start day = 0,
  so it reads e.g. "Sprint day 3 of 9". On a non-working day it reads
  "Weekend · sprint resumes Monday, D Mon".

**My Issues card**
- `ListChecks` ambient icon (size-22), bigger/bolder muted title, no subtitle.
- Thicker segmented bar; bigger/bolder legend with square swatches; app-palette
  colors (slate / blue-500 / green-500).

**Upcoming Releases card**
- Reference horizontal timeline restored: left-aligned items, dots on the left, first
  dot solid + remaining hollow, orange-only accent (closest release: solid orange dot,
  orange connector to the 2nd dot, orange due date), grayscale readiness bars
  (current release darker), trailing stub after the last dot. `Rocket` ambient icon.

**Hours & Commits chart**
- Single diverging chart: hours bars up (blue-500), commits down (green-500),
  normalized per-side so the two halves are visually comparable.
- Decluttered: no left axis labels, only 0 + max guide lines; no special "today" styling.
- Value labels rendered via a Recharts v3 child using `usePlotArea` + `useYAxisScale`
  so every day (including 0-value days with no bar) is labelled, centered over its
  column, hours above / commits below each bar. Grey labels, no-wrap legend.

**All three cards**
- Clickable (hover bg + colored ring + shadow, keyboard + focus ring, pointer over the
  chart SVG): My Issues → /my-tasks, Releases → /releases, Hours&Commits → /worklogs
  (or /sprint-board when Tempo is off), via a shared `clickableCard` helper.

## Verification

- `npm run check` (biome + tsc) GREEN
- Dashboard test suite: 593 passing (2 skipped)
- User sign-off recorded (this UAT) — D-10 / D-14, Assumptions A1 / A2 satisfied

## Known follow-ups (non-blocking)

- **Holiday exclusion** in the sprint-day counter needs the Tempo work schedule wired
  into the dashboard (currently weekends only; `SPRINT_HOLIDAYS` is an empty extension
  point).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| Human verification of WebKit render + fidelity | APPROVED |
| `npm run check` GREEN | VERIFIED |
| Dashboard tests pass (593) | VERIFIED |
| No new threat surface (verification-only plan) | VERIFIED |
