---
phase: 80-subtask-templates-and-bulk-creation
plan: "01"
subsystem: stores, services, dashboard-utils
tags: [store, persistence, pure-functions, tdd, jira-types, progress-indicator]
dependency_graph:
  requires: []
  provides:
    - useSubtaskTemplatesStore (subtask-templates.json persistence)
    - resolveTemplateFields (pure field-drop utility)
    - resolveRowPlaceholders (pure placeholder resolver)
    - JiraIssueDetail.fields.components
    - BulkProgressIndicator actionVerb/noun props
    - BulkCreateSubtasksModal creation-loop contract tests
  affects:
    - taskflow/src/services/jira.ts (additive field)
    - taskflow/src/routes/dashboard/BulkProgressIndicator.tsx (additive props)
tech_stack:
  added: []
  patterns:
    - createTauriStorage persist pattern (mirroring tempo-filters.store.ts)
    - Pure utility functions with no React/Zustand imports
    - TDD RED/GREEN cycle for resolver utilities
key_files:
  created:
    - taskflow/src/stores/subtask-templates.store.ts
    - taskflow/src/stores/subtask-templates.store.test.ts
    - taskflow/src/routes/dashboard/resolveTemplateFields.ts
    - taskflow/src/routes/dashboard/resolveTemplateFields.test.ts
    - taskflow/src/routes/dashboard/resolveRowPlaceholders.ts
    - taskflow/src/routes/dashboard/resolveRowPlaceholders.test.ts
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/BulkProgressIndicator.tsx
decisions:
  - "migrate() uses as unknown as SubtaskTemplatesState (established Zustand persist pattern — matches tempo-filters)"
  - "resolveRowPlaceholders stays pure (no hooks) — context passed as PlaceholderContext parameter"
  - "BulkCreateSubtasksModal.test.ts uses inline createAllRows contract implementation with it.todo for Plan 04 wiring"
metrics:
  duration: "7m"
  completed_date: "2026-06-05"
  tasks_completed: 3
  files_created: 7
  files_modified: 2
---

# Phase 80 Plan 01: Data Foundation — Store, Resolvers, and Test Contracts Summary

Persistent template store, two pure resolver utilities, and four Wave-0 test files establishing the data contract for the Phase 80 subtask-templates feature.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | subtask-templates store + persistence test | `4204065a` | store.ts, store.test.ts |
| 2 (RED) | Failing tests for resolveTemplateFields + resolveRowPlaceholders | `4654d6d7` | 2 test files |
| 2 (GREEN) | resolveTemplateFields + resolveRowPlaceholders implementations | `655e51e7` | 2 impl files |
| 3 | components on JiraIssueDetail, BulkProgressIndicator props, modal test stub | `794becec` | jira.ts, BulkProgressIndicator.tsx, modal test |
| fix | Biome format fixes across all plan-01 files | `bc746ac5` | 6 files |

## What Was Built

**`useSubtaskTemplatesStore`** — Zustand persist store backed by `createTauriStorage('subtask-templates.json')`. Exports `SubtaskTemplateRow` and `SubtaskTemplate` interfaces. Actions: `addTemplate`, `removeTemplate`, `renameTemplate`, `updateTemplate`, `moveTemplate` (up/down/front/back). Store version 1 with `migrate()` that coerces non-array `templates` to `[]` and drops entries with non-array `rows` (T-80-01 threat mitigation).

**`resolveTemplateFields`** — Pure function. Given template rows, createmeta fields, and `storyPointsFieldKey`, returns resolved rows with unsupported custom fields dropped and a `totalSkipped` count. Core fields (summary, assignee, priority, labels, duedate, timetracking, parent) and `storyPointsFieldKey` are ALWAYS_ALLOWED regardless of createmeta. Components counted once and cleared if absent from createmeta and row has values.

