# Feature Research

**Domain:** Personal Workspace — My Tasks command center + graph-driven Dashboard (v1.13)
**Researched:** 2026-06-14
**Confidence:** HIGH (grounded in Linear My Issues, Jira Your Work/All Work, GitHub assigned-to-me, Asana My Tasks, GreenHopper API investigation, shadcn/Recharts docs)

---

## Part 1: My Tasks / My Work View

Reference products: Linear My Issues (Focus grouping), Jira "Your Work" / "All Work" tab grouping, GitHub Issues "assigned to me", Asana My Tasks auto-sections.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Data Dependency | Notes |
|---------|--------------|------------|-----------------|-------|
| Flat list of all issues assigned to me (current sprint) | Every personal task tool has this; missing = broken | LOW | `assignee = currentUser()` filter on GH allData — already fetched | Filter client-side from cached allData; no new fetch for sprint scope |
| Scope toggle: current sprint vs all assigned | Devs need "now" (sprint) vs "everything I own" | LOW | Sprint scope: free from GH allData. "All assigned" needs a new JQL query: `assignee = currentUser() AND statusCategory != Done` | All assigned is a NEW REST v2 JQL fetch; lazy-load on toggle; beware fetch-once page-cap pitfall |
| Status shown per row | Users track work by status constantly | LOW | Status name + category in GH allData | Reuse StatusPopover for inline transition |
| Priority icon per row | Devs triage by priority daily | LOW | Priority field in GH allData | Reuse PriorityIcon |
| Issue type icon per row | Subtask vs story vs bug look identical without it | LOW | issuetype in GH allData | Reuse IssueTypeIcon |
| Issue key + summary per row | The row must be identifiable at a glance | LOW | Already in GH allData | Key → full page; body → peek (v1.12 established pattern) |
| Peek on row click | Users drill in without losing list context | LOW | Universal peek already built (v1.12 Phase 77) | Apply existing peek pattern; no new code |
| Inline status transition | Completing tasks without leaving the list is expected | MEDIUM | Already built: StatusPopover + optimistic update | Wire StatusPopover directly in the row |
| Sprint + parent story context per row | "What story is this subtask under?" reduces cognitive load | LOW | Sprint name + parent key/summary in GH allData | Subtask-under-parent grouping already built (v1.1, Standup Today) |
| Empty state when nothing assigned | Confused users abandon the view | LOW | n/a | Reuse existing illustrated empty-state pattern |
| Loading + error states | Non-negotiable for any data view | LOW | n/a | Existing skeleton + StaleDataBanner patterns |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Data Dependency | Notes |
|---------|-------------------|------------|-----------------|-------|
| "My Day" smart-sort grouping (Focus-style) | Linear's most-praised UX — surfaces what to work on NOW without manual triage. Sections in order: Overdue → In Progress → Blocked (flag set) → Due Today → Current Sprint (other statuses) → Other Assigned → Done | MEDIUM | Overdue: `duedate < today` on the duedate field. Blocked: `customfield_10021` (already integrated, v1.12). In Progress / Done: status category. ALL available in GH allData. | No new API calls; pure client-side sort/group logic on existing cached data |
| By-Status grouping mode | Familiar Jira-style; devs want all "In Review" items together | LOW | Status category in GH allData | Simple client-side groupBy(statusCategory); behind the same grouping toggle |
| By-Sprint-and-Parent grouping mode | Shows work in context of its story — mirrors Standup Today's layout (already built) | LOW | Sprint + parent in GH allData | Reuse subtask-under-parent collapsible grouping from v1.1/Standup |
| MR health badge per row | Devs live in MRs; "approved / changes-requested / pipeline failing" inline saves a GitLab context switch | MEDIUM | MR linking via ticket key parsing already built; MR state already fetched | Board card MR badges already exist — reuse the same badge component |
| Due date per row (with overdue highlight) | Makes the "Overdue" My-Day section meaningful; devs self-manage deadlines | LOW | `duedate` field in GH allData | Red/muted highlight for `duedate < today`; no new data |
| Story points per row | PMs review estimates; devs compare effort | LOW | SP field discovered via `discoverStoryPointsField()`, present in GH allData | Already shown on board cards; copy the pattern |
| timeInColumn aging badge per row | Surfaces stale WIP immediately — "In Review 4d" is actionable without opening a chart | LOW | `timeInColumn` computed in GH allData (v1.11 Phase 73) | Already rendered on sprint board cards — paste the same badge |
| Flags/blocked indicator per row | Blocked issues must be obvious; `customfield_10021` flag already integrated (v1.12) | LOW | Already fetched and integrated | Add a blocked pill/icon; no new data |
| Summary filter strip (status category chips + type chips) | Narrows a long list without JQL knowledge | MEDIUM | Client-side; all fields already in memory | 3–4 chip groups max; do NOT build a full JQL filter bar |
| "Log Work" quick action on row | Logging time inline without opening issue detail saves clicks for Tempo users | MEDIUM | LogWorkPopover already built (v1.5); Tempo service built (v1.9) | Surface from a row context menu (right-click or "..." overflow); no new API |
| Time tracking mini-bar per row | Shows logged/remaining at a glance | MEDIUM | `timeoriginalestimate`, `timespent`, `timeestimate` in GH allData | Reuse sidebar progress bar pattern from issue detail; optional if row gets too dense |

