# Architecture Research

**Domain:** Tauri 2 desktop app — Jira + GitLab integration (v1.1 integration analysis)
**Researched:** 2026-03-12
**Confidence:** HIGH — based on direct codebase inspection of all relevant source files

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React UI Layer                           │
├────────────────┬────────────────┬────────────────┬──────────────┤
│  routes/       │  routes/       │  routes/       │  routes/     │
│  dashboard/    │  notifications/│  settings/     │  onboarding/ │
│  index.tsx     │                │                │              │
│  MyTasksTab    │                │                │              │
│  SprintBoard   │                │                │              │
│  MrAttention   │                │                │              │
│  WorkloadTab   │                │                │              │
│  SprintProg    │                │                │              │
│  ReleasesTab   │                │                │              │
└───────┬────────┴────────────────┴────────────────┴──────────────┘
        │
┌───────▼────────────────────────────────────────────────────────┐
│                    TanStack Query Cache                          │
│  ['jira-issues','my-tasks',proj]        60s poll / 30s stale   │
│  ['jira-issues','sprint-board',proj]    60s poll / 30s stale   │
│  ['gitlab-mrs', baseUrl]                60s poll / 30s stale   │
│  ['mr-health', projectId, iid]          30s stale              │
│  ['mr-commits', projectId, iid]         60s stale              │
│  ['jira-fix-versions', proj]            5min stale             │
│  ['gitlab-current-user', baseUrl]       Infinity stale         │
│  ['gitlab-milestones', group]           5min stale             │
│  ['gitlab-tags', projectId]             5min stale             │
└───────┬────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────┐
│                     Services Layer                               │
│  services/jira.ts        services/gitlab.ts                     │
│  services/linkEngine.ts  services/releaseLinker.ts              │
│  services/notifications.ts  services/stronghold.ts             │
│  services/tauri.ts       services/theme.ts                      │
└───────┬────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────┐
│                     Zustand Stores (persisted)                   │
│  auth.store.ts           settings.store.ts                      │
│  notifications.store.ts  onboarding.store.ts                    │
│  (Tauri Store plugin: auth.json / settings.json / ...)          │
└────────────────────────────────────────────────────────────────┘
        │
┌───────▼────────────────────────────────────────────────────────┐
│                   Tauri 2 Runtime / OS                           │
│  tauri-plugin-http (CORS bypass)    tauri-plugin-stronghold     │
│  tauri-plugin-store (persistence)   tauri-plugin-opener         │
│  tauri-plugin-notification (OS notifications)                   │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v1.1 Change |
|-----------|----------------|-------------|
| `routes/dashboard/index.tsx` | Role-aware overview with live summary cards | MODIFIED: add subtask list, MR status, sprint health, recent notifications sections |
| `routes/dashboard/MyTasksTab.tsx` | Jira issues assigned to me + MR linking | MODIFIED: group subtasks under parent story |
| `routes/dashboard/SprintBoardTab.tsx` | All sprint issues in kanban columns | MODIFIED: group subtasks under story cards, collapsible |
| `routes/dashboard/WorkloadTab.tsx` | Per-assignee task count + story points | MODIFIED: add time tracking columns (estimate/spent/remaining) |
| `routes/dashboard/SprintProgressTab.tsx` | Sprint completion buckets + progress bar | MODIFIED: per-status point breakdown, time totals, per-assignee breakdown |
| `routes/dashboard/ReleasesTab.tsx` | Fix versions + GitLab date matching | MODIFIED: sort newest-first, add released/unreleased badge |
| `routes/dashboard/MrAttentionTab.tsx` | MRs requiring developer attention | MODIFIED: open-only filter + linked-story subtask filter |
| `routes/dashboard/TaskRow.tsx` | Single issue row in My Tasks | MODIFIED: parent story context for subtask rows |
| `routes/dashboard/TaskCard.tsx` | Compact issue card in Sprint Board | MODIFIED: parent story context for subtask cards |
| `services/jira.ts` | All Jira REST API calls + type definitions | MODIFIED: extend JiraIssue type; extend fields param in fetchSprintIssues |

