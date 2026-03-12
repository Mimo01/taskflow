# Phase 4: PM Dashboard + Search - Research

**Researched:** 2026-03-11
**Domain:** Role-conditional React dashboard, Jira/GitLab API aggregation, global search overlay, release version linking
**Confidence:** HIGH

## Summary

Phase 4 adds a PM-role dashboard (Sprint Progress, Workload, Releases tabs) and a global search overlay to the existing Taskflow app. All patterns and infrastructure are already established by Phases 1–3. The task is almost entirely assembly of new components using proven patterns: TanStack Query for data fetching, Zustand for tab state, `fetch` from `@tauri-apps/plugin-http` for API calls, and shadcn/ui components for UI primitives.

The PM dashboard slots into the existing `src/routes/dashboard/index.tsx` via a role-conditional branch (`useSettingsStore().role === 'pm'`), rendering three new tab components in place of the developer tabs. The search overlay mounts a new `SearchOverlay` component from `TopBar.tsx` alongside the existing bell icon. Both features are read-only (no mutations).

The only net-new API surface is: Jira `GET /rest/api/2/search` with `statusCategory` field (sprint-wide, not just assigned-to-me), Jira `GET /rest/api/2/version` (fix versions), GitLab `GET /api/v4/groups/{id}/milestones`, `GET /api/v4/projects/{id}/repository/tags`, and GitLab's global `GET /api/v4/search?scope=merge_requests` for search.

**Primary recommendation:** Extend existing patterns directly — no new libraries needed. New service functions in `jira.ts` / `gitlab.ts`, new tab components in `src/routes/dashboard/`, and a new `SearchOverlay` component in `src/components/app/`. Follow the exact same useQuery + readSecret + inline-error patterns from MyTasksTab and MrAttentionTab.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PM dashboard navigation**
- Same `/dashboard` route as the developer dashboard — role-aware rendering at runtime
- PM role → tabs: Sprint Progress | Workload | Releases
- Developer role → tabs: My Tasks | Sprint Board | MR Attention (unchanged)
- Default PM tab on open: Sprint Progress
- No quick-switch between roles from the dashboard; role change goes through Settings
- Sidebar: existing single "Dashboard" nav link is sufficient — no new nav entries for PM

**Sprint progress display**
- Layout: horizontal progress bar + raw numbers — e.g. `[=====----] 34 / 55 pts`
- Status breakdown grouped into 3 buckets: To Do / In Progress / Done
- Bucket mapping uses Jira's built-in `statusCategory.key` field on each issue:
  - `'new'` → To Do
  - `'indeterminate'` → In Progress
  - `'done'` → Done
- When the sprint has no story points (all issues unestimated): hide the progress bar entirely, show task counts only — no "0 / 0 pts" display
- Each bucket row shows task count; the points bar shows done vs remaining aggregate

**Global search placement and behavior**
- Search icon in the existing top bar (alongside the bell notification icon)
- Click opens a full-width overlay with a search input (does not navigate away from current page)
- Search triggers debounced as-you-type (~400ms) — fires Jira JQL + GitLab search API in parallel
- Results grouped by type: Tasks section then Merge Requests section
- Clicking a result opens a read-only in-app detail panel (similar to the notification detail pattern from Phase 3):
  - Jira task panel: title, status, assignee, story points, description excerpt, linked MR chips
  - GitLab MR panel: title, status, author, linked Jira task key
  - Both panels include an "Open in Jira/GitLab ↗" button via the existing `openUrl` (tauri-plugin-opener) pattern

**Releases view linking logic**
- Jira fix versions are linked to GitLab milestones or tags by date matching (±1 day tolerance)
- Match field: Jira fix version `releaseDate` vs GitLab milestone `due_date` or tag creation date
- Exact date match: solid link — milestone/tag name shown normally
- ±1 day fuzzy match: milestone/tag name shown with a dotted underline / dashed border to signal approximate match
- No match within ±1 day: fix version still appears in the list with a muted "No GitLab link" label — never hidden
- Each fix version row shows: version name, release date, linked GitLab milestone/tag (or no-link label), task count, completion status (done / total tasks from Jira)

