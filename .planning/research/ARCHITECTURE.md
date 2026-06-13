# Architecture Research

**Domain:** Personal Workspace integration into Taskflow (My Tasks page + Dashboard redesign + charting foundation)
**Researched:** 2026-06-14
**Confidence:** HIGH — grounded entirely in reading the actual codebase (jira.ts, main.tsx, routes.tsx, greenhopper/*, stores/*)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           main.tsx (AppLayout)                              │
│  HashRouter + QueryClientProvider + Zustand stores                          │
│  Manages: peek state, create modal, nav handlers, hotkeys                   │
│  Outlet context: { onIssueClick, onOpenIssue, openEdit, openClone, ... }    │
├──────────────────────────┬──────────────────────────────────────────────────┤
│       Sidebar            │   main (flex-1 overflow-auto)                    │
│  sidebar-items.ts        │                                                  │
│  + visibility toggles    │  ┌────────────────────────────────────────────┐  │
│                          │  │  /dashboard   → DashboardPage (MODIFIED)   │  │
│                          │  ├────────────────────────────────────────────┤  │
│                          │  │  /my-tasks    → MyTasksPage (NEW)          │  │
│                          │  ├────────────────────────────────────────────┤  │
│                          │  │  /sprint-board → SprintBoardTab (existing) │  │
│                          │  ├────────────────────────────────────────────┤  │
│                          │  │  /standup-notes → StandupNotesPage        │  │
│                          │  └────────────────────────────────────────────┘  │
│                          │                                                  │
│                          │  PeekPanel (flex-row sibling, non-blocking)      │
└──────────────────────────┴──────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┴───────────────────────────────────────┐
│                         Data Layer                                          │
│                                                                             │
│  services/jira.ts (barrel — all 60+ imports use this path)                 │
│  ├─ fetchSprintIssues()         ['jira-issues','sprint-board',project,spKey]│
│  ├─ fetchMyTasksHierarchy()     ['jira-issues','my-tasks',project,spKey]   │
│  ├─ fetchActiveSprint()         ['jira-active-sprint',project,base,boardId] │
│  └─ (NEW) fetchMyAssignedIssues() ['jira-issues','my-tasks-all',project]   │
│                                                                             │
│  services/jira/sprints.ts                                                   │
│  ├─ fetchActiveSprint()         (existing)                                  │
│  └─ (NEW) fetchClosedSprints()  ['jira-closed-sprints',boardId]             │
│                                                                             │
│  services/jira/greenhopper/                                                 │
│  ├─ useGhAllData()              ['gh-all-data', boardId]  (sprint-board only)│
│  └─ fetchBacklogData()          ['gh-backlog', boardId]   (backlog page)    │
│                                                                             │
│  services/gitlab.ts                                                         │
│  ├─ fetchAssignedMRs/fetchReviewerMRs  ['gitlab-mrs', base, userId]        │
│  └─ ['mr-health', project_id, iid]  populated by MrHealthPanel             │
│                                                                             │
│  services/tempo/                                                            │
│  └─ fetchWorklogs()             ['tempo','worklogs',...]                    │
│                                                                             │
│  stores/ (Zustand + Tauri Store persist)                                    │
│  ├─ settings.store.ts           storyPointsFieldKey, peekPanelWidth, etc.  │
│  ├─ auth.store.ts               jiraBaseUrl, jiraUserDisplayName, etc.      │
│  └─ (NEW) my-tasks.store.ts     groupMode, scopeToggle persisted            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `AppLayout` (main.tsx) | Global chrome: sidebar, top bar, peek panel, hotkeys, outlet context | All new pages receive `onIssueClick` / `onOpenIssue` from outlet context — no changes needed to AppLayout wiring |
| `DashboardPage` (modified) | Hero greeting + stat tiles + sprint health chart + trend graph + MR review queue + activity strip | Replaces 3-card grid; keeps gradient hero + date section |
| `MyTasksPage` (new) | Summary strip + grouping toggle + virtual-scrolled task list + inline quick actions | New lazy-loaded route at `/my-tasks` |
| `ChartWrapper` (new shared) | Single wrapper for Recharts `ResponsiveContainer`, CSS-var theming, explicit height | Both Dashboard chart-cards and any future charts use it |
| `StatTile` (new shared) | Numeric stat with label + optional trend arrow | Used 4-6x on Dashboard |
| `MyTaskRow` (new shared) | Rich task row: type icon, priority, status pill, due date, SP, time bar, MR health badge | Used by MyTasksPage; potentially reusable in standup Today groupings |

---

## Recommended Project Structure

### New files

```
taskflow/src/
├── routes/
│   ├── dashboard/
│   │   ├── index.tsx                   MODIFY — hero stays; 3-card grid replaced
│   │   ├── DashboardStatTiles.tsx      NEW — 4-6 stat tiles (open count, done%, logged today, ...)
│   │   ├── DashboardSprintChart.tsx    NEW — points-by-status chart; wraps ChartWrapper
│   │   ├── DashboardTrendChart.tsx     NEW — weekly logged hours line chart; wraps ChartWrapper
│   │   ├── DashboardVelocityChart.tsx  NEW — N-sprint velocity bar chart; wraps ChartWrapper
│   │   ├── DashboardMrReviewQueue.tsx  NEW — reviewer MRs (reads existing gitlab-mrs cache)
│   │   ├── DashboardActivityStrip.tsx  NEW — recent Jira activity (reuses fetchYesterdayJiraActivity)
│   │   ├── DashboardSprintCard.tsx     MODIFY or DELETE — replaced by DashboardSprintChart + StatTiles
│   │   ├── DashboardInProgressCard.tsx MODIFY or DELETE — replaced by StatTiles + MyTaskRow
│   │   └── DashboardReleaseCard.tsx    KEEP or INTEGRATE into activity strip
│   └── my-tasks/
│       ├── MyTasksPage.tsx             NEW — route root; loads data, owns groupMode state
│       ├── MyTasksHeader.tsx           NEW — summary strip (open count, SP totals, due-today badge)
│       ├── MyTasksControls.tsx         NEW — scope toggle (sprint/all) + grouping toggle
│       ├── MyTasksGroupedList.tsx      NEW — groups with collapsible story headers + virtual scroll
│       └── MyTaskRow.tsx               NEW — rich row component
├── components/
│   ├── charts/
│   │   └── ChartWrapper.tsx            NEW — lazy ResponsiveContainer + CSS-var theming
│   └── ui/
│       ├── stat-tile.tsx               NEW — shared stat tile primitive
│       └── my-task-row.tsx             NEW — if reused outside my-tasks/ (standup, dashboard)
└── stores/
    └── my-tasks.store.ts               NEW — groupMode + scopeToggle persisted via Tauri Store
```

### Modified files

```
taskflow/src/
├── routes/routes.tsx                   ADD /my-tasks lazy route
├── components/app/sidebar-items.ts     ADD 'my-tasks' entry in 'main' section
├── services/jira.ts                    ADD fetchMyAssignedIssues() (exported via barrel)
└── services/jira/sprints.ts            ADD fetchClosedSprints()
```

### Structure Rationale

- **routes/my-tasks/:** Self-contained route module per established pattern (standup-notes/, worklogs/). Page, header, controls, list, and row are all local to the route until reuse is proven.
- **components/charts/:** Charting is a new domain in the app. Isolating in its own folder signals "infrastructure" vs "feature UI". Multiple dashboard chart-cards import from here.
- **stores/my-tasks.store.ts:** Separate store file per the tempo-filters and subtask-templates precedent. Settings store version (currently v26) is NOT bumped for a new separate store file.

---

## Architectural Patterns

### Pattern 1: Outlet context for peek and navigation (existing — reuse unchanged)

**What:** AppLayout threads `onIssueClick`, `onOpenIssue`, `openEdit`, `openClone` through React Router's `Outlet` context. Every route page calls `useOutletContext()` to get these handlers.

**When to use:** Every new page that renders clickable issue rows (MyTasksPage, any new Dashboard section with issue rows).

**Trade-offs:** Explicit prop threading — consistent with the zero-`createContext` codebase rule. Full TypeScript type safety with no context escape hatches.

**Usage in new pages:**
```typescript
const { onIssueClick, onOpenIssue } = useOutletContext<{
  onIssueClick: (key: string, resetTrail?: boolean) => void;
  onOpenIssue: (key: string) => void;
}>();
```

### Pattern 2: PAT loaded once at page root, passed as prop (existing — reuse D-16 pattern)

**What:** Dashboard index.tsx loads `jira-pat` from Stronghold once via `useEffect + useState`, then passes `jiraToken` as a prop to all child card components. Cards never call `readSecret()` directly.

**When to use:** DashboardPage redesign and MyTasksPage. Single `readSecret` at the page level; all sub-components receive `jiraBaseUrl`, `jiraToken` as props.

**Trade-offs:** Centralised token load; child components are testable without Stronghold. Aligns with the D-16 decision documented in PROJECT.md.

### Pattern 3: Distinct query keys to avoid cache contamination (existing — critical to continue)

**What:** Components that need sprint data but must not share the sprint board's polling cycle use a DIFFERENT second key segment. TodayColumn uses `'sprint-board-today-full'` instead of `'sprint-board'` to avoid triggering SprintBoardTab's invalidation.

**When to use:** MyTasksPage fetches under `['jira-issues','my-tasks',...]` — this already exists and is correct. Do NOT borrow `'sprint-board'` even though the underlying sprint data overlaps.

**Trade-offs:** Two copies of overlapping data in cache, but prevents unintended polling cascade. Accepted by codebase-wide precedent.

### Pattern 4: ChartWrapper — Recharts with CSS-var theming

**What:** A single wrapper component that (a) wraps Recharts' `ResponsiveContainer` with an explicit height, (b) makes CSS variable strings available to chart children, (c) applies `'use no memo'` directive to escape React Compiler's auto-memoization for charts.

**When to use:** Every chart on the Dashboard. Dashboard chart components (SprintChart, TrendChart, VelocityChart) each receive a `<ChartWrapper>` as their outermost element.

**Trade-offs:** One indirection layer, but ensures consistent theming and a single opt-out from React Compiler memoization for the charting subtree.

**Implementation sketch:**
```typescript
// components/charts/ChartWrapper.tsx
'use no memo';  // React Compiler escape hatch for Recharts interior-mutability
import { ResponsiveContainer } from 'recharts';
import type { ReactElement } from 'react';

// CSS vars from index.css (Tailwind v4 exposes these in :root)
export const chartColors = {
  tick: 'var(--muted-foreground)',
  grid: 'var(--border)',
  primary: 'var(--primary)',
  chart1: 'var(--chart-1)',
  chart2: 'var(--chart-2)',
  chart3: 'var(--chart-3)',
} as const;

export function ChartWrapper({
  height = 200,
  children,
  className,
}: {
  height?: number;
  children: ReactElement;
  className?: string;
}) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
```

Add chart CSS vars to `index.css` (Tailwind v4 CSS-first config):
```css
:root {
  --chart-1: oklch(70% 0.2 30);   /* orange */
  --chart-2: oklch(65% 0.2 200);  /* blue   */
  --chart-3: oklch(60% 0.2 145);  /* green  */
  --chart-4: oklch(65% 0.2 290);  /* purple */
  --chart-5: oklch(55% 0.2 20);   /* red    */
}
.dark {
  --chart-1: oklch(75% 0.2 30);
  /* etc. */
}
```

### Pattern 5: Zustand + Tauri Store for new persisted prefs (existing — extend)

**What:** `createTauriStorage('my-tasks.json')` passed to Zustand's `persist` middleware. Identical to `tempo-filters.store.ts` (line 48) and `subtask-templates.store.ts`.

**When to use:** My Tasks grouping mode and scope toggle.

**Persistence shape:**
```typescript
export type MyTasksGroupMode = 'day' | 'status' | 'sprint';
export type MyTasksScope = 'sprint' | 'all';

