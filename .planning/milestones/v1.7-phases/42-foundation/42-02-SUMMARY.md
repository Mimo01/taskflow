---
phase: 42-foundation
plan: 02
subsystem: ui
tags: [react-compiler, babel-plugin-react-compiler, rolldown-plugin-babel, memoization, performance]

# Dependency graph
requires: []
provides:
  - React Compiler enabled via @rolldown/plugin-babel + reactCompilerPreset
  - All manual useMemo/useCallback/React.memo removed from 37 source files
  - Automatic IR-level memoization via babel-plugin-react-compiler 1.0.0
affects: [43-performance, any-phase-touching-react-components]

# Tech tracking
tech-stack:
  added:
    - babel-plugin-react-compiler@1.0.0 (exact pin)
    - "@rolldown/plugin-babel@^0.2.2"
  patterns:
    - "React Compiler handles memoization automatically — no manual useMemo/useCallback/memo allowed"
    - "useDebounce uses fnRef pattern (stable ref holding latest fn) instead of useCallback"
    - "Complex multi-statement computations use IIIEs: const x = (() => { ... })()"
    - "Event handlers in useEffect are inlined as named functions inside the effect body"

key-files:
  created: []
  modified:
    - taskflow/vite.config.ts
    - taskflow/package.json
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/components/app/PinnedTabStrip.tsx
    - taskflow/src/components/UnifiedFilterBar.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogFilterBar.tsx
    - taskflow/src/routes/dashboard/BulkActionBar.tsx
    - taskflow/src/routes/dashboard/ImageLightbox.tsx
    - taskflow/src/routes/dashboard/InlineComment.tsx
    - taskflow/src/routes/dashboard/IssueLinkRow.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/QuickFilterChipRow.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/WidgetGrid.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
    - taskflow/src/routes/dashboard/widgets/ReleasesWidget.tsx
    - taskflow/src/routes/dashboard/widgets/SprintProgressWidget.tsx
    - taskflow/src/routes/dashboard/widgets/WorkloadWidget.tsx

key-decisions:
  - "Used @rolldown/plugin-babel (NOT rollup-plugin-babel or vite-plugin-babel) because Vite 8 uses Rolldown internally"
  - "reactCompilerPreset imported from @vitejs/plugin-react v6 — named export in that package's dist"
  - "babel-plugin-react-compiler pinned at exactly 1.0.0 (no caret) per React Compiler stability convention"
  - "useDebounce uses fnRef pattern instead of useCallback to avoid dependency array instability"
  - "MrAttentionTab useMemo named 'data' renamed to 'dataMrs' to avoid collision with useQuery 'data'"
  - "PinnedTabStrip getDropIndex moved inline into useEffect as computeDropIndex to avoid stale closure"

patterns-established:
  - "IIIE pattern for complex multi-step computations: const result = (() => { ...; return value; })()"
  - "Inline event handlers in useEffect instead of extracting to useCallback"
  - "fnRef pattern for stable debounce without useCallback"

requirements-completed:
  - ROUT-04

# Metrics
duration: ~90min
completed: 2026-03-29
---

# Phase 42 Plan 02: React Compiler + Manual Memoization Removal Summary

**React Compiler enabled via babel-plugin-react-compiler 1.0.0 + @rolldown/plugin-babel, with all manual useMemo/useCallback/React.memo removed from 35 source files**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-03-29T18:00:00Z (estimated)
- **Completed:** 2026-03-29T20:07:30Z
- **Tasks:** 4
- **Files modified:** 37 (vite.config.ts, package.json + 35 component/hook files)

## Accomplishments

- Wired `babel-plugin-react-compiler@1.0.0` into the Vite/Rolldown build via `@rolldown/plugin-babel` and `reactCompilerPreset` — React Compiler now transforms all TSX/TS files during build
- Removed every `useMemo`, `useCallback`, and `React.memo`/`memo()` call across the entire codebase (35 files, 0 remaining after removal)
- All 786 tests pass, TypeScript is clean, production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable React Compiler in vite.config.ts** - `37fc72a` (feat)
2. **Task 2: Remove memoization from components and batch-1 dashboard files** - `6408a49` (refactor)
3. **Task 3: Remove memoization from dashboard root + issue-detail files** - `251eb44` (refactor)
4. **Task 4: Remove memoization from widget files** - `a5b38a9` (refactor)

## Files Created/Modified

