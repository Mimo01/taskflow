---
phase: quick-260922-cif
plan: 01
subsystem: dashboard/sprint-board
tags: [density, compact-mode, tailwind, sprint-board]
dependency-graph:
  requires: []
  provides:
    - Compact-density Tailwind variants across TaskCard, StoryHeaderRow, and SprintBoardTab chrome
    - Measured sticky-header offset (density- and font-scale-proof)
  affects:
    - src/routes/dashboard/TaskCard.tsx
    - src/routes/dashboard/StoryHeaderRow.tsx
    - src/routes/dashboard/SprintBoardTab.tsx
    - src/routes/dashboard/SprintGoalBanner.tsx
    - src/routes/dashboard/QuickFilterChipRow.tsx
    - src/routes/dashboard/SprintBoardSkeleton.tsx
tech-stack:
  added: []
  patterns:
    - "density-compact: Tailwind variant prefix (existing app convention)"
    - "measured offsetHeight instead of hardcoded pixel constant for scroll-driven layout math"
key-files:
  created: []
  modified:
    - src/routes/dashboard/TaskCard.tsx
    - src/routes/dashboard/StoryHeaderRow.tsx
    - src/routes/dashboard/SprintBoardTab.tsx
    - src/routes/dashboard/SprintGoalBanner.tsx
    - src/routes/dashboard/QuickFilterChipRow.tsx
    - src/routes/dashboard/SprintBoardSkeleton.tsx
decisions:
  - "HEADER_HEIGHT constant fully replaced by stickyHeaderInnerRef.current?.offsetHeight ?? 37 — the 37 fallback only applies pre-mount, never as a steady-state value"
  - "All new font sizes use rem arbitrary values (text-[0.625rem]) per constraint 3 — zero new px sizes introduced except the two permitted width values (max-w, min-h)"
metrics:
  duration: ~35min
  completed: 2026-09-22
---

# Quick Task 260922-cif: Sprint Board Compact Density Summary

Added `density-compact:` Tailwind variants to ~30 previously-fixed-size class sites across TaskCard, StoryHeaderRow, and the SprintBoardTab chrome (column cells, drop zones, header bar, goal banner, quick filter chips, and loading skeleton), and replaced the sticky swimlane header's hardcoded 37px push-out offset with a live `offsetHeight` measurement.

## What Was Built

### Task 1 — TaskCard and StoryHeaderRow compact variants (commit `9b2bb2e2`)

- `TaskCard.tsx`: card outer wrapper padding/gap/radius, flag icon, issue key (both key-button and legacy-span branches), issue type label, summary text/line-height, bottom-row margin/gaps, `PriorityIcon` (via `className` prop, full replacement string), story-points chip, timeInColumn badge, subtask-toggle padding, `Badge` text size, chevron icons.
- `StoryHeaderRow.tsx`: row wrapper gap/padding, chevron icon, inner gap, flag icon, key text, `PriorityIcon`, summary text, assignee group gap/text/max-width, epic pill, subtask-count min-width/text, transition-error text.
- 16 `density-compact:` occurrences added to TaskCard.tsx, 12 to StoryHeaderRow.tsx (both exceed the 10+ verification floor).
- Zero new px-unit arbitrary values introduced except the permitted `max-w-[90px]` (assignee name) sizing value.
- `statusPillClass` call sites left untouched per plan instruction (docblock forbids callers adding sizing classes).

### Task 2 — Board columns/chrome + sticky header measurement (commit `b46f103b`)

- Replaced `const HEADER_HEIGHT = 37` with `stickyHeaderInnerRef.current?.offsetHeight ?? 37` at the scroll-handler push-out calculation site — density-proof and font-scale-proof, 37 retained only as the pre-mount fallback.
- `TransitionDropZone`: `min-h-[56px]` → `min-h-[40px]` in compact, added `density-compact:text-[0.625rem]` to the label.
- Both duplicate column-cell class strings (virtualized path ~line 533, non-virtual fallback ~line 708) edited identically: `min-h-[56px]` → `min-h-[40px]`, added `density-compact:gap-1 density-compact:p-0.5` (floored at `p-0.5`, never `p-0`, per constraint 6).
- All 4 drop-zone-stack `gap-1` wrappers (split + single, both render paths) got `density-compact:gap-0.5`.
- Header bar `h-10` → `density-compact:h-7`; header cell padding/gap and count/label text got compact variants; refresh cluster padding/gap got compact variants.
- `SprintGoalBanner.tsx`: added `density-compact:py-1 density-compact:px-3` (previously had no density variant at all).
- `QuickFilterChipRow.tsx`: retuned existing `density-compact:py-1` → `density-compact:py-0.5` (the one permitted "retune an existing compact value" edit).
- `SprintBoardSkeleton.tsx`: added compact variants for outer padding/gap, skeleton bar height, column gap, and card-skeleton height to keep loading-state geometry in sync with the new compact card sizing.
- `UnifiedFilterBar.tsx` left untouched as instructed (shared, already density-aware).