interface MyTasksState {
  groupMode: MyTasksGroupMode;
  scope: MyTasksScope;
  setGroupMode: (mode: MyTasksGroupMode) => void;
  setScope: (scope: MyTasksScope) => void;
}
// persist({ name: 'my-tasks', storage: createTauriStorage('my-tasks.json') })
```

Settings store version (v26) does NOT change — this is a new standalone store file, not a settings store migration.

---

## Data Flow

### My Tasks page — complete data flow

```
MyTasksPage mounts
  ↓ useAuthStore() → jiraBaseUrl, jiraUserDisplayName
  ↓ useMyTasksStore() → groupMode, scope
  ↓ readSecret('jira-pat') → jiraToken (once, useEffect)
  ↓

  scope === 'sprint':
    useQuery key: ['jira-issues','my-tasks', project, spKey]
    queryFn:  fetchMyTasksHierarchy()    [EXISTING in jira.ts:483]
    Strategy: 2 parallel JQL calls
      (1) my sprint stories: project=X AND sprint in openSprints()
                              AND issuetype not in subtaskIssueTypes()
                              AND assignee=currentUser()
      (2) my non-done subtasks: project=X AND issuetype in subtaskIssueTypes()
                                 AND assignee=currentUser() AND statusCategory!=Done
    → union parents + fetch extra parents not in sprint
    → fetch ALL subtasks (no assignee filter) for every parent story
    → returns { issues: JiraIssue[], myIssueKeys: Set<string> }

  scope === 'all':
    useQuery key: ['jira-issues','my-tasks-all', project, spKey]
    queryFn: NEW fetchMyAssignedIssues() in jira.ts
    JQL: project=X AND assignee=currentUser() AND statusCategory!=Done
         ORDER BY updated DESC
    Uses fetchAllSearchPages() — same paginated helper

  MR health per row:
    queryClient.getQueryData(['mr-health', project_id, iid])
    Read from cache — populated by MrHealthPanel on Dashboard.
    If MrHealthPanel hasn't run this session, badges show "unknown" / no badge.
    No new fetch triggered from MyTasksPage itself.

  Time bars (progress within estimate):
    issue.fields.timetracking.originalEstimateSeconds / timeSpentSeconds
    Already in fields= list of fetchMyTasksHierarchy.

  groupMode = 'day':
    Client-side bucket: overdue (duedate < today), due-today, upcoming (no due or future)
    Within buckets, sort by status category (indeterminate first)

  groupMode = 'status':
    Client-side group by statusCategory.key ('new' / 'indeterminate' / 'done')
    Subtasks nested under parent story rows (same DashboardInProgressCard pattern)

  groupMode = 'sprint':
    Group by parent.key — each story is a collapsible header row
    Subtasks indented beneath (identical to StandupNotes TodayColumn grouping)
    Orphan subtasks (no parent in result set) shown at bottom