### Claude's Discretion
- Exact progress bar visual implementation (CSS gradient, height, color values)
- Loading skeleton design for PM tabs
- Empty state design for Workload tab (no sprint members) and Releases tab (no fix versions)
- Search overlay animation / transition
- Exact dotted/dashed border styling for fuzzy release matches
- Tooltip content on hover for fuzzy match indicator (e.g., showing the actual date delta)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PM-01 | Project Manager sees sprint progress: task counts by status (to do / in progress / done) and story points done vs remaining | `fetchSprintIssues` with `assignedToMe=false` returns all sprint issues; add `statusCategory` to fields param; aggregate by `statusCategory.key`; sum `customfield_10016` for points |
| PM-02 | Project Manager sees team workload: open task count and story points per team member for the current sprint | Same sprint query as PM-01; group by `issue.fields.assignee.displayName`; count unresolved issues and sum points per member |
| PM-03 | Project Manager sees a Releases view listing Jira fix versions with their linked GitLab milestone or tag | New `fetchFixVersions` (Jira `GET /rest/api/2/version?projectKey=X`) + `fetchGroupMilestones` (GitLab `GET /api/v4/groups/{id}/milestones`) + `fetchProjectTags` (GitLab `GET /api/v4/projects/{id}/repository/tags`); date-match logic in a pure function |
| PM-04 | Releases view shows the count of tasks per fix version and their completion status | Add `fixVersion` to sprint search JQL or use `GET /rest/api/2/search` with JQL `project=X AND fixVersion="v2.1.0"`; count done vs total |
| SRCH-01 | User can search across Jira tasks and GitLab MRs by keyword or ticket key | Jira `GET /rest/api/2/search?jql=project=X AND text~"query"&fields=summary,status,assignee,customfield_10016,description` + GitLab `GET /api/v4/search?scope=merge_requests&search=query`; debounce 400ms; parallel fetch via `Promise.allSettled` |
| SRCH-02 | Search results are grouped by type (tasks vs MRs) and link to the detail view | Two sections in SearchOverlay rendered from `{ tasks: JiraIssue[], mrs: GitLabMR[] }`; click opens SearchResultPanel following NotificationDetail pattern; "Open in Jira/GitLab ↗" via `openUrl` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Server state, polling, deduplication | Established in Phases 2–3; all data fetching goes through here |
| `zustand` | ^5.0.11 | Client UI state (active tab, search query) | All stores use this; ephemeral tab state follows dashboard.store pattern |
| `@tauri-apps/plugin-http` | ^2.5.7 | All outbound API calls (bypasses CORS) | Required; plain fetch() triggers preflight failures in Tauri 2 webview |
| `lucide-react` | ^0.577.0 | Icons (Search, RefreshCw, etc.) | Already used throughout |
| `@tauri-apps/plugin-opener` | ^2 | `openUrl()` for "Open in Jira/GitLab ↗" buttons | Established in Phase 2; `plugin-shell` not installed |

### UI Components (already installed via shadcn/ui)
| Component | File | Use in Phase 4 |
|-----------|------|----------------|
| `Tabs / TabsList / TabsTrigger / TabsContent` | `src/components/ui/tabs.tsx` | PM tab set (Sprint Progress / Workload / Releases) |
| `Popover / PopoverTrigger / PopoverContent` | `src/components/ui/popover.tsx` | Option for search overlay container |
| `Button` | `src/components/ui/button.tsx` | "Open in Jira/GitLab" buttons in result detail |
| `Dialog` (if needed) | not yet added | Alternative to Popover for full-width overlay; Claude to decide |

No new npm packages are required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Popover for search | shadcn Dialog | Dialog is better for full-width modal overlay; Popover is anchored to trigger; either works since it's Claude's discretion |
| Pure CSS progress bar | third-party chart lib | No chart lib in project; Tailwind CSS gradient/width trick is sufficient |
| Two separate useQuery calls for search | Single combined query | Parallel `Promise.allSettled` in one queryFn is cleaner and ensures both results arrive together |

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:
```
taskflow/src/
├── routes/dashboard/
│   ├── SprintProgressTab.tsx    # PM-01: progress bar + status buckets
│   ├── WorkloadTab.tsx          # PM-02: per-member task/point counts
│   └── ReleasesTab.tsx          # PM-03 + PM-04: fix versions with GitLab links
├── components/app/
│   ├── SearchOverlay.tsx        # SRCH-01 + SRCH-02: overlay with input + results
│   └── SearchResultPanel.tsx   # SRCH-02: read-only detail panel for a result
└── services/
    ├── jira.ts                  # extend: fetchAllSprintIssues, fetchFixVersions, searchJira
    └── gitlab.ts                # extend: fetchGroupMilestones, fetchProjectTags, searchGitLabMRs
```