## Verification Results

- `npx vitest run src/routes/dashboard/TaskCard.test.tsx` — 5/5 passed
- `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` — 25/25 passed
- `npx tsc --noEmit` — clean, both tasks
- `npx biome check` on all 4 Task 2 files — clean, no new diagnostics
- `grep -c 'density-compact:'`: TaskCard.tsx = 16, StoryHeaderRow.tsx = 12 (both ≥10 floor)
- px-unit violation grep (excluding permitted `max-w`/`min-h`): 0 in both task scopes
- `density-compact:min-h-[40px]` count in SprintBoardTab.tsx: 3 (TransitionDropZone + both duplicate column-cell strings); `density-compact:min-h-[56px]` count: 0 (fully migrated)
- `git diff -- package.json`: empty (no dependency installs)
- Full pre-commit vitest suite (2761 tests) passed on both commits — no regressions introduced

## Deviations from Plan

None — plan executed exactly as written. All line-number references in the plan were approximate as expected; actual sites were located by class string, matching the plan's own guidance.

## Pending: Human Verification Checkpoint (Task 3)

Task 3 in the plan is `type="checkpoint:human-verify"` with `gate="blocking"`. Per execution constraints, this step was **not** attempted or faked — it is reported here as pending. The plan's checkpoint step requires running `npm run tauri dev` and manually verifying:

1. **Compact density materially denser** — Settings → Appearance → Density → Compact. Confirm the board is visibly denser (more cards fit on screen) and nothing is cut off/clipped/missing (every key, type label, summary, priority icon, status pill, chip, avatar, epic pill, subtask count still renders).
2. **Default/Comfortable unchanged** — switch to Default then Comfortable; confirm zero visual change versus pre-task behavior.
3. **Font-scale response in Compact** — Settings → Appearance → Font scale → sm, then xl; confirm compact board text scales in both directions (validates the rem-only constraint).
4. **Sticky header push-out** — scroll a long board in compact mode; watch the pinned swimlane header hand off cleanly at swimlane boundaries with no jitter or early slide-out (validates the `offsetHeight` measurement fix).
5. **Drop-zone reliability** — drag a card in compact mode onto a transition drop zone; the 40px zone must remain an easy, reliable drop target.
6. **Narrow-window collapse** — narrow the window as far as it goes; confirm each story header row stays on one line (summary truncates first) and no column cell collapses to 0 width.

This SUMMARY documents the completed automated work (Tasks 1-2, fully committed and verified via automated checks) and flags the remaining manual verification as outstanding. The quick-task workflow should resume at the checkpoint step to collect this human sign-off before the task is considered fully closed.

## Self-Check: PASSED

- `src/routes/dashboard/TaskCard.tsx`: FOUND, modified, commit `9b2bb2e2` verified in `git log`
- `src/routes/dashboard/StoryHeaderRow.tsx`: FOUND, modified, commit `9b2bb2e2` verified in `git log`
- `src/routes/dashboard/SprintBoardTab.tsx`: FOUND, modified, commit `b46f103b` verified in `git log`
- `src/routes/dashboard/SprintGoalBanner.tsx`: FOUND, modified, commit `b46f103b` verified in `git log`
- `src/routes/dashboard/QuickFilterChipRow.tsx`: FOUND, modified, commit `b46f103b` verified in `git log`
- `src/routes/dashboard/SprintBoardSkeleton.tsx`: FOUND, modified, commit `b46f103b` verified in `git log`
- Commit `9b2bb2e2`: FOUND in `git log --oneline --all`
- Commit `b46f103b`: FOUND in `git log --oneline --all`
