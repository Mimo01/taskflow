---
slug: issue-status-cache-stale
status: resolved
trigger: "When I update issue status on issue detail, it doesn't get invalidated in cache and still displays old status somewhere. For example updating subtask doesn't update it in parent detail."
created: 2026-06-12
updated: 2026-06-12
---

# Debug Session: issue-status-cache-stale

## Symptoms

- **Expected:** Updating an issue's status (including a subtask's status) propagates to every view showing that issue — notably the subtask row/badge in the parent issue's detail.
- **Actual:** After updating status on the issue detail view, the cache is not invalidated. Stale (old) status persists. Concretely: updating a subtask's status does not update it in the parent issue's detail.
- **Stale where:** Parent issue detail confirmed; possibly other views (unknown / not exhaustively checked).
- **Recovery:** Corrects only on full app reload, or after the cache TTL expires on its own. Navigate-away-and-back behavior not confirmed.
- **Timeline:** Unknown — user unsure whether this ever worked correctly.
- **Errors:** None reported.

## Current Focus

hypothesis: transitionMutation.onSettled in FieldsSection.tsx does not invalidate ['jira-subtask-enrichment'], so when a subtask's status is changed on its own detail page, the parent's subtask enrichment query is never refetched and still shows the old status.
test: Compare invalidation lists in transitionMutation.onSettled vs useFieldMutation.onSettled — useFieldMutation has the subtask-enrichment invalidation, transitionMutation does not.
expecting: Adding `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` to transitionMutation.onSettled will cause the parent's subtask list to refresh after any status transition.
next_action: Apply fix to FieldsSection.tsx transitionMutation.onSettled.

reasoning_checkpoint:
  hypothesis: "transitionMutation.onSettled in FieldsSection.tsx (lines 311-328) does not call `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })`. useFieldMutation.onSettled (line 54) does. When a subtask's status is changed on the subtask detail page, only the subtask's own ['jira-issue-detail', subtaskKey, ...] cache is invalidated. The parent's subtask enrichment query ['jira-subtask-enrichment', parentKey, ...] is never touched, so it returns stale data with the old status."
  confirming_evidence:
    - "FieldsSection.tsx transitionMutation.onSettled (lines 311-328): invalidates jira-issue-detail, jira-issue-changelog, jira-issue-transitions-fields, gh-all-data, gh-backlog, jira-epics-basic, jira-fixversion-issues, jira-version-counts — NO jira-subtask-enrichment invalidation."
    - "useFieldMutation.ts onSettled (lines 47-73): includes `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` on line 54 — the exact invalidation that is missing from transitionMutation."
    - "Parent issue subtask list is sourced from ['jira-subtask-enrichment', issueKey, jiraBaseUrl, subtaskSignature] query in IssueDetailView.tsx (line 161). This query is never invalidated when a subtask status transition fires."
    - "Comment in useFieldMutation.ts (lines 49-53) explicitly documents this requirement: 'Editing a subtask here doesn't know its parent key, so invalidate the enrichment family by prefix — keeps the parent's subtasks section fresh when navigating back.'"
  falsification_test: "If the bug were caused by something other than missing jira-subtask-enrichment invalidation, then adding that invalidation to transitionMutation.onSettled would not fix the stale subtask status display."
  fix_rationale: "The fix adds the missing `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` call to transitionMutation.onSettled in FieldsSection.tsx, matching the pattern already established in useFieldMutation.ts. This invalidates all subtask enrichment queries by prefix, which causes the parent issue's subtask list to refetch after any status transition, displaying the new status."
  blind_spots: "Other views that display subtask status (e.g. SprintBoardTab task cards, BacklogPage rows) are handled by gh-all-data/gh-backlog invalidations which are already present. This fix specifically targets the IssueDetailContent subtask list. Also: the stale status could theoretically appear in epic stories list (parent = epic, children = stories with statuses) — the epic stories query ['jira-epic-stories', issueKey, ...] is also not invalidated by transitionMutation, but that's a separate query for when an epic's child story changes its status."

## Evidence

- timestamp: 2026-06-12
  checked: FieldsSection.tsx transitionMutation.onSettled (lines 311-328)
  found: Invalidates jira-issue-detail, jira-issue-changelog, jira-issue-transitions-fields, gh-all-data, gh-backlog, jira-epics-basic, jira-fixversion-issues, jira-version-counts. No invalidation of jira-subtask-enrichment.
  implication: When a subtask's status is changed from its own detail page, the parent's subtask enrichment cache is never invalidated.

- timestamp: 2026-06-12
  checked: useFieldMutation.ts onSettled (lines 47-73)
  found: Includes `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` — the exact invalidation that transitionMutation is missing. Comment explicitly documents reason: "Editing a subtask here doesn't know its parent key, so invalidate the enrichment family by prefix".
  implication: This pattern was intentionally established for field edits but was not carried over to the status transition mutation.

- timestamp: 2026-06-12
  checked: IssueDetailView.tsx subtaskEnrichmentQuery (lines 160-176)
  found: Query keyed ['jira-subtask-enrichment', issueKey, jiraBaseUrl, subtaskSignature]. staleTime: 30_000. Only re-fetches when its key or stale time triggers it, or when explicitly invalidated.
  implication: Without an explicit invalidation from transitionMutation, the parent's subtask enrichment data will remain stale showing the old status for up to 30 seconds (or until navigating away/back forces a new mount).

## Eliminated

## Resolution

root_cause: transitionMutation.onSettled in FieldsSection.tsx is missing `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })`. useFieldMutation.ts has this invalidation for regular field edits, but the status-transition mutation in FieldsSection was never given the same treatment. As a result, when a subtask's status is changed, the parent issue's subtask enrichment query is never invalidated and displays the old status.
fix: Add `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` to transitionMutation.onSettled in FieldsSection.tsx (after line 312, alongside the other invalidations).
verification: self-verified (`npm run check` clean) + human-verified — user confirmed subtask status now propagates to parent detail without reload (2026-06-12). Committed.
files_changed:
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
