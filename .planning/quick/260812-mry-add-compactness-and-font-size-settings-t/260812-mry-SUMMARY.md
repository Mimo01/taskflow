---
phase: quick-260812-mry
plan: 01
subsystem: ui
tags: [tailwind-v4, zustand, tauri-store, settings, appearance, density, font-scale]

# Dependency graph
requires: []
provides:
  - "Text Size (font scale) user setting: S/M/L/XL, applied via root rem scaling"
  - "Fix for pre-existing bug where persisted density never applied without opening Settings"
  - "Density variant coverage extended to 6 additional high-traffic surfaces"
affects: [settings, dashboard, release-detail, my-tasks, sprint-board, sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root rem scaling via html[data-font-scale] attribute, mirroring the existing data-density pattern"
    - "loadAppearance() reads the persisted Zustand blob directly and applies density+fontScale before first paint, replacing per-component useEffect-only application"

key-files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/services/theme.ts
    - taskflow/src/services/theme.test.ts
    - taskflow/src/index.css
    - taskflow/src/main.tsx
    - taskflow/src/routes/settings/AppearanceSection.tsx
    - taskflow/src/routes/settings/Settings.test.tsx
    - taskflow/src/routes/settings/ConnectionsSection.test.tsx
    - taskflow/src/hooks/useResizable.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/components/app/PinnedTabStrip.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/UnifiedFilterBar.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/TaskCard.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
    - taskflow/src/routes/my-tasks/MyTaskRow.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/stores/settings.store.test.ts

key-decisions:
  - "Two independent selectors (Display Density unchanged, new Text Size) per CONTEXT — no combined 'UI Scale' control"
  - "Root rem scaling via html[data-font-scale]; 'md' tier removes the attribute (CSS baseline), mirroring the density pattern exactly"
  - "loadAppearance() reads the persisted settings-store blob directly (not a dual-written top-level key) and applies both density and font scale before createRoot().render() in main.tsx — fixes the pre-existing bug where density silently reset to default on every restart unless Settings was opened"
  - "Density variant sweep bounded to 6 ranked high-traffic targets (UnifiedTaskTable primary+MR rows+headers, MyTaskRow both branches, StoryHeaderRow, AioTestRunsSection, SprintBoardTab both branches) — vertical padding only, except SprintBoardTab's sanctioned p-* deviation for 2D board columns"
  - "text-[Npx] to rem conversion bounded to 5 high-traffic chrome files (30 occurrences); ~45 occurrences elsewhere in src/ explicitly deferred, not touched"

patterns-established:
  - "useResizable min now accepts number | (() => number), mirroring the existing max shape — enables dynamic bounds scaled by live root font-size"

requirements-completed: []

# Metrics
duration: ~7min (Task 1 8cdb4d5e to Task 3 4d1a5d8a; excludes Task 1's one-time worktree npm install)
completed: 2026-08-12
---

# Quick Task 260812-mry: Compactness + Font Size Settings Summary

**Text Size selector (S/M/L/XL) added to Settings > Appearance via root rem scaling on `html[data-font-scale]`, plus a fix for the pre-existing bug where persisted Display Density never applied unless Settings was opened, plus density variant coverage extended to 6 additional high-traffic surfaces.**

## Performance

- **Started:** 2026-08-12T16:42:00+02:00 (approx, first commit 16:45:01+02:00)
- **Completed:** 2026-08-12T16:51:56+02:00 (Task 3 commit)
- **Tasks:** 3 of 4 (Task 4 is a `checkpoint:human-verify` — stopped there per instructions)
- **Files modified:** 21 across all 3 tasks (Task 1: 6, Task 2: 3, Task 3: 12)

## Accomplishments

- Added `FontScale` type, `fontScale` persisted store field (default `'md'`), `setFontScale` action, v28 migration
- Added `applyFontScale()` and `loadAppearance()` to `services/theme.ts`; `loadAppearance()` reads density + font scale directly from the persisted Zustand blob
- Folded `loadAppearance()` into `main.tsx`'s pre-render `Promise.all`, replacing the hardcoded `applyDensity('default')` — this fixes a real pre-existing bug: persisted density was silently reset to default on every app restart unless the user had visited Settings
- Added a 4-tier Text Size selector to `AppearanceSection.tsx`, structurally identical to the existing Display Density selector
- Converted ~10 hardcoded px layout constants to rem across `UnifiedTaskTable.tsx`, `PinnedTabStrip.tsx`, `AioTestRunsSection.tsx` — byte-identical at 100% root font size, now scale with Text Size
- Sidebar nav labels now `truncate` instead of overflowing at XL; sidebar resize bounds (`min`/`max`) now scale with the live root font-size factor
- `useResizable`'s `min` option widened to `number | (() => number)`, mirroring `max`
- Converted 30 `text-[Npx]` occurrences to rem across 5 scoped high-traffic chrome files (UnifiedFilterBar, TaskCard, Sidebar, PinnedTabStrip, LinkedIssuesSection); ~45 occurrences elsewhere in `src/` deliberately deferred
- Extended density variant coverage to 6 ranked high-traffic surfaces (UnifiedTaskTable primary row + MR sub-row + both header strips, MyTaskRow both row branches, StoryHeaderRow, AioTestRunsSection, SprintBoardTab both board-column branches) without regressing the 6 pre-existing density-aware components

## Task Commits

1. **Task 1: Font scale foundation — store field, appliers, CSS, pre-paint bootstrap** - `8cdb4d5e` (feat)
2. **Task 2: Text Size selector in Appearance + test mock updates** - `8c9af630` (feat)
3. **Task 3: Bounded px-to-rem scaling sweep + density variant sweep on ranked surfaces** - `4d1a5d8a` (feat)

_Note: Task 1 and Task 3 each include one small in-scope test fix (Rule 1) folded into the task commit rather than a separate commit — see Deviations below._

## Files Created/Modified

- `taskflow/src/stores/settings.store.ts` - `FontScale` type, `fontScale` field, `setFontScale` action, v28 migration
- `taskflow/src/services/theme.ts` - `applyFontScale()`, `loadAppearance()`
- `taskflow/src/services/theme.test.ts` - DOM-assertion tests for `applyDensity`, `applyFontScale`, `loadAppearance`
- `taskflow/src/index.css` - `html[data-font-scale]` root rem scaling rules (sm 87.5%, lg 112.5%, xl 125%)
- `taskflow/src/main.tsx` - `loadAppearance()` folded into pre-render `Promise.all`, replaces hardcoded `applyDensity('default')`
- `taskflow/src/routes/settings/AppearanceSection.tsx` - Text Size selector (4 tiers), hydration sync `useEffect`
- `taskflow/src/routes/settings/Settings.test.tsx` - mock updates + new AppearanceSection content describe block
- `taskflow/src/routes/settings/ConnectionsSection.test.tsx` - `fontScale`/`setFontScale` added to duplicate mock
- `taskflow/src/hooks/useResizable.ts` - `min` widened to `number | (() => number)`
- `taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` - column constants to rem, all `w-[28px]` to rem, density variants on primary row/MR sub-row/both header strips
- `taskflow/src/components/app/PinnedTabStrip.tsx` - tab width constants to rem, `text-[Npx]` to rem
- `taskflow/src/components/app/Sidebar.tsx` - label `truncate`, scaled resize bounds, `text-[Npx]` to rem
- `taskflow/src/components/UnifiedFilterBar.tsx` - `text-[Npx]` to rem (7 occurrences)
- `taskflow/src/routes/dashboard/TaskCard.tsx` - `text-[Npx]` to rem (4 occurrences)
- `taskflow/src/routes/dashboard/TaskCard.test.tsx` - Rule 1 fix: updated locked `text-[11px]` assertion to `text-[0.6875rem]`
- `taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx` - `text-[Npx]` to rem (2 occurrences)
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` - `min-h-[44px]` to `min-h-11`, density variant
- `taskflow/src/routes/my-tasks/MyTaskRow.tsx` - density variant on both row branches
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` - density variant
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - density variant (p-*) on both board-column branches
- `taskflow/src/stores/settings.store.test.ts` - Rule 1 fix: updated locked persist-version smoke test from 27 to 28

## Decisions Made

- Followed CONTEXT/RESEARCH decisions exactly: root rem scaling via `data-font-scale`, two independent selectors, bounded density and px-to-rem sweeps. No new architectural decisions were required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/pre-existing test] Updated persist-version smoke test to expect v28**
- **Found during:** Task 1
- **Issue:** `settings.store.test.ts` contained a smoke test literally asserting `version).toBe(27)` — a regression guard for the exact persist version string. Task 1 intentionally bumps the version to 28 for the new `fontScale` migration, so this test failed as an expected consequence of the plan's own change, not a bug in the new code.
- **Fix:** Updated the test's expected value and description to reference v28 / this quick task.
- **Files modified:** `taskflow/src/stores/settings.store.test.ts`
- **Verification:** `npx vitest run src/stores/settings.store.test.ts` passes (65/65)
- **Committed in:** `8cdb4d5e` (Task 1 commit)

**2. [Rule 1 - Bug/pre-existing test] Updated TaskCard timeInColumn badge className assertion**
- **Found during:** Task 3
- **Issue:** `TaskCard.test.tsx` asserted `badge.className).toContain('text-[11px]')` — a literal string match on the exact Tailwind class. Task 3's Part B px-to-rem sweep intentionally converts `text-[11px]` to `text-[0.6875rem]` in `TaskCard.tsx` (one of the 5 in-scope chrome files), so this test failed as an expected, in-scope consequence.
- **Fix:** Updated the assertion to the new rem-based class string.
- **Files modified:** `taskflow/src/routes/dashboard/TaskCard.test.tsx`
- **Verification:** Full `npx vitest run` — 2586/2586 passing, 0 failures
- **Committed in:** `4d1a5d8a` (Task 3 commit)

**3. [Environment setup, not a plan deviation] Installed npm dependencies in the worktree**
- **Found during:** Task 1, before first test run
- **Issue:** The worktree's `taskflow/` had no `node_modules` (git-ignored, not carried into the fresh worktree), so `npx vitest` and `npx tsc` failed at the module-resolution stage before any test code ran.
- **Fix:** Ran `npm install` inside `taskflow/` — 690 packages installed, matching the existing lockfile (no lockfile changes).
- **Files modified:** none tracked (node_modules is gitignored; no `package.json`/`package-lock.json` diff)
- **Verification:** `npx vitest run` and `npx tsc --noEmit` both run cleanly afterward

---

**Total deviations:** 3 (2 in-scope test updates required by the plan's own intentional changes, 1 environment setup step). No scope creep — all three were either predictable consequences of the plan's own edits or a prerequisite for running any verification at all.

## Issues Encountered

- `vi.mock('@tauri-apps/plugin-store')`'s factory-scoped `Map` in `theme.test.ts` is only fresh per `vi.resetModules()` call, not per individual `it()` — the two `loadAppearance` tests originally ran in an order where the "no persisted blob" assertion saw state left over from the "with persisted blob" test that ran before it. Reordered the tests (baseline-first, blob-seeded-second) so each `beforeEach`'s `vi.resetModules()` genuinely isolates them. No production code change needed.
- `getByRole('button', { name: /regex/i })` in `Settings.test.tsx`'s new density regression-guard test did not match on the expected substring because the accessible name computation did not behave as a simple concatenated-text match against an anchored regex; switched to `getAllByRole('button').filter(...)` on `textContent` for a more robust match.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Task 4 (checkpoint:human-verify) was intentionally NOT self-verified, per this execution's explicit constraint.** The following manual verification is still required before this quick task can be considered fully complete:

1. Run `cd taskflow && npm run tauri dev`.
2. Go to Settings > Appearance. Confirm two selectors: Display Density (3 tiers) and Text Size (4 tiers).
3. Click Text Size > Extra Large. The entire app should scale instantly — text, padding, gaps, icons.
4. While at XL, visit: the sidebar (nav labels must truncate, not overflow or scroll horizontally), a release detail page (unified task table columns must not spill the issue key into the summary), and the pinned tab strip (tab labels sized proportionally).
5. Set Display Density > Compact. Confirm rows tighten on the release detail table, My Tasks, story header rows in Backlog/Sprint Board, AIO test run rows and sprint board columns — and that Sidebar / TaskCard / BacklogRow / TaskRow / MrRow / NotificationRow still behave exactly as before.
6. Pick Compact + Large, fully quit the app, relaunch, and land on any route other than Settings. Both settings must already be applied on first paint with no flash and without opening Settings (this is the pre-existing density bug being fixed).

All automated verification (tsc, full vitest suite, biome lint on touched files, exact-count grep assertions from the plan's Task 3 verify block) has passed. No known stubs or threat-surface changes were introduced.

---
*Quick task: 260812-mry*
*Completed: 2026-08-12*

## Self-Check: PASSED

- All 19 files listed in `key-files.modified` verified to exist on disk.
- All 3 task commits (`8cdb4d5e`, `8c9af630`, `4d1a5d8a`) verified present in `git log --oneline --all`.