Modifications:
```
taskflow/src/
├── routes/dashboard/index.tsx   # add role-conditional branch
├── components/app/TopBar.tsx    # add Search icon + SearchOverlay mount
└── stores/dashboard.store.ts   # add PmDashTab type + pmActiveTab state
```

### Pattern 1: Role-Conditional Dashboard

The dashboard index wraps two tab sets behind a role check:

```typescript
// src/routes/dashboard/index.tsx
import { useSettingsStore } from '@/stores/settings.store';
import { useDashboardStore } from '@/stores/dashboard.store';

export default function Dashboard() {
  const role = useSettingsStore((s) => s.role);
  const { activeTab, setActiveTab, pmActiveTab, setPmActiveTab } = useDashboardStore();

  if (role === 'pm') {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <Tabs value={pmActiveTab} onValueChange={(v) => setPmActiveTab(v as PmDashTab)}>
          <TabsList>
            <TabsTrigger value="sprint-progress">Sprint Progress</TabsTrigger>
            <TabsTrigger value="workload">Workload</TabsTrigger>
            <TabsTrigger value="releases">Releases</TabsTrigger>
          </TabsList>
          <TabsContent value="sprint-progress"><SprintProgressTab /></TabsContent>
          <TabsContent value="workload"><WorkloadTab /></TabsContent>
          <TabsContent value="releases"><ReleasesTab /></TabsContent>
        </Tabs>
      </div>
    );
  }

  // developer tabs (existing)
  return ( /* unchanged */ );
}
```

### Pattern 2: Extended Dashboard Store

Extend `DashboardStore` to add PM tab state. Both tab types are ephemeral (no persist):

```typescript
// src/stores/dashboard.store.ts — additions
export type PmDashTab = 'sprint-progress' | 'workload' | 'releases';

interface DashboardState {
  activeTab: DashTab;         // existing developer tab
  setActiveTab: (tab: DashTab) => void;
  pmActiveTab: PmDashTab;     // new PM tab
  setPmActiveTab: (tab: PmDashTab) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  activeTab: 'my-tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),
  pmActiveTab: 'sprint-progress',   // default per CONTEXT.md
  setPmActiveTab: (tab) => set({ pmActiveTab: tab }),
}));
```

### Pattern 3: Sprint Progress Tab Data Flow

All sprint issues (not just assigned-to-me) are needed. The existing `fetchSprintIssues(... assignedToMe=false)` query already fetches all sprint issues for the sprint board — **reuse query key `['jira-issues', 'sprint-board', activeJiraProject]`** to avoid double-fetching.

New fields needed: add `statusCategory` to the fields parameter in `fetchSprintIssues`. Currently `fields = 'summary,status,assignee,issuetype,customfield_10016,story_points'` — extend to include `statusCategory`.

Aggregation is pure client-side from the already-fetched data:

```typescript
// In SprintProgressTab — statusCategory.key mapping
const buckets = { todo: 0, inProgress: 0, done: 0 };
const points = { done: 0, remaining: 0 };

for (const issue of sprintIssues) {
  const cat = issue.fields.status.statusCategory?.key;  // 'new' | 'indeterminate' | 'done'
  const pts = issue.fields.customfield_10016 ?? 0;
  if (cat === 'done') { buckets.done++; points.done += pts; }
  else if (cat === 'indeterminate') { buckets.inProgress++; points.remaining += pts; }
  else { buckets.todo++; points.remaining += pts; }
}
```

The JiraIssue type needs a `statusCategory` field addition:
```typescript
// In jira.ts JiraIssue interface
fields: {
  status: {
    id: string;
    name: string;
    statusCategory: { key: 'new' | 'indeterminate' | 'done' };  // ADD THIS
  };
  // ...
}
```

### Pattern 4: Workload Tab Data Flow

Same sprint data as SprintProgressTab — use the same query key `['jira-issues', 'sprint-board', activeJiraProject]` to read from TanStack cache without a new fetch:

