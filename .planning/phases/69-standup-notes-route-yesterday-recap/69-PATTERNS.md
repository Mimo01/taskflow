# Phase 69: Standup Notes — Route + Yesterday Recap - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` | component (page) | request-response (multi-query) | `taskflow/src/routes/worklogs/WorklogsPage.tsx` | exact |
| `taskflow/src/routes/standup-notes/StandupPageHeader.tsx` | component (sub) | — | `taskflow/src/routes/dashboard/index.tsx` (header section) | role-match |
| `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` | component (sub) | transform (data grouping) | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (hierarchy useMemo) | role-match |
| `taskflow/src/routes/standup-notes/TodayColumnPlaceholder.tsx` | component (sub) | — | `taskflow/src/routes/dashboard/index.tsx` (card section) | role-match |
| `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` | component (sub) | — | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (epic/story rows) | role-match |
| `taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx` | component (sub) | — | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (NO_EPIC row) | role-match |
| `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx` | component (sub) | — | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (epic row) | role-match |
| `taskflow/src/lib/standup-date.ts` | utility | transform | `taskflow/src/lib/aioUtils.ts` | role-match |
| `taskflow/src/services/jira.ts` (add `fetchYesterdayJiraActivity`) | service | request-response | `taskflow/src/services/jira.ts` (`fetchComments`, `searchJira`) | exact (same file) |
| `taskflow/src/services/gitlab.ts` (add `fetchUserCommits`) | service | request-response | `taskflow/src/services/gitlab.ts` (`validateGitLab`, `listGitLabProjects`) | exact (same file) |
| `taskflow/src/services/gitlab.ts` (add `fetchUserMREvents`) | service | request-response | `taskflow/src/services/gitlab.ts` (`validateGitLab`) | exact (same file) |
| `taskflow/src/routes/routes.tsx` (add `/standup-notes`) | config (route) | — | `taskflow/src/routes/routes.tsx` (`/worklogs` entry) | exact |
| `taskflow/src/components/app/sidebar-items.ts` (add entry) | config | — | `taskflow/src/components/app/sidebar-items.ts` (existing entries) | exact |
| `taskflow/src/main.tsx` (add routeLabel case) | config | — | `taskflow/src/main.tsx` (routeLabel lines 286-298) | exact |

---

## Pattern Assignments

### `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` (component, multi-query)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx`

**Imports pattern** (lines 14-50):
```typescript
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { readSecret } from '@/services/stronghold';
import { fetchWorklogs, fetchUserSchedule } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
```

**Token loading pattern** (lines 305-312):
```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```
Copy this pattern twice: once for `jiraToken` / `jiraBaseUrl`, once for `gitlabToken` / `gitlabBaseUrl`.

**Fine-grained store selector pattern** (line 255):
```typescript
const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
```
Never destructure `useSettingsStore()` wholesale — always use a per-field selector.

**T-62-06 critical rule — token NOT in queryKey** (lines 352-364):
```typescript
// T-62-06: jiraToken MUST NOT appear in queryKey
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? ''],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl!, jiraToken!, selectedUsername ? [selectedUsername] : [], from, to),
  enabled:
    !!jiraBaseUrl &&
    !!jiraToken &&
    tempoEnabled &&
    !!from &&
    !!to,
});
```
For standup queries, use `readSecret()` inside the queryFn for the second and third queries (jira activity, gitlab queries), while keeping `!!jiraToken` only in `enabled`. See RESEARCH.md Pattern 3 for all four queryKey shapes.

**Schedule query with long staleTime** (lines 490-495):
```typescript
const { data: scheduleData } = useQuery({
  queryKey: ['tempo', 'schedule', jiraBaseUrl, from, to, jiraUserKey ?? ''],
  queryFn: () => fetchUserSchedule(jiraBaseUrl!, jiraToken!, from, to, jiraUserKey!),
  enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUserKey && tempoEnabled && !!from && !!to,
  staleTime: 24 * 60 * 60 * 1000,
});
```
Schedule data changes at most once per day; use `staleTime: 24 * 60 * 60 * 1000` (not the default 5min).