**`resolveRowPlaceholders`** — Pure function exporting `resolveAssignee` and `resolveRowForCreate`. Resolves the three placeholder sentinels: `@unassigned` → null payload, `@current` → `jiraUsername` (DC name, not displayName), `@inherit` → reads parent fields with missing-value-to-empty fallback (D-12). No React/Zustand imports — pure data transform.

**`JiraIssueDetail.fields.components`** — Additive field `components?: Array<{ id: string; name: string }>` typed on `JiraIssueDetail.fields`. String `'components'` added to `fetchIssueDetail` fields array so `@inherit` can read parent components.

**`BulkProgressIndicator` text props** — Added `actionVerb?: string` (default `'Updating'`) and `noun?: string` (default `'issues'`) props. Status text derivation now uses these props. Existing callers unaffected (defaults preserve original text). Supports `actionVerb="Creating" noun="subtasks"` for the bulk modal (UI-SPEC copy contract).

**`BulkCreateSubtasksModal.test.ts`** — Wave-0 creation-loop contract stub. 6 passing assertions: sequential ordering (SUBTPL-06), retry-no-duplicate (SUBTPL-07), `createdKey` retention on retry, state transition tracking. 5 `it.todo` items documenting the Plan 04 integration contract (parent key payload, issueTypeId, cache invalidation).

## Verification

- Full test suite: **1821 passing, 0 failing, 2 skipped, 18 todo** (up from 1358 pre-phase)
- `npm run check` (biome + tsc): **clean**
- All Wave-0 test files exist and pass; `BulkCreateSubtasksModal.test.ts` green (6 passing + 5 todo)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript cast in migrate() required `as unknown as`**
- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** `{ templates: [] } as SubtaskTemplatesState` rejected by tsc — the partial object type doesn't satisfy the full state interface
- **Fix:** Changed to `{ templates: [] } as unknown as SubtaskTemplatesState` — the established Zustand persist migrate pattern (same as `tempo-filters.store.ts` uses `persisted as TempoFiltersState`)
- **Files modified:** `subtask-templates.store.ts`
- **Commit:** `bc746ac5`

**2. [Rule 1 - Style] Biome format fixes across all new files**
- **Found during:** Task 3 final `npm run check`
- **Issue:** Long ternary lines in resolveRowPlaceholders.ts, `['key']` bracket access vs dot notation in tests, unused `beforeEach` import in modal test, multiline arrow in store
- **Fix:** `biome check --write` (safe fixes) + `--unsafe` for literal key and unused import fixes
- **Files modified:** 6 files
- **Commit:** `bc746ac5`

## Known Stubs

None — all implementations are complete pure functions or persistence wiring. No data flows to UI rendering in this plan (that is Plan 02/03/04 territory).

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. `components` field addition to `fetchIssueDetail` is additive to an existing authenticated Jira request. T-80-01 (migrate coercion) and T-80-02 (discrete data fields, no interpolation) both mitigated as planned.

## Self-Check: PASSED

Files exist:
- `taskflow/src/stores/subtask-templates.store.ts` ✓
- `taskflow/src/stores/subtask-templates.store.test.ts` ✓
- `taskflow/src/routes/dashboard/resolveTemplateFields.ts` ✓
- `taskflow/src/routes/dashboard/resolveTemplateFields.test.ts` ✓
- `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts` ✓
- `taskflow/src/routes/dashboard/resolveRowPlaceholders.test.ts` ✓
- `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts` ✓

Commits exist:
- `4204065a` feat(80-01): add subtask-templates store with Tauri persistence ✓
- `4654d6d7` test(80-01): add failing tests for resolveTemplateFields and resolveRowPlaceholders ✓
- `655e51e7` feat(80-01): implement resolveTemplateFields and resolveRowPlaceholders pure functions ✓
- `794becec` feat(80-01): components on JiraIssueDetail, BulkProgressIndicator text props, modal test stub ✓
- `bc746ac5` style(80-01): apply biome format fixes to all plan-01 files ✓