### Anti-Features (Explicitly Avoid)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Full JQL filter bar | Power users want it | Months of work; explicitly out of scope in PROJECT.md | Chip filters (status/type/priority) cover 95% of daily needs |
| Cross-project My Tasks | "Show all my work across projects" | Core constraint: one Jira project at a time; multi-project multiplies data model complexity | Scope toggle (current sprint / all in project) is the correct boundary |
| Manual drag-to-reorder (à la Asana My Tasks) | Feels powerful | Jira rank applies globally to the backlog, not to personal lists; drag-to-rank on a personal view would silently reorder for everyone | Sort modes (My Day / by status / by sprint) replace personal reordering |
| Due-date inline edit from the list | Devs want to set deadlines quickly | `duedate` PUT requires the field to be on the edit screen for the project; inconsistent across Jira DC instances; field edit belongs in issue detail | Keep the row read/transition-focused; open issue detail for field edits |
| Separate "inbox / triage" section | Some Jira workflows have triage statuses | This team uses a 3-bucket workflow (Future/Active/Done); no triage status exists | "Overdue + no sprint" in My Day smart-sort acts as a de-facto triage bucket |

---

## Part 2: Dashboard — Personal Stat Tiles and Charts

Reference products: Jira dashboard gadgets, Linear Insights, Azure DevOps dashboards, Tempo reports, sprint velocity research, dashboard design best-practice literature.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Data Dependency | Notes |
|---------|--------------|------------|-----------------|-------|
| Personal stat tiles: Open / In Progress / Done counts (sprint, me) | Instant at-a-glance health — the first thing any developer checks | LOW | GH allData filtered by `assignee = me` client-side | 3 tiles max above the fold; no new fetch |
| Sprint points-by-status stacked bar or donut chart | Single most-requested agile chart; already computed in v1.1 | MEDIUM | Status-bucket point totals already computed from GH allData | CHARTING LIBRARY REQUIRED. Reuse existing data; render as stacked bar. |
| MR review queue section | Devs need to see which MRs await their review; old Dashboard had MR Attention | MEDIUM | GitLab MR data already fetched; filter: `reviewer = me AND state = open AND not approved` | Reuse MR health badges; list with status chip + age. No new data. |
| Next release countdown | Already on the old Dashboard; removing it would be a regression | LOW | Fix versions already fetched (Releases view) | RETAIN from current Dashboard — it is one of the 3 cards being replaced, but keep the content |
| Weekly hours logged tile (current week total) | Tempo users want to know if they're on track | LOW | Tempo worklogs already fetched for Worklogs page; sum `timespent` for `assignee = me`, current week | New derived computation but uses existing Tempo service; no new endpoint |
| Sprint name / sprint goal display | Orients user to which sprint they're in | LOW | Sprint name + goal already in GH allData | Already on Sprint Board banner (v1.5); copy the pattern |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Data Dependency | Notes |
|---------|-------------------|------------|-----------------|-------|
| Weekly hours logged bar chart by day (Mon–Fri) | Shows distribution across the week — catches "I logged nothing Monday/Tuesday" before the week ends | MEDIUM | Tempo worklogs already fetched; group `timespent` by date for current week | CHARTING LIBRARY REQUIRED. Simplest useful chart: 5 daily bars, 1 series. Highly feasible. |
| Aging WIP count tile (my in-progress issues > N days) | "3 items stuck In Review for 5+ days" is immediately actionable without opening a chart | LOW | `timeInColumn` per issue already in GH allData (v1.11) | Filter `assignee = me AND statusCategory = active AND timeInColumn > threshold`. No new data. |
| MR pipeline status in review queue | "Approved but pipeline failing" vs "approved and green" changes priority | LOW | GitLab pipeline status (`pipeline.status`) already in MR data | Add a pipeline status dot next to each MR; no new API |
| Sprint burndown chart for current sprint (CONDITIONAL) | Shows whether the team will finish on time; the most classic agile chart | HIGH | CRITICAL DATA GAP: GreenHopper `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=&sprintId=` returns `{ changes: { "<unix_ms>": [{ key, statC: { newValue }, added }] } }` — a timestamp-keyed changelog of SP changes and scope additions/removals throughout the sprint. CONFIRMED to work on Jira Data Center. NEW FETCH REQUIRED. | This is NOT the same as "historical analytics" — it is a live call for the current sprint. But it is a new GH endpoint not yet called in the app. Flag as NEEDS PROBE in the burndown phase. Reconstruct: sum committed SP at sprint start, walk the change log to get remaining SP per day, draw ideal vs actual lines. HIGH complexity. |
| Personal velocity trend (points completed per sprint, last N sprints) (CONDITIONAL) | Shows personal throughput trend — is the dev completing more or fewer points per sprint over time? | HIGH | CRITICAL DATA GAP: GreenHopper `/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=&sprintId=` returns completed/incomplete/punted issues with SP. Requires iterating N closed sprints and calling this endpoint per sprint, filtering by `assignee = me`. N API calls. NEW FETCH REQUIRED per sprint. | CLOSEST to the PROJECT.md "out of scope" historical analytics warning. Flag for product owner decision. Consider: only show if ≥ 3 closed sprints; cache aggressively; limit to last 5 sprints. |
| Activity feed (recent changelog on my issues) | Shows what changed on personal work while away | MEDIUM | Jira issue changelog already fetched in the unified activity timeline (v1.5); filter to `assignee = me` issues | Show last ~15 events grouped by day; chronological. Low priority. |