---

## Integration Points for v1.1 Features

### 1. JiraIssue Type Extension

**Current state in `services/jira.ts`:**
```typescript
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { id: string; name: string; statusCategory?: { key: 'new' | 'indeterminate' | 'done' } };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    customfield_10016: number | null;  // story points
    issuetype: { name: string };
    description?: string | null;
  };
}
```

**Required additions — all fields are optional to preserve backward compatibility:**
```typescript
fields: {
  // ... existing fields ...
  parent?: { id: string; key: string; fields: { summary: string } }
  subtasks?: Array<{
    id: string
    key: string
    fields: {
      summary: string
      status: { name: string; statusCategory?: { key: 'new' | 'indeterminate' | 'done' } }
      assignee: { displayName: string; avatarUrls: { '48x48': string } } | null
    }
  }>
  timetracking?: {
    originalEstimateSeconds?: number
    timeSpentSeconds?: number
    remainingEstimateSeconds?: number
  }
}
```

**fetchSprintIssues fields param change — single string in `jira.ts`:**
```typescript
// Current:
const fields = 'summary,status,assignee,issuetype,customfield_10016,story_points';
// After:
const fields = 'summary,status,assignee,issuetype,customfield_10016,story_points,parent,subtasks,timetracking';
```

**Ripple effect on every JiraIssue consumer:**

| File | Impact |
|------|--------|
| `MyTasksTab.tsx` | Reads `data: JiraIssue[]` — no breaking change; gains parent/subtasks for grouping |
| `SprintBoardTab.tsx` | Reads `data: JiraIssue[]` — no breaking change; gains subtasks for column grouping |
| `MrAttentionTab.tsx` | Reads sprintIssues for link key set; passes linkedTask as JiraIssue to MrRow — gains subtasks for filter logic |
| `WorkloadTab.tsx` | Reads assignee + story points — no breaking change; gains timetracking for new columns |
| `SprintProgressTab.tsx` | Reads statusCategory + story points — no breaking change; gains timetracking for time totals |
| `Dashboard/index.tsx` | Derives counts from sprint data — no breaking change |
| `TaskRow.tsx` | Receives JiraIssue prop — no breaking change; conditionally renders parent context |
| `TaskCard.tsx` | Receives JiraIssue prop — no breaking change; conditionally renders parent context |
| `MrRow.tsx` | Receives JiraIssue as linkedTask — reads .key and .fields.status.name only — no breaking change |

All fields are optional. All existing components continue to compile and run unchanged. New display logic in each component is gated on field presence.

---

### 2. Story Grouping in My Tasks and Sprint Board

**The data topology:** Jira returns a flat list of issues. A story has `fields.subtasks[]` (child keys + status). A subtask has `fields.parent` (parent key + summary). Both stories and subtasks can appear in the same sprint board response.

**Two-pass grouping algorithm — for a shared `useMemo`:**

```typescript
// Input: JiraIssue[] from sprint cache
// Output: { groups: StoryGroup[], orphans: JiraIssue[], standalone: JiraIssue[] }

interface StoryGroup {
  story: JiraIssue            // the parent story
  subtasks: JiraIssue[]       // matched subtasks from the flat list
  isCollapsed: boolean        // managed locally in StoryGroup component
}

// Pass 1: index all issues and identify subtasks vs stories
const issueByKey = new Map<string, JiraIssue>()
const subtasksByParentKey = new Map<string, JiraIssue[]>()

for (const issue of issues) {
  issueByKey.set(issue.key, issue)
  const parentKey = issue.fields.parent?.key
  if (parentKey) {
    const arr = subtasksByParentKey.get(parentKey) ?? []
    subtasksByParentKey.set(parentKey, [...arr, issue])
  }
}

// Pass 2: build story groups
const storyKeys = new Set<string>()
const groups: StoryGroup[] = []

for (const issue of issues) {
  if ((issue.fields.subtasks?.length ?? 0) > 0) {
    storyKeys.add(issue.key)
    groups.push({
      story: issue,
      subtasks: subtasksByParentKey.get(issue.key) ?? [],
    })
  }
}

// Orphans: subtasks whose parent is not in this issue set (parent in a different sprint)
const orphans = issues.filter(i => i.fields.parent && !storyKeys.has(i.fields.parent.key))
// Standalone: non-subtask issues with no children (tasks, bugs)
const standalone = issues.filter(i => !i.fields.parent && !storyKeys.has(i.key))
```

