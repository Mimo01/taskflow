---
phase: quick
plan: 260316-uxr
subsystem: epic-colors
tags: [ui, epic, color, jira-integration]
dependency-graph:
  requires: [jira-api, settings-store]
  provides: [epic-color-mapping]
  affects: [backlog, sprint-board, epics-page, issue-detail]
tech-stack:
  added: []
  patterns: [epicColorToTailwind-utility, ghx-label-mapping, hash-fallback-coloring]
key-files:
  created:
    - taskflow/src/lib/epicColors.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/DraggableCard.tsx
decisions:
  - epicColorFieldKey defaults to customfield_10013 (Jira Server gh-epic-color custom type)
  - Settings store bumped to version 4 with migration for epicColorFieldKey
  - Hash-based fallback ensures all epics get a consistent color even without Jira color data
  - Unknown hex colors rendered via inline styles with opacity-based bg/border
metrics:
  duration: 13min
  completed: "2026-03-16"
---

# Quick Task 260316-uxr: Match Epic Badge Colors with Jira Summary

Epic badges across the app now reflect the actual color assigned to each epic in Jira, replacing the previous random hash-based coloring with real Jira colors (ghx-label-N values).

## What Changed

### 1. Epic color discovery and mapping utility
- `discoverCustomFields` now detects `epicColorFieldKey` (gh-epic-color custom type)
- New `epicColors.ts` utility maps Jira's 14 ghx-label-N values + known hex codes to Tailwind classes
- Unknown hex colors get inline styles with opacity-based backgrounds
- Epics without a Jira color fall back to deterministic hash-based coloring

### 2. API integration
- `fetchBacklogView` returns `epicColors` map alongside `epicNames`
- `fetchEpicsBasic` returns `color` field on each `EpicEnriched`
- `fetchIssueDetail` now requests `epicColorFieldKey` so epic detail pages have color data
- Settings store v4 persists discovered `epicColorFieldKey`

### 3. UI updates across all views
- **Backlog**: Epic badges use real Jira colors, show "EPIC-42 Epic Name" format
- **Epics page**: Prominent colored left border + colored name badge pill per row
- **Sprint board**: TaskCards show compact colored epic key badges
- **Issue detail (epic)**: Colored accent bar at top + Color metadata row in sidebar
- **Issue detail (story)**: Epic link shown as colored badge instead of plain text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] epicColors missing from test fixtures**
- **Found during:** Task 1
- **Issue:** Adding `epicColors` to `BacklogViewData` interface broke all BacklogPage test mock data
- **Fix:** Added `epicColors: new Map()` to all test fixture objects
- **Files modified:** `BacklogPage.test.tsx`
- **Commit:** 1cb51a6

**2. [Rule 1 - Bug] fetchIssueDetail not requesting epicColorFieldKey**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Epic detail pages showed no color because fetchIssueDetail did not include epicColorFieldKey in its API field list
- **Fix:** Added epicColorFieldKey to fetchIssueDetail customFields parameter and both callers
- **Files modified:** `jira.ts`, `IssueDetailPage.tsx`, `IssueDetailSheet.tsx`
- **Commit:** 42f5d48

**3. [Rule 1 - Bug] Epic color accent bar not showing for epics without Jira color**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Accent bar and color swatch were gated on `epicColorValue` being truthy, hiding them for epics using fallback colors
- **Fix:** Changed gate to `isEpic` so hash fallback colors always render
- **Files modified:** `IssueDetailContent.tsx`, `IssueDetailSidebar.tsx`
- **Commit:** 42f5d48

**4. [Rule 1 - Bug] Epics page color indicator too subtle**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Small 2.5x2.5 color dot was barely visible
- **Fix:** Replaced with colored left border bar + colored name badge pill
- **Files modified:** `EpicsPage.tsx`
- **Commit:** 42f5d48

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 1cb51a6 | feat(quick-260316-uxr): discover epic color field and add color mapping utility |
| 2 | 3a3c189 | feat(quick-260316-uxr): apply real Jira epic colors to all badge locations |
| 3 | 42f5d48 | fix(quick-260316-uxr): fix epic color not showing on detail + make epics page color prominent |
