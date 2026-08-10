---
phase: 82-my-tasks-page
plan: "05"
subsystem: ui
tags: [react, react-router, sidebar, jira, container-queries, uat]

requires:
  - phase: 82-my-tasks-page
    provides: MyTasksPage + MyTaskRow (82-04), sort lib (82-01), store (82-02), service (82-03)
provides:
  - "/my-tasks lazy route registered + 'My Tasks' sidebar entry with CheckSquare icon"
  - "My Tasks page wired end-to-end and hardened through live UAT"
affects: [dashboard, my-tasks]

tech-stack:
  added: []
  patterns:
    - "Container-query responsiveness (@container + @[1000px]) for drawer-aware hide/show"
    - "Sprint-scoped JQL: done items only from the current/open sprint"

key-files:
  created: []
  modified:
    - taskflow/src/routes/routes.tsx
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/my-tasks/MyTasksPage.tsx
    - taskflow/src/routes/my-tasks/MyTaskRow.tsx
    - taskflow/src/services/jira.ts
    - taskflow/src/main.tsx

key-decisions:
  - "Row body click opens PeekPanel via outlet onOpenIssue; issue key opens full page via onIssueClick (breadcrumb-aware)"
  - "All Assigned/All Reported scopes: open-sprint issues always shown; future-sprint + backlog only when NOT done (done items appear only from the current sprint)"
  - "Epics excluded from all scopes; subtasks (incl. Done) shown under their parent"
  - "Grouping switcher removed at user request — page always uses the My Day band grouping"
  - "Story rows show accumulated (story + subtasks) logged/estimated time"
  - "Right-click quick-actions context menu removed at user request"

patterns-established:
  - "Drawer-aware responsive hide via Tailwind v4 container queries instead of viewport breakpoints"
  - "Design contract captured in 82-DESIGN-TARGET.md from an approved mockup before implementation"

requirements-completed: [MYTASK-01]

duration: multi-session
completed: 2026-06-14
---

# Phase 82 / Plan 05: My Tasks wiring + UAT hardening

**Registered the `/my-tasks` route, sidebar entry, and CheckSquare icon, then hardened the page across an extended live-UAT loop into a polished, app-consistent personal command center.**

## Accomplishments

### Task 1 — Route/sidebar/icon wiring (MYTASK-01)
- `/my-tasks` lazy route via the `withLazy` pattern (`routes.tsx`).
- "My Tasks" entry in `SIDEBAR_NAV_ITEMS` with `iconName: 'CheckSquare'`; `CheckSquare` added to `Sidebar.tsx` ICON_MAP (key matches the iconName).

### Task 2 — Human UAT (real Tauri build)
Verified against a real WebKit build. The checkpoint surfaced a large set of refinements and gaps, all resolved iteratively (see below).

## UAT-driven fixes & redesign (post-checkpoint)
- **Interactions:** row body → PeekPanel (was a navigate stub); issue key → full page with breadcrumb trail.
- **Service/data:** `fetchAllReportedHierarchy` (All Reported scope) added; All-Assigned/All-Reported sprint-scoped (open + future + backlog); epics excluded from all scopes; Done subtasks shown under parents; done stories shown only from the current sprint; `labels`, `updated`, and `priority` added to fetch fields.
- **Rows:** assignee avatars (far-right, no border); SP hidden on subtasks and styled to match BacklogRow; story-point accumulation of logged/estimated time on parents; standup-style time bars; metadata chips (labels → Flagged → MR health); priority after the key; Log Work on subtasks (later the right-click menu was removed entirely per request).
- **Layout:** redesigned to the approved mockup (`82-DESIGN-TARGET.md`) — hero header + sprint-progress donut + 3 stat tiles (To Do / In Progress / Done) doubling as the single-select filter; standup-style section headers; grouping switcher removed; clean flat rows with app-standard density/typography.
- **Responsive:** constant-height header; donut hidden via container query (`@[1000px]`) so it also hides when a drawer shrinks the content area.

## Verification
- `npm run check` (biome + tsc) clean; `npm test` green (1970 passing).
- Human UAT approved 2026-06-14.

## Notes / known limitations
- MR health shows the `Awaiting review` state when an authored MR matches; full `Approved`/`Changes requested` derivation needs per-MR `/approvals` + `/discussions` calls (not made here).
- All Assigned / All Reported scopes return parent issues only (no subtask nesting) by design.
- Sprint name/number not shown in the status line (not in fetched fields).
- `82-05-PLAN.md` documented the row context menu (MYTASK-06); it was removed at the user's explicit request during UAT.