- `taskflow/vite.config.ts` — Added @rolldown/plugin-babel + reactCompilerPreset
- `taskflow/package.json` — Added babel-plugin-react-compiler@1.0.0 and @rolldown/plugin-babel
- `taskflow/src/components/app/Sidebar.tsx` — Removed useMemo (visibleIds, sectionedItems)
- `taskflow/src/components/app/PinnedTabStrip.tsx` — Removed useCallback, moved getDropIndex inline in useEffect
- `taskflow/src/components/UnifiedFilterBar.tsx` — Removed useMemo (filtered, epicKeys, currentJql)
- `taskflow/src/routes/notifications/NotificationPopover.tsx` — Removed useMemo (virtualEntries)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Removed useMemo/useCallback (6 computations)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Removed useMemo (5 computations)
- `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` — Removed useCallback (handleBlur)
- `taskflow/src/routes/dashboard/BulkActionBar.tsx` — Removed useCallback (handleApply)
- `taskflow/src/routes/dashboard/ImageLightbox.tsx` — Removed useCallback, inlined handleKeyDown in useEffect
- `taskflow/src/routes/dashboard/InlineComment.tsx` — Removed useMemo (sortedComments)
- `taskflow/src/routes/dashboard/IssueLinkRow.tsx` — Removed useCallback, rewrote useDebounce with fnRef
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — Removed memo/useMemo/useCallback (9 handlers + CommentCard unwrap)
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Removed useMemo (attachmentMap, userMap)
- `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` — Removed useMemo (linkedJiraKeys)
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — Removed useMemo/useCallback (8 computations, renamed data→dataMrs)
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — Removed useMemo (7 computations)
- `taskflow/src/routes/dashboard/QuickFilterChipRow.tsx` — Removed useCallback (handleKeyDown)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — Removed useMemo/useCallback (6 computations + 4 handlers)
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — Removed useMemo/useCallback (3 computations + 2 handlers)
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — Removed useMemo (computed IIFE)
- `taskflow/src/routes/dashboard/WidgetGrid.tsx` — Removed useMemo (itemMap, effectiveLayout)
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — Removed memo wrapper, removed useMemo/useCallback
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` — Removed useMemo (rows/hasTimeData IIFE)
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` — Removed useMemo (allEntries, sortedEntries, counts, visibleEntries)
- `taskflow/src/routes/dashboard/issue-detail/AttachmentLightbox.tsx` — Removed useCallback, inlined handleKeyDown in useEffect
- `taskflow/src/routes/dashboard/issue-detail/AttachmentUpload.tsx` — Removed useCallback (handleFile, handleFileSelect)
- `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx` — Removed useMemo/useCallback (2 memos + 5 callbacks)
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — Removed useMemo (filteredVersions), removed useCallback (doSearch)
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — Removed useMemo (linkedMRs)
- `taskflow/src/routes/dashboard/issue-detail/LinkedIssuesSection.tsx` — Removed useMemo (groupedLinks)
- `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` — Removed useCallback, rewrote useDebounce with fnRef pattern
- `taskflow/src/routes/dashboard/widgets/ReleasesWidget.tsx` — Removed useMemo (releases)
- `taskflow/src/routes/dashboard/widgets/SprintProgressWidget.tsx` — Removed useMemo (computed)
- `taskflow/src/routes/dashboard/widgets/WorkloadWidget.tsx` — Removed useMemo (rows, maxPts)

## Decisions Made

- Used `@rolldown/plugin-babel` instead of `rollup-plugin-babel` or `vite-plugin-babel` because Vite 8 uses Rolldown internally and requires the Rolldown-compatible babel plugin
- Pinned `babel-plugin-react-compiler` at exactly `1.0.0` (no caret) to match stable release convention
- `reactCompilerPreset` imported from `@vitejs/plugin-react` v6 — it's a named export in that package
- For `useDebounce` in `IssueLinkRow.tsx` and `useFieldMutation.ts`: used fnRef pattern (stable ref holding latest fn + timerRef for timeout id) to avoid useCallback while maintaining stable function identity
- Renamed `data` (from useMemo) to `dataMrs` in `MrAttentionTab.tsx` to avoid shadowing the `data` from `useQuery`
- Moved `getDropIndex` function in `PinnedTabStrip.tsx` inline into `useEffect` as `computeDropIndex` to avoid stale closures when not using useCallback

## Deviations from Plan

None — plan executed exactly as written. All 35 files modified as specified, React Compiler wired via the correct plugin.

## Issues Encountered

- **MrAttentionTab variable collision**: The useMemo result was named `data`, same as the `useQuery` destructured `data`. Resolved by renaming to `dataMrs`.
- **PinnedTabStrip useEffect deps**: After removing useCallback from `getDropIndex`, it would be recreated every render and appear stale in useEffect deps. Resolved by inlining the function inside the effect.
- **useDebounce stability**: useDebounce returns a function that must be stable (same reference) across renders to avoid useEffect dep churn in callers. Solved with fnRef + a stable stableRef pattern — the outer function never changes but always calls the latest fn.

## Known Stubs

None.

## Next Phase Readiness

- React Compiler is active for all component files — memoization is now fully automated at the IR level
- Phase 42-03 (performance profiling/verification) can now measure the actual compiler output
- No blockers

---
*Phase: 42-foundation*
*Completed: 2026-03-29*