```

### Dashboard redesign — complete data flow

```
DashboardPage mounts
  ↓ readSecret('jira-pat') + readSecret('gitlab-pat') (once each, useEffect)
  ↓ useBoardId() → boardId (existing hook, staleTime:Infinity)
  ↓

  DashboardStatTiles
    reads: ['jira-issues','sprint-board', project, spKey]
    warm from SprintBoardTab if visited; cold fetch if first load
    client-side derive: open count, in-progress count, done SP, total SP

  DashboardSprintChart (points-by-status donut or bar)
    reads: ['jira-issues','sprint-board', project, spKey]  ← SAME warm cache
    no new fetch; derive 3 buckets (new / indeterminate / done) from issues
    render: <BarChart> or <PieChart> via ChartWrapper

  DashboardTrendChart (weekly logged hours)
    gated: tempoEnabled check (from useSettingsStore)
    reads: ['tempo','worklogs', dateRange, ...] — may overlap WorklogsPage cache
    if cold: NEW query with last-28-days date range
    aggregate by ISO week (.slice(0,10) date rule — Phase 62 standing rule)
    graceful empty state when tempoEnabled=false

  DashboardMrReviewQueue
    reads: ['gitlab-mrs', base, userId]  ← SAME cache as MrHealthPanel (no new fetch)
    reads: ['mr-health', project_id, iid] ← SAME cache
    filter to: mr.reviewer_ids.includes(myUserId) AND mr.state==='opened'

  DashboardActivityStrip
    reads/fires: fetchYesterdayJiraActivity() [EXISTING in jira.ts]
    key: ['jira-standup-activity', project, yesterdayDate]  or adjust to share
    Note: If key matches StandupNotesPage's query, cache is shared for free.
    Reuse standup page's key format to get cache sharing on same session.

  DashboardVelocityChart (N-sprint velocity)
    reads: ['jira-closed-sprints', boardId]
    queryFn: NEW fetchClosedSprints(base, token, boardId, maxResults=8)
      → GET /rest/agile/1.0/board/{boardId}/sprint?state=closed&maxResults=8
    for each closed sprint:
      reads: ['jira-sprint-issues-by-id', sprintId]  staleTime: Infinity
      queryFn: NEW fetchSprintIssuesBySprintId(base, token, sprintId)
        → GET /rest/agile/1.0/sprint/{sprintId}/issue?fields=customfield_10016,status
      derive: committed SP (all SP) + completed SP (SP where statusCategory=done)
    concurrency cap: p-limit(3) — already in package.json dependencies
    render as last section (lazy-load priority — other sections render first)
