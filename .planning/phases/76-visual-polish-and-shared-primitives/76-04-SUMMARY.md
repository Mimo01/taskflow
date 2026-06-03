---
phase: 76-visual-polish-and-shared-primitives
plan: "04"
subsystem: ui
tags: [react, tailwind, jira, greenhopper, priority, accessibility, wcag, sprint-board]
dependency_graph:
  requires:
    - phase: 76-01
      provides: isDoneStatus / doneSummaryClass / priorityStripeClass display primitives
  provides:
    - Done-state key strike wired into Backlog, Standup Today, and Dashboard In-Progress surfaces
    - Priority left-edge color stripe on non-subtask sprint board cards
    - Icon-severity priority mapping that handles custom Jira priority schemes
  affects:
    - Phase 78 (drag-to-rank — consumes the same priority surfaces)
    - Future: REST /priority rank-based coloring follow-up
tech_stack:
  added: []
  patterns:
    - Icon-severity priority mapping (derive stripe color from Jira priority icon filename)
    - Graduated WCAG-verified color ramp keyed by severity token
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
    - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
    - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
    - taskflow/src/lib/issueDisplayUtils.ts
    - taskflow/src/lib/issueDisplayUtils.test.ts
    - taskflow/src/services/jira/greenhopper/adapter.ts
    - taskflow/src/services/jira/greenhopper/adapter.test.ts
decisions:
  - "Strike the issue KEY span only (never the summary) across all four list surfaces (D-05/D-06)"
  - "TaskCard done-check refactored to isDoneStatus single source of truth"
  - "Subtask cards keep the muted nesting border and get NO priority stripe (D-04)"
  - "Priority stripe colored by Jira icon severity (priorityUrl filename), not display name — handles this instance's custom scheme (Blocker/Must/Critical/Should/...)"
  - "Graduated severity ramp tuned to the instance order: Blocker>Must>Critical/Should>High>Medium>Low>Lowest>Minor"
  - "Medium stripe uses bright yellow-500/400 (1.92:1 light) — accepted product trade-off over WCAG-legible olive yellow-700, per explicit UX preference"
  - "Critical and Should share highest.svg → share a color; distinguishing them needs REST /priority rank (deferred follow-up)"
requirements_completed: [VISUAL-01, VISUAL-02, VISUAL-03, VISUAL-04, VISUAL-05]
metrics:
  duration: "~checkpoint session"
  completed: "2026-06-03"
  tasks_completed: 3
  files_modified: 9
---

# Phase 76 Plan 04: Wire Display Primitives Into UI Surfaces Summary

**Done-state key strike applied across Backlog/Standup/Dashboard surfaces, and a WCAG-tuned, icon-severity priority color stripe on sprint board cards that correctly handles this Jira instance's custom priority scheme.**

## Performance

- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Completed:** 2026-06-03
- **Files modified:** 9

## Accomplishments

- Key-only `line-through` (via `doneSummaryClass`) wired into BacklogRow, both Standup Today sections, and the Dashboard In-Progress per-story rows (VISUAL-01/02/03).
- TaskCard's inline `statusCategory?.key === 'done'` replaced with `isDoneStatus` (single source of truth).
- `border-l-4` + priority color stripe added to non-subtask sprint board cards; subtasks keep the muted nesting border (VISUAL-04/05).
- Priority stripe colors now reflect the instance's real priority order via icon-severity mapping + a graduated, contrast-verified ramp.

## Task Commits

1. **Task 1: TaskCard — isDoneStatus refactor + priority stripe** - `ebaea273` (feat)
2. **Task 2: doneSummaryClass across list surfaces** - `f6233f2c` (feat)
3. **Task 3: Human-verify checkpoint** — approved after the deviations below.

## Deviations from Plan

The human-verify checkpoint surfaced that the planned palette did not work for this Jira instance. Three deviations were applied and re-verified with the user:

### 1. [Rule 1 - Bug fix] GreenHopper adapter was not populating `fields.priority`
- **Found during:** Task 3 checkpoint — every stripe rendered the neutral-gray default.
- **Issue:** Phase 73 (WR-01) removed `resolvePriority` from the adapter when no consumer existed; the sprint board's `priorityStripeClass(issue.fields.priority?.name)` always saw `undefined`.
- **Fix:** Re-added `resolvePriority(gh.priorityId, entityMaps)` to the adapted fields + regression tests.
- **Committed in:** `dc10c569`

### 2. [Rule 1 - Wrong assumption] Name-keyed palette didn't fit the custom priority scheme
- **Found during:** Task 3 re-check — `High` showed red and custom priorities (`Must`, `Should`, `Critical`, `Needed`) all fell through to gray.
- **Issue:** The UI-SPEC/RESEARCH palette keyed on standard names (Highest/High/Medium/Low/Lowest); this instance uses a custom scheme.
- **Fix:** `priorityStripeClass` now resolves color from the priority icon filename (severity token) first, falling back to the standard-name palette then the neutral default. Accepts a priority object or a bare name.
- **Committed in:** `c45211c5`

### 3. [Rule 1 - UX refinement] Top-tier collapse + Medium shade
- **Found during:** Task 3 re-check — top priorities collapsed onto one red; Medium read as olive/brown.
- **Fix:** Replaced the 4-hue map with a graduated severity ramp (`cbbc5d5d`) giving 8 distinct, ordered, contrast-verified levels tuned to the instance order; then brightened Medium to `yellow-500`/`yellow-400` per explicit UX preference (`8de8c4d2`).
- **Committed in:** `cbbc5d5d`, `8de8c4d2`

---

**Total deviations:** 4 commits across 3 logical fixes. All re-verified at the checkpoint and unit-tested.
**Impact on plan:** VISUAL-04/05 now satisfied for this instance. Scope expanded into `greenhopper/adapter.ts` (Phase 73 file) — out of the plan's declared file list but necessary for the priority stripe to function.

## Known Limitations / Follow-up

- **Same-icon priorities share a color:** `Critical` and `Should` both use `highest.svg`, so color alone cannot separate them. The robust fix is to color by the Jira priority scheme **rank** from `GET /rest/api/2/priority` (which also exposes each priority's configured color) — deferred to a follow-up plan.
- **Medium contrast:** `yellow-500` is 1.92:1 on the white light card (below WCAG 3:1) — a deliberate product trade-off for visual punch.

## Issues Encountered

None beyond the checkpoint-driven deviations above; all resolved and committed.

## Next Phase Readiness

Phase 76 visual polish complete. The priority-rank REST follow-up is the natural next improvement for fully distinct priority colors.

---
*Phase: 76-visual-polish-and-shared-primitives*
*Completed: 2026-06-03*