**My Tasks subtask visibility:** The current `fetchSprintIssues(assignedToMe=true)` JQL (`assignee = currentUser()`) returns only issues directly assigned to the current user. Subtasks assigned to me appear, but their parent stories (if assigned to someone else) do not. Two approaches:

- **Approach A (recommended for v1.1):** Reuse the sprint board cache `['jira-issues','sprint-board',proj]` (all issues), filter client-side to `assignee = currentUser()`, then run grouping. Zero new API calls. The sprint board cache is already fetched when WorkloadTab/SprintProgressTab are visited.
- **Approach B:** Keep the my-tasks query and add a second query for parent issues not in the result set. Two queries, more complex.

Approach A is lower risk and already consistent with the pattern used by SprintBoardTab (which reads gitlab-mrs from cache without its own query).

**New components:**

- `StoryGroup.tsx` — collapsible container. Props: `story: JiraIssue`, `subtasks: JiraIssue[]`, `variant: 'row' | 'card'`. Renders story as `TaskRow`/`TaskCard` at top, subtask rows/cards indented below. Collapse state is local `useState` to avoid parent re-renders on expand.
- `SubtaskRow.tsx` — lightweight TaskRow variant for use inside StoryGroup. Shows issue key, summary, status, assignee. Omits MR chips (story-level MR chip is sufficient). Shows parent context only when rendered outside a StoryGroup (orphan case).
- `SubtaskCard.tsx` — lightweight TaskCard variant for Sprint Board columns inside StoryGroup.

**Parent context display:** When a subtask is rendered standalone (orphan — parent not in current sprint), a small muted label shows `parent.key · parent.fields.summary` above the summary line. When inside a StoryGroup, this label is suppressed (context is already obvious).

---

### 3. WorkloadTab Time Tracking Enrichment

**Current state:** Pure `useMemo` transform on `['jira-issues','sprint-board',proj]` cache. `WorkloadRow = { name, count, points }`.

**Extended WorkloadRow:**
```typescript
interface WorkloadRow {
  name: string
  count: number
  points: number
  estimateHours: number   // sum(originalEstimateSeconds) / 3600, non-done issues only
  spentHours: number      // sum(timeSpentSeconds) / 3600, non-done issues only
  remainingHours: number  // sum(remainingEstimateSeconds) / 3600, non-done issues only
}
```

**Integration approach:** No new queries. The existing `useQuery` for `['jira-issues','sprint-board',proj]` already runs. After extending the `fields` param to include `timetracking`, the `useMemo` in WorkloadTab gains three more accumulation variables per assignee. The render adds three columns (or a secondary display row per assignee) formatted via `formatHours(seconds)` from the shared `sprintUtils.ts`.

**Per-story totals:** Show time breakdown per story within a developer's entry. This is a nested expand or tooltip — implementation detail for the render layer. The data structure supports it: `spentHours` can be accumulated per-story before summing to the row total.

---

### 4. SprintProgressTab Enrichment

**Current state:** Three status buckets (To Do / In Progress / Done) + a single story points progress bar. All from `useMemo` on `['jira-issues','sprint-board',proj]`.

**Required additions:**
- Points broken down per status bucket (not just Done vs remaining)
- Sprint-wide time totals (estimate/spent/remaining)
- Per-assignee breakdown table

