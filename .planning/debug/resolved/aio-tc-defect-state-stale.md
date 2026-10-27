---
status: resolved
trigger: "On AIO TC detail page, when I update defect state from the sidebar it doesnt update the defekt in the aio page. Update works, it is written to jira, the sidebar and everywhere else shows correct data but the AIO page doesnt update at all and still shows old data"
created: 2026-10-27
updated: 2026-10-27
---

## Symptoms

DATA_START
- expected: After changing a linked defect's state (Jira status) from the issue sidebar while on the AIO test case detail page, the defect shown in the AIO TC page reflects the new state.
- actual: Transition succeeds and is written to Jira; the sidebar and all other views show the new state, but the defect on the AIO TC detail page keeps showing the old state (no update at all).
- errors: none reported
- timeline: unknown — not stated whether this ever worked
- reproduction: Open an AIO test case detail page with a linked defect → open the defect in the sidebar → change its state → observe the AIO page's defect display still shows the old state.
DATA_END

## Current Focus

hypothesis: (none yet)
test:
expecting:
next_action: gather initial evidence — find where the AIO TC detail page gets defect state (likely an AIO-side query/cache key, separate from the Jira issue query invalidated by the sidebar transition mutation)

## Hints from project memory

- Enrichment invalidation no-op: invalidating a derived query is useless if its upstream source is stale.
- Reactive cache-read badge: imperative getQueryData() in render is non-reactive.
- Shared fetcher cache key / query-key churn issues have occurred before.
- React Compiler vs module reads: module-level reads go stale only in the app.
- Module map mount-order dep: AIO status map populated by overview page mount.

## Evidence

## Eliminated

## Resolution

root_cause: AIO pages (AioTestRunDetailPage, RunStepCard, useCycleDefects) read linked defects from ['jira', baseUrl, 'issue-lightweight', defectId], where defectId is the NUMERIC Jira id from jiraDefectIDs. Sidebar/board mutations invalidated jira-issue-detail etc. but never this cache. The first fix attempt invalidated by issue KEY, which still could not match the numeric-id keys.
fix: New src/lib/issue-lightweight-cache.ts invalidateLightweightIssue() — prefix invalidation with a predicate matching queryKey[3] === key OR cached data.key === key. Called from FieldsSection (3 sites), useFieldMutation onSettled, SprintBoardTab transition.
verification: tsc + biome clean; new regression test (numeric-id entry invalidated, unrelated defect untouched); 355 tests pass in affected suites. User confirmed fixed in app (2026-10-27).
files_changed: src/lib/issue-lightweight-cache.ts, src/lib/issue-lightweight-cache.test.ts, issue-detail/FieldsSection.tsx, issue-detail/useFieldMutation.ts, SprintBoardTab.tsx
