# Research: MR Detail Page + MR List Page

## 1. GitLab API Endpoints Needed

**Single MR detail** (not yet implemented — needs new `fetchMRDetail` function):
- `GET /api/v4/projects/:id/merge_requests/:iid` — returns full MR object including `description`, `target_branch`, `created_at`, `updated_at`, `merged_at`, `labels`, `milestone`, `draft`, `merge_status`, `has_conflicts`, `changes_count`, `diff_refs`, etc.

**Already implemented in gitlab.ts:**
- `fetchProjectMRs()` — list MRs for project (currently state=opened only, needs state param)
- `fetchMRCommits()` — commits for an MR
- `fetchMRApprovals()` — approval state
- `fetchMRDiscussions()` — discussion threads
- `searchGitLabMRs()` — search MRs by text

**Existing types:**
- `GitLabMR` — basic MR fields (id, iid, project_id, title, source_branch, state, author, reviewers, updated_at, web_url)
- `MRCommit` — commit id, title, message
- `MRApprovals` — approved_by[], approved
- `Discussion` / `DiscussionNote` — discussion threads

## 2. Reusable Patterns

**IssueDetailPage pattern (the model to follow):**
- Route at `/issue/:key`, two-column layout (flex-1 left + w-[42%] sidebar)
- `useQuery` for data fetching with `staleTime: 30_000`
- Breadcrumb navigation via `useBreadcrumbStore`
- Skeleton loading state
- Recent items tracking via `useRecentItemsStore`

**Outlet context pattern:**
- AppLayout passes `onIssueClick`, `openEdit`, etc. via `<Outlet context={...}>`
- MR detail page will need its own context or can reuse `onIssueClick` for linked issues

## 3. Routing (main.tsx)

Current routes are flat children of `AppLayout`:
```
/dashboard, /settings, /my-tasks, /sprint-board, /backlog, /epics,
/mr-attention, /sprint-progress, /workload, /releases, /debug-logs, /issue/:key
```

Need to add:
- `/merge-requests` — MR list page
- `/mr/:projectId/:iid` — MR detail page (needs both projectId and iid to fetch)

## 4. Sidebar Navigation

Sidebar has role-based sections. The "MR Attention" link already exists for developers. The new "Merge Requests" link should be added as a shared link (visible to all roles), similar to "Epics".

## 5. Key Implementation Notes

- **GitLabMR type needs extension**: The list endpoint returns basic fields. The single MR endpoint returns `description`, `target_branch`, `created_at`, `labels`, `milestone`, `draft`, `merge_status`, `has_conflicts`, `changes_count`. Need a `GitLabMRDetail` interface extending `GitLabMR`.
- **No write operations needed**: Read-only with "Open in GitLab" button per user decision.
- **Linked Jira issues**: Use existing `linkEngine.extractTicketKeys()` to extract Jira keys from MR title/branch, then display as clickable links navigating to `/issue/:key`.
- **MR list needs state filter**: Current `fetchProjectMRs` only fetches `state=opened`. Need to support `state=all` or parameterize.
- **Pipeline info**: GitLab's single MR endpoint includes `pipeline.status` field — can show pipeline badge.
