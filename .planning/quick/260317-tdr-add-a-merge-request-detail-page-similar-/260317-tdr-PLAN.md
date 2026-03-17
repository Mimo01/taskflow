---
phase: quick-260317-tdr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/gitlab.ts
  - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
  - taskflow/src/main.tsx
  - taskflow/src/components/app/Sidebar.tsx
autonomous: true
requirements: [MR-DETAIL, MR-LIST]

must_haves:
  truths:
    - "User can navigate to a dedicated MR list page showing all project MRs"
    - "User can filter MRs by state (open/merged/closed) and search by text"
    - "User can click an MR in the list to view its full detail page"
    - "MR detail page shows title, description, commits, linked Jira issues in left column"
    - "MR detail page shows status, author, reviewers, labels, pipeline, branches, dates in right sidebar"
    - "User can click 'Open in GitLab' to view MR in browser"
    - "Breadcrumb navigation works the same as Jira issue detail"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "fetchMRDetail function and GitLabMRDetail type"
      contains: "fetchMRDetail"
    - path: "taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx"
      provides: "Full MR detail page with two-column layout"
      min_lines: 150
    - path: "taskflow/src/routes/dashboard/MergeRequestListPage.tsx"
      provides: "MR list page with state filters and search"
      min_lines: 100
    - path: "taskflow/src/main.tsx"
      provides: "Routes for /merge-requests and /mr/:projectId/:iid"
      contains: "merge-requests"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Merge Requests nav link"
      contains: "merge-requests"
  key_links:
    - from: "taskflow/src/routes/dashboard/MergeRequestListPage.tsx"
      to: "/mr/:projectId/:iid"
      via: "navigate() on row click"
      pattern: "navigate.*mr/"
    - from: "taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx"
      to: "fetchMRDetail"
      via: "useQuery"
      pattern: "useQuery.*gitlab-mr-detail"
    - from: "taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx"
      to: "/issue/:key"
      via: "onIssueClick for linked Jira issues"
      pattern: "onIssueClick"
---

<objective>
Add a merge request detail page (two-column layout mirroring IssueDetailPage) and a dedicated MR list page as a top-level route. MR detail shows title, rendered description, commits, linked Jira issues on the left; status, author, reviewers, assignee, labels, pipeline, approvals, source/target branch, dates on the right sidebar. MR list page shows all project MRs with state filters and search. All read-only with "Open in GitLab" for actions.

Purpose: Developers can browse and inspect GitLab MRs without leaving the app.
Output: Two new route pages, extended GitLab API service, sidebar nav link, router config.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/IssueDetailPage.tsx (layout pattern to mirror)
@taskflow/src/routes/dashboard/IssueDetailSidebar.tsx (sidebar pattern)
@taskflow/src/services/gitlab.ts (existing GitLab API functions + types)
@taskflow/src/services/linkEngine.ts (extractTicketKeys for linked Jira issues)
@taskflow/src/stores/breadcrumb.store.ts (breadcrumb trail pattern)
@taskflow/src/main.tsx (router config + AppLayout)
@taskflow/src/components/app/Sidebar.tsx (nav links)

<interfaces>
<!-- Key types and contracts the executor needs -->

From taskflow/src/services/gitlab.ts:
```typescript
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string;
  web_url: string;
}
export interface MRCommit { id: string; title: string; message: string; }
export interface MRApprovals { approved_by: Array<{ user: { id: number; name: string } }>; approved: boolean; }
// Existing functions: fetchProjectMRs, fetchMRCommits, fetchMRApprovals, fetchMRDiscussions, searchGitLabMRs
```

From taskflow/src/services/linkEngine.ts:
```typescript
export function extractTicketKeys(text: string): string[]
```

From taskflow/src/stores/breadcrumb.store.ts:
```typescript
export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  trail: TrailEntry[], push, pop, reset
}))
```

