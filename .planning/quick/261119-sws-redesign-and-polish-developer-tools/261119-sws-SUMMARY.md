---
phase: quick-261119-sws
plan: 01
subsystem: dev-tools
tags: [developer-tools, tanstack-query, logs, cache-inspector]
requires: []
provides:
  - Full-height Developer Tools page (Logs, Cache, Notifications, Editor) on a shared list + inspector layout
  - Live TanStack Query cache inspector
  - settings persist v40 (drops operationProfiling, performanceWaterfall)
affects: [settings, apiFetch]
key-files:
  created:
    - taskflow/src/routes/dev-tools/ListInspectorLayout.tsx
    - taskflow/src/routes/dev-tools/dev-tools-ui.tsx
    - taskflow/src/routes/dev-tools/dev-tools-view.store.ts
    - taskflow/src/routes/dev-tools/DevToolsSettingsPopover.tsx
    - taskflow/src/routes/dev-tools/LogInspector.tsx
    - taskflow/src/routes/dev-tools/CacheTab.tsx
    - taskflow/src/routes/dev-tools/CacheInspector.tsx
    - taskflow/src/routes/dev-tools/useQueryCacheRows.ts
    - taskflow/src/routes/dev-tools/DevToolsPage.test.tsx
    - taskflow/src/lib/dev-tools/ (json-preview, log-filters, log-stats, curl, query-cache-snapshot, entry-filters, each with tests)
  modified:
    - taskflow/src/routes/dev-tools/{DevToolsPage,LogsTab,NotificationsTab,EditorTab}.tsx
    - taskflow/src/lib/apiFetch.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/settings/DebugModeSection.tsx
  deleted:
    - operation-profiler.store.ts, OperationsTab, OperationCard, WaterfallTab, WaterfallBar, DevToolsSettings, routes/debug-logs/
decisions:
  - Pause is UI-only (snapshot in the view store); debug-log.store unchanged
  - Cache tab is not gated by devToolsEnabled
  - Inspector width is local transient store state (not persisted)
metrics:
  tasks: 3
  completed: 2026-11-19
---

# Quick 261119-sws: Redesign and polish Developer Tools Summary

Developer Tools is now a full-height tool under the standard PageHeader with four tabs sharing one toolbar / list / resizable-inspector layout: a Network-panel style Logs tab (facets, pause, stats strip, Headers/Request/Response/Timing inspector, redacted cURL), a live TanStack Query Cache inspector, and Notifications and Editor moved onto the same pattern. The operation profiler, Operations and Waterfall tabs and the legacy debug-logs viewer are gone.

## Commits

- e498fb11 Task 1: shell, settings popover, shared primitives, profiler removal, settings v40
- e63be1bb Task 2: Logs redesign, pure modules, Cache tab
- 9c4d6f34 Task 3: Notifications and Editor tabs

## TDD note (Task 2 and Task 3 pure modules)

Tests for log-filters, log-stats, curl, query-cache-snapshot and entry-filters were written first and confirmed failing (module resolution errors) before the implementations. The RED state was not committed, because the pre-commit hook blocks RED commits. Test and implementation landed in the same commit.

## Deviations from Plan

1. [Rule 3 - Blocking] `stores/settings.store.test.ts` asserts `version: 39` in two source-regex tests. The plan said it must pass unchanged, but bumping the persist version to 40 makes those assertions fail by design. Updated the two regexes and test titles to 40. The v39 migration-guard assertion is kept.
2. Worktree base reset: HEAD was at 02466a34, so I reset to 6b54d35c as the worktree check instructs (the plan files only exist there).
3. `node_modules` symlinked from the main repo into the worktree inner `taskflow/` (not committed, gitignored).
4. Disabled-state EmptyStates are rendered by each tab (Logs, Notifications, Editor) rather than by DevToolsPage, since each tab already owned its own disabled branch. Strings and behaviour match the plan.
5. `ListRow` puts `data-testid="devtools-row"` and the accessible label on the overlay button (not the wrapping div), so clicks in tests hit the actual interactive element.
6. Biome a11y: the list scroller needs `tabIndex` for arrow-key navigation, so `ListInspectorLayout` carries two scoped `biome-ignore` comments (noNoninteractiveTabindex, noStaticElementInteractions).
7. `toCacheRow` keeps the plan's `(query, staleTimeMs, now)` signature but `now` is unused (underscore-prefixed); staleness is computed via `isStaleByTime` OR `isInvalidated`.
8. Notification rows also show the notification body (and the source badge) in the row, because the existing tests assert the body text before any row is selected.
9. Inspector width is not persisted to settings (local transient store, as the research recommended), so no extra settings migration.

No production code was bent to satisfy test mocks.

## Verification

- `npx tsc --noEmit`: clean
- `npm test` (full suite): 477 files passed, 1 skipped; 7029 tests passed
- `npx biome check` on all touched paths: clean (no findings)
- `grep operationProfiling|performanceWaterfall|operation-profiler src`: only `settings.store.ts` (v40 migration lines)
- Bundle guard test passes (no wiki-editor engine imports from dev-tools)

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-sws-01 (curl redaction) and T-sws-04 (scoped, exact cache actions; Remove disabled while observed; `client.clear()` never used) are implemented and unit tested.

## Self-Check: PASSED

All listed files exist and the three commits are in git log.
