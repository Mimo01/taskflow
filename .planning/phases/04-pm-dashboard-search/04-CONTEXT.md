# Phase 4: PM Dashboard + Search - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A project manager can see sprint progress (task counts + story points), team workload (per-member open tasks + points), and release state (Jira fix versions linked to GitLab milestones/tags). Any user can search across Jira tasks and GitLab MRs by keyword or ticket key, with results showing in-app. No write actions from search or PM views — those are future scope.

</domain>

<decisions>
## Implementation Decisions

### PM dashboard navigation
- Same `/dashboard` route as the developer dashboard — role-aware rendering at runtime
- PM role → tabs: **Sprint Progress | Workload | Releases**
- Developer role → tabs: **My Tasks | Sprint Board | MR Attention** (unchanged)
- Default PM tab on open: **Sprint Progress**
- No quick-switch between roles from the dashboard; role change goes through Settings
- Sidebar: existing single "Dashboard" nav link is sufficient — no new nav entries for PM

### Sprint progress display
- Layout: **horizontal progress bar + raw numbers** — e.g. `[=====----] 34 / 55 pts`
- Status breakdown grouped into **3 buckets**: To Do / In Progress / Done
- Bucket mapping uses Jira's built-in `statusCategory.key` field on each issue:
  - `'new'` → To Do
  - `'indeterminate'` → In Progress
  - `'done'` → Done
- When the sprint has **no story points** (all issues unestimated): hide the progress bar entirely, show task counts only — no "0 / 0 pts" display
- Each bucket row shows task count; the points bar shows done vs remaining aggregate

### Global search placement and behavior
- Search icon in the **existing top bar** (alongside the bell notification icon)
- Click opens a **full-width overlay** with a search input (does not navigate away from current page)
- Search triggers **debounced as-you-type** (~400ms) — fires Jira JQL + GitLab search API in parallel
- Results grouped by type: **Tasks** section then **Merge Requests** section
- Clicking a result opens a **read-only in-app detail panel** (similar to the notification detail pattern from Phase 3):
  - Jira task panel: title, status, assignee, story points, description excerpt, linked MR chips
  - GitLab MR panel: title, status, author, linked Jira task key
  - Both panels include an **"Open in Jira/GitLab ↗"** button via the existing `openUrl` (tauri-plugin-opener) pattern

### Releases view linking logic
- Jira fix versions are linked to GitLab milestones or tags by **date matching** (±1 day tolerance)
- Match field: Jira fix version `releaseDate` vs GitLab milestone `due_date` or tag creation date
- **Exact date match**: solid link — milestone/tag name shown normally
- **±1 day fuzzy match**: milestone/tag name shown with a **dotted underline / dashed border** to signal approximate match
- **No match within ±1 day**: fix version still appears in the list with a muted **"No GitLab link"** label — never hidden
- Each fix version row shows: version name, release date, linked GitLab milestone/tag (or no-link label), task count, completion status (done / total tasks from Jira)

### Claude's Discretion
- Exact progress bar visual implementation (CSS gradient, height, color values)
- Loading skeleton design for PM tabs
- Empty state design for Workload tab (no sprint members) and Releases tab (no fix versions)
- Search overlay animation / transition
- Exact dotted/dashed border styling for fuzzy release matches
- Tooltip content on hover for fuzzy match indicator (e.g., showing the actual date delta)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/tabs.tsx` — shadcn/ui Tabs: direct reuse for PM tab set (Sprint Progress / Workload / Releases) in the same shell as the dev dashboard
- `src/components/ui/popover.tsx` — shadcn/ui Popover: reuse for the search overlay (or use a Dialog/Sheet — Claude to decide)
- `src/components/ui/button.tsx` — for "Open in Jira/GitLab" buttons in detail panels
- `src/routes/notifications/NotificationDetail.tsx` — read-only detail panel pattern from Phase 3; search result detail should follow the same structure
- `src/routes/notifications/NotificationPopover.tsx` — overlay/panel pattern to reference for search overlay
- `src/components/app/TopBar.tsx` — top bar already has bell icon; search icon slot goes here
- `@tauri-apps/plugin-opener` (openUrl) — already used in Phase 2 and Phase 3 for external links; reuse for "Open in Jira/GitLab"
- `src/stores/settings.store.ts` — Zustand persist pattern for any new settings (none needed for Phase 4)
- `src/stores/dashboard.store.ts` — existing active-tab store; extend or create parallel store for PM active tab

### Established Patterns
- **tauri-plugin-http fetch**: all Jira and GitLab API calls use `fetch` from `@tauri-apps/plugin-http`
- **TanStack Query + poll coordinator**: PM tabs and search use the same query patterns; search likely uses `enabled: query.length > 0` to avoid empty queries
- **Inline errors, no toast/modal**: error handling consistent with Phases 2–3
- **Zustand + persist**: any new state follows existing store conventions
- **Role-based rendering**: `useSettingsStore().role === 'pm'` check at the dashboard level to swap tab sets

### Integration Points
- `src/routes/dashboard/index.tsx` — replace static tab set with role-conditional rendering
- `src/components/app/TopBar.tsx` — add search icon + overlay mount point
- Jira API: `GET /rest/api/2/search` (JQL for sprint tasks with `statusCategory` field), `GET /rest/api/2/version` (fix versions for active project)
- GitLab API: `GET /api/v4/groups/{id}/milestones`, `GET /api/v4/projects/{id}/repository/tags` (for release date matching), `GET /api/v4/search` (for MR search)
- New route components: `SprintProgressTab.tsx`, `WorkloadTab.tsx`, `ReleasesTab.tsx` under `src/routes/dashboard/`
- New search components: `SearchOverlay.tsx`, `SearchResultPanel.tsx` — likely under `src/routes/search/` or `src/components/app/`

</code_context>

<specifics>
## Specific Ideas

- Sprint Progress bar mockup: `[=================--------] 34 / 55 pts`
- Status breakdown mockup:
  ```
  ● To Do         12 tasks
  ● In Progress    8 tasks
  ● Done          18 tasks
  ```
- Releases row mockup (exact match): `v2.1.0   2026-03-15   GitLab: sprint-15   3/8 tasks done`
- Releases row mockup (fuzzy match): `v2.1.0   2026-03-15   GitLab: sprint-15̲ (dotted)   3/8 tasks done`
- Releases row mockup (no match): `v2.1.0   2026-03-15   — No GitLab link   3/8 tasks done`
- Search overlay mockup (from discussion):
  ```
  ┌────────────────────────────────┐
  | 🔍  Search tasks and MRs...     |
  |                                |
  |  Tasks                         |
  |  ○ PROJ-123 Fix login bug       |
  |  ○ PROJ-99 Update API layer     |
  |                                |
  |  Merge Requests                |
  |  ┣ !42 feat: auth rewrite       |
  └────────────────────────────────┘
  ```
- Search result detail panel mockup:
  ```
  ━ PROJ-123: Fix login bug
  Status: In Review  |  Assignee: J.Smith
  Points: 3

  Description:
  The login form throws an uncaught exception...

  Linked MRs: !42 feat: auth rewrite [open]

  [ Open in Jira ↗ ]
  ```

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-pm-dashboard-search*
*Context gathered: 2026-03-11*