```typescript
// WorkloadTab reads from cache via useQuery with same key
const { data: sprintIssues } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
  queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
});

// Group by assignee
const workloadMap = useMemo(() => {
  const map = new Map<string, { count: number; points: number }>();
  for (const issue of sprintIssues ?? []) {
    const name = issue.fields.assignee?.displayName ?? 'Unassigned';
    const pts = issue.fields.customfield_10016 ?? 0;
    const existing = map.get(name) ?? { count: 0, points: 0 };
    // Only count unresolved (not 'done') for workload
    if (issue.fields.status.statusCategory?.key !== 'done') {
      map.set(name, { count: existing.count + 1, points: existing.points + pts });
    }
  }
  return map;
}, [sprintIssues]);
```

### Pattern 5: Releases Tab — New API Functions

Three new service functions needed:

```typescript
// jira.ts — new
export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate: string | null;  // "YYYY-MM-DD" or null if not set
  released: boolean;
  description?: string;
}

export async function fetchFixVersions(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraFixVersion[]>
// GET ${baseUrl}/rest/api/2/version?projectKey=${projectKey}&maxResults=50
```

```typescript
// gitlab.ts — new
export interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  due_date: string | null;  // "YYYY-MM-DD" or null
  state: 'active' | 'closed';
  web_url: string;
}

export interface GitLabTag {
  name: string;
  commit: { created_at: string };  // ISO 8601
  release: { tag_name: string; description: string } | null;
}

export async function fetchGroupMilestones(
  baseUrl: string,
  token: string,
  groupId: string,
): Promise<GitLabMilestone[]>
// GET ${baseUrl}/api/v4/groups/${groupId}/milestones?per_page=100

export async function fetchProjectTags(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabTag[]>
// GET ${baseUrl}/api/v4/projects/${projectId}/repository/tags?per_page=100
```

Note: `activeGitlabGroup` in auth store holds the group full_path string. The group ID is needed for the milestones API. Either store group ID in auth store or look it up. Simplest: the group list endpoint returns both `id` and `full_path` — the group ID should be stored in auth store or fetched via `GET /api/v4/groups?search=<full_path>`.

**Important caveat:** The auth store currently stores `activeGitlabGroup` as a string (the group `full_path`), not the numeric ID. The milestones API requires the numeric group ID or the URL-encoded path. GitLab `GET /api/v4/groups/{id}` accepts both the numeric ID and the URL-encoded path, so `encodeURIComponent(full_path)` works. This avoids any auth store changes.

### Pattern 6: Release Date Matching Logic

Pure function, no API calls — testable in isolation:

```typescript
// Pure date matching: returns 'exact' | 'fuzzy' | 'none'
function matchGitLabToFixVersion(
  fixVersionDate: string | null,  // "YYYY-MM-DD"
  candidate: { date: string | null; name: string },
): 'exact' | 'fuzzy' | 'none' {
  if (!fixVersionDate || !candidate.date) return 'none';
  const fix = new Date(fixVersionDate).getTime();
  const cand = new Date(candidate.date).getTime();
  const diffDays = Math.abs(fix - cand) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 'exact';
  if (diffDays <= 1) return 'fuzzy';
  return 'none';
}
```

Date comparison pitfall: JavaScript `new Date("YYYY-MM-DD")` parses in UTC midnight; `new Date(isoString)` for tag creation dates parses with timezone. Normalize all dates to UTC midnight for comparison.

### Pattern 7: Global Search Overlay

The search overlay is a full-screen fixed overlay triggered by a Search icon in TopBar. Use a React Portal or a conditional render approach. Following the TopBar pattern (pure UI, no useQuery):

```typescript
// TopBar.tsx — add Search icon and overlay state
import { useState } from 'react';
import { Search } from 'lucide-react';
import SearchOverlay from './SearchOverlay';

// Inside TopBar:
const [searchOpen, setSearchOpen] = useState(false);

// In header JSX — add before bell icon:
<button
  type="button"
  onClick={() => setSearchOpen(true)}
  aria-label="Search"
  className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
>
  <Search className="w-5 h-5" />
</button>

{searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
```

SearchOverlay holds its own query state and debouncing:

```typescript
// SearchOverlay.tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
// ...

export default function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 400ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => performSearch(jiraBaseUrl!, jiraToken!, gitlabBaseUrl!, gitlabToken!, debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30_000,
  });
  // ...
}
```

The `performSearch` function fires both Jira JQL and GitLab search in parallel using `Promise.allSettled`:

