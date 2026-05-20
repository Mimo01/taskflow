# Stack Research: Tempo Timesheets Integration + Dashboard Redesign

**Milestone:** Taskflow v1.9 — Tempo, Dashboard Redesign & Cleanup
**Researched:** 2026-05-20
**Confidence:** HIGH (codebase analysis, removal safety) / MEDIUM (Tempo Server auth model)

---

## Scope

This is a SUBSEQUENT MILESTONE document. The validated v1.8 stack (Tauri 2, React 18,
TypeScript, TanStack Query v5, shadcn/ui, Tailwind v4, Zustand, Vitest, Biome, @dnd-kit,
@tanstack/react-virtual, react-grid-layout, jira2md, react-markdown, react-hotkeys-hook,
cmdk, babel-plugin-react-compiler, recharts) is NOT re-researched. Only net-new questions
for v1.9 are assessed here.

---

## New Dependencies Needed

**None.**

The existing stack is sufficient for all v1.9 features. No new packages need to be installed.

---

## Dependencies to Remove

| Package | Version in package.json | Why Safe to Remove |
|---------|--------------------------|-------------------|
| `react-grid-layout` | `^2.2.2` | Used exclusively in `src/routes/dashboard/WidgetGrid.tsx` and `src/routes/dashboard/index.tsx`. The entire widget dashboard system is being deleted in v1.9. No other files import it — confirmed via codebase grep. |
| `@types/react-grid-layout` | `^1.3.6` | Type declarations for `react-grid-layout` — redundant once the lib is removed. Note: react-grid-layout v2 ships its own types; `@types/react-grid-layout` is already deprecated upstream. Remove alongside the library. |
| `react-resizable` | Transitive dep of react-grid-layout | Only imported in `WidgetGrid.tsx` via CSS (`import 'react-resizable/css/styles.css'`). Safe to remove alongside react-grid-layout. |

**Removal safety check:**

```bash
# These are the only two files that reference react-grid-layout:
# taskflow/src/routes/dashboard/WidgetGrid.tsx
# taskflow/src/routes/dashboard/index.tsx
# Both files are being deleted entirely as part of the dashboard cleanup.
# No other source file imports from react-grid-layout or react-resizable.
```

The `DashboardLayoutItem` type exported from `src/stores/settings.store.ts` and the
`dashboardLayout`, `addDashboardWidget`, `removeDashboardWidget` store actions are also
being deleted. Any tests referencing these (e.g. `settings.store.test.ts`) will need
corresponding removal. All widget components under `src/routes/dashboard/widgets/` and
`WidgetCard.tsx`, `WidgetPicker.tsx` are deleted in the cleanup pass.

---

## Tempo Timesheets REST API

### Authentication Model — CRITICAL FINDING

**The Tempo Timesheets Server/DC REST API does NOT accept the Jira PAT Bearer token.**

Tempo is a third-party plugin that stores its data separately from core Jira. It has its
own authentication system requiring a **Tempo API Integration Token** generated from within
Tempo's own settings UI:

> Tempo → Settings → Data Access → API Integration → New Token

The generated token is used as a Bearer token in a separate Authorization header:
```
Authorization: Bearer <TempoAPIIntegrationToken>
```

The official documentation shows Basic Auth for Server/DC, but community-confirmed behavior
is:
- Basic Auth (`username:password`) — works on some older endpoints
- Jira PAT Bearer — does NOT work for `tempo-timesheets` endpoints (produces 401)
- Tempo API Integration Token as Bearer — the correct approach

**Implication for v1.9:** A new Tempo PAT credential must be added to the onboarding flow,
stored in Stronghold alongside the Jira PAT. This means extending `useAuthStore` with a
`tempoToken` field, adding a Tempo token input to Settings → Connections, and storing it
via `writeSecret('tempo-pat', token)`. A `tempoEnabled` toggle (same pattern as `aioEnabled`)
should gate all Tempo API calls.

**Confidence:** MEDIUM — auth model inferred from multiple community reports and the
architecture of Tempo as a separate plugin. Must be probe-verified in Phase 1 of v1.9
(same probe-first approach used for AIO in v1.8).

### Endpoint Structure

**Base path (Timesheets plugin v4):**
```
{jiraBaseUrl}/rest/tempo-timesheets/4/
```

**Primary worklog endpoint (POST — search/filter):**
```
POST {jiraBaseUrl}/rest/tempo-timesheets/4/worklogs/search
```

Request body:
```json
{
  "from": "2026-05-01",
  "to": "2026-05-31",
  "workerKeys": ["jdoe", "jsmith"],
  "projectKeys": ["ESHOP"]
}
```

Query params for pagination: `?limit=1000&offset=0`