**Integration approach:** All from existing cache. No new queries. The `useMemo` gains more aggregation. New sections appended below the existing progress bar in the render.

**Per-assignee breakdown** shares groupByAssignee logic with WorkloadTab — extract to `sprintUtils.ts`:

```typescript
// src/lib/sprintUtils.ts
export interface AssigneeMetrics {
  name: string
  taskCount: number
  points: number
  estimateHours: number
  spentHours: number
  remainingHours: number
}

export function groupByAssignee(issues: JiraIssue[]): AssigneeMetrics[]
export function formatHours(seconds: number): string  // e.g. "3.5h"
```

Both WorkloadTab and SprintProgressTab import from this module. No duplication.

---

### 5. Dashboard New Sections

**Current state:** `Dashboard/index.tsx` uses `useQuery` with the same keys as the tab components, reads from shared cache, derives 3 numeric card values per role.

**Required new sections and their data sources:**

| Section | Data Source | Query? |
|---------|-------------|--------|
| My open subtasks (dev) | `['jira-issues','my-tasks',proj]` cache | No — filter subtasks from existing data |
| My open MRs (dev) | `['gitlab-mrs', baseUrl]` cache | No — filter `state === 'opened'` |
| Sprint health summary (dev) | `['jira-issues','sprint-board',proj]` cache | No — derived metrics |
| Recent notifications (both) | `useNotificationsStore(s => s.items)` | No — Zustand store direct read |

**Integration pattern:** Dashboard already uses `useQuery` with `enabled: role !== 'pm'` to conditionally fetch. The pattern is established. New sections follow the same gating. Data is reactive: when the cache is populated (by tab navigation or initial load), the Dashboard's `useQuery` will already have it or will fetch it.

**My open subtasks:** Filter `myTasks` where `issue.fields.issuetype.name === 'Sub-task'` (or `!!issue.fields.parent`). Render as a compact list, up to 5 items, with a "View all in My Tasks" link. Requires Phase 1 type extension to have the `parent` field populated.

**Recent notifications:** `useNotificationsStore(s => s.items).slice(0, 3)`. No query needed — the notification polling hook (`useNotificationPolling`) updates the store independently on its own interval. The store is always available.

---

### 6. Releases Sort and Status Badge

**Current state:** `matchedVersions` rendered in API order (typically oldest-first). `JiraFixVersion.released: boolean` already exists in the type. No badge displayed.

**Required changes — both purely client-side:**

```typescript
// Sort: newest-first. Push versions with no releaseDate to the end.
const sorted = [...matchedVersions].sort((a, b) => {
  const dateA = a.version.releaseDate
  const dateB = b.version.releaseDate
  if (!dateA && !dateB) return 0
  if (!dateA) return 1   // no date → end
  if (!dateB) return -1  // no date → end
  return dateB.localeCompare(dateA)  // ISO date strings sort correctly
})
```

Badge: `version.released ? <Badge variant="success">Released</Badge> : <Badge variant="warning">Unreleased</Badge>`. The `released` field is already on `JiraFixVersion`, fetched by `fetchFixVersions`. No API changes.

No new query keys. No changes to `jira.ts`. The sort and badge are a two-line addition in ReleasesTab's render section.

---

### 7. MR Attention Filter

**Current state:** `MrAttentionTab.tsx` fetches `fetchAssignedMRs` + `fetchReviewerMRs` with no state filter. Includes MRs that may be closed/merged.

**Required changes:**

**Open-only filter:** Add `state=opened` to the GitLab API calls in `gitlab.ts`. This is a server-side filter — cleaner than client-side filtering because it reduces payload size. `fetchAssignedMRs` and `fetchReviewerMRs` both call `/api/v4/merge_requests` — add `&state=opened` to both URLs. This is a single-line change per function.

**Linked-story subtask filter logic in `MrAttentionTab`:**
```
Current inclusion rule: assigned to me OR (reviewer MR with unresolved discussions)
New inclusion rule:     state=opened AND (
                          assigned to me
                          OR (reviewer MR with unresolved discussions)
                          OR (linked to story where any subtask.assignee.displayName === jiraUserDisplayName)
                        )
```

