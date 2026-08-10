# Phase 82: My Tasks Page - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a dedicated `/my-tasks` page — a personal command center showing the user's assigned issues in three configurable grouping modes (My Day, By Status, By Sprint & Parent), with a summary/filter strip, a scope toggle (Current Sprint ↔ All Assigned), inline status transitions, peek navigation, a right-click context menu, and grouping/scope preferences that survive app restarts via a new `stores/my-tasks.store.ts` (Zustand + Tauri Store).

WHAT this page delivers is locked by ROADMAP §Phase 82's 7 success criteria and requirements MYTASK-01..08. This discussion captures only the HOW/UX decisions left open inside that scope. No new capabilities — new ideas go to other phases.

</domain>

<decisions>
## Implementation Decisions

### Summary / Filter Strip (MYTASK-02)
- **D-01:** **Single-select, transient** filter behavior. Clicking a count (To Do / In Progress / In Review / Done this sprint / Overdue / MRs awaiting me) filters the list to matching rows; only **one** filter is active at a time. Clicking the active count again (or a different one) clears/switches it. The active filter is **transient — it resets on reload**. Per criterion 7, only *grouping mode* and *scope* persist; the filter does not.
- **D-02:** The active filter applies **on top of** the current grouping mode and scope (it narrows whichever grouping is rendered, not replaces it).

### Subtask Hierarchy (MYTASK-03, MYTASK-04)
- **D-03:** **Subtasks always render nested (indented) under their parent in every grouping mode** — My Day, By Status, and By Sprint & Parent. The parent issue is the grouping/sort anchor; standalone tasks (no subtasks) render as their own single rows. `fetchMyTasksHierarchy` already returns the parent+subtask hierarchy to support this.
- **D-04:** **My Day smart-sort: a parent floats to the rank of its most-urgent child.** A parent's sort position = the **highest-attention item in its subtree** (the parent's own status OR any of its subtasks), evaluated against the My Day band order: flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do → done. A parent with an overdue subtask sorts into the *overdue* band and drags its whole subtree with it. Standalone rows sort by their own attention. Within a band, parents keep their subtasks grouped beneath them.

