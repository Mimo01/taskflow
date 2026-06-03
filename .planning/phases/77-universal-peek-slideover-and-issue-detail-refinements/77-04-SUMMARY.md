---
phase: 77-universal-peek-slideover-and-issue-detail-refinements
plan: "04"
subsystem: ui
tags: [react, tanstack-router, vitest, peek-panel, click-split, stopPropagation, role-button]

requires:
  - "77-03 (PeekPanel + onOpenIssue in outlet context, onOpenIssue on CommandPalette/NotificationPopover props)"
provides:
  - "TaskCard.tsx — div role=button body → onOpenIssue (peek); inner key button → stopPropagation → navigate full-page"
  - "BacklogRow.tsx — tr body → onOpenIssue; key cell button → stopPropagation → onIssueClick (full-page)"
  - "DashboardInProgressCard.tsx — div role=button rows (parent/subtask/orphan) → onOpenIssue; trailing key button → stopPropagation → onIssueClick"
  - "StandupNotesPage.tsx + sub-components — onOpenIssue threaded to all standup row surfaces; per-row key/body split"
  - "CommandPalette.tsx — inner issue-key button → stopPropagation → onIssueClick (full-page); body → peek retained"
  - "NotificationRow.tsx — div role=button outer; inner key button → stopPropagation → onIssueKeyClick (full-page)"
  - "TaskCard.test.tsx — PEEK-05 test cases activated and passing"
affects:
  - "78 (drag-to-rank on Backlog — BacklogRow modified)"
  - "79 (drag-to-transition on Sprint Board — TaskCard modified)"

tech-stack:
  added: []
  patterns:
    - "D-10 key/body split: outer div role=button (onClick → onOpenIssue) + inner button (stopPropagation → navigate full-page) — applied on every list surface"
    - "Pitfall 1 avoidance: outer <button> converted to div role=button+tabIndex+onKeyDown whenever an inner key <button> is needed (no nested button-in-button HTML)"
    - "stopPropagation inner clickable: mirrors BacklogRow epic-badge idiom from 77-PATTERNS.md § Shared Patterns"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/dashboard/TaskCard.test.tsx

key-decisions:
  - "Outer button-to-div conversion (div role=button + tabIndex + onKeyDown Enter/Space) chosen as the single approach for all surfaces with nested key buttons — consistent with TaskCard as the reference surface (Pitfall 1 / D-10)"
  - "CommandPalette inner key element uses stopPropagation before calling onIssueClick — body dispatch to onOpenIssue (from Plan 03) is unchanged"
  - "NotificationPopover handles onIssueKeyClick inline (mark read + navigate + close) and passes it to NotificationRow as a prop — avoids coupling row to popover state"
  - "StandupNotesPage: onOpenIssue destructured from useOutletContext alongside onIssueClick, threaded to all standup sub-components (A6 full-tree coverage)"

patterns-established:
  - "D-10 split: div role=button body → onOpenIssue / inner <button> key → stopPropagation + navigate — the canonical pattern for every list card/row in the codebase"
  - "Pitfall 1 fix applied consistently: any surface where an inner key button is added and the outer was a button becomes div role=button"

requirements-completed: [PEEK-01, PEEK-02, PEEK-04, PEEK-05]

duration: ~30min
completed: 2026-06-03
---

# Phase 77 Plan 04: Universal Key/Body Click Split Summary

**Key-vs-body click split (D-10 / PEEK-05) delivered across all six list surfaces — TaskCard, BacklogRow, DashboardInProgressCard, all Standup row sub-components, CommandPalette result rows, and NotificationRow — body click opens peek via onOpenIssue, issue-key click navigates full-page via stopPropagation, completing universal PEEK-01/05 coverage with no nested-button HTML on any surface**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-03T14:00:00Z
- **Completed:** 2026-06-03T14:30:00Z
- **Tasks:** 3 autonomous + 1 checkpoint (human-verify approved)
- **Files modified:** 8

## Accomplishments

