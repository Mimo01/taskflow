---
slug: issue-status-cache-stale-drawer
status: resolved
trigger: "When I update issue status on issue detail, it doesn't get invalidated in cache and still displays old status somewhere. For example updating subtask doesn't update it in parent detail. (Re-report: all interaction happens inside the slide-out DRAWERS / peek panel.)"
created: 2026-06-12
updated: 2026-06-12
---

# Debug Session: issue-status-cache-stale-drawer

## Symptoms

- **Expected:** Changing a status (including a subtask's status) via the status-transition dropdown inside a drawer propagates to every view showing that issue — notably the subtask row/badge in the parent issue's detail, and the peek-panel/drawer preview itself.
- **Actual:** After a status transition done inside a drawer, stale (old) status persists in: (1) the parent detail's subtask list, and (2) the peek panel / drawer preview.
- **Crucial new detail:** The user does ALL of this inside the slide-out drawers (peek panel / drawer preview), NOT the full-page IssueDetailView. The update path is the **status transition dropdown**.
- **Stale where (confirmed by user):** Peek panel / drawer preview AND parent detail subtasks.

## Prior context (IMPORTANT — read before investigating)

This is a RE-REPORT of `.planning/debug/resolved/issue-status-cache-stale.md` (resolved earlier today, 2026-06-12). Two fixes already landed and are confirmed present in `FieldsSection.tsx` transitionMutation.onSettled:
- Line 324: `queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] })` (commit 6b82f07f)
- Line 329: `queryClient.invalidateQueries({ queryKey: ['jira-epic-stories'] })` (commit d47f0d5f)

Those fixes targeted the FULL-PAGE IssueDetailView path. The user STILL sees staleness, and the key difference is everything is happening inside the **drawer / peek panel**. Recent commit `4a7ab5e6` "fix(peek-panel): wire edit/clone/add-subtask handlers to drawer preview" indicates the drawer preview is a distinct rendering path.

## Current Focus

hypothesis: "The parent's subtask list shows stale subtask statuses because fetchEnrichedSubtasks (jira.ts:1411-1444) only fetches assignee data (fields=assignee), NOT status. The status in enrichedSubtasks comes from the stale issue.fields.subtasks passed as input. When jira-subtask-enrichment refetches after invalidation, it uses the same stale input (parent's jira-issue-detail is not invalidated) and returns stale statuses. Secondary issue: jira-parent-detail is not invalidated when the parent transitions status, causing stale parent status in the subtask peek panel's 'Parent' section."

test: "Fix 1: Extend fetchEnrichedSubtasks to also fetch and merge status (add status to fields= parameter). Fix 2: Invalidate ['jira-parent-detail', issueKey] in transitionMutation.onSettled so subtask peek panels refresh parent status display."

expecting: "After Fix 1, the enrichment query refetch returns fresh status data from Jira, updating the parent's subtask list. After Fix 2, the subtask peek panel's Parent section refreshes when parent transitions."

next_action: "Apply Fix 1 to jira.ts fetchEnrichedSubtasks and Fix 2 to FieldsSection.tsx transitionMutation.onSettled. Also fix SprintBoardTab.handleTransition missing invalidations as a secondary fix."

reasoning_checkpoint:
  hypothesis: "fetchEnrichedSubtasks only fetches fields=assignee. Status comes from stale input subtasks array (issue.fields.subtasks from parent's cached jira-issue-detail). Even after jira-subtask-enrichment invalidation+refetch, the returned status is still the old status from the stale input. Parent's jira-issue-detail is never invalidated on subtask transition."
  confirming_evidence:
    - "fetchEnrichedSubtasks (jira.ts:1411) uses fields=assignee only in the JQL search URL. Returns subtasks with enriched assignee but original status from input."
    - "subtaskEnrichmentQuery in IssueDetailView passes issue?.fields.subtasks as input to fetchEnrichedSubtasks. Parent's jira-issue-detail (not invalidated) still contains old subtask statuses."
    - "transitionMutation.onSettled invalidates ['jira-subtask-enrichment'] prefix but NOT the parent's jira-issue-detail. The input to fetchEnrichedSubtasks remains stale on refetch."
    - "jira-parent-detail query in IssueDetailView (for subtask views) is separate from jira-issue-detail and NOT invalidated on transition."
  falsification_test: "If fetchEnrichedSubtasks fetched status alongside assignee, the enrichment refetch would return fresh status and the parent's subtask list would show the new status."
  fix_rationale: "Adding status to fields= in fetchEnrichedSubtasks makes the enrichment query authoritative for status, breaking the dependency on stale issue.fields.subtasks input. Also invalidating jira-parent-detail ensures subtask views show fresh parent status."
  blind_spots: "SprintBoardTab.handleTransition also missing jira-subtask-enrichment and jira-epic-stories invalidations - handled as secondary fix."

## Evidence

- timestamp: 2026-06-12
  checked: FieldsSection.tsx transitionMutation.onSettled (lines 311-338)
  found: Invalidates jira-issue-detail, jira-issue-changelog, jira-issue-transitions-fields, jira-subtask-enrichment (324), jira-epic-stories (329), jira-epics-basic, jira-fixversion-issues, jira-version-counts, plus gh data.
  implication: Both prior fixes are present. If the drawer is still stale, either it uses a query key not in this list, or drawer transitions don't use this mutation at all.

- timestamp: 2026-06-12
  checked: fetchEnrichedSubtasks in jira.ts (lines 1411-1444)
  found: The JQL search URL uses `fields=assignee` only. Status is NOT fetched. The enrichment returns the input subtasks array with only assignee updated. Status data comes from the CALLER's subtasks input (issue?.fields.subtasks from the parent's cached jira-issue-detail).
  implication: When jira-subtask-enrichment refetches after invalidation, it uses stale issue.fields.subtasks as input (parent's jira-issue-detail is not invalidated) and returns the same stale status. The invalidation+refetch cycle does NOT fix the stale status because the data source (parent's issue detail) is stale.