### Anti-Features (Explicitly Avoid)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Configurable widget grid (drag-to-resize layout) | Users always ask for "customize it" | Widget grid was built in v1.5 and EXPLICITLY REMOVED in v1.9 Phase 59 because nobody knew what to put where; re-adding react-grid-layout reintroduces a removed dependency | Fixed curated layout; allow section collapse/expand if more control is needed |
| Team velocity (aggregate across all assignees) | PMs want it | This is a PERSONAL workspace — v1.13 is explicitly personal. Team analytics belongs in a future PM-facing sprint report surface | Show personal velocity only; label clearly as "my completed points per sprint" |
| Points-committed vs completed bar with insufficient history | Looks like a good metric | With fewer than 3 closed sprints it is noise, not signal; misleading for new projects or after team changes | Only render velocity chart if ≥ 3 closed sprints with data; otherwise show "Not enough sprint history yet" |
| Cumulative Flow Diagram (CFD) | Analytics evangelists request it | Requires daily status-bucket snapshots for ALL sprint issues across the FULL sprint timeline; impossible to reconstruct from Jira changelog without a persistent snapshot store; LinearB/Swarmia exist for this | Explicitly out of scope (PROJECT.md: "Historical analytics / burndown charts — no daily-use value; complex data pipeline") |
| "Time to First Commit" / cycle-time metrics | Developer productivity measurement culture | Requires parsing commit timestamps from GitLab and correlating to Jira assignment dates — multi-source join with no clean API surface; not actionable daily | Out of scope; GitLab Insights covers this |
| Per-epic breakdown donut on Dashboard | Interesting for 1 day | Nobody acts on it after the initial novelty; it consumes chart real estate for decoration | If needed, build it on the Backlog or a dedicated Sprint Report page |
| "Total team logged hours this week" tile | PMs want team visibility | This is the PERSONAL workspace; team time tracking belongs in Worklogs page (already built with full hierarchy) | Direct user to the Worklogs page for team view |

---

## Feature Dependencies

