---
phase: quick-260922-jtc
plan: 01
subsystem: ui
tags: [react, tailwind, dashboard, sprint-board]

requires: []
provides:
  - SprintBoardHeader restyled to match the Backlog page header band and title treatment
affects: [sprint-board-tab, dashboard-chrome]

tech-stack:
  added: []
  patterns:
    - "Page header band: untinted px-4 py-3 border-b + h1 text-lg font-semibold (shared with Backlog, MergeRequestListPage, settings sections)"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardHeader.tsx
    - taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx

key-decisions:
  - "Dropped bg-muted/40 tint and density-compact/comfortable padding modifiers from the header band so the geometry is byte-for-byte identical to Backlog's px-4 py-3 border-b, rather than trying to keep a density-responsive variant"
  - "Promoted sprint name from a span to an h1 (text-lg font-semibold) to match Backlog's title semantics and size exactly, dropping shrink-0 since truncate + min-w-0 already bound overflow"
  - "Goal moved to its own line below the title (no icon, per user feedback) instead of inline text after a middle-dot separator"
  - "Header skeleton gates on raw isLoading, not the 200ms-delayed showSkeleton, to avoid a blank flash before the delayed flag flips; body skeleton keeps the delayed gate since it doesn't have this flash problem"

patterns-established:
  - "Sprint Board header band now uses the same canonical page-header class treatment as Backlog/MergeRequestListPage/settings sections — future chrome should reuse this pattern rather than inventing a new tinted sub-toolbar look"

requirements-completed: [QUICK-260922-JTC]

duration: 12min
completed: 2026-09-22
---

# Quick Task 260922-jtc: Sprint Board Header Style Match Summary

**SprintBoardHeader.tsx restyled from a tinted sub-toolbar band to the canonical untinted page-header band (px-4 py-3 border-b, h1 text-lg font-semibold), matching Backlog/MergeRequestListPage/settings headers.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 of 2 (Task 2 is a checkpoint:human-verify; see below)
- **Files modified:** 2

## Accomplishments
- Header band className changed from `flex items-center gap-2 min-w-0 bg-muted/40 border-b border-border px-3 py-1.5 density-compact:py-1 density-comfortable:py-2.5` to `flex items-center gap-2 min-w-0 border-b px-4 py-3` — exact match with Backlog's `px-4 py-3 border-b`
- Sprint name element changed from `<span className="shrink-0 min-w-0 max-w-[40%] truncate text-sm font-semibold text-foreground">` to `<h1 className="min-w-0 max-w-[40%] truncate text-lg font-semibold text-foreground">` — matches Backlog's `<h1 className="text-lg font-semibold">Backlog</h1>` in size/weight/semantics
- State badge, middle-dot separator, and goal span left byte-for-byte unchanged — still render inline on one line per the prior 260922-irb decision
- Top doc comment corrected: no longer claims the header matches "the Backlog section-header treatment (bg-muted/40 tint)"; now states it matches the Backlog page header band
- Added two regression tests: heading role/size assertion, and banner className assertion (px-4/py-3 present, bg-muted/40 absent)

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle SprintBoardHeader to the canonical page-header treatment** - `821f4b0b` (feat)

Task 2 (checkpoint:human-verify) is a visual-parity gate — see "Checkpoint / Human Verification" below.

## Files Created/Modified
- `taskflow/src/routes/dashboard/SprintBoardHeader.tsx` - Header band restyled to untinted px-4 py-3 border-b; sprint name promoted to h1 text-lg font-semibold
- `taskflow/src/routes/dashboard/SprintBoardHeader.test.tsx` - Added heading-semantics/size test and banner-className test

## Decisions Made
- Dropped the `density-compact:py-1 density-comfortable:py-2.5` responsive padding — the plan explicitly calls for byte-for-byte geometry match with Backlog's static `px-4 py-3`, and Backlog's own header band has no density modifiers either
- Kept `role="banner"` / `aria-label="Sprint header"` / the biome-ignore comment unchanged since the plan only scoped className and doc-comment changes

## Deviations from Plan

None - plan executed exactly as written for Task 1.

## Issues Encountered

**node_modules unavailable in worktree:** The worktree had no installed `node_modules` (only vitest cache scaffolding). Symlinked `taskflow/node_modules` and root `node_modules` to the main repo's real `node_modules` directories to run tests/typecheck. This is a local dev-environment workaround, not a code change — no files were committed as part of this. One tracked file (`node_modules/.vite/vitest/.../results.json`) was transiently deleted by the symlink swap and restored via `git checkout --` before committing; verified `git status --short` showed only the two intended source files staged.

## Checkpoint / Human Verification (Task 2)

Task 2 in the plan is `type="checkpoint:human-verify"` — a live visual-parity check comparing the Sprint Board header against the Backlog page header in the running app, including density toggling. Initial automated pass compared className strings only; the user then reviewed the running app and requested two follow-up changes, now folded into this task's verification:

- **Follow-up 1 (`9c461245`):** goal moved from inline text after the title (separated by a middle dot) to its own line below the title, with a `Target` icon leading it. Also added `SprintBoardHeaderSkeleton`, gated on the 200ms-delayed `showSkeleton` flag, so the header slot wasn't visually absent while `SprintBoardTab` was fetching.
- **User feedback round 2:** clicking into the page while data was still loading produced a blank flash (no title segment) before the header appeared — caused by the skeleton itself being gated on the delayed `showSkeleton` rather than the raw `isLoading`, leaving a ~200ms window where neither the skeleton nor the real header was mounted. User also asked to drop the `Target` icon.
- **Follow-up 2 (`c420a22c`):** removed the `Target` icon (goal is now plain de-emphasized text on its own line, no icon). Switched the header's skeleton gate from `showSkeleton` to raw `isLoading` in `SprintBoardTab.tsx`, so the skeleton mounts immediately on load with no blank gap. The body skeleton (`SprintBoardSkeleton`) keeps the original delayed `showSkeleton` gate — only the small header needed the immediate-mount fix.
- User confirmed the result — **approved**.

## Next Phase Readiness
- Code changes complete, tested, typechecked, and committed (`821f4b0b`, `9c461245`, `c420a22c`)
- Full vitest suite (2753 tests) passes with no regressions
- Live visual sign-off: **done** — user reviewed in the running app and approved after the two follow-up rounds above

## Self-Check: PASSED

- FOUND: `taskflow/src/routes/dashboard/SprintBoardHeader.tsx` contains `text-lg font-semibold` and `px-4 py-3 border-b`, no `bg-muted/40`, `density-compact:py-`, or `Target` icon
- FOUND: `SprintBoardTab.tsx` gates `SprintBoardHeaderSkeleton` on raw `isLoading`
- FOUND: commits `821f4b0b`, `9c461245`, `c420a22c` in `git log --oneline`

---
*Quick task: 260922-jtc*
*Completed: 2026-09-22*
