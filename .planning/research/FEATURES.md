# Feature Research: Tempo Worklog Viewer + Minimal Static Dashboard

**Project:** Taskflow v1.9 — Tempo Timesheets + Dashboard Redesign
**Researched:** 2026-05-20
**Confidence:** HIGH for Tempo API shape (verified against live DC docs + community articles);
HIGH for dashboard card scope (agreed scope from PROJECT.md); MEDIUM for UX patterns (Tempo
Cloud docs as proxy for DC behaviour — minor differences may exist)

---

## Domain Context

Two distinct feature areas in this milestone:

1. **Tempo worklog viewer** — reads from the Tempo Timesheets plugin REST API on the same
   on-premise Jira Data Center instance (base path `/rest/tempo-timesheets/`). Separate from
   Jira's native `/rest/api/2/issue/{key}/worklog` (already built for v1.5 issue detail time
   tracking). Tempo adds team-wide logged time across issues with date-column layout.

2. **Minimal static dashboard** — replaces the widget-based customizable dashboard (react-grid-layout,
   11 widget types). Agreed scope: exactly 3 cards. No customization. No drag/resize. No role presets.

---

## Feature Landscape

### Table Stakes — Tempo Worklog Viewer

Features users expect in any serious worklog viewer. Missing these makes the view feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Day-column grid layout | Core Tempo UX — each day is a column, hours per cell | MEDIUM | Date range drives column count; cells show h/m total per person+day |
| Row-per-user (or issue) with daily subtotals | Every time-tracking tool shows this | LOW | Sum logged seconds per (user, date) pair from API response |
| Date range selector with presets | Without this, users reopen the view to a useless default | LOW | Presets: This Week (default), Last Week, This Month, Last Month, custom |
| Total column (sum of row across days) | Users need the weekly/monthly total without mental math | LOW | Right-most sticky column summing all day cells in the row |
| Total row (sum of column across users) | PMs need per-day team total to spot under/over-logged days | LOW | Bottom-most row summing all user cells in the day column |
| Loading/error/empty states | Consistent with rest of Taskflow | LOW | Skeleton on load; ErrorState on API failure; empty state when no worklogs |
| People filter (select which users to show) | Team has many members; PM only wants their squad | MEDIUM | Multi-select list of Jira users; persisted as a saved filter config |
| Saved filter with named preset | "My squad, last week" should be one click | MEDIUM | Save (name + people list + date preset); list in sidebar; auto-load on nav |

### Table Stakes — Minimal Static Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sprint health bar | First thing every dev looks at — are we on track? | LOW | Points done vs. total; % complete; days remaining; reuses SprintHealthPanel already built |
| My in-progress subtasks | What am I working on right now? | LOW | Jira: `assignee = currentUser() AND status = "In Progress" AND issuetype in subtaskIssueTypes()` — data already fetched for sprint board |
| Next release countdown | When is the next ship date? How many days left? | LOW | Reuses existing Releases data (fix versions with dates); pick soonest unreleased future release |

### Differentiators — Tempo Worklog Viewer

Features that make the Taskflow Tempo view better than switching to the Jira/Tempo web UI.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Epic/Story/Subtask row hierarchy | Log time is often on subtasks; seeing it rolled up to epic gives PM context Tempo's flat list hides | HIGH | Requires enriching worklog issue keys with parent/epic chain via Jira API; grouping logic non-trivial |
| Highlight cells over/under threshold | Tempo's native UI does this — devs instantly see who logged less than 6h on a day | LOW | Compare cell hours against configurable threshold (e.g. 7.5h); colour the cell background |
| "Last working day" smart preset | Monday morning: nobody cares about the weekend; "last working day" = Friday | LOW | Skip Sat/Sun when computing "last working day"; simple date arithmetic |
| Drill-down tooltip on cell click | Click a cell to see individual worklogs (issue key + description + time) aggregated into that day | MEDIUM | Popover listing raw worklog entries summed into the cell |
| Persist people list across sessions | Saved filter remembered without re-opening the filter panel every time | LOW | LazyStore (same as pinned tabs pattern) |

### Differentiators — Minimal Static Dashboard

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Instant load (stale-while-revalidate) | Widget dashboard was slow; static cards use cached data immediately | LOW | All three cards read from queries already live for other views (sprint, releases) |
| Zero configuration | Widget dashboard required setup; static cards just work | NONE | No state, no presets, no drag/resize to implement |

### Anti-Features