```
My Tasks Page
    ├──reuses──> StatusPopover (transition) — already built
    ├──reuses──> PriorityIcon / IssueTypeIcon — already built
    ├──reuses──> MR health badge component — already on board cards
    ├──reuses──> Universal peek slideover — already built (v1.12 Phase 77)
    ├──reuses──> timeInColumn badge — already in GH allData (v1.11)
    ├──reuses──> Subtask-under-parent grouping — already built (v1.1, Standup Today)
    ├──reuses──> LogWorkPopover — already built (v1.5)
    └──NEW──> "All assigned" JQL fetch — new REST v2 query, lazy on scope toggle

Dashboard
    ├──reuses──> GH allData (sprint issues + SP totals) — already fetched
    ├──reuses──> Tempo worklogs service — already built (v1.9)
    ├──reuses──> GitLab MR data — already fetched
    ├──reuses──> Fix versions / releases data — already fetched
    ├──reuses──> timeInColumn per issue — already in GH allData
    ├──NEW──> Charting library (Recharts via shadcn/ui chart component) — FIRST TIME in app
    ├──NEW──> Weekly hours aggregation: group Tempo worklogs by date for current week
    ├──CONDITIONAL──> Sprint burndown → GH scopechangeburndownchart endpoint — new fetch, probe required
    └──CONDITIONAL──> Personal velocity → GH sprintreport per closed sprint — N new fetches, product owner decision required

Charting library
    └──required-by──> Sprint points-by-status chart (stacked bar)
    └──required-by──> Weekly hours logged bar chart
    └──required-by──> Sprint burndown (if built)
    └──required-by──> Personal velocity trend (if built)
```

### Dependency Notes

- **Charting library must be selected and installed before any chart component.** This is the single new hard dependency for v1.13. Decision below.

- **Burndown is CONDITIONAL on a GH endpoint probe.** The `scopechangeburndownchart` endpoint is confirmed to exist on Jira Data Center (the target environment) and is accessible with the existing Bearer PAT pattern. It has never been called in this app. A probe must verify the response shape against the real instance before committing to implementation. The PROJECT.md "out of scope" note targets aggregate historical analytics (LinearB-style), NOT a live current-sprint burndown — these are different.

- **Personal velocity is CONDITIONAL and closer to "out of scope".** It requires one `sprintreport` API call per closed sprint. With 10+ sprints in history that is 10+ sequential fetches on Dashboard load. This needs caching (TanStack Query gcTime: Infinity), a sprint-list fetch to enumerate closed sprint IDs, and product owner sign-off that the API cost is acceptable.

- **"All assigned" scope has a fetch-once page-cap risk.** The new JQL query for all assigned issues must paginate server-side (not fetch one capped page and filter client-side). Apply the established pattern from other paginated fetchers. See MEMORY: `project_fetch_once_pagecap_pitfall.md`.

---

## MVP Definition

### Launch With (v1.13)

**My Tasks Page:**
- [x] Flat list, current sprint scope, assignee = me (from existing GH allData)
- [x] Three grouping modes behind a toggle: My Day (smart-sort) / By Status / By Sprint & Parent
- [x] Row fields: type icon, priority, key + summary, status, due date (overdue highlight), SP, timeInColumn badge, MR health badge, blocked indicator
- [x] Inline status transition via StatusPopover
- [x] Row body → peek; issue key → full page (existing pattern)
- [x] Summary filter strip: status category chips + issue type chips
- [x] Scope toggle: current sprint / all assigned (lazy fetch for "all" with pagination)

**Dashboard:**
- [x] Personal stat tiles: Open / In Progress / Done (sprint, me)
- [x] Sprint points-by-status stacked bar chart (Recharts via shadcn chart)
- [x] MR review queue (open MRs awaiting my review, reuse existing MR logic)
- [x] Next release countdown (retained from current Dashboard)
- [x] Weekly hours logged tile: total for current week (Tempo sum)
- [x] Weekly hours logged bar chart: Mon–Fri bars (Recharts)
- [x] Aging WIP count tile (me, in-progress > N days, from timeInColumn)
- [x] Sprint goal / sprint name header

### Add After Validation (v1.13.x or v1.14)

- [ ] Sprint burndown chart — CONDITIONAL on GH `scopechangeburndownchart` probe success; flag in the relevant phase plan
- [ ] Personal velocity trend (last N closed sprints) — CONDITIONAL on GH `sprintreport` feasibility and product owner sign-off
- [ ] "Log Work" quick action from My Tasks row — feasible; validate demand after ship
- [ ] Activity feed on Dashboard — useful but lower priority than the charts