**useMemo for derived date** (lines 332-349):
```typescript
const { from, to } = useMemo(() => {
  // ...computation...
}, [preset, customFrom, customTo]);
```
Use the same `useMemo` pattern with `scheduleData` as dependency:
```typescript
const yesterdayDate = useMemo(
  () => resolveYesterdayDate(scheduleData ?? undefined),
  [scheduleData],
);
```

**Loading/error/empty rendering cascade** (lines 953-1012):
```typescript
{isError ? (
  <div className="p-4">
    <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
  </div>
) : isLoading && !data ? (
  // Skeleton rows
  <Skeleton className="h-4 w-full" />
) : data?.length === 0 ? (
  <div className="px-6 py-4">
    <EmptyState icon={Clock} title="No worklogs found" subtitle="..." />
  </div>
) : (
  // Actual content
)}
```
Apply per section (once per `useQuery` source), not wrapping the whole page.

---

### `taskflow/src/routes/standup-notes/StandupPageHeader.tsx` (component, sub)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (header JSX) + `taskflow/src/routes/dashboard/index.tsx` (greeting/date pattern)

**Header structure pattern** (WorklogsPage.tsx lines 738-743):
```typescript
return (
  <div className="flex flex-col h-full">
    {/* Page header */}
    <header className="px-6 py-4 border-b border-border">
      <h1 className="text-xl font-semibold">Worklogs</h1>
    </header>
```
For standup, extend to include: title (`text-xl font-semibold`), muted date, right-aligned sync status + Refresh button + Copy markdown button.

**Copy markdown clipboard pattern** (navigator.clipboard — no Tauri plugin):
```typescript
async function handleCopyMarkdown() {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback: silent no-op
  }
}
```

---

### `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` (component, transform)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (hierarchy useMemo, lines 507-656)

**Grouping by key pattern** (lines 530-631 — adapted for issue grouping):
```typescript
const { hierarchy, ... } = useMemo(() => {
  const hierarchyMap: HierarchyMap = new Map();

  function getOrCreateEpic(epicKey: string, summary: string): EpicNode {
    if (!hierarchyMap.has(epicKey)) {
      hierarchyMap.set(epicKey, { summary, dayMap: new Map(), entries: [], stories: new Map() });
    }
    return hierarchyMap.get(epicKey)!;
  }

  for (const w of data ?? []) {
    const issueKey = w.issue.key;
    // ...accumulate
  }

  return { hierarchy: hierarchyMap, ... };
}, [data, enrichQuery.data, ...]);
```
Adapt this Map-based grouping for the standup's issue groups. The standup grouping key is Jira issue key extracted from: worklog → Jira activity → commit message → commit branch → "Other" catch-all.

**Date comparison with .slice(0,10)** (WorklogsPage.tsx line 127):
```typescript
// NEVER toLocaleDateString() for date comparison (Phase 62 rule)
days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
```
All date comparisons: `dateStr.slice(0, 10) === yesterdayDate` — never `toLocaleDateString()`.

**Hours formatting pattern** (WorklogsPage.tsx lines 92-98):
```typescript
export function formatSeconds(secs: number): string {
  if (secs === 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```
For standup, use `(seconds / 3600).toFixed(1) + 'h'` as the simpler variant (already in RESEARCH.md as the verified WorklogsPage local copy pattern).

---

### `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` (component, sub)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (story row JSX, lines 1122-1177)

