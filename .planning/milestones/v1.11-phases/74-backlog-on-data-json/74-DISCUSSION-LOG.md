# Phase 74: Backlog on `data.json` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 74-backlog-on-data-json
**Areas discussed:** Scope of the swap, Entity-map + sprint-grouping source, Field gaps in GhIssue, Legacy cleanup + reload bundle

---

## Pre-discussion finding (changed the framing)

Before discussion started, inspection of the actual fixture (`taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json`) revealed that `data.json` carries **far more** than the GREENHOPPER-API.md research doc suggested — specifically:
- `entityData.{statuses, priorities, types, epics}` (full entity maps)
- `sprints[]` with metadata + `issuesIds[]` (sprint membership)
- `rankCustomFieldId`, `projects`, `versionData`, `canCreateIssue`, `canManageSprints`, `cardColorStrategy`, `emptyFilterBoard`

The doc only described `{ issues: Issue[] }`. The current `GhBacklogResponse` type (`types.ts:160-166`) inherits the doc's incomplete shape. This finding made a full-page rewrite onto `data.json` viable in one call, where it would otherwise have required a companion `allData.json` fetch for entity maps.

This was surfaced to the user before the four area-selection questions.

---

## Scope of the swap

| Option | Description | Selected |
|--------|-------------|----------|
| Full page rewrite onto data.json | One `useGhBacklogData(boardId)` call replaces all three current queries. Sprint sections derived from `sprints[].issuesIds[]`; backlog = issues not in any sprint. Entity maps live in same response. Cleanest fit for GH-BACKLOG-01. | ✓ |
| Minimal swap (backlog query only) | Replace only `fetchBacklogIssues→data.json`. Keep sprint-list + per-sprint stories REST. Violates literal "single request" criterion. | |
| Hybrid: data.json for issues+entity maps, keep sprint-list REST | data.json drives backlog + sprint-section issue lists + entity maps; keep `fetchSprintList` REST for canonical ordering. Hedges against edge cases. | |

**User's choice:** Full page rewrite onto data.json (recommended option).
**Notes:** The pre-discussion fixture finding made this the clear winner — `data.sprints[]` carries everything needed for sprint section rendering including empty sprints.

---

## Mutations

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing REST mutations + invalidate `['gh-backlog', boardId]` | Mirrors Phase 72 D-08 (postTransition stays REST). All mutation handlers stay; only their invalidation calls swap from the three legacy keys to the new GH cache key. Lowest-risk. | ✓ |
| Investigate GH endpoints for these mutations as part of this phase | Researcher probes whether GH POSTs would be faster/cleaner. Wider scope. | |

**User's choice:** Keep existing REST mutations (recommended).
**Notes:** Phase 72 precedent already established this convention. Optimistic-update logic in handlers needs porting to the new single-cache shape (D-06a).

---

## Field gaps in GhIssue

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter synthesizes what it can; accept reduced filter fidelity | Adapter maps GhIssue→JiraIssue (assignee, story points, status/type/epic via entityData). Label filter drops in this phase. Subtask + flagged drops on backlog rows. Captured as known UX deltas. | ✓ |
| Probe data.json deeper for labels/subtasks first | Spawn researcher to verify whether labels/subtasks appear in a less-obvious field on GhIssue. | |
| Secondary REST fetch for filter dimensions only | Keep a slim REST query for label/assignee filter dropdowns. Violates "single data.json" if interpreted strictly. | |

**User's choice:** Adapter synthesizes what it can (recommended).
**Notes:** Loss of label-filter parity is the main UX delta. Captured in CONTEXT.md Deferred Ideas. If users flag it post-ship, revisit via probe or secondary REST.

---

## Legacy cleanup + reload action

| Option | Description | Selected |
|--------|-------------|----------|
| Delete board-only fetchers; add Reload-backlog action | Delete `fetchBacklogIssues`, `fetchBacklogSprintStories`, `fetchBacklogView` (verify unused) + re-exports. KEEP `fetchSprintList` (FieldsSection.tsx still uses it). Add "Reload backlog" toolbar action invalidating `['gh-backlog', boardId]` + epics + statuses. Mirrors Phase 73. | ✓ |
| Delete fetchers but skip the Reload action | Rely on staleTime + auto-invalidation on mutations. Skip the new toolbar control. | |
| Planner decides cleanup scope after running grep | Capture intent, let planner verify each fetcher's call sites before committing. | |

**User's choice:** Delete board-only fetchers; add Reload-backlog action (recommended).
**Notes:** `fetchSprintList` is confirmed in-use at `FieldsSection.tsx:32,153` and stays. `fetchBacklogView` may be unused (planner runs final grep before deletion).

---

## Claude's Discretion

The planner has flexibility on (per CONTEXT.md "Claude's Discretion"):
- Hook return shape — raw envelope vs derived `{ backlog, sprints, entityMaps }`.
- Whether to factor a shared `useReloadBacklog` hook for the toolbar action.
- Whether to extend the Phase 71 adapter or write a backlog-specific variant.
- Whether to surface closed sprints as a collapsed section.
- Exact toolbar placement (mirror Phase 73).
- Whether to drop `flagged` from backlog rows or chase via a secondary REST call.

## Deferred Ideas

- Label filter on backlog — drops in this phase; restoration deferred.
- Subtask chips on backlog cards — drops; low signal on backlog anyway.
- `flagged` indicator on backlog rows — drops unless trivially mapped.
- GH-side mutation endpoints (move/rank/create POSTs) — future phase.
- `details.json` caching — Phase 75 scope.
- Performance verification — Phase 75 final artifact per GH-CUT-02.
- Closed-sprint section — future UX phase.
- `useReloadBacklog` shared hook — promote only if a second consumer appears.
- Issue-detail sprint picker swap (`FieldsSection.tsx`) — Phase 75 scope.
- `fetchBacklogView` deletion — defer if planner finds residual callers.
