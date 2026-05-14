---
phase: 56
plan: "03"
subsystem: aio
tags: [tabs, defects, credential-migration, navigation, jira-enrichment]
dependency_graph:
  requires:
    - taskflow/src/hooks/useAioCredentials.ts
    - taskflow/src/lib/aioUtils.ts
  provides:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx (tabbed layout)
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
  affects:
    - AioCycleDetailPage: Executions | Defects tabs, clickable run rows, enriched defects
tech_stack:
  added: []
  patterns:
    - "DefectRow: token+tokenLoading PROP-DRILLED from page (D-16 — no second useAioCredentials call)"
    - "queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey] — avoids fetchIssueDetail collision (Pitfall 5)"
    - "openRun() extracted helper: breadcrumb push + navigate, shared by onClick and onKeyDown"
    - "run rows: role=button tabIndex=0, Enter/Space keyboard activation (D-09)"
key_files:
  modified:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
decisions:
  - "Old describe('defects section') tests rewritten in-place as describe('Defects tab') — old assertions checked for conditional section visibility which no longer applies after tabs redesign"
  - "breadcrumb mock placed at file scope (outside first describe) — vi.mock hoisting ensures it applies to all test suites in the file"
  - "Tabs root takes flex-1 flex flex-col min-h-0 (Pitfall 4 scroll preservation); error/skeleton branches wrapped in flex-1 overflow-auto div"
  - "AioCycleDetailPage.tsx NavLink import added for DefectRow; useLocation was already present from Task 2"
metrics:
  duration: "~25 minutes (inline orchestrator execution after agent permission failure)"
  completed: "2026-05-14T21:10:00Z"
  tasks_completed: 3
  files_modified: 2
  tests_before: 10
  tests_after: 21
---

# Phase 56 Plan 03: AioCycleDetailPage Tabs Redesign Summary

**One-liner:** Reorganized AioCycleDetailPage into Executions/Defects tabs with clickable run rows navigating to run detail and an enriched 4-column defects table with per-defect Jira fetch.

## What Was Built

### Task 1: Tabs layout + credential migration
- Replaced local `normalizeStatus`/`normalizeStatusLabel` with `@/lib/aioUtils` imports
- Replaced `readSecret`/`useEffect` credential block with `useAioCredentials()` + `!tokenLoading` guard on both queries
- Wrapped loaded body in `<Tabs defaultValue="executions">` with Progress section above the tab bar (always visible)
- Filter chips toolbar moved into `<TabsContent value="executions">`

### Task 2: Clickable run rows (D-08, D-09)
- `openRun(run)` helper: `useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname })` then `navigate(/aio-cycle/:projectKey/:cycleKey/run/:runId)`
- Run rows: `role="button"` `tabIndex={0}` with `onClick` + `onKeyDown` (Enter/Space) — no `<NavLink>` on `<tr>`
- Tests: 5 new cases covering tab default state, tab switch, click navigation, Enter key, Space key

### Task 3: DefectRow + enriched Defects tab (AIOC-03)
- `DefectRow` sub-component above main export — receives `token`/`tokenLoading` as props (D-16)
- Per-defect `useQuery` with `queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey]`
- 4 columns: Key (NavLink `/issue/:key`) | Title (Skeleton → summary | fallback to key) | Status chip | Triggered By
- `defectsWithTriggers` derived from runs whose `defects[]` includes the key (D-12)
- EmptyState when `allDefects.length === 0` ("No defects are linked to runs in this cycle.")
- Tests: 6 new cases in `describe('Defects tab')` replacing old `describe('defects section')`

## Test Results

| Describe | Tests | Status |
|----------|-------|--------|
| AioCycleDetailPage (root) | 1 | ✓ |
| progress bar | 3 | ✓ |
| filter chips | 3 | ✓ |
| Defects tab | 6 | ✓ |
| pin button | 3 | ✓ |
| Executions tab — clickable rows | 5 | ✓ |
| **Total** | **21** | **All pass** |

Full project suite: 1074 tests, 0 failures.

## Deviations from Plan

- Agent hit permission wall mid-Task 2 (couldn't commit). Orchestrator executed Tasks 1-3 inline with atomic commits per task.
- `@gsd-build/sdk` accidentally added to package.json by agent — reverted before commits.
- Defects tab placeholder test updated (from `data-testid="defects-tab-placeholder"` to tab role assertion) since placeholder was removed in Task 3.

## Self-Check: PASSED

- [x] `<Tabs defaultValue="executions"` present in tsx
- [x] `function DefectRow(` present in tsx
- [x] `queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey]` present
- [x] `fetchJiraIssueByKey` imported and used
- [x] `subtitle="No defects are linked to runs in this cycle."` present
- [x] `grep -c "function normalizeStatus" AioCycleDetailPage.tsx` → 0
- [x] `grep -c "readSecret" AioCycleDetailPage.tsx` → 0
- [x] `grep -c "!tokenLoading" AioCycleDetailPage.tsx` → 2
- [x] `grep -c "role=\"button\"" AioCycleDetailPage.tsx` → ≥1
- [x] `describe('Defects tab'` exists in test file
- [x] `describe('defects section'` does NOT exist in test file
- [x] All 21 tests pass; full suite 1074 green