**Issue group header pattern** (lines 1134-1152):
```typescript
<tr className="cursor-pointer group/row">
  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border border-border border-r-0 min-w-52 max-w-52 overflow-hidden">
    <button
      type="button"
      aria-label={`Open ${storyKey}`}
      onClick={() => onIssueClick(storyKey)}
      className="flex items-center gap-1 w-full text-left pl-3 min-w-0 cursor-pointer"
    >
      <StoryIcon className={`size-3 shrink-0 ${storyColor}`} />
      <span className="font-medium leading-tight truncate">
        {storyNode.summary}
      </span>
    </button>
  </td>
```
For standup, replace the table cell with a flex div. The group header is: `[icon] [IssueKey] [Summary] [TotalTempoHours right-aligned]`. Sub-items beneath with icons from Lucide per type (see UI-SPEC).

**Integration-disabled inline notice** (RESEARCH.md Pattern 8):
```typescript
if (!tempoEnabled) {
  return <p className="text-xs text-muted-foreground">Tempo is disabled. Enable it in Settings → Integrations.</p>;
}
```
Render this before `isLoading`/`isError` cascade — it is not an error state.

---

### `taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx` (component, sub)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (NO_EPIC row, lines 1059-1094)

**"No parent" group pattern** (lines 1059-1094):
```typescript
const isNoEpic = epicKey === NO_EPIC;
// ...
{isNoEpic ? (
  <span className="flex items-center gap-1 text-purple-400 dark:text-purple-600 italic text-[11px]">
    <Layers className="size-3 shrink-0 text-purple-400 dark:text-purple-600" />
    No Epic
  </span>
) : ( ... )}
```
Apply the same concept for "Other commits" — a distinct visual style (muted, italic) to separate catch-all entries from issue-linked groups.

---

### `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx` (component, sub)

**Analog:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (epic row pattern, lines 1054-1120)

The same epic row pattern applies: group header with MR IID as the key (e.g. `!2098`), MR title as summary, no hours column. Use `GitMerge` or `GitPullRequest` Lucide icon.

---

### `taskflow/src/lib/standup-date.ts` (utility, transform)

**Analog:** `taskflow/src/lib/aioUtils.ts`

**Utility file structure pattern** (aioUtils.ts lines 1-28):
```typescript
/**
 * Shared [domain] utilities.
 *
 * [Single-sentence purpose description]
 */

/**
 * [Function JSDoc]
 */
export function normalizeStatus(raw: string | undefined): 'pass' | 'fail' | 'blocked' | 'notRun' {
  // pure logic — no side effects
}
```

**Weekend-skip source** (WorklogsPage.tsx lines 182-189 — `getLastWorkingDay()`):
```typescript
function getLastWorkingDay(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 1=Mon, ...
  const daysBack = dow === 1 ? 3 : dow === 0 ? 2 : 1;
  const d = new Date(today);
  d.setDate(today.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}
```
This is the base logic to extend. The new `resolveYesterdayDate()` adds a loop that also checks `tempoSchedule?.get(dateStr) === 'HOLIDAY'`. Full implementation in RESEARCH.md Pattern 4.

**`ScheduleDayType` import:**
```typescript
import type { ScheduleDayType } from '@/services/tempo';
```

---

### `taskflow/src/services/jira.ts` — add `fetchYesterdayJiraActivity()` (service, request-response)

**Analog:** `fetchComments()` at lines 806-833 and `searchJira()` at lines 1061-1094 of `taskflow/src/services/jira.ts`

**JQL search with apiFetch pattern** (searchJira lines 1067-1093):
```typescript
export async function searchJira(baseUrl, token, projectKey, query) {
  const base = baseUrl.replace(/\/$/, '');
  const jql = `project = ${projectKey} AND text ~ "${query}" ORDER BY updated DESC`;
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee&maxResults=20`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      'Search Issues',
    );
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const data = await response.json();
  return (data.issues ?? []) as JiraIssue[];
}
```
For `fetchYesterdayJiraActivity`, add `expand=changelog` to the fields param and throw `ApiError` on 401/403 (rather than returning empty) since auth failures should surface as error states, not empty states.

**Comments fetch pattern** (lines 806-833):
```typescript
export async function fetchComments(baseUrl, token, issueKey): Promise<JiraComment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;
  let response: Response;
  try {
    response = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } }, 'Load Issue Detail');
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch comments for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch comments for ${issueKey}: status ${response.status}`);
  }
  const data = (await response.json()) as { comments: JiraComment[] };
  return data.comments ?? [];
}
```
The standup Jira function calls this endpoint per issue inside a `try/catch` with graceful degradation (per-issue failure should not abort the whole request).

