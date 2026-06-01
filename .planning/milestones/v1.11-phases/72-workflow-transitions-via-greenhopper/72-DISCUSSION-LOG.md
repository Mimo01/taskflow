# Phase 72: Workflow Transitions via GreenHopper - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 72-workflow-transitions-via-greenhopper
**Areas discussed:** Cache storage mechanism, Resolver shape, Cross-project handling, Manual refresh UX + projectId source

---

## Cache Storage Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| React Query (`['gh-transitions', projectId]`) | useQuery + invalidateQueries; natural session-scope; integrates with existing StatusPopover pattern | ✓ (Claude's discretion) |
| Module-level `Map<projectId, response>` | Singleton in services/jira/greenhopper/transitionsCache.ts | |
| Zustand store slice | Reactive slice on existing store | |

**User's choice:** "you decide"
**Notes:** Claude locked React Query for D-01 because (a) all 4 call sites already live in React Query–served contexts; (b) StatusPopover already uses `useQuery(['transitions', issueKey])` — the migration is a queryKey swap, not a paradigm shift; (c) session-scoped cache satisfies the "refresh on session start" requirement for free; (d) `queryClient.ensureQueryData` handles the imperative BulkActionBar case without inventing a new singleton.

---

## Resolver Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Adapt to legacy `JiraTransition` | Resolver synthesizes `to.{id, name, statusCategory}` so call sites stay unchanged | ✓ (Claude's discretion) |
| Return `GhTransition` + `statusOf` lookup | Callers do their own resolution | |
| `JiraTransition` + raw `__gh` escape hatch | Adapter shape plus GH flags | |

**User's choice:** "you decide"
**Notes:** Locked adapter shape (D-02) for minimal call-site churn, consistent with Phase 71 D-01's superset philosophy. Escape hatch dropped — no current consumer reads `hasScreen`/`hasConditions`/`isGlobal`/`isInitial`/`fromStatusId`. Surfaced a dependency: the adapter needs a `statusId → {name, category}` map, leading to D-06.

---

## Cross-Project Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project, no eviction | gcTime: Infinity; small workflow envelopes; matches React Query naturally | ✓ (Claude's discretion) |
| Per-project with LRU (~5 projects) | Defensive eviction | |
| Single-project slot, swap on switch | Cheapest memory, breaks cross-project BulkActionBar | |

**User's choice:** "you decide"
**Notes:** Locked unbounded per-project caching (D-04). BulkActionBar can legitimately hit multiple projects in one operation, and workflow envelopes are KB-sized.

---

## Manual Refresh UX + projectId Source

| Sub-area | Option | Selected |
|----------|--------|----------|
| Refresh trigger | Sprint-board toolbar menu item ("Reload workflow transitions") | ✓ (Claude's discretion) |
| Refresh trigger | Settings → Integrations page button | |
| Refresh trigger | Bundled into Phase 73 board reload | |
| projectId source | REST `issue.fields.project.id` + `issue.fields.issuetype.id` | ✓ (Claude's discretion) |
| projectId source | Pull Phase 73 forward, fetch allData for active board | |
| projectId source | Pass projectId explicitly from parent context | |

**User's choice:** "you decide" on both
**Notes:** Refresh action lives on the sprint-board toolbar (D-07) — one discoverable trigger, invalidates both `['gh-transitions', currentProjectId]` and `['jira-statuses']`, refetches, toasts. projectId/issueTypeId read from existing REST `JiraIssue` shape (D-05) to keep the phase a pure swap with no premature GH-adoption at call sites; Phases 73-75 will swap to GH-native fields as those surfaces flip.

---

## Claude's Discretion

All four areas — user answered "you decide" on every direct question. Decisions made:
- D-01/D-01a (cache layer: React Query)
- D-02/D-02a (adapter shape: legacy JiraTransition, no escape hatch)
- D-03/D-03a (public API: hook + imperative helper + invalidator; warn-once on workflow-name miss)
- D-04 (per-project, no eviction)
- D-05/D-05a (REST-issue source for IDs)
- D-06/D-06a/D-06b (status map via `/rest/api/2/status`, new `services/jira/statuses.ts` module)
- D-07/D-07a/D-07b (toolbar action; invalidates transitions + statuses; toast)
- D-08/D-08a (hard cutover; delete legacy `fetchTransitions`)

Planner-discretion items preserved in CONTEXT.md "Claude's Discretion" subsection.

## Deferred Ideas

- Bundled board-wide reload (Phase 73 may subsume the toolbar action).
- `postTransition` migration to GH (POST stays on REST).
- GH-only transition flags (`hasScreen`, `hasConditions`, etc.) not exposed; extend adapter if a future phase needs screen-aware UX.
- Performance verification recorded at milestone end per `GH-CUT-02`, not in this phase.
- Per-project `/rest/api/2/project/{id}/statuses` fallback if global `/rest/api/2/status` proves insufficient.