```typescript
async function performSearch(
  jiraBaseUrl: string, jiraToken: string,
  gitlabBaseUrl: string, gitlabToken: string,
  query: string
): Promise<{ tasks: JiraIssue[]; mrs: GitLabMR[] }> {
  const [jiraResult, gitlabResult] = await Promise.allSettled([
    searchJira(jiraBaseUrl, jiraToken, query),
    searchGitLabMRs(gitlabBaseUrl, gitlabToken, query),
  ]);
  return {
    tasks: jiraResult.status === 'fulfilled' ? jiraResult.value : [],
    mrs: gitlabResult.status === 'fulfilled' ? gitlabResult.value : [],
  };
}
```

### Pattern 8: Search Result Detail Panel

Follows exactly the `NotificationDetail` pattern from Phase 3:

```typescript
// SearchResultPanel.tsx — Jira task result
interface SearchResultPanelProps {
  result: JiraIssue | GitLabMR;
  type: 'jira' | 'gitlab';
  jiraBaseUrl: string;
  gitlabBaseUrl: string;
  onClose: () => void;
}
```

The "Open in Jira/GitLab ↗" button:
```typescript
import { openUrl } from '@tauri-apps/plugin-opener';

// For Jira: construct browse URL
const jiraUrl = `${jiraBaseUrl}/browse/${issue.key}`;
// For GitLab: mr.web_url is already the direct URL

<Button onClick={() => openUrl(url)}>Open in {type === 'jira' ? 'Jira' : 'GitLab'} ↗</Button>
```

### Anti-Patterns to Avoid

- **Separate query for each PM tab:** SprintProgressTab and WorkloadTab should share the same `['jira-issues', 'sprint-board', ...]` query key — TanStack deduplicates and both tabs read from the same cache entry.
- **Storing search state in Zustand:** Search query is transient UI state — keep it in SearchOverlay component state, not the store.
- **Using `Promise.all` for parallel search:** Use `Promise.allSettled` so one failing API (e.g., GitLab unreachable) doesn't kill the other results.
- **Comparing dates with string equality:** Jira dates are `"YYYY-MM-DD"`, GitLab tag dates are ISO 8601 with timezone — always normalize to milliseconds for comparison.
- **Navigating away for search:** Search opens a full-screen overlay, does NOT use react-router navigation — preserves the user's current page.
- **Forgetting `enabled: query.length > 0` in search query:** Empty query must not trigger API calls; `useQuery` must stay disabled until debounced input is non-empty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debouncing search input | Custom debounce hook | `useEffect` + `setTimeout` / `clearTimeout` | Simple 5-line pattern; no library needed for 400ms debounce |
| Progress bar visual | SVG arc or canvas | Tailwind CSS `w-[X%]` on a div with `bg-primary` | Tailwind utility is sufficient for horizontal bar; no chart lib needed |
| Date arithmetic (±1 day) | Moment.js / date-fns | Native `Date` + millisecond math | No date library installed; `Math.abs(a - b) / 86400000` is sufficient |
| Search result grouping | Third-party list virtualization | Array split into tasks/mrs sections | Result set is small (<50 per type); no virtualization needed |
| HTTP concurrent fetch | RxJS or custom promise pool | `Promise.allSettled([...])` | Two parallel requests, standard pattern |

**Key insight:** Every problem in this phase has a trivial built-in solution given the existing stack. Do not introduce any new runtime dependencies.

---

## Common Pitfalls

### Pitfall 1: `statusCategory` Not Returned Without Explicit Field Request
**What goes wrong:** The current `fetchSprintIssues` fields param does not include `statusCategory`. Calling `issue.fields.status.statusCategory` will be undefined at runtime even though the TypeScript type claims otherwise.
**Why it happens:** Jira REST API v2 `fields` parameter is a whitelist — only listed fields are returned. `status` is returned but `status.statusCategory` is a nested object that IS included when `status` is requested. Testing against actual Jira Server needed to confirm, but the Jira API spec states `statusCategory` is embedded in the `status` field object.
**How to avoid:** Confirm `status.statusCategory.key` is present in actual Jira response. If not, add `statusCategory` as an explicit field. Update the `JiraIssue` type to include `statusCategory` on the `status` field.
**Warning signs:** `statusCategory` is `undefined` in dev tools; all issues map to "To Do" bucket incorrectly.