**JiraComment interface** (lines 798-804):
```typescript
export interface JiraComment {
  id: string;
  author: { displayName: string; name?: string };
  body: string;
  created: string; // ISO 8601
  updated: string;
}
```

**ApiError import** (line 17 of jira.ts):
```typescript
import { ApiError } from '../lib/api-error';
```

---

### `taskflow/src/services/gitlab.ts` — add `fetchUserCommits()` and `fetchUserMREvents()` (service, request-response)

**Analog:** `validateGitLab()` and `listGitLabProjects()` at lines 46-165 of `taskflow/src/services/gitlab.ts`

**GitLab apiFetch pattern** (validateGitLab lines 46-79):
```typescript
export async function validateGitLab(baseUrl: string, token: string): Promise<GitLabUser> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/user`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Validate Connection',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (response.ok) {
    const data = await response.json();
    return { id: data.id, name: data.name, username: data.username };
  }
  if (response.status === 401) throw new ApiError('Invalid token or token has expired', 401, 'gitlab');
  if (response.status === 403) throw new ApiError('Token valid but lacks required permissions', 403, 'gitlab');
  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}
```
Critical rules: always use `'PRIVATE-TOKEN'` header (not `Authorization: Bearer`); always use `apiFetch('gitlab', ...)` with `'gitlab'` as first arg; always wrap the `apiFetch` call in `try/catch` that throws a descriptive URL error.

**ApiError import** (line 16 of gitlab.ts):
```typescript
import { ApiError } from '../lib/api-error';
```

**Parallel fetch pattern** (for `fetchUserMREvents` — two event types in parallel):
```typescript
const [commentedRes, approvedRes] = await Promise.allSettled([
  apiFetch('gitlab', urlA, { headers }, 'Load Standup MR Events'),
  apiFetch('gitlab', urlB, { headers }, 'Load Standup MR Events'),
]);
for (const result of [commentedRes, approvedRes]) {
  if (result.status === 'fulfilled' && result.value.ok) {
    const data = (await result.value.json()) as GitLabUserMREvent[];
    events.push(...data.filter(e => e.created_at.slice(0, 10) === date));
  }
}
```

---

### `taskflow/src/routes/routes.tsx` — add `/standup-notes` route (config)

**Analog:** `/worklogs` entry (lines 12-23 + line 45)

**Lazy import pattern** (lines 12-23):
```typescript
const WorklogsPage = lazy(() => import('./worklogs/WorklogsPage'));
```
Add directly above the existing `WorklogsPage` import:
```typescript
const StandupNotesPage = lazy(() => import('./standup-notes/StandupNotesPage'));
```

**Route array entry pattern** (line 45):
```typescript
{ path: '/worklogs', element: withLazy(WorklogsPage) },
```
Add after `/worklogs`:
```typescript
{ path: '/standup-notes', element: withLazy(StandupNotesPage) },
```

**withLazy wrapper** (lines 25-33 — do not modify):
```typescript
function withLazy(Component: ComponentType) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        <Component />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
```

---

### `taskflow/src/components/app/sidebar-items.ts` — add `standup-notes` entry (config)

**Analog:** `my-tasks` entry (lines 46-51) — also `section: 'main'`

**SidebarNavDef pattern** (lines 46-51):
```typescript
{
  id: 'my-tasks',
  label: 'My Tasks',
  path: '/my-tasks',
  iconName: 'CheckSquare',
  section: 'main',
},
```
Add after `my-tasks`:
```typescript
{
  id: 'standup-notes',
  label: 'Standup Notes',
  path: '/standup-notes',
  iconName: 'ClipboardList',
  section: 'main',
},
```
No `getDefaultSidebarItems()` change needed — it maps `SIDEBAR_NAV_ITEMS` automatically (line 96).

---

### `taskflow/src/main.tsx` — add `routeLabel` case (config)

**Analog:** `/worklogs` case (line 293)

**routeLabel pattern** (lines 285-298):
```typescript
function routeLabel(pathname: string): string {
  if (pathname.startsWith('/sprint-board')) return 'Sprint Board';
  // ...
  if (pathname.startsWith('/worklogs')) return 'Worklogs';
  // ...
  return 'Home';
}
```
Add before `return 'Home'`:
```typescript
if (pathname.startsWith('/standup-notes')) return 'Standup Notes';
```

---

## Shared Patterns

### Token Loading (apply to StandupNotesPage.tsx)

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 263 + 305-312

```typescript
const [jiraToken, setJiraToken] = useState<string | null>(null);
const [gitlabToken, setGitlabToken] = useState<string | null>(null);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);