The subtask check reads from `sprintIssues` (already fetched via `['jira-issues','sprint-board',proj]`):
```typescript
// After type extension, sprintIssues have subtasks[]
const currentUserDisplayName = useAuthStore(s => s.jiraUserDisplayName)

const mrIncludesMySubtask = (mr: GitLabMR): boolean => {
  const linkedKey = linkMRToTask(mr, sprintIssueKeySet)
  if (!linkedKey) return false
  const issue = issueByKey.get(linkedKey)
  if (!issue) return false
  return (issue.fields.subtasks ?? []).some(
    st => st.fields.assignee?.displayName === currentUserDisplayName
  )
}
```

This adds a predicate to the existing `useMemo` that builds the MR display list. No new queries.

**Dependency:** This filter requires Phase 1 (type extension with `subtasks[]`) to be complete first.

---

## Recommended Project Structure Changes

```
taskflow/src/
├── routes/
│   └── dashboard/
│       ├── index.tsx              MODIFIED — new sections
│       ├── MyTasksTab.tsx         MODIFIED — story grouping
│       ├── SprintBoardTab.tsx     MODIFIED — story grouping
│       ├── WorkloadTab.tsx        MODIFIED — time tracking columns
│       ├── SprintProgressTab.tsx  MODIFIED — enriched metrics
│       ├── ReleasesTab.tsx        MODIFIED — sort + status badge
│       ├── MrAttentionTab.tsx     MODIFIED — open-only + subtask filter
│       ├── TaskRow.tsx            MODIFIED — parent context for orphan subtasks
│       ├── TaskCard.tsx           MODIFIED — parent context for orphan subtask cards
│       ├── StoryGroup.tsx         NEW — collapsible story+subtasks container
│       ├── SubtaskRow.tsx         NEW — compact subtask row for inside StoryGroup
│       ├── SubtaskCard.tsx        NEW — compact subtask card for sprint board
│       ├── MrRow.tsx              no change
│       ├── StatusPopover.tsx      no change
│       └── InlineComment.tsx      no change
├── lib/
│   ├── utils.ts                   existing
│   └── sprintUtils.ts             NEW — groupByAssignee, formatHours pure functions
└── services/
    ├── jira.ts                    MODIFIED — JiraIssue type extension + fields param
    └── gitlab.ts                  MODIFIED — state=opened filter on MR fetch functions
```

### Structure Rationale

- **StoryGroup.tsx with variant prop:** Single component renders story+subtasks in both list layout (MyTasksTab) and card layout (SprintBoardTab) via a `variant: 'row' | 'card'` prop. Prevents collapse logic duplication across two tabs. Collapse state lives in StoryGroup's own `useState` — not the parent — to prevent full-tab re-renders on toggle.
- **SubtaskRow / SubtaskCard:** Lighter variants of TaskRow/TaskCard. Inside a StoryGroup the parent context label is suppressed (already obvious from StoryGroup heading). The MR chip section is also omitted from subtask rows — only story-level MR linkage is shown.
- **sprintUtils.ts:** Pure functions with no React dependencies. Easy to unit test. Both WorkloadTab and SprintProgressTab import from here; no circular dependencies.

---

## Architectural Patterns

### Pattern 1: Extend the Fields Param Before Adding New Queries

**What:** When a feature needs new data fields on existing issues, extend the Jira `fields` query param in `fetchSprintIssues`. New optional fields on `JiraIssue` cost zero additional API calls and the same TanStack cache entry serves all consumers.

**When to use:** Any time a v1.1 feature needs data that belongs to issues already fetched by a sprint query (parent, subtasks, timetracking, priority, labels).

**Trade-offs:** Slightly larger JSON payloads. For a sprint of ~50 issues, adding `parent + subtasks + timetracking` adds roughly 2-5 KB — negligible for a desktop app on a local network.