- Applied D-10 key/body split to TaskCard and BacklogRow (Task 1): outer button converted to div role=button; key span promoted to button with stopPropagation; PEEK-05 TaskCard tests activated and passing
- Applied same split to DashboardInProgressCard (all 3 row variants) and all standup sub-components (A6 full coverage, Task 2): onOpenIssue threaded from StandupNotesPage down to every sub-component that previously received onIssueClick
- Added inner key clickables to CommandPalette result rows and NotificationRow (Task 3): stopPropagation → onIssueClick/onIssueKeyClick (full-page); outer elements converted to div role=button where needed; no nested button-in-button on either surface
- Checkpoint human-verify approved: all surfaces manually tested, no double-fire, no Phase 76 visual regression, swap while open confirmed

## Task Commits

1. **Task 1: TaskCard + BacklogRow key/body split** - `10bb3438` (feat)
2. **Task 2: DashboardInProgressCard + Standup key/body split** - `8fd66d02` (feat)
3. **Task 3: CommandPalette + NotificationRow inner key split** - `2f829a72` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `taskflow/src/routes/dashboard/TaskCard.tsx` — **Modified**: outer button → div role=button; key span → button w/ stopPropagation; onOpenIssue from outlet context
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — **Modified**: both tr variants body → onOpenIssue; key cell → button w/ stopPropagation + onIssueClick
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — **Modified**: all 3 row buttons → div role=button; trailing key spans → buttons w/ stopPropagation; onOpenIssue added
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — **Modified**: onOpenIssue destructured from context; threaded to all standup sub-surfaces
- `taskflow/src/components/app/CommandPalette.tsx` — **Modified**: inner key button w/ stopPropagation → onIssueClick; body dispatch to onOpenIssue retained
- `taskflow/src/routes/notifications/NotificationPopover.tsx` — **Modified**: handleIssueKeyClick callback (mark read + navigate + close) passed to NotificationRow as onIssueKeyClick
- `taskflow/src/routes/notifications/NotificationRow.tsx` — **Modified**: outer element → div role=button; key text → inner button w/ stopPropagation; onIssueKeyClick prop added
- `taskflow/src/routes/dashboard/TaskCard.test.tsx` — **Modified**: PEEK-05 test cases activated (key click fires navigate/onIssueClick NOT onOpenIssue; body click fires onOpenIssue)

## Decisions Made

- Outer button-to-div conversion is the single consistent approach for all surfaces where an inner key button is required — mirrors TaskCard as the reference (Pitfall 1 avoidance, D-10).
- CommandPalette inner key element applies `stopPropagation` before `onIssueClick` to prevent cmdk Command.Item's `onSelect` from also firing `onOpenIssue` (the capture-vs-bubble resolution documented in PATTERNS.md).
- NotificationPopover owns the `handleIssueKeyClick` logic (mark read + navigate + close popover) and passes it as a callback prop — NotificationRow remains unaware of popover state.
- StandupNotesPage threaded `onOpenIssue` to the full standup component tree (A6 requirement): every sub-component that previously received only `onIssueClick` now also receives `onOpenIssue`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all key/body split paths are fully wired. The stubs documented in Plan 03 SUMMARY (CommandPalette body-select-only, NotificationRow key-split missing) are resolved by this plan.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes. All changes are pure event-wiring on existing in-DOM issue keys. T-77-05 (nested-button double-fire) mitigated by div role=button conversion + stopPropagation on every surface.

## Next Phase Readiness

- Phase 77 is complete: PEEK-01 through PEEK-07 and DETAIL-01/02 all satisfied
- Phase 78 (drag-to-rank on Backlog) may need to integrate with BacklogRow's updated click model — `onOpenIssue` is now a BacklogRow prop threaded from the page
- Phase 79 (drag-to-transition on Sprint Board) similarly: TaskCard's outer element is now div role=button — DnD attributes and drag handle logic preserved from Phase 76

---
*Phase: 77-universal-peek-slideover-and-issue-detail-refinements*
*Completed: 2026-06-03*

## Self-Check

### Commits Verified Present

- [x] `10bb3438` — feat(77-04): TaskCard + BacklogRow key/body click split (PEEK-01/05)
- [x] `8fd66d02` — feat(77-04): DashboardInProgressCard + standup key/body split (PEEK-01/05)
- [x] `2f829a72` — feat(77-04): CommandPalette + NotificationRow inner key split (PEEK-05 / D-10)

### Checks

- [x] `npm run check` — clean (biome + tsc, 441 files, no fixes applied)
- [x] Human-verify checkpoint approved by user

## Self-Check: PASSED