### Future Consideration (v2+)

- [ ] Cross-project My Tasks — blocked by one-project-at-a-time core constraint
- [ ] Team velocity / team analytics — PM-oriented, needs a separate sprint report surface
- [ ] Cumulative Flow Diagram — explicitly out of scope (PROJECT.md)

---

## Feature Prioritization Matrix

### My Tasks

| Feature | User Value | Impl Cost | Priority |
|---------|------------|-----------|----------|
| My Day smart-sort grouping | HIGH | MEDIUM (client-side logic on existing data) | P1 |
| Inline status transition | HIGH | LOW (StatusPopover reuse) | P1 |
| By-Status and By-Sprint grouping modes | HIGH | LOW (client-side groupBy) | P1 |
| MR health badge per row | HIGH | LOW (badge component reuse) | P1 |
| Scope toggle + all-assigned fetch (paginated) | MEDIUM | MEDIUM (new JQL fetch + pagination guard) | P1 |
| timeInColumn aging badge | MEDIUM | LOW (already in allData) | P1 |
| Due date display + overdue highlight | HIGH | LOW | P1 |
| Blocked/flag indicator | MEDIUM | LOW (customfield_10021 already fetched) | P1 |
| Summary filter chips | MEDIUM | MEDIUM | P2 |
| Time tracking mini-bar | LOW | MEDIUM | P2 |
| Log Work quick action | MEDIUM | MEDIUM | P2 |

### Dashboard

| Feature | User Value | Impl Cost | Priority |
|---------|------------|-----------|----------|
| Personal stat tiles (3 counts) | HIGH | LOW | P1 |
| Points-by-status stacked bar (Recharts) | HIGH | MEDIUM (charting library + data wire-up) | P1 |
| MR review queue | HIGH | LOW (reuse existing MR list logic) | P1 |
| Next release countdown (retained) | HIGH | LOW | P1 |
| Weekly hours logged tile | HIGH | LOW (Tempo sum) | P1 |
| Weekly hours logged bar by day | HIGH | MEDIUM (group + chart) | P1 |
| Aging WIP tile | MEDIUM | LOW (timeInColumn already available) | P1 |
| Sprint goal / name header | LOW | LOW | P1 |
| Sprint burndown chart | MEDIUM | HIGH (new GH endpoint + conditional) | P2 |
| Personal velocity trend | MEDIUM | HIGH (multi-sprint fetch + conditional) | P2 |
| Activity feed | LOW | MEDIUM | P3 |

---

## Charting Library Decision

**Recommendation: Recharts via the shadcn/ui `chart` component**

Rationale:
- The app already uses shadcn/ui for all UI primitives. The shadcn `chart` component wraps Recharts v3, wires CSS variable theming (`--chart-1` through `--chart-5`) into the existing Tailwind v4 + shadcn CSS token system out of the box — zero manual theme plumbing.
- Recharts v3 is fully React 18 + React Compiler compatible; works in Tauri WebView (no SSR concerns).
- shadcn's chart does NOT wrap Recharts in an abstraction — it exposes Recharts components directly, so the Recharts upgrade path remains open and the existing team knowledge of Recharts applies.
- Chart types needed in v1.13: stacked bar (points-by-status), simple bar (weekly hours), line (burndown ideal/actual — conditional), bar (velocity — conditional). All are first-class Recharts chart types with shadcn examples.
- Bundle concern: Recharts v3 is ~370KB but tree-shaking is effective per chart type; for a Tauri desktop app where there is no network cost (local bundle), this is acceptable.
- visx would be smaller (~15KB modular) but requires D3-level composition for every chart — the chart types here are simple enough that Recharts' declarative API is strictly better DX.
- nivo has better visual defaults but ~500KB+ full install, documented module compatibility issues, and no shadcn integration path.

---

## Data Dependencies Summary