AppLayout outlet context (from main.tsx):
```typescript
{ onIssueClick: (key: string, resetTrail?: boolean) => void, openEdit, openAddSubtask, openCreateStory }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend GitLab API + Create MR Detail Page + MR List Page</name>
  <files>
    taskflow/src/services/gitlab.ts,
    taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx,
    taskflow/src/routes/dashboard/MergeRequestListPage.tsx
  </files>
  <action>
**1. Extend gitlab.ts:**

Add a `GitLabMRDetail` interface extending `GitLabMR` with additional fields from the single-MR endpoint:
```typescript
export interface GitLabMRDetail extends GitLabMR {
  description: string | null;
  target_branch: string;
  created_at: string;
  labels: string[];
  draft: boolean;
  merge_status: string;
  has_conflicts: boolean;
  changes_count: string;
  merged_at: string | null;
  closed_at: string | null;
  pipeline: { id: number; status: string; web_url: string } | null;
  assignee: { id: number; name: string; username: string; avatar_url: string } | null;
}
```

Add `fetchMRDetail(baseUrl, token, projectId, mrIid)` function following the exact same pattern as `fetchProjectMRs` — uses `apiFetch('gitlab', ...)` with `PRIVATE-TOKEN` header, calls `GET /api/v4/projects/${projectId}/merge_requests/${mrIid}`, returns `GitLabMRDetail`. Follow same error handling pattern (ApiError for 401/403).

Update `fetchProjectMRs` to accept an optional `state` parameter (default `'opened'`), so MR list page can fetch all states: change URL to `...merge_requests?state=${state}&per_page=100`.

**2. Create MergeRequestDetailPage.tsx:**

Mirror IssueDetailPage's structure exactly:
- Route params: `useParams<{ projectId: string; iid: string }>()`
- Same breadcrumb navigation header pattern (reads `useBreadcrumbStore` trail, same back button + breadcrumb chips)
- `useQuery` with key `['gitlab-mr-detail', projectId, iid]` fetching via `fetchMRDetail`. `staleTime: 30_000`.
- Read `gitlabBaseUrl` from `useAuthStore()`, read gitlab-pat from `readSecret('gitlab-pat')`.
- Parallel queries for commits (`fetchMRCommits`), approvals (`fetchMRApprovals`) using same projectId/iid.

**Left column (flex-1, overflow-auto, p-6):**
- MR IID as mono text (`!{iid}`), title as h1
- Draft badge if `mr.draft`
- State badge: green for opened, purple for merged, red for closed
- "Open in GitLab" button using `openUrl(mr.web_url)` from `@tauri-apps/plugin-opener`
- Description rendered with `WikiRenderer` (reuse from IssueDetailContent — it handles markdown). If description is null/empty, show italic "No description provided".
- Commits section: heading "Commits ({count})" + list of commit titles with truncated SHA prefix (`commit.id.slice(0,8)`)
- Linked Jira Issues section: use `extractTicketKeys(mr.title)` and `extractTicketKeys(mr.source_branch)` to find Jira keys. Display as clickable badges that call `onIssueClick(key)` from outlet context (same as IssueDetailPage pattern). If no linked issues found, show "No linked Jira issues".

**Right sidebar (w-[42%], border-l, overflow-auto, p-4, shrink-0):**
- Status: state badge (same as left)
- Author: avatar (img, rounded-full, h-6 w-6) + name
- Assignee: avatar + name (or "Unassigned")
- Reviewers: list of names
- Approvals: "Approved by: {names}" from MRApprovals data, or "No approvals"
- Labels: mapped as Badge components
- Pipeline: status badge if pipeline exists (success=green, failed=red, running=blue, pending=yellow)
- Source branch -> Target branch: `source_branch` arrow `target_branch` with GitBranch icon
- Conflicts: warning badge if `has_conflicts`
- Changes: `changes_count` files changed
- Created: `relativeTime(mr.created_at)` — import from IssueDetailContent
- Updated: `relativeTime(mr.updated_at)`
- Merged: `relativeTime(mr.merged_at)` if merged

Skeleton loading state: same pattern as IssueDetailSkeleton in IssueDetailPage.tsx (two-column skeleton with Skeleton components).

**3. Create MergeRequestListPage.tsx:**

- `useAuthStore()` for `gitlabBaseUrl`, `activeGitlabProject`
- `readSecret('gitlab-pat')` for token (same pattern as MrAttentionTab)
- State filter: tabs or button group for "Open" | "Merged" | "Closed" | "All" — default "Open". Store as `useState<'opened'|'merged'|'closed'|'all'>('opened')`.
- Search: text input with debounced search (300ms). When search text exists, use `searchGitLabMRs()` instead of `fetchProjectMRs()`.
- `useQuery` with key `['gitlab-project-mrs', projectId, stateFilter]` calling `fetchProjectMRs(baseUrl, token, projectId, stateFilter)`.
- Results displayed as a list/table of MR rows. Each row shows: title, `!{iid}`, state badge (colored), author name, source branch, pipeline status dot, relative updated time.
- Whole row clickable — navigates to `/mr/${mr.project_id}/${mr.iid}`. Before navigating, push current page onto breadcrumb trail: `breadcrumbReset(); breadcrumbPush({ path: '/merge-requests', label: 'Merge Requests' })`.
- Track recent item on MR click: `pushRecentItem({ type: 'gitlab-mr', id: String(mr.iid), title: mr.title })`.
- EmptyState when no MRs found. ErrorState on error. StaleDataBanner when stale + cached data (three-state detection pattern per Phase 22 decisions).
- Page header: "Merge Requests" with GitMerge icon, matching the style of other list pages.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -50</automated>
  </verify>
  <done>
    - GitLabMRDetail type and fetchMRDetail function exist in gitlab.ts
    - fetchProjectMRs accepts optional state parameter
    - MergeRequestDetailPage.tsx renders two-column MR detail with breadcrumbs
    - MergeRequestListPage.tsx renders filterable MR list
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire Routes + Sidebar Nav + Breadcrumb Integration</name>
  <files>
    taskflow/src/main.tsx,
    taskflow/src/components/app/Sidebar.tsx
  </files>
  <action>
**1. Update main.tsx:**

Add imports at top:
```typescript
import MergeRequestDetailPage from './routes/dashboard/MergeRequestDetailPage';
import MergeRequestListPage from './routes/dashboard/MergeRequestListPage';
```

Add two new routes to the router children array (after the `/issue/:key` route):
```typescript
{ path: '/merge-requests', element: <MergeRequestListPage /> },
{ path: '/mr/:projectId/:iid', element: <MergeRequestDetailPage /> },
```

Update `routeLabel` function to handle new routes:
```typescript
if (pathname.startsWith('/merge-requests')) return 'Merge Requests';
if (pathname.startsWith('/mr/')) return 'MR Detail';
```

Update the breadcrumb reset `useEffect` to also keep breadcrumbs alive on MR detail:
Change `if (!location.pathname.startsWith('/issue/'))` to `if (!location.pathname.startsWith('/issue/') && !location.pathname.startsWith('/mr/'))`.

**2. Update Sidebar.tsx:**

Add a "Merge Requests" NavLink in the shared section (after Epics, before the role-specific Work section). This is a shared link visible for all roles, just like Epics:

```tsx
<NavLink to="/merge-requests" className={navLinkClass} title={sidebarCollapsed ? 'Merge Requests' : undefined}>
  <GitMerge className="h-4 w-4 shrink-0" />
  <span className={labelClass}>Merge Requests</span>
</NavLink>
```

`GitMerge` is already imported in Sidebar.tsx. Place the NavLink right after the Epics NavLink.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - /merge-requests route renders MergeRequestListPage
    - /mr/:projectId/:iid route renders MergeRequestDetailPage
    - Sidebar shows "Merge Requests" link for all roles
    - Breadcrumbs persist on MR detail navigation
    - routeLabel returns correct labels for new routes
    - TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` — zero errors
2. `cd /Users/mimo/Desktop/Tasker/taskflow && npm run build` — builds successfully
3. Visual: Navigate to /merge-requests from sidebar, see MR list, click MR to see detail page
</verification>

<success_criteria>
- MR list page loads at /merge-requests with state filter tabs and search
- Clicking an MR navigates to /mr/:projectId/:iid showing full detail
- MR detail page has two-column layout matching IssueDetailPage style
- Breadcrumb navigation works between MR list and MR detail
- Linked Jira issues in MR detail are clickable and navigate to /issue/:key
- "Open in GitLab" button opens MR in browser
- Sidebar shows "Merge Requests" nav link for all roles
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260317-tdr-add-a-merge-request-detail-page-similar-/260317-tdr-SUMMARY.md`
</output>