Features that look useful but create complexity disproportionate to their value for this team.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Timesheet approval workflow | Tempo has it; devs expect it | Requires submit/approve/reject state machine, notifications, PM action surface — weeks of work for a PM-only workflow that PMs can do in the Jira web UI | Read-only worklog view is sufficient; approval stays in Jira |
| Billable vs. non-billable hours split | Finance teams love it | Requires Tempo Accounts configuration per instance; not all teams use Accounts; high setup friction | Show total logged hours only; skip billing categorization |
| Worklog write (log time from the viewer) | "Log my time here instead of Jira" | Issue detail already has worklog CRUD (v1.5); duplicating it in the viewer creates two entry points and sync complexity | Deep-link from viewer cell to the relevant issue detail where logging already works |
| Team capacity planning overlay | "Show planned vs. logged" | Requires Tempo Planner (a separate plugin); not part of Timesheets; adds a second API integration | Sprint health bar on dashboard covers capacity at sprint level |
| Burndown chart on dashboard | Stakeholders ask for it | Requires daily snapshot data; Jira/Tempo don't expose historical point snapshots via REST in a usable form; PROJECT.md explicitly out of scope | Sprint health bar percentage is sufficient for daily pulse |
| Customizable dashboard (keep the widgets) | Some users have personalised layouts | React-grid-layout, 11 widget types, drag/resize grid = thousands of lines to maintain; most users ignore customization after initial setup | Static 3-card layout serves 90% of actual daily use; PROJECT.md explicitly removes widgets |
| Per-user worklog detail page | Drill into one person's full log | Creates a separate route, its own date navigation, and a permissions question (can I see others' full logs?) | Cell drill-down tooltip covers the need without a full route |
| Issue-type grouping toggle (story/epic/user) | Power users want to pivot | Three separate grouping modes × server data enrichment = 3× implementation; rarely used after first week | Single hierarchy mode (user rows with issue-level detail in tooltip) covers daily use |
| Export to CSV/Excel | "For reporting" | Tempo's own export is robust; reimplementing it in Tauri requires file dialog + CSV serialization + cross-platform path handling | Deep-link to Tempo's own export in the Jira web UI |

---

## Feature Dependencies

```
Tempo Worklog Viewer
  └── requires: Tempo PAT config (same Jira PAT — Tempo is on same host)
  └── requires: People list (Jira users from existing fetchJiraUsers or project members)
  └── requires: Date range selector (new component)
  └── enables: Saved filter (wraps people list + date preset)

Epic/Story hierarchy rows
  └── requires: Tempo Worklog Viewer (base table first)
  └── requires: Jira issue enrichment (parent + epic chain per worklog issue key)
  └── NOTE: this is a differentiator, not table stakes — build flat user rows first

Saved Filter
  └── requires: People filter multi-select (built as part of viewer)
  └── requires: LazyStore persistence (already in codebase)
  └── enhances: Tempo Worklog Viewer (one-click load preset)

Minimal Dashboard — Sprint Health Card
  └── requires: SprintHealthPanel component (already built in v1.1)
  └── requires: fetchActiveSprint + fetchSprintIssues (already in jira.ts)

Minimal Dashboard — My In-Progress Subtasks Card
  └── requires: fetchSprintIssues result filtered to currentUser + In Progress + subtask
  └── NOTE: query already runs for sprint board; cache hit, no new fetch

Minimal Dashboard — Next Release Countdown Card
  └── requires: fetchFixVersions (already in jira.ts, used in ReleasesPage)
  └── requires: logic to pick soonest unreleased future release by releaseDate

Dashboard cleanup (remove widget system)
  └── removes: react-grid-layout dependency
  └── removes: Workload route + all related widgets
  └── NOTE: do removal before building new dashboard to avoid merge conflicts
```

### Dependency Notes

- **Epic hierarchy requires flat viewer first:** The row-hierarchy differentiator requires the
  worklog service layer and flat table to exist. Do not attempt hierarchy in the same phase as
  the base viewer — it adds a Jira enrichment N+1 risk that needs independent validation.

- **Dashboard cards are independent:** All three card data sources already exist in the query
  layer. The static dashboard is assembly work, not new data work.

- **Saved filter depends on people list UX:** The filter panel must be built before save is
  possible. Build filter UI → then wire save/load on top.

- **Cleanup must precede new dashboard:** Removing react-grid-layout and the workload route
  avoids conflicts with the new dashboard index route. Delete first, then build.

---

## Tempo Data Center API Shape

**Confidence: MEDIUM** — Documented in Tempo's DC migration guide and community articles.
Requires probe verification on the live instance before service functions are written.

The Tempo Timesheets plugin on Jira Data Center exposes a servlet REST API at:
```
{jiraBaseUrl}/rest/tempo-timesheets/{version}/
```

Key endpoint for worklog data:
```
GET /rest/tempo-timesheets/4/worklogs
  ?dateFrom=YYYY-MM-DD
  &dateTo=YYYY-MM-DD
  &username={jiraUsername}    # filter by user (optional; omit = all users)
  &projectKey={key}           # filter by project (optional)
```

Alternative (undocumented but community-confirmed):
```
GET /rest/tempo-timesheets/1/tempo-worklogs
  ?jql=worklogAuthor in (user1,user2)
  &dateFrom=YYYY-MM-DD
  &dateTo=YYYY-MM-DD
  &paginate=false
```

