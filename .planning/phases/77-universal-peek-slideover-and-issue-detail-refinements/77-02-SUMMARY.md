---
phase: 77-universal-peek-slideover-and-issue-detail-refinements
plan: "02"
subsystem: ui
tags: [tanstack-query, refactor, component-extraction, vitest, issue-detail]

requires:
  - "77-01 (IssueDetailContent.test.tsx stub file, fields.parent type confirmed)"
provides:
  - "IssueDetailView.tsx — shared full-detail body with layout='two-column'|'single-column' and onOpenIssue props (D-05 override target for PeekPanel)"
  - "IssueDetailPage.tsx slimmed to breadcrumb-header + IssueDetailView wrapper"
  - "IssueDetailContent.tsx with ArrowUpRight parent breadcrumb above h2 (DETAIL-01)"
  - "FieldsSection.tsx with parent MetaRow removed (DETAIL-01)"
  - "IssueDetailContent DETAIL-02 cursor sweep: subtask py-2 + cursor-pointer, epic + add-subtask cursor-pointer"
affects:
  - "77-03 (PeekPanel — renders IssueDetailView layout='single-column' for full editable detail)"

tech-stack:
  added: []
  patterns:
    - "Component extraction: all queries/mutations lifted from page into shared view component"
    - "Layout prop branching: layout='two-column' preserves existing JSX; layout='single-column' stacks sidebar-first per D-06"
    - "isPinned/onTogglePin as props with internal store fallback — callers override, peek/page both work"

key-files:
  created:
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
  modified:
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx

key-decisions:
  - "isPinned/onTogglePin accepted as props in IssueDetailView with usePinnedTabsStore fallback — PeekPanel and IssueDetailPage can both pass them; no store coupling required"
  - "CommentCard and IssueDetailSkeleton copied into IssueDetailView.tsx (not a shared module) — they are tightly coupled to IssueDetailView state (editMutation, userMap, etc.) and the extraction is already encapsulated"
  - "Single-column layout uses px-6 for AioTestRunsSection/ActivityTimeline block to match inner two-column padding; outer p-4 wraps sidebar and content blocks per D-06"

decisions:
  - "isPinned/onTogglePin as props with store fallback in IssueDetailView — props take precedence, stores used internally by default"

duration: 25min
completed: 2026-06-03
---

# Phase 77 Plan 02: IssueDetailView Extraction + DETAIL-01/02 Summary

**Shared IssueDetailView (816 lines) with full queries/mutations/composer extracted from IssueDetailPage; IssueDetailPage slimmed to 82-line wrapper; parent breadcrumb above h2 (DETAIL-01) and cursor-pointer sweep (DETAIL-02) landed with 3 passing tests**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-03T11:29:59Z
- **Completed:** 2026-06-03T11:35:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created `IssueDetailView.tsx` (816 lines): all 6+ queries (`jira-issue-detail`, `jira-epic-stories`, `jira-issue-comments`, `jira-subtask-enrichment`, `jira-issue-changelog`, `jira-worklogs`), both comment mutations (edit/delete), both worklog mutations (edit/delete), CommentCard, IssueDetailSkeleton, perf marks (TTFMP/TTI), useDelayedLoading gates, useMentionUserMap — all moved verbatim from IssueDetailPage with identical query keys/staleTime/invalidations
- `layout='two-column'`: reproduces existing two-column JSX (left `flex-1 overflow-auto`, right resizable sidebar with useResizable) exactly
- `layout='single-column'`: `flex flex-col h-full overflow-auto` with sidebar fields block (`p-4 border-b`) first, then content block — per D-06 for PeekPanel
- Slimmed `IssueDetailPage.tsx` from 842 → ~82 lines: only breadcrumb header + `<IssueDetailView layout="two-column" onOpenIssue={onIssueClick}>` (D-13 navigate context preserved)
- DETAIL-01: `ArrowUpRight` breadcrumb above `<h2>` in `IssueDetailContent` for subtasks with `fields.parent`; `onClick → onOpenIssue(parentKey)` (D-13 seam)
- DETAIL-01: parent `MetaRow` removed from `FieldsSection.tsx`
- DETAIL-02: subtask row `py-1.5 → py-2` + `cursor-pointer`; epic story rows + Add-subtask button gain `cursor-pointer`
- Converted 3 `it.todo` stubs in `IssueDetailContent.test.tsx` to passing `it()` assertions (all green)

## Task Commits

1. **Task 1: Extract shared IssueDetailView** - `0d330779` (feat)
2. **Task 2: Slim IssueDetailPage to wrapper** - `7d9ff321` (feat)
3. **Task 3: DETAIL-01 parent breadcrumb + DETAIL-02 cursor sweep** - `8156b989` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/IssueDetailView.tsx` — **Created**: 816 lines, shared full-detail body with layout + onOpenIssue props
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — **Modified**: 842 → ~82 lines, thin breadcrumb-header wrapper
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — **Modified**: ArrowUpRight import + parent breadcrumb block + cursor sweep
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — **Modified**: parent MetaRow block removed
- `taskflow/src/routes/dashboard/IssueDetailContent.test.tsx` — **Modified**: 3 it.todo → 3 passing it() (DETAIL-01 x2, DETAIL-02)

## Decisions Made

- `isPinned`/`onTogglePin` accepted as props in `IssueDetailView` with `usePinnedTabsStore` fallback — callers (IssueDetailPage, PeekPanel) can pass them; component reads stores internally if not provided. No store coupling required at call sites.
- `CommentCard` and `IssueDetailSkeleton` remain in `IssueDetailView.tsx` (not extracted to a shared module) — they depend on internal mutation state and the extraction is already well-encapsulated.
- Query keys, staleTime, and invalidation targets preserved verbatim — peek and full-page share TanStack Query cache per RESEARCH Pitfall 4.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all it.todo stubs converted to passing it() assertions.

## Threat Flags

None — pure refactor + display change. No new network endpoints, auth paths, or schema changes. Query keys unchanged (existing cache entries reused).

---
*Phase: 77-universal-peek-slideover-and-issue-detail-refinements*
*Completed: 2026-06-03*
