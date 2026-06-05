---
phase: quick-260605-hx2
plan: rework
subsystem: jira-issue-detail
tags: [jira, transitions, resolution, issue-detail, status-popover]
requires:
  - postTransition (existing)
  - GreenHopper transitions cache (useGhTransitions)
provides:
  - postTransition with optional presence-checked fields arg
  - fetchIssueTransitionsWithFields REST fetcher (expand=transitions.fields)
  - JiraTransitionWithFields / JiraTransitionFieldMeta types
  - transition-driven sidebar Resolution control
  - StatusPopover resolution picker step
affects:
  - taskflow/src/services/jira/transitions.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/StatusPopover.tsx
tech-stack:
  added: []
  patterns:
    - on-demand React Query keyed ['jira-issue-transitions-fields', issueKey, jiraBaseUrl] shared by sidebar + StatusPopover
    - resolution set exclusively via POST /issue/{key}/transitions fields.resolution
key-files:
  created: []
  modified:
    - taskflow/src/services/jira/transitions.ts
    - taskflow/src/services/jira/transitions.test.ts
    - taskflow/src/services/jira/types.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
    - taskflow/src/routes/dashboard/StatusPopover.tsx
    - taskflow/src/routes/dashboard/StatusPopover.test.tsx
decisions:
  - "postTransition includes the fields key via a presence check (fields !== undefined), NOT truthiness, so a { resolution: null } clear payload survives and no-fields callers keep { transition: { id } }"
  - "Sidebar resolution is editable only when an in-place loop transition (to.id === status.id) exposes fields.resolution; otherwise read-only with an explanation"
  - "Resolution options come from the transition's fields.resolution.allowedValues (id as value), preferred over the global resolution list which is no longer fetched in the sidebar"
  - "StatusPopover gains an optional resolution step for resolution-capable transitions; loading/errored REST metadata falls back to a plain transition rather than blocking"
metrics:
  duration: ~7m
  completed: 2026-06-05
---

# Phase quick-260605-hx2 Plan rework: Resolution via workflow transition Summary

Reworked the issue-detail Resolution control so resolution is set by EXECUTING a workflow transition (`POST /issue/{key}/transitions` with `fields.resolution`) instead of a direct field PUT that the live ESHOP Jira rejects, delivering both entry points: an in-place sidebar loop transition and a resolution picker step inside the StatusPopover status-change flow.

## What was built

### Task 1 — `postTransition` fields + `fetchIssueTransitionsWithFields` + types (`89e87f5c`)
- `postTransition` gained an optional 5th param `fields?: Record<string, unknown>`. The body is built with a **presence check** (`fields !== undefined ? { fields } : {}`), so a `{ resolution: null }` clear payload survives while existing no-fields callers still produce exactly `{ transition: { id } }`. URL, headers, and error handling unchanged.
- Added `fetchIssueTransitionsWithFields(baseUrl, token, issueKey)` → `GET /rest/api/2/issue/{key}/transitions?expand=transitions.fields`, returning the `transitions` array, with the resolutions-style error envelope (401/403 → `ApiError`, other non-OK → generic `Error`, label `'Load Transitions'`).
- Added `JiraTransitionWithFields` + `JiraTransitionFieldMeta` types in `types.ts` (`to.statusCategory?.key`, `fields?` map with `{ required, allowedValues?, operations? }`). `JiraTransition` left untouched. Both the fetcher and types are re-exported from `jira.ts`.

### Task 2 — Sidebar Resolution control via in-place transition (`222d93bf`)
- Removed the dead direct-PUT path (`handleResolutionChange`, the `fetchResolutions`-only query, and the `statusCategory==='done'` edit gate).
- Added an on-demand query keyed `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]`, enabled only while editing, deriving `inPlaceResolutionTransition` (first transition where `to.id === f.status.id && fields?.resolution`).
- The Select is editable only when such a transition exists; options come from its `allowedValues` (id as value), plus an "Unresolved" item when the resolution field is not `required`. Selecting runs a dedicated mutation calling `postTransition(..., { resolution: { id } | null })` with **no optimistic status change** (in-place loop). Otherwise the row renders read-only with the explanation "Resolution can only be changed via a status transition."

### Task 3 — StatusPopover resolution step (`5a6528b5`)
- Threaded optional `issueKey`/`jiraBaseUrl` props from FieldsSection. When open, StatusPopover fetches transitions-with-fields via the same shared cache key.
- `onSelect` signature extended to `(transitionId, toStatusName, opts?: { resolution: { id: string } | null })`. Picking a transition whose REST counterpart (matched by id) is resolution-capable shows an in-popover "Select resolution" step; choosing a resolution calls `onSelect(id, toName, { resolution: { id } })`. Non-capable transitions call `onSelect(id, toName)` immediately (unchanged). Loading/errored/empty REST metadata falls back to the plain transition.
- FieldsSection's `handleTransition` forwards the optional resolution into `postTransition`'s fields.

## Deviations from Plan

None — plan executed as written. The only non-task change was a Biome format pass on `transitions.test.ts` and `jira.ts` (already-committed Task 1 files), folded into the Task 3 commit.

## Verification

- `cd taskflow && npm run check` (biome + tsc): **PASS** — `Checked 460 files. No fixes applied.`
- `cd taskflow && npx vitest run src/services/jira/transitions.test.ts src/routes/dashboard/issue-detail/FieldsSection.test.tsx src/routes/dashboard/StatusPopover.test.tsx`: **PASS** — 3 files, **31/31 tests passed**.
- `grep -rn "fieldName: 'resolution'" taskflow/src`: no matches — direct-PUT resolution path fully removed.
- Post-build manual validation against live ESHOP-20308 (set + clear resolution from sidebar and via status change) is deferred to the user per the addendum scope decision.

## Environment note

The worktree had no `node_modules`; a symlink to the main checkout's `taskflow/node_modules` was created so vitest/tsc could run. The symlink is git-ignored and untracked — no tracked files affected.

## Self-Check: PASSED

- FOUND: taskflow/src/services/jira/transitions.ts
- FOUND: taskflow/src/services/jira/types.ts
- FOUND: taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
- FOUND: taskflow/src/routes/dashboard/StatusPopover.tsx
- FOUND commit: 89e87f5c
- FOUND commit: 222d93bf
- FOUND commit: 5a6528b5