Worklog response fields (MEDIUM confidence — probe required):
```typescript
interface TempoWorklog {
  id: number;
  issue: {
    key: string;          // e.g. "SHOP-123"
    summary: string;
    issueType?: { name: string };
  };
  author: {
    name: string;         // Jira username (Data Center uses name, not accountId)
    displayName: string;
    avatarUrls?: Record<string, string>;
  };
  timeSpentSeconds: number;
  dateStarted: string;    // "YYYY-MM-DDThh:mm:ss.000" or "YYYY-MM-DD"
  comment?: string;
}
```

Auth: same `Authorization: Bearer <PAT>` as all Jira calls. Tempo piggybacks on Jira auth.
No separate Tempo token needed for Data Center (DC uses Jira PAT; Cloud uses a separate Tempo
OAuth token — this project is DC only).

**Critical pre-implementation step:** Hit `/rest/tempo-timesheets/4/worklogs?dateFrom=...&dateTo=...`
on the live instance and inspect the actual response envelope and field names before writing
TypeScript types.

---

## MVP Scope for v1.9

### Build (table stakes first)

1. **Tempo worklog viewer** (flat user-row layout):
   - Day-column grid for a date range
   - Row per person, cell = total logged hours that day
   - Total column (right) + total row (bottom)
   - Date presets: This Week (default), Last Week, This Month, Last Month, custom
   - People filter multi-select
   - Loading/error/empty states
   - "Last working day" smart preset (skip weekends)

2. **Saved filter**:
   - Save name + people list + date preset
   - Sidebar list (same sidebar pattern as saved Jira filters from v1.5)
   - Auto-load last used filter on navigation

3. **New minimal static dashboard**:
   - Sprint health card (reuse SprintHealthPanel)
   - My in-progress subtasks card (filtered sprint query)
   - Next release countdown card (soonest unreleased release with date)

4. **Cleanup**:
   - Remove react-grid-layout + all widget components
   - Remove Workload route and all references

### Defer to v1.9.x or later

- Epic/story/subtask row hierarchy — differentiator but HIGH complexity (N+1 enrichment risk)
- Cell drill-down tooltip — nice-to-have, implement only if time allows
- Cell colour thresholds — trivial once base table exists; add in same phase or as a quick task

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Day-column grid (flat user rows) | HIGH | MEDIUM | P1 |
| Date range presets | HIGH | LOW | P1 |
| People filter | HIGH | MEDIUM | P1 |
| Total row + total column | HIGH | LOW | P1 |
| Saved filter | MEDIUM | MEDIUM | P1 |
| Sprint health card | HIGH | LOW | P1 |
| My in-progress subtasks card | HIGH | LOW | P1 |
| Next release countdown card | MEDIUM | LOW | P1 |
| Remove widget dashboard | HIGH (maintenance debt) | MEDIUM | P1 |
| Cell highlight threshold | MEDIUM | LOW | P2 |
| Cell drill-down tooltip | MEDIUM | MEDIUM | P2 |
| Epic/story hierarchy rows | MEDIUM | HIGH | P3 |
| Timesheet approval | LOW (for this team) | HIGH | Defer indefinitely |
| CSV export | LOW | MEDIUM | Defer indefinitely |
| Billable/non-billable split | LOW | HIGH | Defer indefinitely |

---

## Sources

- [Tempo Help Center — Viewing Reports (DC)](https://help.tempo.io/timesheets-dc/latest/viewing-reports-tempo-server)
- [Tempo Help Center — Overview of the Timesheet](https://help.tempo.io/timesheets/latest/overview-of-the-timesheet)
- [Tempo Help Center — Grouping Worklogs in Timesheet View (DC)](https://help.tempo.io/timesheets-dc/latest/grouping-worklogs-in-the-timesheet-view-tempo-serv)
- [Tempo Help Center — REST APIs for Jira Data Center](https://help.tempo.io/cloudmigration/latest/rest-apis-for-jira-server-data-center)
- [Dario Djuric — Retrieving Worklogs Using Jira Tempo REST API](https://dario-djuric.medium.com/retrieving-worklogs-using-jira-tempo-rest-api-f7a0c77c4832)
- [Accelo Timesheet Overview Guide](https://help.accelo.com/guides/user/timers-timesheets-and-scheduling/timesheet-reports/) — date preset patterns
- [Atlassian — 7 steps to a beautiful and useful agile dashboard](https://www.atlassian.com/blog/jira-software/7-steps-to-a-beautiful-and-useful-agile-dashboard) — dashboard card ordering rationale
- Taskflow PROJECT.md (confirmed scope, existing components, key decisions)
- Taskflow codebase inspection — existing SprintHealthPanel, fetchFixVersions, fetchSprintIssues patterns

---
*Feature research for: Taskflow v1.9 Tempo Worklog Viewer + Minimal Static Dashboard*
*Researched: 2026-05-20*
*Confidence: HIGH for dashboard scope (agreed); MEDIUM for Tempo API shape (requires live probe)*