**Response structure:**
```json
{
  "metadata": {
    "count": 42,
    "limit": 1000,
    "offset": 0
  },
  "results": [
    {
      "tempoWorklogId": 3920,
      "jiraWorklogId": 14020,
      "issue": {
        "key": "ESHOP-123",
        "id": 10991
      },
      "timeSpentSeconds": 3600,
      "startDate": "2026-05-15",
      "startTime": "09:00:00",
      "description": "Worked on checkout flow",
      "author": {
        "key": "jdoe",
        "displayName": "John Doe"
      }
    }
  ]
}
```

**Note on issue.key:** The v4 Cloud API omits `issue.key` and returns only `issue.id`.
The Data Center v4 endpoint at `apidocs.tempo.io/dc` does return `issue.key`. This must
be probe-verified on the actual instance — if only `issue.id` is available, issue keys
must be resolved via a Jira API call (`/rest/api/2/issue/{id}`), which can be batched.

**Pagination:** Max 1,000 per page. For typical team date ranges (2–4 weeks, 5–10 people),
response count is well under 1,000 — single-page fetch is sufficient. Add offset pagination
only if needed.

### Additional Useful Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rest/tempo-teams/2/team` | GET | List teams (needed for team-member filter) |
| `/rest/tempo-timesheets/4/timesheet-approval/user/{userKey}/log` | GET | Timesheet approval status per user |

For the v1.9 worklog viewer (showing people + date range), the worklogs search endpoint
is sufficient. Teams endpoint is optional — team membership can be inferred from Jira project
members already fetched for sprint board.

---

## Date Range Handling — No New Library Needed

The worklog viewer needs:
1. Date range selection (configurable from/to dates)
2. Date preset generation ("this week", "last week", "this month", "last 2 weeks")
3. Day-column table header generation (list of dates between from/to)
4. Working-day calculation (optional: highlight weekends differently)

**Recommendation: Use native Date API + small utility functions.**

The native `Date` API is sufficient for all these use cases without adding `date-fns`
(~18 KB gzip). The operations needed are:

```typescript
// Generate date range array
function dateRange(from: Date, to: Date): Date[] { ... }

// ISO date string for API params
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);  // "YYYY-MM-DD"
}

// Preset: this week (Mon–Sun)
function thisWeekRange(): [Date, Date] { ... }

// Check weekend
function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}
```

None of these require `date-fns`. The range length for the worklog table (max ~31 days) is
small enough that vanilla Date arithmetic is readable and maintainable. Only add `date-fns`
if locale-aware date formatting or complex business-day offset arithmetic is needed — neither
is required for v1.9.

**Confidence:** HIGH — confirmed via native Date API capability check.

---

## Table Virtualization — Existing Library Sufficient

The worklog table has:
- Rows: team members (5–15 people) × hierarchy levels (epic → story → subtask, ~3–4 levels)
- Columns: day columns across the date range (7–31 columns) + fixed first column (issue/person)

**Row count: ~50–200 rows maximum.** This is well within `@tanstack/react-virtual`'s
sweet spot. The existing `useVirtualizer` usage in `BacklogPage.tsx` and `SprintBoardTab.tsx`
provides proven patterns.

**Column virtualization: NOT needed.** With max 31 day columns (one month) plus the fixed
label column, the DOM column count never exceeds ~35 elements. This is trivially small —
column virtualization adds complexity for no performance benefit at this scale.

**Sticky first column and sticky header row:** Achievable with CSS `position: sticky` +
`left: 0` / `top: 0` on the container. This is a pure CSS concern, not a library
concern. The existing `@tanstack/react-virtual` handles vertical row virtualization if the
hierarchical row list grows large; sticky CSS handles the fixed dimensions.

**No `@tanstack/react-table` needed.** The worklog table is a specialized layout (day
columns as sum/dot cells, not generic sortable columns). TanStack Table's column model adds
overhead without benefit for a fixed-structure display. Build a bespoke table component
with custom row/column rendering — the same approach used for `SprintBoardTab` and
`BacklogPage`.

---

## Static Dashboard — No New Dependencies

The new minimal static dashboard (sprint health bar + my in-progress subtasks + next
release countdown) reuses:

- **Sprint health data:** Already fetched by `useSprintIssues` query used in `SprintBoardTab`
- **My in-progress subtasks:** Already fetched by `useMyTasks` query used in `MyTasksTab`
- **Next release countdown:** Already fetched by `useFixVersions` query used in `ReleasesTab`

All three panels render from cached TanStack Query data — no new API calls needed, no
new libraries needed. The static layout is plain Tailwind CSS grid/flex — no grid
library required. The existing `SprintHealthPanel`, `SubtasksPanel`, and `ReleasesTab`
components can be adapted or their query hooks reused directly.

---

## Existing Stack — What Covers Each v1.9 Need

