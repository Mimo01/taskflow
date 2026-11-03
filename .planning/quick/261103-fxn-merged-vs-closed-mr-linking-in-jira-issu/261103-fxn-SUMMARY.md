# Quick 261103-fxn Summary

Jira issue detail now lists every linked MR (opened, merged, closed) via one server-side GitLab search per issue, instead of filtering the project's 20 most recently updated MRs client-side.

## Commits
- d646dbd1: add `fetchIssueLinkedMRs` (services/gitlab.ts) + 9 tests
- 3d68adec: `useLinkedMRs` switched to per-issue query key `['gitlab-issue-linked-mrs', base, project, issueKey]`, 'Closed' badge label, stale comment fixed in IssueDetailView, 5 hook tests

## Behavior
- URL: `projects/:id/merge_requests?state=all&search=KEY&in=title,description&per_page=100`; issueKey URL-encoded; never throws (returns [] on transport/non-ok/json/non-array failures).
- Exact-key client filter (title or source_branch) retained to drop substring false positives (ABC-1234 for ABC-123).
- MergeRequestsSection: non-merged/non-opened states capitalise first letter (closed -> Closed, locked -> Locked).

## Known limitation (documented in JSDoc)
GitLab search does not cover source_branch, so an MR whose key appears only in its branch name is not found.

## Deviations
None to plan. Environment notes: the worktree had no node_modules, so a symlink (untracked, gitignored) to the main checkout's node_modules was created to run tests/hooks. One test cast changed to `as unknown as Response` to satisfy tsc.

## Verification
Full vitest suite passed in the pre-commit hook for both commits; tsc and biome clean on touched files. Manual UAT pending (older merged MR + closed MR on a real issue).
