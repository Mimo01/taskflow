---
phase: 18-app-icon-multi-page-settings
plan: 06
subsystem: ui
tags: [tailwind, density, css-variants, sprint-board, sidebar, task-rows]

# Dependency graph
requires:
  - phase: 18-04
    provides: density-compact and density-comfortable CSS @variant declarations in index.css
  - phase: 18-05
    provides: AppearanceSection density selector that writes data-density attribute to html element
provides:
  - density-aware vertical padding on TaskRow, BacklogRow, MrRow, Sidebar nav items, and TaskCard (sprint board)
  - scrollable sidebar nav that remains usable at comfortable density
  - Debug settings promoted to top-level Advanced section in Settings sidebar
affects:
  - 19-keyboard-foundation
  - future ui plans that touch row/card components

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "density variant pattern: py-N density-compact:py-[N/2] density-comfortable:py-[N*1.5] on row/card containers"
    - "For table rows (BacklogRow), apply density variants per-cell since tr does not support CSS padding"
    - "TaskCard uses px-2 py-2 split (not shorthand p-2) to allow vertical-only density overrides"
    - "Sidebar nav list wrapped in overflow-y-auto to remain scrollable when comfortable density expands items beyond viewport"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/MrRow.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx

key-decisions:
  - "Files are in src/routes/dashboard/ and src/components/app/ — not the paths listed in plan frontmatter (plan had stale paths from earlier phase architecture)"
  - "BacklogRow uses table markup (tr/td) — density applied per td cell since tr ignores CSS padding"
  - "TaskCard p-2 split to px-2 py-2 so density variants only affect vertical axis, preserving horizontal card padding"
  - "Sprint board cards use TaskCard.tsx (shared with DragOverlay) — applying density there covers both DraggableCard and the drag overlay"
  - "Sidebar nav wrapped in overflow-y-auto to stay scrollable at comfortable density; Debug promoted to top-level Advanced section"

patterns-established:
  - "Density variant rollout pattern: find py-N baseline, add density-compact:py-[half] density-comfortable:py-[1.5x]"
  - "Sidebar scroll: always wrap nav lists in overflow-y-auto when items may grow with density"

requirements-completed:
  - SETTINGS-03

# Metrics
duration: ~30min
completed: 2026-03-15
---

# Phase 18 Plan 06: Density Variant Rollout Summary

**density-compact:/density-comfortable: Tailwind variants applied to all 5 major list and card surfaces (TaskRow, BacklogRow, MrRow, Sidebar nav, SprintBoard cards) enabling immediate visual density changes from Settings > Appearance — human visual check approved**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-15T19:14:32Z
- **Completed:** 2026-03-15
- **Tasks:** 3 of 3 complete (including human checkpoint — approved)
- **Files modified:** 5

## Accomplishments
- TaskRow, MrRow: density variants on outer row container (py-2 baseline, compact py-1, comfortable py-3)
- BacklogRow: density variants applied per-cell (table tr/td layout requires per-cell approach)
- Sidebar nav: density variants in shared NAV_LINK_CLASS constant — all nav links updated in one change; nav list made scrollable to handle comfortable density expansion
- TaskCard (sprint board): p-2 split to px-2 py-2 + density variants, covers DraggableCard and DragOverlay
- Human visual check passed: density selector changes spacing across all 5 surfaces with no page reload; density persists across route changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply density variants to list rows and sidebar nav** - `0a2dad1` (feat)
2. **Task 2: Apply density variants to sprint board cards** - `856d99a` (feat)
3. **Checkpoint reached** - `0535556` (docs)
4. **Fix: scrollable sidebar nav + Debug to Advanced section** - `edac5be` (fix)
5. **Fix: main sidebar nav scrollable in comfortable density** - `70ce28c` (fix)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `taskflow/src/routes/dashboard/TaskRow.tsx` - py-2 density-compact:py-1 density-comfortable:py-3 on flex row container
- `taskflow/src/routes/dashboard/BacklogRow.tsx` - density variants on all 6 td cells
- `taskflow/src/routes/dashboard/MrRow.tsx` - py-2 density-compact:py-1 density-comfortable:py-3 on outer div
- `taskflow/src/components/app/Sidebar.tsx` - density variants in NAV_LINK_CLASS constant + overflow-y-auto scroll container
- `taskflow/src/routes/dashboard/TaskCard.tsx` - p-2 split to px-2 py-2 + density compact/comfortable variants

## Decisions Made
- Files are at `src/routes/dashboard/` and `src/components/app/` — plan frontmatter listed stale paths from earlier phase
- BacklogRow uses `<tr><td>` markup; applied density variants per-cell since CSS `py-*` has no effect on `<tr>`
- Split `p-2` → `px-2 py-2` in TaskCard to isolate vertical padding for density variants without affecting horizontal spacing
- Sidebar nav list wrapped in `overflow-y-auto` to remain usable when comfortable density grows nav items past viewport height
- Debug section promoted to standalone Advanced top-level section in Settings sidebar (alongside Connections, Appearance, Notifications, Workflow, Role) for improved discoverability

## Deviations from Plan

### Path Deviation (Non-blocking)
The plan frontmatter listed files at `src/routes/developer/`, `src/routes/sprint/`, and `src/components/MrRow.tsx`. The actual files are at `src/routes/dashboard/` and `src/components/app/Sidebar.tsx`. Applied density variants to the correct actual paths.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sidebar nav overflow at comfortable density**
- **Found during:** Post-checkpoint human visual verification
- **Issue:** Comfortable density expanded sidebar nav items such that bottom items were pushed off-screen
- **Fix:** Wrapped sidebar nav list in `overflow-y-auto` scroll container; promoted Debug to top-level Advanced section so it has a stable sidebar slot
- **Files modified:** `taskflow/src/components/app/Sidebar.tsx`
- **Verification:** Human visual check confirmed sidebar is scrollable and all items reachable at comfortable density
- **Committed in:** `edac5be`, `70ce28c`

---

**Total deviations:** 1 path mapping (non-blocking) + 1 auto-fixed bug (sidebar scroll overflow)
**Impact on plan:** No scope change. All 5 surfaces updated as planned. Scroll fix necessary for usability at comfortable density.

## Issues Encountered
- Pre-existing TypeScript errors in SprintBoardTab.test.tsx (7 TS errors) and unhandled test errors in TopBar.test.tsx/NotificationPopover.test.tsx/gitlab.test.ts (18 errors) — pre-existing, out of scope. Logged to deferred-items.
- 34/34 test files pass, 401/401 tests pass — no regressions from this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 18 complete — all 6 plans executed and human-approved
- Phase 19 (Keyboard Foundation) ready to begin: install `react-hotkeys-hook@^5.2.4`, audit all `window.addEventListener('keydown')` calls before adding shortcuts

---
*Phase: 18-app-icon-multi-page-settings*
*Completed: 2026-03-15*