```

### What requires new fetchers vs what reads existing cache

| Dashboard section | Cache status | Action |
|------------------|-------------|--------|
| Stat tiles | Warm from SprintBoardTab | No new fetch |
| Sprint health chart | Warm from SprintBoardTab | No new fetch |
| Trend chart (Tempo) | Cold on first Dashboard visit | New query, reuse fetchWorklogs |
| MR review queue | Warm if MrHealthPanel ran this session | Read existing cache; no new fetch |
| Activity strip | Cold; standup page may warm it | Use fetchYesterdayJiraActivity with matching key |
| Velocity chart | Always cold (new data shape) | New fetchers in sprints.ts + jira.ts barrel |

---

## Burndown / Historical Data — Availability Assessment

**VERDICT: Not available through supported APIs. Out of scope per PROJECT.md.**

The GreenHopper endpoint `/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=X&sprintId=Y` exists and is used by Jira's own UI for sprint report rendering. However:

1. It is unofficial and undocumented (not in the Jira DC REST API reference)
2. PROJECT.md explicitly lists "Historical analytics / burndown charts" as Out of Scope
3. The velocity chart (completed vs committed SP per closed sprint) is achievable through official REST without the unofficial endpoint

For velocity, the pattern is: `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed` to list closed sprints, then `GET /rest/agile/1.0/sprint/{sprintId}/issue?fields=customfield_10016,status` per sprint to sum story points. This is confirmed available on Jira DC via the official Agile REST API reference (v9.14.0).

---

## Integration Points

### Existing fetchers and cache keys usable directly

| Data | Cache key | Existing fetcher | My Tasks | Dashboard |
|------|-----------|-----------------|----------|-----------|
| Sprint issues (all) | `['jira-issues','sprint-board',project,spKey]` | `fetchSprintIssues(false)` | Warm read for MR badge enrichment | Stat tiles + sprint chart |
| My sprint hierarchy | `['jira-issues','my-tasks',project,spKey]` | `fetchMyTasksHierarchy()` | Primary query | Stat tile fallback |
| Active sprint | `['jira-active-sprint',project,base,boardId]` | `fetchActiveSprint()` | Sprint name header | Sprint chart header |
| GitLab MRs | `['gitlab-mrs',base,userId]` | `fetchAssignedMRs + fetchReviewerMRs` | MR badge per row (read cache) | MR review queue |
| MR health | `['mr-health',projectId,iid]` | populated by MrHealthPanel | `getQueryData` read | `getQueryData` read |
| Tempo worklogs | `['tempo','worklogs',...]` | `fetchWorklogs()` | Time bar from `timetracking` field | Trend chart |
| Custom fields | `['jira-custom-fields',base]` | `discoverCustomFields()` | via settingsStore | via settingsStore |
| Board ID | `['jira-board-id',base,project]` | `useBoardId()` hook | Not needed | Sprint chart + velocity |

### New fetchers to add

| Fetcher | Where | Cache key | Purpose |
|---------|-------|-----------|---------|
| `fetchMyAssignedIssues(base, token, project, spKey)` | `services/jira.ts` (barrel, ~line 603) | `['jira-issues','my-tasks-all',project,spKey]` | My Tasks "all" scope — JQL `assignee=currentUser() AND statusCategory!=Done` |
| `fetchClosedSprints(base, token, boardId, maxResults)` | `services/jira/sprints.ts` + re-export via barrel | `['jira-closed-sprints',boardId]` | GET `.../board/{boardId}/sprint?state=closed&maxResults=N` |
| `fetchSprintIssuesBySprintId(base, token, sprintId, spKey)` | `services/jira/sprints.ts` or `services/jira.ts` | `['jira-sprint-issues-by-id',sprintId]` with `staleTime: Infinity` | Velocity chart per-sprint SP aggregation |

### Outlet context (AppLayout/main.tsx) — no changes required

`onIssueClick`, `onOpenIssue`, `openEdit`, `openClone`, `openAddSubtask` are already threaded through `Outlet` context. New pages call `useOutletContext()` with the existing type shape. No main.tsx changes needed for basic peek + navigate-to-issue functionality.

### Sidebar — one new entry

```typescript
// components/app/sidebar-items.ts — add after 'dashboard' entry
{ id: 'my-tasks', label: 'My Tasks', path: '/my-tasks', iconName: 'CheckSquare', section: 'main' }
```

Place it between `dashboard` and `standup-notes` in `SIDEBAR_ALL_ITEMS`. The `getDefaultSidebarItems()` function will include it in the all-visible default set.

### Router — one new lazy route

```typescript
// routes/routes.tsx
const MyTasksPage = lazy(() => import('./my-tasks/MyTasksPage'));
// add to routes array:
{ path: '/my-tasks', element: withLazy(MyTasksPage) }
```

Dashboard at `/dashboard` is currently NOT lazy (direct import). If adding Recharts, consider converting it to lazy as well to keep the initial JS bundle lighter:
```typescript
const DashboardPage = lazy(() => import('./dashboard/index'));
```

### Shared components already usable as-is

- `StatusPopover` — in-place status transition, works on any `JiraIssue` key
- `PriorityIcon` — from `components/ui/priority-icon.tsx`
- `IssueTypeIcon` — from `components/ui/issue-type-icon.tsx`
- `CachedAvatar` — from `components/ui/cached-avatar.tsx`
- `useDelayedLoading` — from `hooks/useDelayedLoading.ts` (200ms skeleton flicker prevention)
- `doneSummaryClass`, `issueTypeStripeClass` — from `lib/issueDisplayUtils.ts`
- `EmptyState`, `ErrorState`, `StaleDataBanner` — from `components/ui/`
- `Progress` — from `components/ui/progress.tsx` (for time bars)

---

## Anti-Patterns

### Anti-Pattern 1: Sharing sprint-board cache key with My Tasks

**What people do:** Use `['jira-issues','sprint-board',...]` in MyTasksPage since the sprint data overlaps.

**Why it's wrong:** `fetchSprintIssues(assignedToMe=false)` returns all team members' issues, not just mine. `fetchMyTasksHierarchy` uses a different strategy (my stories + my subtasks, then all subtasks for those parents). Sharing the key would break My Tasks when the sprint board cache contains unfiltered data, or bust the sprint board's polling when My Tasks invalidates.

**Do this instead:** Keep `['jira-issues','my-tasks',...]` as the distinct key for `fetchMyTasksHierarchy`. The sprint board cache (`['jira-issues','sprint-board',...]`) may be read for MR badge enrichment via `getQueryData` but never written by My Tasks queries.

### Anti-Pattern 2: Fetching velocity sprint issues in parallel without concurrency cap

**What people do:** `Promise.all(closedSprints.map(id => fetchSprintIssuesBySprintId(...)))` for 8 sprints simultaneously.

**Why it's wrong:** 8 concurrent REST calls against Jira DC (which has `jiraConcurrencyLimit: 6` in settings) can queue-starve other in-flight requests. Velocity is the lowest-priority dashboard section.

**Do this instead:** Use `p-limit(3)` (already in `package.json`) to cap velocity sprint fetches at 3 concurrent calls. `staleTime: Infinity` for closed sprint issues means this runs at most once per session per sprint.

### Anti-Pattern 3: Reading Tauri Stronghold token inside chart components

**What people do:** Each chart component calls `readSecret('jira-pat')` in a `useEffect` to get its own token for fetching.

**Why it's wrong:** Violates D-16 (single token load pattern). Creates N parallel Stronghold reads and makes components non-testable without the Tauri runtime.

**Do this instead:** Load `jiraToken` once in DashboardPage root (existing pattern), pass it as prop to `DashboardSprintChart`, `DashboardTrendChart`, `DashboardVelocityChart`.

### Anti-Pattern 4: Recharts `ResponsiveContainer` without explicit height on parent

**What people do:** `<ResponsiveContainer width="100%">` inside a flex container with `height: auto`, expecting the chart to fill available space.

**Why it's wrong:** `ResponsiveContainer` reads the DOM height of its parent. If the parent has `height: auto`, the chart collapses to 0px or renders incorrectly. This is the most common Recharts bug.

**Do this instead:** Always pass an explicit `height` to `ChartWrapper`. The wrapper enforces this by applying `style={{ height }}` on its outer div. Never rely on CSS alone for Recharts height.

### Anti-Pattern 5: CSS Tailwind color strings as Recharts props (wrong approach)

**What people do:** `stroke="text-primary"` or `fill="bg-orange-500"` thinking Tailwind class names work as SVG attribute values.

**Why it's wrong:** SVG attribute values are not CSS classes. Tailwind classes don't apply to SVG `stroke`/`fill` props passed directly to Recharts.

**Do this instead:** Pass CSS variable strings: `stroke="var(--primary)"`, `fill="var(--chart-1)"`. SVG elements in WKWebView/WebView2 resolve CSS variables correctly. This is the approach that gives dark/light theme support automatically.

### Anti-Pattern 6: Using `useGhAllData` directly in Dashboard or My Tasks

**What people do:** Import `useGhAllData` into Dashboard or MyTasksPage to get sprint issues since it's the "single source of truth" for the sprint board.

**Why it's wrong:** `useGhAllData` is gated on `isActive === useIsActiveRoute('/sprint-board')`. It will not fetch when rendering on `/dashboard` or `/my-tasks`. It also returns raw `GhBoardIssue` types, not `JiraIssue`, requiring the adapter layer that is already encapsulated inside `fetchSprintIssues`.

**Do this instead:** Use `fetchSprintIssues` (for all-sprint data) or `fetchMyTasksHierarchy` (for my-issues data) under their own query keys. `gcTime: Infinity` ensures the sprint board's allData cache stays live and readable across routes — it just won't be re-fetched by dashboard queries.

---

## Build Order (Phase Sequencing)

The charting foundation must exist before chart-consuming dashboard sections. My Tasks data layer is already partially implemented (`fetchMyTasksHierarchy` exists in jira.ts at line 483, used by SubtasksPanel with query key `['jira-issues','my-tasks',...]`).

**Phase A — Charting Foundation**
- Install Recharts + `react-is` override in package.json
- Create `src/components/charts/ChartWrapper.tsx`
- Define `--chart-1` through `--chart-5` CSS vars in `index.css`
- Document `'use no memo'` placement for chart components
- Verify dark/light theming works in a dummy chart component
- Deliverable: `ChartWrapper` renders correctly on `/dashboard` with correct theme response

**Phase B — My Tasks data layer + page**
- Add `fetchMyAssignedIssues` to `services/jira.ts` (scope = 'all')
- Create `stores/my-tasks.store.ts`
- Create `routes/my-tasks/` directory with all components
- Wire lazy route in `routes/routes.tsx` + sidebar entry
- Peek and status transitions via outlet context (no AppLayout changes)
- Deliverable: `/my-tasks` functional with all 3 grouping modes, scope toggle, peek, status transitions

**Phase C — Dashboard stat tiles + sprint health chart**
- Replace 3-card grid in `routes/dashboard/index.tsx` with stat tiles + chart
- DashboardStatTiles reads warm sprint-board cache
- DashboardSprintChart (points-by-status) uses ChartWrapper
- Keep gradient hero + date unchanged
- Deliverable: Dashboard shows stat tiles + sprint health chart; existing release card integrated

**Phase D — Trend graph + MR review queue + activity strip**
- DashboardTrendChart (weekly logged hours, Tempo-gated)
- DashboardMrReviewQueue (reads existing gitlab-mrs + mr-health cache)
- DashboardActivityStrip (reuses fetchYesterdayJiraActivity)
- Deliverable: Full dashboard layout; Tempo-enabled users see trend, others see placeholder

**Phase E — Velocity trend**
- Add `fetchClosedSprints` + `fetchSprintIssuesBySprintId` to `sprints.ts` + barrel
- DashboardVelocityChart with `p-limit(3)` concurrency cap
- `staleTime: Infinity` for closed sprint issue queries
- Deliverable: Velocity chart renders last N sprints with committed vs completed SP

**Dependency order:**
- Phase A before C, D (ChartWrapper required by all chart sections)
- Phase B independent (no chart dependency; can run in parallel with A)
- Phase C before D (establishes dashboard layout structure)
- Phase D before E (MR queue + activity sections frame the lower dashboard)
- Phase E last (new fetchers + most complex caching logic; lowest priority)

---

## Sources

- Recharts React 19 support: [Support React 19 — Issue #4558](https://github.com/recharts/recharts/issues/4558)
- React Compiler escape hatch: [React Compiler — react.dev](https://react.dev/learn/react-compiler)
- Jira DC closed sprints API: [Jira Agile DC REST API 9.14.0](https://docs.atlassian.com/jira-software/REST/9.14.0/)
- Velocity via REST: [How to Get Sprint Velocity Data via JIRA REST API](https://community.atlassian.com/forums/Jira-questions/How-to-Get-Sprint-Velocity-Data-via-JIRA-REST-API/qaq-p/1226330)
- Tailwind v4 + shadcn/ui: [Tailwind v4 — shadcn/ui docs](https://ui.shadcn.com/docs/tailwind-v4)
- Codebase sources (all HIGH confidence, read directly):
  - `taskflow/src/main.tsx` — AppLayout, outlet context, peek state
  - `taskflow/src/services/jira.ts` — barrel, fetchMyTasksHierarchy (line 483), fetchSprintIssues (line 389)
  - `taskflow/src/services/jira/greenhopper/useGhAllData.ts` — route-gated polling
  - `taskflow/src/services/jira/greenhopper/types.ts` — GhAllDataResponse, GhSprintBacklog
  - `taskflow/src/services/jira/sprints.ts` — fetchActiveSprint, fetchSprintsForBoard
  - `taskflow/src/stores/settings.store.ts` — persist v26, createTauriStorage pattern
  - `taskflow/src/routes/dashboard/index.tsx` — current Dashboard structure
  - `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — existing grouping pattern
  - `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` — existing sprint data pattern
  - `taskflow/src/routes/dashboard/SubtasksPanel.tsx` — fetchMyTasksHierarchy usage + cache key
  - `taskflow/src/routes/dashboard/MrHealthPanel.tsx` — gitlab-mrs + mr-health cache pattern
  - `taskflow/src/routes/standup-notes/TodayColumn.tsx` — grouping pattern reusable for My Tasks
  - `taskflow/src/routes/routes.tsx` — lazy route pattern
  - `taskflow/src/components/app/sidebar-items.ts` — sidebar entry format
  - `taskflow/src/lib/issueDisplayUtils.ts` — shared display primitives
  - `taskflow/package.json` — current dependencies (no chart lib present)

---

*Architecture research for: Taskflow v1.13 Personal Workspace*
*Researched: 2026-06-14*