### Scope Toggle — "All Assigned" UX (MYTASK-07)
- **D-05:** **All-Assigned group ordering (By Sprint & Parent):** active sprint(s) first, then **closed sprints newest-first**, then Backlog last.
- **D-06:** **Progressive/lazy loading, no hard cap.** While `fetchAllSearchPages` streams pages in, show a loading indicator ("loading more…"); the list grows as pages arrive. Server-side pagination handles volume — there is **no client-side page cap and no single-page-capped call** (enforced by criterion 6's unit test: 250 results when total=250 and first page returns 50). See [[project_fetch_once_pagecap_pitfall]].

### Inline Actions — Context Menu (MYTASK-06)
- **D-07:** Right-click context menu includes exactly **Log Work** (opens `LogWorkPopover`) and **Copy issue key / link**. Flag/Unflag and Open-in-browser were explicitly **not** selected for this phase (flagging still happens via peek/detail; the My Day flagged-band sort still reads the flag, it just isn't toggled from this menu).
- **D-08:** Other inline interactions are locked by criterion 5 and not re-litigated: row-body click → `PeekPanel` slideover; issue-key click → full-page detail; status-pill click → `StatusPopover` inline transition.

### Defaults (locked by success criteria — recorded for clarity)
- **D-09:** Default grouping on first load = **My Day**; default scope = **Current Sprint** (criterion 1). After first use, both are restored from `my-tasks.store.ts`.

### Persistence (MYTASK-08)
- **D-10:** New `stores/my-tasks.store.ts` (Zustand + Tauri Store `my-tasks.json`) persists **grouping mode** and **scope** only — not the transient filter (D-01). Follow the existing persisted-store pattern used by other `stores/*.store.ts` files.

### State Treatment (carried pattern)
- **D-11:** Reuse the shared `EmptyState` / `ErrorState` / `Skeleton` primitives from `components/ui/`. Empty cases to cover: My Day with nothing needing attention, an active filter yielding zero rows, and an empty All-Assigned result. Sections degrade independently (DASH-07 independence pattern, applied early here).

### Claude's Discretion
- Exact loading-indicator placement/style for progressive All-Assigned paging (within D-06).
- Precise component decomposition for the row (reusing/adapting `TaskCard` / `BacklogRow` anatomy vs. a new `MyTaskRow`) — planner/researcher choice, as long as the row shows the full anatomy in criterion/MYTASK-05.
- Precise store shape and selector design within D-10.
- Whether the collapse/expand affordance on sprint/parent groups is added (not required this phase; allowed if cheap).

### Reviewed Todos (not folded)
- `priority-stripe-rest-rank.md` — keyword-matched (priority/status/sprint) but is **sprint-board priority-stripe coloring** work, not My Tasks scope. Left deferred. See [[project_jira_priority_scheme]].

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — MYTASK-01..08 (lines 22–29) — the binding requirement list
- `.planning/ROADMAP.md` §Phase 82 (lines 396–410) — goal + 7 success criteria (the acceptance bar; criterion 6 mandates the pagination unit test)

### Codebase anchors — data
- `taskflow/src/services/jira.ts:483` — `fetchMyTasksHierarchy(...)` (current-sprint default load; returns parent+subtask hierarchy that D-03/D-04 depend on)
- `taskflow/src/services/jira.ts` + `taskflow/src/services/jira/client.ts` — `fetchAllSearchPages` (server-side pagination for All-Assigned scope; D-06)
- `taskflow/src/routes/dashboard/SubtasksPanel.tsx` — existing consumer of `fetchMyTasksHierarchy` (reference for hierarchy shape + react-query usage)

### Codebase anchors — UI reuse
- `taskflow/src/components/app/PeekPanel.tsx` — peek slideover (row-body click, D-08)
- `taskflow/src/routes/dashboard/StatusPopover.tsx` — inline status transition (status-pill click, D-08)
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — Log Work action (D-07)
- `taskflow/src/components/ui/context-menu.tsx` — radix context-menu primitive (D-07)
- `taskflow/src/routes/dashboard/TaskCard.tsx`, `taskflow/src/routes/dashboard/BacklogRow.tsx` — existing row anatomy (type icon, key, priority, summary, status pill, due, SP, MR badge, time bar) to reuse/adapt for MYTASK-05
- `taskflow/src/components/app/Sidebar.tsx`, `taskflow/src/components/app/sidebar-items.ts` — add the "My Tasks" → `/my-tasks` entry (MYTASK-01)
- `taskflow/src/routes/routes.tsx` — register the `/my-tasks` route (consider `React.lazy()` per the Phase 81 lazy-route pattern, D-07 of 81)

### Codebase anchors — persistence
- `taskflow/src/stores/*.store.ts` (e.g. `pinned-tabs.store.ts`, `recent-items.store.ts`) — established Zustand + Tauri Store persisted-store pattern to mirror for the new `my-tasks.store.ts` (D-10)

### Prior context
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — shared sidebar/layout + state-primitive reuse patterns carried forward

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchMyTasksHierarchy` (`services/jira.ts:483`): default current-sprint loader, returns parent+subtask hierarchy — directly powers nested rendering (D-03) and My Day subtree sort (D-04).
- `fetchAllSearchPages` (`services/jira.ts` / `services/jira/client.ts`): server-side paginated search for All-Assigned scope (D-06); already battle-tested in `epics.ts`.
- `PeekPanel`, `StatusPopover`, `LogWorkPopover`, `context-menu.tsx`: cover every inline interaction (D-07, D-08) — no new interaction primitives needed.
- `TaskCard` / `BacklogRow`: existing full row anatomy to adapt for MYTASK-05.
- `EmptyState` / `ErrorState` / `Skeleton` (`components/ui/`): per-section states (D-11).
- `Sidebar` / `sidebar-items.ts`: sidebar entry registration (MYTASK-01).

### Established Patterns
- Persisted Zustand stores backed by Tauri Store live in `src/stores/*.store.ts` with co-located `*.test.ts` — `my-tasks.store.ts` follows this exactly (D-10).
- Server-side pagination via `fetchAllSearchPages` is the project's standard against the recurring fetch-once page-cap pitfall ([[project_fetch_once_pagecap_pitfall]]).
- react-query caching of Jira/GH entity fetches (as in `SubtasksPanel.tsx`).

### Integration Points
- New route `/my-tasks` in `routes/routes.tsx` + sidebar item in `sidebar-items.ts`.
- New `stores/my-tasks.store.ts` (+ `my-tasks.json` Tauri Store) for grouping/scope persistence.
- New My Tasks page component tree under `src/routes/` consuming the data + UI assets above.

</code_context>

<specifics>
## Specific Ideas

- My Day's "parent floats to its most-urgent child" rule (D-04) is the single most subtlety-prone piece — the smart-sort key must be computed over a parent's *whole subtree*, not its own status. Worth an explicit unit test alongside criterion 6's pagination test.
- The summary-strip counts and the filter both derive from the same loaded dataset for the current scope — counts should reflect scope (e.g. "Done this sprint" is sprint-scoped).

</specifics>

<deferred>
## Deferred Ideas

- **Flag/Unflag and Open-in-browser context-menu actions** — considered, not included this phase (D-07). Easy to add later if desired.
- **Rank-order priority-stripe coloring** (`priority-stripe-rest-rank.md`) — sprint-board concern, out of My Tasks scope. See [[project_jira_priority_scheme]].

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 82-my-tasks-page*
*Context gathered: 2026-06-14*
