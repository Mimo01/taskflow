---
phase: quick-260330-wj6
plan: 01
subsystem: ui
tags: [react, tailwind, sprint-board, hover-states, affordances]

requires: []
provides:
  - Sprint board task cards with cursor-pointer, hover background tint, and issue key underline on hover
  - Story header rows with cursor-pointer and issue key underline on hover of clickable area

affects: [sprint-board, task-card, story-header]

tech-stack:
  added: []
  patterns:
    - "Tailwind group + group-hover:underline for link-like key affordance on compound hover targets"
    - "hover:bg-accent/50 for subtle card hover background (avoids misleading border highlight)"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx

key-decisions:
  - "hover:bg-accent/50 used instead of hover:border-primary/50 — border highlight was misleading for a right-click context menu target"
  - "group + group-hover:underline pattern on parent/key-span pair signals clickability without underling entire card"

patterns-established:
  - "group/group-hover:underline: attach group to clickable container, group-hover:underline to the key span for link-like affordance"

requirements-completed: []

duration: 5min
completed: 2026-03-30
---

# Quick 260330-wj6: Better Communicate Sprint Board Clickability Summary

**Subtle bg-tint hover + issue-key underline on sprint board cards and story headers, using Tailwind group pattern**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-30T00:00:00Z
- **Completed:** 2026-03-30T00:00:00Z
- **Tasks:** 1 (+ 1 checkpoint awaiting human verify)
- **Files modified:** 2

## Accomplishments

- TaskCard: replaced misleading `hover:border-primary/50` with subtle `hover:bg-accent/50`, added `group` class and `group-hover:underline` on issue key
- StoryHeaderRow: added `group cursor-pointer` to the key+summary button, added `group-hover:underline` to story key span
- Preserved right-click context menu behavior (no visual changes to border/outline behavior)

## Task Commits

1. **Task 1: Add clickability affordances to TaskCard and StoryHeaderRow** - `2b7beb9` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/TaskCard.tsx` - Hover bg tint + group + issue key underline
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` - group cursor-pointer + story key underline

## Decisions Made

- Used `hover:bg-accent/50` instead of restoring `hover:border-primary/50` — the original removal (commit 74ef958) was intentional because the border highlighted the wrong interaction (right-click menu vs left-click navigation). Background tint is a more neutral affordance.
- `group`/`group-hover:underline` pattern chosen over always-underline to keep the UI clean when not hovered.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Visual affordances are in place. Human verification step (Task 2 checkpoint) remains pending — user should confirm in the running app that hover states and left-click behavior look and work correctly.

---
*Phase: quick-260330-wj6*
*Completed: 2026-03-30*