useEffect(() => {
  if (gitlabBaseUrl) {
    readSecret('gitlab-pat')
      .then((t) => setGitlabToken(t))
      .catch(() => setGitlabToken(null));
  }
}, [gitlabBaseUrl]);
```

### T-62-06: Token NOT in queryKey (apply to all useQuery hooks)

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 1-12 (comment) + 352-354

Token strings (`jiraToken`, `gitlabToken`) must never appear in `queryKey`. The `enabled` guard (`!!jiraToken`) ensures the query only fires when a token is available. Fresh token is fetched via `readSecret()` inside `queryFn` for dependent queries.

### Error Handling in Service Functions

**Source:** `taskflow/src/services/gitlab.ts` lines 70-78, `taskflow/src/services/jira.ts` lines 825-829

```typescript
if (response.status === 401 || response.status === 403) {
  throw new ApiError('...descriptive message...', response.status, 'gitlab'); // or 'jira'
}
throw new Error(`...status ${response.status}`);
```
Always use `ApiError` for 401/403 (triggers session-expired UI in `ErrorState`). Use plain `Error` for other non-ok statuses.

### apiFetch Source Parameter

**Source:** `taskflow/src/services/gitlab.ts` line 51, `taskflow/src/services/jira.ts` line 57

- All calls in `gitlab.ts` new functions: `apiFetch('gitlab', url, ...)`
- All calls in `jira.ts` new function: `apiFetch('jira', url, ...)`

### Date Comparison (apply everywhere)

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 113-127 (comment)

```typescript
// CORRECT: .slice(0,10) on ISO string
const dateStr = candidate.toISOString().slice(0, 10);
// CORRECT: date comparison
w.dateStarted.slice(0, 10) === yesterdayDate

// WRONG: never use toLocaleDateString() for date comparison
```

### Skeleton Loading Pattern

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 975-976

```typescript
<Skeleton className="h-4 w-full" />
```
Per UI-SPEC: use 3× stacked `<Skeleton className="h-4 w-full" />` for section loading states.

### Empty State Pattern

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 1001-1011

```typescript
<div className="px-6 py-4">
  <EmptyState
    icon={Clock}
    title="No worklogs found"
    subtitle="No hours were logged in the selected date range."
  />
</div>
```

### ErrorState Pattern

**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 953-956

```typescript
<div className="p-4">
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
</div>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `taskflow/src/routes/standup-notes/TodayColumnPlaceholder.tsx` | component (sub) | — | No existing placeholder/stub column component exists; it is a novel UI element. Use `text-muted-foreground` text and the same section card styling as other column headers. |

---

## Metadata

**Analog search scope:** `taskflow/src/routes/`, `taskflow/src/services/`, `taskflow/src/lib/`, `taskflow/src/components/app/`, `taskflow/src/main.tsx`
**Files scanned:** 14 files read directly + grep over jira.ts exports
**Pattern extraction date:** 2026-05-24
