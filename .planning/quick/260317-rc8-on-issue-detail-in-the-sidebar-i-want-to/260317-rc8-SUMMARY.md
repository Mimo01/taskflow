---
phase: quick
plan: 260317-rc8
subsystem: issue-detail-sidebar
tags: [gitlab, merge-requests, sidebar, issue-detail]
dependency_graph:
  requires: [linkEngine.extractTicketKeys, gitlab-api, auth-store]
  provides: [mr-section-in-issue-sidebar]
  affects: [IssueDetailSidebar.tsx]
tech_stack:
  patterns: [useQuery-cache-first, extractTicketKeys-matching, openUrl-external-link]
key_files:
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
decisions:
  - GitLab project MRs fetched without state filter (all states) to show recently merged MRs alongside open ones
  - Dedicated query key ['gitlab-project-mrs', ...] with 60s staleTime to avoid excessive API calls
  - MR matching uses extractTicketKeys on both title and source_branch for comprehensive linking
metrics:
  duration: 81s
  completed: "2026-03-17"
---

# Quick Task 260317-rc8: Merge Requests Section in Issue Detail Sidebar

GitLab MR section added to issue detail sidebar, showing linked MRs by matching issue key in MR title or branch name via extractTicketKeys.

## What Was Done

### Task 1: Add Merge Requests section to IssueDetailSidebar

Added a "Merge Requests" section to `IssueDetailSidebar.tsx` that:

1. **Queries GitLab project MRs** using a dedicated `useQuery` with key `['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject]`. Fetches the 20 most recently updated MRs across all states (not just open) so recently merged MRs also appear.

2. **Filters by issue key** using `extractTicketKeys` from `linkEngine.ts` against both `mr.title` and `mr.source_branch`. If either contains the current `issueKey`, the MR is included.

3. **Renders each MR** with:
   - `GitMerge` icon from lucide-react
   - Clickable button showing `!{iid} {title}` that opens the MR in browser via `openUrl`
   - State badge: "Open", "Merged", or raw state for closed/locked

4. **Conditional visibility**: Section only renders when `gitlabConnected && gitlabBaseUrl`. Shows loading skeleton during fetch, "None" when no MRs match.

**Commit:** `0096dc9`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors (no new errors in IssueDetailSidebar.tsx)
- Section renders after Linked Issues section
- Section hidden when GitLab not connected
- Shows "None" when no MRs match the issue key

## Self-Check

Verified:
- Modified file exists: taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
- Commit exists: 0096dc9