### Pattern 2: Read From Cache Before Declaring a New Query

**What:** SprintBoardTab reads `['gitlab-mrs', baseUrl]` via `queryClient.getQueryData()` without its own `useQuery`. Dashboard reads from `['jira-issues','sprint-board']` that was first populated by SprintProgressTab. New Dashboard sections should follow this passive read pattern.

**When to use:** When a component needs data already fetched by another component at the same polling interval.

**Trade-offs:** The `getQueryData` read is synchronous and not reactive. SprintBoardTab works around this by including `data` (its own query result) in the `useMemo` dependency array — when the sprint refreshes, the memo recomputes and picks up the latest cached MRs.

**Example (SprintBoardTab):**
```typescript
const gitlabMrs = useMemo(() => {
  return queryClient.getQueryData<GitLabMR[]>(['gitlab-mrs', gitlabBaseUrl]) ?? []
}, [queryClient, gitlabBaseUrl, data])  // 'data' dep causes recompute on sprint refresh
```

### Pattern 3: Client-Side Grouping via useMemo

**What:** All data transformation (grouping, sorting, filtering, aggregation) happens in `useMemo` within the component that owns the query. No intermediate stores, no transformation at the service layer.

**When to use:** All view-specific derivations from raw API data. Story grouping, workload aggregation, sprint progress bucketing, MR filtering — all belong here.

**Trade-offs:** Logic lives close to the view (readable), but grows large in complex tabs. Extract to a utility function in `lib/` when a `useMemo` body exceeds ~30 lines.

### Pattern 4: Token Loading via useEffect + useState

**What:** Each tab independently calls `readSecret('jira-pat')` in a `useEffect` and stores the result in local state. TanStack Query `enabled` gates the query until the token arrives.

**When to use:** Every component that needs a PAT. This is the established pattern throughout the entire codebase.

**v1.1 rule:** All new or modified components continue this exact pattern. Do not extract tokens to a shared context or Zustand store — tokens in Zustand would be written to disk unencrypted, defeating Stronghold.

### Pattern 5: Collapse State Belongs in the Leaf Component

**What:** For StoryGroup, the `isCollapsed` boolean lives in `StoryGroup`'s own `useState`, not in the parent tab component.

**Why:** If collapse state were `Record<storyKey, boolean>` in `MyTasksTab`, every expand/collapse would re-render the entire tab including all rows. With state inside `StoryGroup`, only that group re-renders.

**When to use:** Any interactive UI element where state changes should not propagate upward.

---

## Data Flow

### v1.1 Story Grouping Data Flow

```
fetchSprintIssues (fields param now includes parent, subtasks, timetracking)
    |
    v
TanStack Cache ['jira-issues','sprint-board',proj]
    | (shared by SprintBoardTab, WorkloadTab, SprintProgressTab, Dashboard)
    v
useMemo: groupByStory(issues)
    |-- StoryGroup[] (story + matched subtasks)
    |-- orphans[] (subtasks with parent not in sprint)
    `-- standalone[] (tasks/bugs with no parent/children)
    v
StoryGroup component (per group):
    |-- story card/row  (TaskCard or TaskRow)
    `-- [expanded] SubtaskCard or SubtaskRow per subtask
```

### v1.1 MR Attention Filter Data Flow

```
fetchAssignedMRs + fetchReviewerMRs (now with state=opened)
    |
    v
TanStack Cache ['gitlab-mrs', baseUrl]
    |
TanStack Cache ['jira-issues','sprint-board',proj] (includes subtasks[])
    |
    v
MrAttentionTab useMemo:
    for each MR:
        linkMRToTask() --> storyKey?
            --> issueByKey.get(storyKey)?.fields.subtasks
                --> any subtask.assignee.displayName === jiraUserDisplayName?
    |
    v
Filtered open MR list --> MrRow render
```

### v1.1 Dashboard New Sections Data Flow

