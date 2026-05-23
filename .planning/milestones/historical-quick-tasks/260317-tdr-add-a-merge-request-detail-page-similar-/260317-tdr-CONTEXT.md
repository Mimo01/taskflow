# Quick Task 260317-tdr: Add a merge request detail page similar to the Jira detail page - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Task Boundary

Add a merge request detail page similar to the Jira issue detail page, plus a dedicated MR list page.

</domain>

<decisions>
## Implementation Decisions

### Page Layout & Content
- Full detail view: two-column layout mirroring the Jira detail page structure
- Left column: MR title, description (rendered markdown), commits list, linked Jira issues
- Right sidebar: status badge, author + avatar, reviewers, assignee, labels, pipeline status, approvals count, source → target branch, created/updated dates
- "Open in GitLab" button for external actions

### Navigation & Routing
- MR detail page accessible from: MR cards in Jira issue sidebar, notification items, AND a new dedicated MR list page
- New MR list page needed as a top-level route (like board/backlog)
- Breadcrumb navigation matching the Jira detail page pattern

### MR Actions
- Read-only within the app — all actions (approve, merge, comment) via "Open in GitLab" link
- No GitLab write API scopes needed

### MR List Page
- Show all MRs for the active GitLab project
- State filters (open/merged/closed) and search
- Click MR to navigate to MR detail page

</decisions>

<specifics>
## Specific Ideas

- Follow the same two-column layout pattern as IssueDetailPage (left content + right sidebar at 42% width)
- Reuse breadcrumb navigation store pattern from Jira detail page
- Route pattern: `/mr/:iid` for detail, `/merge-requests` for list
- MR cards in the list should show: title, IID, state badge, author, source branch, pipeline status, updated date
- Linked Jira issues extracted from MR title/branch using existing linkEngine

</specifics>

<canonical_refs>
## Canonical References

- IssueDetailPage pattern: `taskflow/src/routes/dashboard/IssueDetailPage.tsx`
- IssueDetailSidebar pattern: `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx`
- GitLab API service: `taskflow/src/services/gitlab.ts` (GitLabMR interface)
- Link engine: `taskflow/src/services/linkEngine.ts` (ticket key extraction)
- Breadcrumb store: `taskflow/src/stores/breadcrumb.store.ts`

</canonical_refs>
