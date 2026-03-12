---
phase: 05-api-foundation-quick-wins
plan: "02"
subsystem: jira-service
tags: [type-extension, discovery, settings-store, startup-wiring]
dependency_graph:
  requires: [05-01]
  provides: [APIF-01, APIF-03]
  affects: [jira-service, settings-store, app-layout]
tech_stack:
  added: []
  patterns: [useQuery-staleTime-Infinity, startup-hook-pattern, TDD-red-green]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/main.tsx
    - taskflow/src/services/jira.test.ts
    - taskflow/src/components/app/SearchOverlay.test.tsx
    - taskflow/src/components/app/SearchResultPanel.test.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
decisions:
  - "issuetype.subtask is a required boolean (not optional) — existing test mocks needed subtask: false added (non-breaking at runtime since Jira always returns this field)"
  - "discoverStoryPointsField uses fetch from @tauri-apps/plugin-http (same as other jira.ts functions) — matches existing mock pattern in tests"
  - "useStoryPointsFieldDiscovery defined in main.tsx (not a separate hooks/ file) per plan instruction to keep startup wiring co-located"
metrics:
  duration: "~7 min"
  completed: "2026-03-12"
  tasks_completed: 3
  files_changed: 10
---

# Phase 5 Plan 02: JiraIssue Type Extension + Discovery Wiring Summary

**One-liner:** Extended JiraIssue interface with parent/subtasks/timetracking/index-signature fields, added discoverStoryPointsField() with GET /rest/api/2/field discovery, cached key in settings store, and wired startup hook into AppLayout.

## What Was Built

### Task 1: Extended JiraIssue Interface (TDD)

The `JiraIssue.fields` type in `taskflow/src/services/jira.ts` was extended with:
- `issuetype.subtask: boolean` — use this instead of name comparison (admin-renameable)
- `parent?: { id, key, fields: { summary } }` — optional parent issue reference
- `subtasks?: Array<{ id, key, fields: { summary, status: { name } } }>` — optional child issues
- `timetracking?: { originalEstimate?, remainingEstimate?, timeSpent?, *Seconds? }` — optional time data
- `[key: string]: unknown` — index signature enabling `issue.fields[storyPointsFieldKey]` without casting

All new fields are optional — existing callers receive `undefined` and require no changes.

### Task 2: discoverStoryPointsField() + Settings Store (TDD)

Added `discoverStoryPointsField(baseUrl, token): Promise<string>` to jira.ts:
- Calls `GET /rest/api/2/field` to list all field descriptors
- Matches by `name === 'Story Points'` or `name === 'story_points'` or `id === 'customfield_10028'`
- Falls back to `'customfield_10016'` on any failure (non-OK response, network error)

Extended `SettingsState` interface and `useSettingsStore` create() with:
- `storyPointsFieldKey: string` (initial value: `'customfield_10016'`)
- `setStoryPointsFieldKey: (key: string) => void`

### Task 3: App Startup Wiring

Added `useStoryPointsFieldDiscovery()` hook in `main.tsx` (co-located with startup hooks):
- Uses `useQuery` with `staleTime: Infinity` and `enabled: !!jiraBaseUrl && !!jiraConnected`
- Reads Jira PAT from Stronghold at query time (same pattern as `useNotificationPolling`)
- `useEffect` writes `query.data` into `setStoryPointsFieldKey` when data arrives
- Called in `AppLayout` immediately after `useNotificationPolling()`

## Test Results

- 25/25 tests pass in `src/services/jira.test.ts`
- APIF-01 type tests: 2 passing (parent/subtasks/timetracking fields, index signature)
- APIF-03 discovery tests: 4 passing (happy path, 404 fallback, network throw fallback, id match)
- All 19 pre-existing tests continue to pass
- `npx tsc --noEmit`: 3 pre-existing errors only (SearchOverlay unused React, 2x unused SelectValue)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `subtask: false` to issuetype mocks in 5 test files**
- **Found during:** Task 1 GREEN phase — `npx tsc --noEmit` revealed compile errors
- **Issue:** Making `issuetype.subtask` a required boolean field broke 5 existing test files that had `issuetype: { name: 'Story' }` without `subtask`
- **Fix:** Added `subtask: false` to makeIssue/makeJiraIssue factory functions in all 5 affected test files
- **Files modified:** `SearchOverlay.test.tsx`, `SearchResultPanel.test.tsx`, `MyTasksTab.test.tsx`, `WorkloadTab.test.tsx`, `MrAttentionTab.test.tsx`, `SprintProgressTab.test.tsx`
- **Commit:** 3f87984

**Note:** Also noticed linter auto-reverted the initial jira.ts interface edit between the first Edit call and subsequent tsc check. Re-applied the change successfully on second attempt.

## Commits

| Hash | Message |
|------|---------|
| 8c19299 | test(05-02): add failing tests for APIF-01 type extension and APIF-03 discovery |
| 3f87984 | feat(05-02): extend JiraIssue interface and add discoverStoryPointsField + settings store key |
| b8cc1de | feat(05-02): wire useStoryPointsFieldDiscovery into AppLayout startup |

## Self-Check: PASSED

- FOUND: taskflow/src/services/jira.ts (discoverStoryPointsField exported, JiraIssue extended)
- FOUND: taskflow/src/stores/settings.store.ts (storyPointsFieldKey + setStoryPointsFieldKey present, 3 occurrences)
- FOUND: taskflow/src/main.tsx (useStoryPointsFieldDiscovery defined and called, 2 occurrences)
- FOUND: .planning/phases/05-api-foundation-quick-wins/05-02-SUMMARY.md
- Commits verified: 8c19299, 3f87984, b8cc1de