```
Existing caches (populated by tab visits or Dashboard's own useQuery):
  ['jira-issues','my-tasks',proj]      --> filter subtasks --> "My open subtasks"
  ['gitlab-mrs',baseUrl]               --> filter state=opened --> "My open MRs"
  ['jira-issues','sprint-board',proj]  --> derive health score --> "Sprint health"
  useNotificationsStore.items          --> slice(0,3) --> "Recent notifications"
```

---

## Build Order

The dependency graph of features drives this order. Later features depend on earlier ones being stable.

**Phase 1 — Type Foundation (zero risk, unlocks everything)**
- Extend `JiraIssue` type in `jira.ts` with `parent?`, `subtasks?[]`, `timetracking?`
- Extend `fetchSprintIssues` `fields` param
- All optional fields — existing code compiles and runs unchanged
- All downstream features depend on this being complete first

**Phase 2 — Releases (isolated, no dependencies)**
- Sort `matchedVersions` newest-first in `ReleasesTab`
- Add `released` badge using existing `JiraFixVersion.released` boolean
- Purely client-side. No API changes. No cross-component effects
- Self-contained — good first deliverable, low risk

**Phase 3 — WorkloadTab + SprintProgressTab enrichment**
- Extract `sprintUtils.ts` with `groupByAssignee` + `formatHours`
- Add time tracking columns to WorkloadTab
- Add per-status point breakdown + time totals + per-assignee table to SprintProgressTab
- Both tabs read from same `['jira-issues','sprint-board',proj]` cache — no new queries
- Depends on Phase 1 (needs `timetracking` field)

**Phase 4 — Story grouping in My Tasks and Sprint Board**
- Build `StoryGroup.tsx`, `SubtaskRow.tsx`, `SubtaskCard.tsx`
- Modify `MyTasksTab` to filter from sprint board cache + group subtasks
- Modify `SprintBoardTab` to group subtasks within each column
- Highest UI complexity of all v1.1 features
- Depends on Phase 1 (needs `parent` and `subtasks[]` fields)

**Phase 5 — MR Attention filter**
- Add `state=opened` to `fetchAssignedMRs` + `fetchReviewerMRs` in `gitlab.ts`
- Add linked-story subtask filter to `MrAttentionTab`
- Depends on Phase 1 (needs `subtasks[]` on sprint issues)
- Update existing MrAttentionTab tests to verify the new filter predicate

**Phase 6 — Dashboard enrichment**
- Add new sections to Dashboard: my subtasks, my MR status, sprint health, recent notifications
- Reads entirely from existing caches and Zustand stores — no new queries
- Depends on Phase 1 (subtask data) and Phase 4 (story grouping patterns established)
- Purely additive — no existing cards modified

---

## Integration Boundaries

### External Services

| Service | Integration Pattern | v1.1 Changes |
|---------|---------------------|--------------|
| Jira REST API v2 (Data Center) | `tauri-plugin-http` fetch, Bearer PAT | Extend `fields` param only — no new endpoints |
| GitLab REST API v4 | `tauri-plugin-http` fetch, PRIVATE-TOKEN | Add `&state=opened` to MR list calls |

### Internal Boundaries

| Boundary | Communication | v1.1 Notes |
|----------|---------------|------------|
| `jira.ts` ↔ all tab components | TypeScript import of `JiraIssue` + service functions | Optional field extension is non-breaking |
| TanStack cache ↔ Dashboard | `useQuery` with shared key + `queryClient.getQueryData` passive reads | New sections follow passive-read pattern |
| `sprintUtils.ts` ↔ WorkloadTab + SprintProgressTab | Direct import of pure functions | New module; no circular dependencies possible |
| `StoryGroup` ↔ MyTasksTab + SprintBoardTab | Props: `story`, `subtasks`, `variant` | Single component, two render paths via variant |
| `notifications.store.ts` ↔ Dashboard | `useNotificationsStore` hook | Direct store read — no query needed |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New Query Key for Subtask Data