| Feature | Data Source | Already Fetched? | New Fetch Required? |
|---------|-------------|------------------|---------------------|
| My Tasks list (current sprint, me) | GH allData.json | YES | No — filter client-side |
| My Tasks list (all assigned) | Jira REST v2 JQL search | NO | YES — lazy, on scope toggle, PAGINATED |
| Status / priority / type / SP / due date / timeInColumn / flag | GH allData.json | YES | No |
| Parent key + sprint name per row | GH allData.json | YES | No |
| MR health badges per row | GitLab MR API | YES | No |
| Sprint points by status (chart) | GH allData.json | YES | No — derived client-side |
| Weekly hours logged (tile + bar chart) | Tempo worklogs API | YES (Worklogs page query) | No — reuse with `assignee = me, date = this week` scope |
| Next release countdown | Jira fix versions API | YES | No |
| Aging WIP (timeInColumn filter) | GH allData.json | YES | No |
| Sprint burndown (CONDITIONAL) | GH `scopechangeburndownchart` | NO | YES — new fetcher; probe first |
| Personal velocity per sprint (CONDITIONAL) | GH `sprintreport` × N closed sprints | NO | YES — N fetches; aggressive caching required |

---

## Historical Data Flag

**Sprint burndown** is the key "is this truly in scope?" question.

The GreenHopper `scopechangeburndownchart` endpoint returns a live changelog for the CURRENT active sprint — it is not an offline historical store. The response maps Unix timestamps to scope events (`added: true/false`, `statC.newValue` for SP changes). To render the chart:
1. Fetch at page load (one API call per active sprint).
2. Reconstruct the remaining-SP series: start from committed points at sprint start, apply each change log entry in timestamp order.
3. Draw ideal line: linear from committed SP to 0 over sprint calendar days.
4. Draw actual line: the reconstructed remaining-SP per day.

This is materially different from "historical analytics across many sprints" (which the PROJECT.md explicitly rules out). A live burndown for the current active sprint is daily-use value. Mark this as P2/CONDITIONAL but not out-of-scope on principle — it needs a PROBE phase to validate the endpoint and response shape against the real DC instance.

**Personal velocity** DOES require iterating closed sprints. Each `sprintreport` call covers one closed sprint. With 10 historical sprints that is 10 API calls on Dashboard load. This is closer to the "complex data pipeline" the PROJECT.md warns about. Gate behind product owner sign-off and a minimum of 3 closed sprints before rendering.

---

## Sources

- Linear My Issues docs: https://linear.app/docs/my-issues
- Linear Display Options: https://linear.app/docs/display-options
- Linear conceptual model / cycles: https://linear.app/docs/conceptual-model
- Linear My Issues practical guide (Descript): https://linear.app/now/descript-internal-guide-for-using-linear
- Jira "Group Your Work" All Work tab (2024): https://community.atlassian.com/forums/Jira-articles/Group-your-work-items-in-the-All-work-tab/ba-p/2992173
- GitHub new PR dashboard (public preview, March 2026): https://github.blog/changelog/2026-03-26-new-pull-requests-dashboard-is-in-public-preview/
- GitHub assigned-to-me issues: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/viewing-all-of-your-issues-and-pull-requests
- Sprint burndown report overview: https://support.atlassian.com/jira-software-cloud/docs/what-is-the-sprint-burndown-report/
- GreenHopper burndown API (community, DC confirmed): https://community.atlassian.com/forums/Jira-questions/How-do-I-fetch-Sprint-Burndown-data-via-API-calls-or-otherwise/qaq-p/2623047
- GreenHopper sprintreport endpoint: https://community.developer.atlassian.com/t/agile-api-equivalent-for-a-greenhopper-sprintreport-url/3997
- Sprint velocity anti-patterns: https://www.parabol.co/blog/sprint-velocity/
- WIP Aging chart concepts: https://getnave.com/aging-chart-for-jira
- Dashboard design best practices: https://www.domo.com/learn/article/dashboard-design-examples-best-practices
- Azure DevOps actionable dashboards: https://learn.microsoft.com/en-us/azure/devops/report/dashboards/dashboard-focus
- shadcn/ui chart component (Recharts v3): https://ui.shadcn.com/docs/components/radix/chart
- shadcn Tailwind v4 upgrade: https://ui.shadcn.com/docs/tailwind-v4
- Recharts vs visx vs nivo 2026: https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026
- Best React chart libraries 2026: https://blog.logrocket.com/best-react-chart-libraries-2026/

---
*Feature research for: Taskflow v1.13 Personal Workspace (My Tasks + Dashboard)*
*Researched: 2026-06-14*