### Pitfall 2: `activeGitlabGroup` Is a Path, Not a Numeric ID
**What goes wrong:** GitLab milestones endpoint is `GET /api/v4/groups/{id}/milestones` where `{id}` can be numeric ID or URL-encoded path. If you pass the raw `full_path` string it will 404.
**Why it happens:** Auth store stores the human-readable `full_path` (e.g., `my-org/my-group`), not the numeric `id`.
**How to avoid:** Use `encodeURIComponent(activeGitlabGroup)` in the URL construction. GitLab accepts URL-encoded paths as group IDs.
**Warning signs:** `404` response from the milestones endpoint.

### Pitfall 3: TopBar Is a Pure UI Component — No Hooks With QueryClient
**What goes wrong:** Adding `useQuery` directly into `TopBar.tsx` will fail in tests because TopBar renders without a `QueryClientProvider`.
**Why it happens:** Established decision from Phase 3: `TopBar` is pure UI; polling hooks run in `AppLayout`. The `useNotificationPolling` hook was explicitly extracted for this reason.
**How to avoid:** `SearchOverlay` (mounted from TopBar) CAN use `useQuery` because it is mounted inside the React tree where `QueryClientProvider` exists. But keep TopBar itself free of any TanStack Query hooks. The `useState(searchOpen)` and `<SearchOverlay>` conditional render in TopBar is fine.
**Warning signs:** Test file for TopBar fails with "No QueryClient set".

### Pitfall 4: Date Parsing UTC vs Local Timezone
**What goes wrong:** `new Date("2026-03-15")` parses as midnight UTC, but `new Date("2026-03-15T14:22:00+05:30")` parses as a local-timezone-adjusted timestamp. Comparing these without normalization can show a 1-day offset in certain timezones.
**Why it happens:** JavaScript Date parsing is inconsistent between date-only strings (UTC) and ISO 8601 with timezone (local-adjusted).
**How to avoid:** For date-only strings (Jira `releaseDate`, GitLab `due_date`): parse with `new Date(dateStr + 'T00:00:00Z')` to force UTC. For tag `commit.created_at` (ISO 8601): parse normally then floor to midnight UTC via `Math.floor(ms / 86400000) * 86400000`.
**Warning signs:** Release date matches appear off by one day for users in UTC+/- timezones.