- timestamp: 2026-06-12
  checked: IssueDetailView.tsx subtaskEnrichmentQuery (lines 160-176) and parentQuery (lines 178-191)
  found: subtaskEnrichmentQuery passes issue?.fields.subtasks to fetchEnrichedSubtasks. parentQuery uses a separate key ['jira-parent-detail', parentKey, jiraBaseUrl] — NOT ['jira-issue-detail', ...]. The transitionMutation.onSettled does NOT invalidate jira-parent-detail.
  implication: Two distinct bugs: (1) enrichment gets status from stale input, (2) parent status in subtask peek panel never refreshes on parent transition.

- timestamp: 2026-06-12
  checked: SprintBoardTab.handleTransition (lines 1321-1398)
  found: After successful transition, invalidates gh-all-data, jira-issue-detail, jira-issue-changelog, jira-issue-transitions-fields. MISSING: jira-subtask-enrichment, jira-epic-stories invalidations.
  implication: Board context-menu and drag-drop transitions don't update parent subtask list or epic story list.

## Eliminated

- hypothesis: FieldsSection transitionMutation doesn't exist for the peek panel path
  evidence: IssueDetailSheet.tsx (the actual Sheet component) confirmed unused in production (no imports). The peek panel uses PeekPanel → IssueDetailView → IssueDetailSidebar → FieldsSection — same transitionMutation path as full-page.
  timestamp: 2026-06-12

- hypothesis: The drawer uses a different query key for jira-issue-detail
  evidence: Both PeekPanel and IssueDetailView use ['jira-issue-detail', issueKey, jiraBaseUrl] — same key. Optimistic updates and invalidations work correctly for the current issue's own status display.
  timestamp: 2026-06-12

## Resolution

root_cause: "fetchEnrichedSubtasks in jira.ts only fetched assignee data (fields=assignee) from Jira. Status in enrichedSubtasks came from the stale issue.fields.subtasks input (sourced from parent's jira-issue-detail, which is never invalidated on subtask transition). When jira-subtask-enrichment refetched after invalidation, it used the same stale input and returned the same stale status. Secondary: jira-parent-detail query was not invalidated by transitionMutation.onSettled, so parent status shown in subtask peek panels stayed stale. Tertiary: SprintBoardTab.handleTransition also missing jira-subtask-enrichment/jira-epic-stories invalidations."
fix: "Fix 1 (primary): Extended fetchEnrichedSubtasks to fetch fields=assignee,status and merge fresh status from server response. Fix 2: Added jira-parent-detail invalidation to FieldsSection transitionMutation.onSettled. Fix 3: Added jira-subtask-enrichment, jira-epic-stories, and jira-parent-detail invalidations to SprintBoardTab.handleTransition."
verification: "Human-verified by user on 2026-06-12: drawer subtask status and parent status now propagate correctly after transition without requiring a page reload. npm run check passes clean (biome + tsc)."
files_changed:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
