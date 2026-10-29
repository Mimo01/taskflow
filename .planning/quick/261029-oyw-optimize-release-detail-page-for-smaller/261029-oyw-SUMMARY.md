# Quick Task 261029-oyw: Release detail page narrow-width layout - Summary

Tiered container-query columns in the release task table, a CSS-capped side-by-side sidebar whose drag starts from its rendered width, and narrow-safe sidebar content and breadcrumb.

## Commits
- ce67689c: Task 1, UnifiedTaskTable tiers + tests
- d897be84: Task 2, sidebar cap, getStartWidth, MetaRow/branch/tag/breadcrumb + tests

## What changed
- UnifiedTaskTable: `@container` on the section. Shared COL_* constants now tier: below 860px assignee is avatar only (name sr-only) and MR is 5.5rem with state Badge sr-only and short aria-hidden slot text ("— unknown", "No MR", "— not checked"); below 640 icon and assignee drop; below 520 MR drops (and flagged badge words hide); below 400 Status drops. Header strip and rows share the constants. Secondary key cells got overflow-hidden; Issues header row wraps.
- ReleaseDetailSidebar: inline `maxWidth: max(12.5rem, min(50%, 100% - 30rem))`, `rootRef` prop, inner `@container`, truncating branch/tag names with titles (`pr-0.5` on italic states).
- useResizable: optional `getStartWidth` (read through a ref); ReleaseDetailPage passes the sidebar's `offsetWidth`. Left column got `@container` and `@max-[480px]:p-4`.
- MetaRow stacks label over value below 240px. Breadcrumb truncates the trail and version name.

## Deviations
- The "x / y done" badge words were NOT hidden below 520: the existing test uses `getByText('4 / 6 done')`, which would break with a nested span. The badge is short; only the wrong-branch / no-milestone words hide.
- Added `data-testid="branch-name"` to the branch name span (for the test).
- Slot-state long text and short variant coexist (long sr-only at narrow); existing assertions pass unchanged.
- The worktree base differed from the requested commit and was hard-reset to 84b7e269 as instructed. A `node_modules` symlink to the main checkout's was created in the worktree's `taskflow/` (git-ignored).

## Verification
Full vitest suite (pre-commit), biome on touched files, and tsc all pass on both commits.

## Pending human verification (Task 3)
jsdom cannot evaluate container queries. In `npm run tauri dev`, at about 1440/1280/1100/1024px with and without peek: rows stay one line with a visible summary and no sideways scroll; tiers compact then drop in the order above; sidebar stays beside the content, shrinks on peek open and regrows; dragging the capped handle moves immediately; metadata labels stack and branch/tag truncate with tooltip in a narrow sidebar; breadcrumb truncates the release name.

## Self-Check: PASSED
