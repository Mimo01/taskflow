# Phase 2: Developer Dashboard - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A developer opens the app and sees their current sprint tasks, a sprint board grouped by workflow status, and GitLab MRs needing attention — with automatic task-to-MR linking and the ability to take Jira actions (update status, add comment) without leaving the app. No notifications, no PM views — those are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Three tabs at the top of the main content area: **My Tasks | Sprint Board | MR Attention**
- Sidebar keeps a single 'Dashboard' nav entry (no sub-items)
- Default tab on open: **My Tasks**
- Each tab has its own last-refreshed timestamp + manual refresh button in the **top-right corner** of the content area (per-tab, independent refresh state)

### Sprint board columns
- Show **all Jira workflow statuses as columns** (one column per distinct status found in the current sprint)
- Board scrolls horizontally when there are more columns than fit the viewport
- Sprint board cards are **compact**: Jira key + task summary + assignee avatar + MR health badge (colored dot icon)
- No story points, no status badge on board cards (status is implied by the column)

### My Tasks list (list view)
- **Richer than board cards**: key | summary | status badge | assignee | story points | linked MR chips
- MR chip format: `[MR !42 🟡]` — MR number + review health badge
- Tasks with no linked MR show `[— no MR]`

### Write actions UX
- **Status transitions (JACT-01)**: click the status badge on any My Tasks row → inline popover with available workflow transitions fetched per-issue at runtime → select to update optimistically
- **Add comment (JACT-02)**: click comment icon (💬) on a My Tasks row → textarea expands inline below that row → Submit / Cancel
- **Write actions are only in My Tasks list** — sprint board cards are read-only
- **Error handling**: on API failure, revert optimistic update immediately + show inline error message on that specific card/row ("Failed to update — try again"); no toast, no modal

### MR Attention list
- Shows MRs **assigned to the developer** or where they are a **reviewer with open threads**
- Stale MRs flagged with an **amber badge showing age**: `🟠 Stale•5d`
- Stale threshold default: **3 days** of no activity
- Stale threshold is **configurable in the Settings page** (user sets it once, applies globally)

### Claude's Discretion
- Exact MR health badge color mapping (waiting for review / approved / changes requested)
- Loading skeleton design for each tab
- Empty state illustrations and copy for no-tasks / no-MRs
- Column min-width and scroll behavior for the sprint board
- Exact typography, spacing, and Tailwind classes

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/tabs.tsx` — shadcn/ui Tabs: ready to use for the My Tasks | Sprint Board | MR Attention tab structure
- `src/components/ui/button.tsx` — for refresh buttons, submit/cancel in inline comment form
- `src/components/ui/select.tsx` — could be used in Settings for stale threshold input
- `src/components/app/Sidebar.tsx` — vertical sidebar already established; Phase 2 adds a Dashboard nav item
- `src/components/app/ReAuthBanner.tsx` — already handles expired token UX; Phase 2 dashboard inherits this
- `src/services/jira.ts` — PAT auth pattern, tauri-plugin-http fetch, existing JiraUser/JiraProject interfaces
- `src/services/gitlab.ts` — PRIVATE-TOKEN auth pattern, existing GitLabUser/GitLabGroup interfaces
- `src/stores/settings.store.ts` — Zustand store; stale MR threshold setting goes here

### Established Patterns
- **tauri-plugin-http fetch** (not plain fetch): all Jira and GitLab API calls must use `fetch` from `@tauri-apps/plugin-http` — CORS bypass through Rust backend
- **Zustand stores**: state management pattern; new dashboard state (active tab, last-refreshed timestamps) follows existing store conventions
- **TanStack Query**: poll coordinator for data fetching; Phase 2 establishes the single poll coordinator (min 60s background) that Phase 3 notifications will reuse
- **Jira REST v2** (not Cloud): use `name` not `accountId`, Bearer PAT auth, offset pagination, per-issue transitions endpoint
- **GitLab REST**: PRIVATE-TOKEN header, not Authorization: Bearer

### Integration Points
- `src/routes/dashboard/index.tsx` — currently a placeholder; Phase 2 replaces this with the full dashboard component
- `src/stores/settings.store.ts` — stale MR threshold and active Jira project/GitLab group already stored here; new 'staleMrThresholdDays' setting added
- Jira: `GET /rest/api/2/search` (JQL for sprint tasks), `GET /rest/api/2/issue/{key}/transitions` (per-issue), `POST /rest/api/2/issue/{key}/transitions` (status change), `POST /rest/api/2/issue/{key}/comment`
- GitLab: `GET /api/v4/merge_requests` (assigned/reviewer), `GET /api/v4/projects/{id}/repository/commits` (fallback link scan)

</code_context>

<specifics>
## Specific Ideas

- My Tasks list mockup: `PROJ-123  Fix login bug  [In Review]  J.Smith  3sp  [MR !42 🟡]`
- Sprint board mockup: `[ To Do ] [ Analysis ] [ In Dev ] [ In Review ] [ Testing ] [ Done ]` with horizontal scroll
- Status popover on badge click: small popover with list of transition names (`→ In Testing`, `→ Done`, `→ Reopen`)
- Inline comment expand: textarea appears below the task row, stays in list context (no navigation away)
- Stale badge: `🟠 Stale•5d` amber label on MR rows

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-developer-dashboard*
*Context gathered: 2026-03-11*