### Pitfall 5: Search Fires on Every Keystroke Without Debounce Guard
**What goes wrong:** Without the `enabled: debouncedQuery.length > 0` guard, TanStack Query will fire a search for the empty string on initial render or after the user clears input.
**Why it happens:** TanStack Query executes queries when `enabled` is truthy. A query key of `['search', '']` with `enabled: true` fires immediately.
**How to avoid:** Always gate with `enabled: debouncedQuery.length > 0` (or `> 2` for better UX — Claude's discretion).
**Warning signs:** Network requests firing on overlay open before any typing.

### Pitfall 6: Fetching Fix Version Task Counts Requires Separate Per-Version Query
**What goes wrong:** `GET /rest/api/2/version` returns fix version metadata (name, date) but NOT task counts. Task counts require a separate JQL search per version: `project = X AND fixVersion = "v2.1.0"`.
**Why it happens:** Jira's version endpoint doesn't aggregate issue counts.
**How to avoid:** Fetch all sprint issues once and group client-side by `issue.fields.fixVersions[0].name`, OR use `GET /rest/api/2/version/{id}/relatedIssueCounts` which returns `issuesFixed` and `issuesAffected` counts without fetching full issues. The second approach is more efficient for PM-04.
**Warning signs:** N+1 query pattern with one JQL fetch per fix version.

---

## Code Examples

### Jira Sprint Search — all issues with statusCategory

```typescript
// jira.ts — extend fetchSprintIssues or create fetchAllSprintIssues
// Source: Jira REST API v2 spec + project jira.ts pattern
const jql = encodeURIComponent(
  `project = ${projectKey} AND sprint in openSprints() ORDER BY updated DESC`
);
// Add statusCategory to fields — it IS part of the status object
const fields = 'summary,status,assignee,issuetype,customfield_10016';
const url = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=200`;
```

### Jira Fix Versions

```typescript
// GET /rest/api/2/version?projectKey=PROJ
// Source: Jira REST API v2 spec
const url = `${base}/rest/api/2/version?projectKey=${projectKey}&maxResults=50`;
// Response: Array<{ id, name, releaseDate: "YYYY-MM-DD" | undefined, released: boolean }>
```

### Jira Fix Version Issue Counts

```typescript
// GET /rest/api/2/version/{id}/relatedIssueCounts
// Source: Jira REST API v2 spec
const url = `${base}/rest/api/2/version/${versionId}/relatedIssueCounts`;
// Response: { issuesFixed: number, issuesAffected: number, ... }
// issuesFixed = done tasks, (total = issuesFixed + issuesAffected) may not be right
// Alternative: separate JQL count queries per version
// Simpler: fetch all sprint issues, group by fixVersions field client-side
```

### GitLab Group Milestones

```typescript
// GET /api/v4/groups/{id}/milestones
// Source: gitlab.ts pattern + GitLab API docs
const url = `${base}/api/v4/groups/${encodeURIComponent(groupPath)}/milestones?per_page=100`;
// PRIVATE-TOKEN header (same as all gitlab.ts functions)
// Response: Array<{ id, iid, title, due_date: "YYYY-MM-DD" | null, state, web_url }>
```

### GitLab Project Tags

```typescript
// GET /api/v4/projects/{id}/repository/tags
// Source: gitlab.ts pattern + GitLab API docs
// Note: need project ID, not just group. Auth store has activeGitlabGroup (path).
// If only one project is configured, can get project ID from group projects list.
// GET /api/v4/groups/{id}/projects returns projects with their IDs.
const url = `${base}/api/v4/projects/${projectId}/repository/tags?per_page=100`;
// Response: Array<{ name, commit: { created_at: ISO8601 }, release: null | { tag_name, description } }>
```

### GitLab Search MRs

```typescript
// GET /api/v4/search?scope=merge_requests&search=QUERY
// Source: GitLab REST API docs
const url = `${base}/api/v4/search?scope=merge_requests&search=${encodeURIComponent(query)}&per_page=20`;
// Returns same MR object shape as GitLabMR interface — safe to cast
```

### Jira Search (JQL text search)

```typescript
// GET /rest/api/2/search?jql=...&fields=...
// Source: project jira.ts fetchSprintIssues pattern
const jql = encodeURIComponent(
  `project = ${projectKey} AND text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`
);
const fields = 'summary,status,assignee,customfield_10016,description';
const url = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=20`;
// Description is returned as a string (Jira Server) — excerpt by slicing first 200 chars
```

### TopBar with Search Icon

```typescript
// src/components/app/TopBar.tsx — modified
import { useState } from 'react';
import { Bell, Search } from 'lucide-react';

export default function TopBar() {
  const unreadCount = useUnreadCount();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-12 border-b flex items-center justify-end px-4 flex-shrink-0 gap-2">
      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Existing bell + popover */}
      <Popover>
        {/* ... unchanged ... */}
      </Popover>

      {/* Search overlay — rendered inline, fixed-position overlay */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tauri-plugin-http` optional | `tauri-plugin-http` required for all API calls | Phase 1 (corrected) | Plain `fetch()` triggers CORS in Tauri 2 webview; always use plugin |
| `createBrowserRouter` | `createHashRouter` | Phase 1 | BrowserRouter breaks production Tauri builds |
| `vi.stubGlobal(fetch)` for tests | `vi.mock('@tauri-apps/plugin-http')` module mock | Phase 1 | Services import named `fetch` from plugin, not globalThis.fetch |

**Still current:**
- TanStack Query v5 (not v4) — `useQuery` API is the same but some internals differ
- Tailwind v4 — no `postcss.config.js` or `tailwind.config.js`; `@tailwindcss/vite` only
- Zustand v5 — store creation syntax unchanged from v4

---

## Open Questions

1. **Does `status.statusCategory` come back when requesting `status` as a field?**
   - What we know: Jira REST API v2 `status` field includes the full status object with `statusCategory` nested
   - What's unclear: Whether Jira Server (on-prem) versions below 8.x include `statusCategory` in the status object
   - Recommendation: In the service function, defensively handle `statusCategory?.key` being undefined; default to 'todo' bucket if missing; log a warning

2. **GitLab project ID for tags endpoint**
   - What we know: Auth store has `activeGitlabGroup` (full_path string) but NOT a project ID; milestones use group ID (path works); tags require a specific project ID
   - What's unclear: Which GitLab project to use for tags — the team might have multiple projects in the group
   - Recommendation: Fetch `GET /api/v4/groups/{id}/projects` and use the first project, OR add `activeGitlabProjectId` to auth store. The simplest path: fetch group projects during ReleasesTab init and use the first project (or the one matching the configured group context). This is a one-time fetch with `staleTime: Infinity`.

3. **`releaseDate` field on Jira fix versions — always present?**
   - What we know: Jira `GET /rest/api/2/version` returns `releaseDate` as a string when set, omits the field when not set
   - What's unclear: Fix versions without a release date cannot match GitLab milestones/tags — should they be shown?
   - Recommendation: Per CONTEXT.md, "fix version still appears in the list with muted 'No GitLab link' label — never hidden". A version with no `releaseDate` also shows "No GitLab link". Handle `releaseDate: undefined` gracefully in the matching function.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PM-01 | Sprint progress buckets (To Do / In Progress / Done) computed correctly from statusCategory | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx -x` | ❌ Wave 0 |
| PM-01 | Progress bar hidden when all issues unestimated (no story points) | unit | same file | ❌ Wave 0 |
| PM-02 | Workload grouped correctly by assignee, unresolved only | unit | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx -x` | ❌ Wave 0 |
| PM-03 | Fix version date matching: exact / fuzzy / none | unit | `cd taskflow && npx vitest run src/services/releaseLinker.test.ts -x` | ❌ Wave 0 |
| PM-04 | Releases tab renders version rows with task counts | unit | `cd taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx -x` | ❌ Wave 0 |
| SRCH-01 | Search query disabled when input is empty | unit | `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx -x` | ❌ Wave 0 |
| SRCH-01 | Both Jira and GitLab search called in parallel for non-empty query | unit | same file | ❌ Wave 0 |
| SRCH-02 | Results grouped by Tasks / Merge Requests sections | unit | same file | ❌ Wave 0 |
| SRCH-02 | Clicking result shows detail panel with "Open in Jira/GitLab" button | unit | `cd taskflow && npx vitest run src/components/app/SearchResultPanel.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
All test files are new — none exist yet:
- [ ] `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` — covers PM-01
- [ ] `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — covers PM-02
- [ ] `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` — covers PM-03, PM-04
- [ ] `taskflow/src/services/releaseLinker.test.ts` — covers PM-03 date matching logic (pure function, easiest to test in isolation)
- [ ] `taskflow/src/components/app/SearchOverlay.test.tsx` — covers SRCH-01, SRCH-02
- [ ] `taskflow/src/components/app/SearchResultPanel.test.tsx` — covers SRCH-02 detail panel

Note: `TopBar.test.tsx` already exists and tests TopBar in isolation. The SearchOverlay mount should be tested separately to avoid breaking existing TopBar tests.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of `taskflow/src/services/jira.ts` — all Jira API patterns, field names, auth headers
- Direct code reading of `taskflow/src/services/gitlab.ts` — all GitLab API patterns, PRIVATE-TOKEN header
- Direct code reading of `taskflow/src/routes/dashboard/MyTasksTab.tsx` — TanStack Query pattern with readSecret + polling
- Direct code reading of `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — shared query key pattern
- Direct code reading of `taskflow/src/routes/notifications/NotificationDetail.tsx` — read-only detail panel pattern
- Direct code reading of `taskflow/src/components/app/TopBar.tsx` — pure UI, no TanStack Query
- Direct code reading of `taskflow/src/stores/dashboard.store.ts` — DashTab type, Zustand pattern
- Direct code reading of `taskflow/src/stores/settings.store.ts` — role field type
- Direct code reading of `taskflow/src/stores/auth.store.ts` — activeGitlabGroup as string path

### Secondary (MEDIUM confidence)
- Jira REST API v2 specification: `GET /rest/api/2/version` returns `releaseDate`, `GET /rest/api/2/version/{id}/relatedIssueCounts` returns counts — standard API, well-documented
- GitLab REST API docs: `GET /api/v4/groups/{id}/milestones`, `GET /api/v4/projects/{id}/repository/tags`, `GET /api/v4/search?scope=merge_requests` — standard API endpoints
- `statusCategory` field on Jira issue status objects — standard Jira REST API v2 behavior for Server and Cloud

### Tertiary (LOW confidence)
- Whether `statusCategory` is reliably present in all Jira Server on-prem instances — flag for validation with real instance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json; no new deps needed
- Architecture: HIGH — patterns directly observed from existing Phase 2/3 components
- Pitfalls: HIGH for code pitfalls (confirmed from source); MEDIUM for API response shape (Jira statusCategory on real server)
- API endpoints: MEDIUM — standard documented endpoints; exact response shapes need real-instance validation

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable stack; Jira/GitLab API endpoints are stable)
