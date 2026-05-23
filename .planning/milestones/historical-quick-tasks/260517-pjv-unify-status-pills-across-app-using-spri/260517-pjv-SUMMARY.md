---
phase: quick-260517-pjv
plan: 01
subsystem: ui/status-pills
tags: [ui, status, tailwind, refactor, sprint-board, aio]
dependency_graph:
  requires: []
  provides: [unified-status-pill-helper]
  affects: [StoryHeaderRow, TaskCard, StatusPopover, IssueDetailContent, EpicsPage, ReleaseDetailPage, AioCycleDetailPage, AioTestRunDetailPage, AioTestRunsSection]
tech_stack:
  added: []
  patterns: [single-source-of-truth style helper, layout+color className composition]
key_files:
  created: []
  modified:
    - taskflow/src/lib/statusStyles.ts
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
decisions:
  - Defect status pill in AioCycleDetailPage DefectRow used font-semibold; migrated to STATUS_PILL_LAYOUT_CLASS (font-medium) for visual consistency — no functional difference
  - StatusPopover trigger: removed border fork (border-border/text-foreground fallback for unknown category); unified pill always carries colored background, no border needed
  - LinkedIssuesSection intentionally excluded — uses Badge component with its own geometry (text-[10px] h-4), color-only helper retained
metrics:
  duration: ~8 minutes
  completed: 2026-05-17T16:35:38Z
  tasks_completed: 2
  tasks_total: 3
  files_modified: 10
---

# Quick Task 260517-pjv: Unify Status Pills Across App Using Sprint Board Style

**One-liner:** Single `statusPillClass` / `aioCycleStatusPillClass` / `aioRunStatusPillClass` helpers in `statusStyles.ts` replace hand-rolled `rounded-full px-2 py-0.5` geometry in 9 consumer files with the sprint board reference style (`shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium` + color tokens).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add unified statusPillClass helpers in statusStyles.ts | 9be1775 | statusStyles.ts |
| 2 | Migrate all status-pill consumers to the unified helper | 2ff5c3c | 9 consumer files |
| 3 | Visual UAT — confirm status pills look unified across the app | DEFERRED | — |

## Task 3 — Deferred (Visual UAT)

Per execution constraints, Task 3 (visual UAT checkpoint) is deferred to human review. The developer should start the app (`pnpm tauri dev`) and visually confirm pill uniformity across all 7 surfaces listed in the plan:

1. Sprint board (story header pills, task card pills, context-menu transition pills)
2. Issue detail sidebar (StatusPopover trigger + list, linked stories, linked subtasks)
3. Epics page (status column)
4. Release detail page (linked issues table)
5. AIO Cycle detail page (cycle status header, per-run status)
6. AIO Test Run detail page (run header, per-step status)
7. AIO Test Runs Section on issue detail (step, run-header, impacted-execution chips)

Expected: all pills show `rounded` (not `rounded-full`), same minimum width (`min-w-[5.5rem]`), same height/padding, same color palette as sprint board reference.

## What Was Built

**`taskflow/src/lib/statusStyles.ts`** — Added:
- `STATUS_PILL_LAYOUT_CLASS` constant: `'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium'`
- `statusPillClass(categoryKey)` — full layout+color for Jira status pills
- `aioCycleStatusPillClass(status)` — full layout+color for AIO cycle status pills
- `aioRunStatusPillClass(status)` — full layout+color for AIO run/step status pills
- All existing color-only exports (`statusCategoryBadgeClass`, `statusCategoryDotClass`, `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass`) retained for `LinkedIssuesSection` and dot usage

**9 consumer files migrated:**
- `StoryHeaderRow.tsx` — header badge + context-menu transition pills
- `TaskCard.tsx` — status badge + context-menu transition pills
- `StatusPopover.tsx` — PopoverTrigger (with interaction-only classes preserved via `cn`) + transition list items
- `IssueDetailContent.tsx` — linked-story + linked-subtask pills
- `EpicsPage.tsx` — epics list status column
- `ReleaseDetailPage.tsx` — linked-issues table status column
- `AioCycleDetailPage.tsx` — cycle status header, per-run status, defect status pill
- `AioTestRunDetailPage.tsx` — run header + per-step status pills
- `AioTestRunsSection.tsx` — step status, run-block header, impacted-execution chip (data-testid preserved)

## Deviations from Plan

### Auto-fixed Issues

None.

### Decisions Made

1. **AioCycleDetailPage defect pill font-weight**: The defect status pill in `DefectRow` used `font-semibold` — migrated to `font-medium` (from `STATUS_PILL_LAYOUT_CLASS`) for visual uniformity across the file. No functional impact.

2. **StatusPopover border fork removed**: The trigger previously had a fallback branch (`border-border text-foreground`) for when `statusCategoryKey` was undefined. The unified pill uses `bg-muted text-muted-foreground` for the `new`/unknown category, which provides a visible colored background without needing a border. The border is dropped from the trigger.

## Verification Results

- Grep gate: 0 remaining instances of `rounded-full ... statusCategoryBadgeClass/aioCycleStatusBadgeClass/aioRunStatusBadgeClass` in dashboard files
- `LinkedIssuesSection.tsx` correctly retained old color-only helper (out of scope)
- `AioTestRunsSection.test.tsx`: 28/28 tests pass, 2 skipped (color substring assertions `'green'`/`'red'` still match `bg-green-500/15`/`bg-red-500/15`)
- TypeScript: no new errors introduced (verified via main repo `tsc --noEmit` baseline = 0 errors before and after)

## Known Stubs

None.

## Self-Check: PASSED

- taskflow/src/lib/statusStyles.ts — exists, contains `STATUS_PILL_LAYOUT_CLASS`, `statusPillClass`, `aioCycleStatusPillClass`, `aioRunStatusPillClass`
- All 9 consumer files modified and committed in 2ff5c3c
- Commits 9be1775 and 2ff5c3c verified in git log