| v1.9 Need | Covered By | No New Dep |
|-----------|------------|------------|
| Tempo API HTTP calls | `@tauri-apps/plugin-http` via existing `apiFetch` pattern | YES |
| Tempo auth token storage | Stronghold (`writeSecret`/`readSecret`) — same pattern as Jira PAT | YES |
| Date range inputs | shadcn `<Input type="date">` or `<Popover>` + `<Calendar>` (shadcn calendar already available via shadcn/ui) | YES |
| Date preset buttons | shadcn `<Button>` + native Date arithmetic | YES |
| Worklog table render | Custom component + CSS sticky + `@tanstack/react-virtual` for rows | YES |
| Row hierarchy (epic/story/subtask) | Collapsible pattern already established in `SprintBoardTab` + `StoryHeaderRow` | YES |
| Saved filters persistence | TanStack Query + `LazyStore` — same pattern as saved sprint board filters | YES |
| Sprint health panel | `SprintHealthPanel.tsx` exists — reuse or adapt | YES |
| Release countdown | `ReleasesTab.tsx` data + countdown display component | YES |
| Dashboard static layout | Tailwind CSS grid/flex — no library | YES |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `date-fns` | 18 KB for simple date arithmetic that 10 lines of native code handles | Native `Date` API + utility functions in `src/lib/date-utils.ts` |
| `@tanstack/react-table` | Heavy abstraction for a fixed-schema display table; adds complexity without benefit at 50–200 row scale | Custom table component with bespoke rendering |
| `react-datepicker` / `@mui/x-date-pickers` | Large dependencies for date inputs; shadcn/ui's `Calendar` + `Popover` pattern already available in the codebase | shadcn `<Calendar>` + `<Popover>` |
| New grid/layout library to replace react-grid-layout | The new dashboard is static — CSS grid handles it perfectly | Tailwind `grid` classes |
| `swr` or `axios` | Project uses TanStack Query + Tauri plugin-http exclusively | Existing `apiFetch` wrapper |
| Tempo JavaScript SDK (if one exists) | Adds vendor lock-in; typed interfaces over raw fetch is the established pattern across all services | Raw `apiFetch('tempo', ...)` calls in a new `src/services/tempo/` module |

---

## Tempo Service Module Pattern

Create `src/services/tempo/` mirroring the Jira domain module structure:

```
src/services/tempo/
  index.ts           # barrel re-export
  types.ts           # TempoWorklog, TempoAuthor, TempoSearchParams interfaces
  worklogs.ts        # fetchWorklogs(baseUrl, token, params): Promise<TempoWorklogPage>
  client.ts          # shared apiFetch wrapper with 'tempo' source type
```

The `apiFetch` wrapper needs a new `'tempo'` source type (unlike AIO which reused `'jira'`,
Tempo has a separate credential and a separate auth failure signal — a 401 should mark
`tempoConnected: false`, not `jiraConnected: false`).

**Query key convention:**
```typescript
queryKey: ['tempo-worklogs', jiraBaseUrl, searchParams]
queryKey: ['tempo-worklogs', jiraBaseUrl, { from, to, workerKeys }]
```

**staleTime:** 5 minutes — worklogs don't change frequently during a viewing session.

---

## Installation Commands

```bash
# No new packages to install

# Remove:
npm uninstall react-grid-layout @types/react-grid-layout
# react-resizable is a transitive dep — removed automatically when react-grid-layout is removed
```

---

## Version Compatibility

| Concern | Notes |
|---------|-------|
| react-grid-layout removal | v2.2.2 has no reverse dependencies in this codebase — safe to uninstall after deleting WidgetGrid.tsx, WidgetCard.tsx, WidgetPicker.tsx, widgets/ directory, and dashboard/index.tsx |
| `@types/react-grid-layout` | Already deprecated upstream (react-grid-layout v2 ships own types) — no risk removing it |
| Native Date API | Fully supported in all Tauri 2 webviews (Chromium-based on Windows/Linux, WebKit on macOS) — no polyfill needed |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| react-grid-layout safe to remove | HIGH | Grep-confirmed: only 2 files import it; both are being deleted |
| No new library needed for date handling | HIGH | All needed operations are trivial with native Date API |
| No new library needed for table | HIGH | Row counts are small; existing @tanstack/react-virtual is sufficient |
| Tempo auth requires separate token | MEDIUM | Multiple community reports + Tempo architecture (separate plugin, separate data store); must be probe-verified against the actual instance |
| Tempo API base path `/rest/tempo-timesheets/4/` | MEDIUM | Documented + community-confirmed; version "4" is the current DC API version; probe required to confirm 19.2.3 uses v4 vs. newer path |
| `issue.key` in DC v4 response | MEDIUM | DC docs suggest it's available; Cloud v4 omits it; probe required |
| Static dashboard reuses existing queries | HIGH | Sprint health, my tasks, and releases are already fetched — TanStack Query cache makes these zero-cost for the new dashboard page |

---

*Stack research for: Taskflow v1.9 Tempo Timesheets + Dashboard Redesign*
*Researched: 2026-05-20*
