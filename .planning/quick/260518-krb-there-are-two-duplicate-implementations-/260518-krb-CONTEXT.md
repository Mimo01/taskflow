# Quick Task 260518-krb: Unify jira.ts and jira/issues.ts - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Task Boundary

Unify two duplicate Jira fetch implementations: `jira.ts` (2209 lines, 62 callers) and `jira/issues.ts` (718 lines, 5 callers). Eliminate duplication by making `jira.ts` the single canonical source.

</domain>

<decisions>
## Implementation Decisions

### Canonical File
- `jira.ts` is the winner — 62 callers already import from it vs only 5 from jira/issues.ts
- Inline the `jira/issues.ts` function bodies into `jira.ts` (they are marginally cleaner: use `isResponseLikeError` helper instead of inlined duck-typing)
- Delete `jira/issues.ts` entirely after migration

### Duplicate Functions (10 total)
The following functions exist in both files and must be unified (keep jira/issues.ts version body in jira.ts, remove from jira/issues.ts):
- fetchSprintIssues, fetchMyTasksHierarchy, fetchIssueDetail, fetchIssueSummary
- updateIssueField, createIssue, bulkUpdateIssue, wrapCustomFieldValue
- searchJira, searchJiraClosed

### Unique Functions (move to jira.ts)
- `fetchSprintStories` and `fetchSprintSubtasks` — only in jira/issues.ts; move inline to jira.ts
- `fetchJiraIssueByKey` — currently in jira/issues.ts, re-exported by jira.ts line 24; move body into jira.ts and remove the re-export line

### Callers to Update (5 files)
These 5 files import directly from `jira/issues.ts` and must be updated to import from `jira.ts`:
- `taskflow/src/components/app/Sidebar.tsx` (fetchSprintStories)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` (fetchSprintStories, fetchSprintSubtasks)
- `taskflow/src/routes/dashboard/BulkActionBar.tsx` (updateIssueField)
- `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` (updateIssueField)
- `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` (bulkUpdateIssue, createIssue, wrapCustomFieldValue)

### Tests
- `jira/issues.test.ts` exists — keep its tests but update imports to use `jira.ts` or the appropriate new location. Do not lose test coverage.

### Claude's Discretion
- Which exact line in jira.ts to insert new functions (after existing related functions)
- Whether to also add fetchSprintStories/fetchSprintSubtasks/fetchJiraIssueByKey to jira/index.ts exports or leave index.ts unchanged
- jira/index.ts currently does NOT export from jira/issues.ts — leave it as-is

</decisions>

<specifics>
## Specific Ideas

- jira/issues.ts uses `isResponseLikeError` from `./client` — when copying function bodies to jira.ts, need to either import this helper or inline the check (jira.ts already has the inlined version, so use the helper for cleanliness)
- jira.ts currently imports from jira/ modules: `export { fetchJiraIssueByKey } from './jira/issues';` at line 24 — remove this re-export line once the function is moved inline
- `SUBTASK_CHUNK_SIZE` is used in fetchSprintIssues in jira/issues.ts — check if it's defined in client.ts and import it in jira.ts

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/services/jira.ts` — legacy monolith, canonical surface
- `taskflow/src/services/jira/issues.ts` — modular file to be deleted
- `taskflow/src/services/jira/client.ts` — shared helpers (fetchAllSearchPages, isResponseLikeError, SUBTASK_CHUNK_SIZE)

</canonical_refs>