**What people do:** Add a separate `fetchSubtasks(parentKey)` per story with a new query key `['jira-subtasks', parentKey]`.

**Why it's wrong:** The subtask data is already available on parent issues via `fields.subtasks[]` when `subtasks` is included in the `fields` param. Per-story fetches multiply API calls by the number of stories in the sprint.

**Do this instead:** Extend the `fields` param in the existing `fetchSprintIssues` call. One request, all data.

### Anti-Pattern 2: Storing Tokens in Zustand for Cross-Component Access

**What people do:** Add `jiraToken: string | null` to auth.store.ts so all components can read it without the `readSecret` useEffect.

**Why it's wrong:** Zustand state is serialized to Tauri Store on every mutation (via the persist middleware). Token strings would be written to disk unencrypted, defeating Stronghold entirely.

**Do this instead:** Continue the established `useEffect` + `readSecret` + local `useState` pattern in every component that needs tokens.

### Anti-Pattern 3: Duplicate GroupBy Logic

**What people do:** Copy-paste the `groupByAssignee` calculation from WorkloadTab into SprintProgressTab when adding the per-assignee breakdown.

**Why it's wrong:** Two copies diverge. Bug fixes apply to one only. Tests must be duplicated.

**Do this instead:** Extract to `src/lib/sprintUtils.ts` as a pure function. Both tabs import from there.

### Anti-Pattern 4: Collapse State in the Parent Tab Component

**What people do:** Put `Record<string, boolean>` collapse state in `MyTasksTab` or `SprintBoardTab` to track which story groups are open.

**Why it's wrong:** Every expand/collapse triggers a full re-render of the tab including all rows and cards.

**Do this instead:** Collapse state lives in `StoryGroup`'s own `useState`. Each group re-renders independently on expand/collapse.

### Anti-Pattern 5: Client-Side Filtering When Server Filtering Exists

**What people do:** Fetch all MRs (including merged/closed) from GitLab and filter `mr.state === 'opened'` client-side in the MrAttentionTab `useMemo`.

**Why it's wrong:** Unnecessarily fetches and caches closed/merged MRs. For active projects, closed MR count can be orders of magnitude larger than open MR count.

**Do this instead:** Add `&state=opened` to the GitLab API calls in `gitlab.ts` — server filters before transmission.

---

## Scalability Considerations

Taskflow is a single-user desktop app. Scalability concerns are data volume, not user count.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Sprint with fewer than 50 issues | Current pattern is fine; all in-memory grouping is instant |
| Sprint with 50-200 issues | `useMemo` grouping is fast; subtask rendering adds rows but no O(n^2) operations |
| Sprint with more than 200 issues | Virtualised list (react-virtual) would help TaskRow rendering; not needed for v1.1 |

**First bottleneck at current scale:** Per-MR health queries scale linearly with linked MR count. TanStack deduplicates across tabs (MyTasksTab and MrAttentionTab share `['mr-health',...]` keys). Already working in v1.0.

**Second bottleneck:** Commit fallback queries scale linearly with unlinked MR count. Already present and acceptable in v1.0.

**v1.1 additions do not introduce new bottlenecks.** Story grouping is pure `useMemo` work. Time tracking fields are already in the sprint response. MR open-only filter reduces payload size.

---

## Sources

- Direct inspection of all route, service, and store files in `taskflow/src/` — HIGH confidence
- Jira REST API v2 field documentation: `parent`, `subtasks`, `timetracking` are standard system fields returned by `/rest/api/2/search` when listed in the `fields` param — HIGH confidence (standard Jira Data Center behavior, consistent across versions)
- GitLab MR list API `state` parameter: standard filter documented at `GET /api/v4/merge_requests?state=opened` — HIGH confidence
- TanStack Query `queryClient.getQueryData` passive read pattern: established in `SprintBoardTab.tsx` — confirmed by direct inspection

---
*Architecture research for: Taskflow v1.1 integration points*
*Researched: 2026-03-12*
