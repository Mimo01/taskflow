---
slug: subtask-assignee-stale-cache
status: resolved
trigger: "On subtask detail when I change asignee, the cache for sprint board is not invalidated and the asignee in subtask card is not changed until reload"
created: 2026-06-03
updated: 2026-06-03
---

# Debug Session: subtask-assignee-stale-cache

## Symptoms

- **Expected behavior:** Changing the assignee on a subtask's detail page updates the subtask card on the sprint board immediately (board cache invalidated / refetched).
- **Actual behavior:** The assignee shown on the subtask card on the sprint board does NOT update until a full page reload. The sprint board cache is not invalidated after the mutation.
- **Error messages:** None reported (silent stale cache).
- **Timeline:** Not specified.
- **Reproduction:**
  1. Open a subtask's full detail page (dedicated subtask detail route/page).
  2. Change the assignee.
  3. Return to the sprint board — the subtask card still shows the old assignee until reload.
- **Scope note:** Unknown whether parent-issue assignee changes have the same problem (user hasn't checked). Entry point confirmed: full subtask detail page (not modal/drawer).

## Current Focus

- hypothesis: `useFieldMutation.onSettled` invalidates `invalidateGhBacklogData` (`['gh-backlog']`) and a dead key `['jira-issues','sprint-board']`, but never `invalidateGhAllData` (`['gh-all-data', boardId]`) — the key the sprint board cards actually read via `useGhAllData`. So assignee edits leave the board stale.
- test: trace which query key the sprint board cards read from, vs which keys the assignee mutation invalidates.
- expecting: board reads `['gh-all-data', boardId]`; mutation never invalidates it. CONFIRMED.
- next_action: add `invalidateGhAllData` to `useFieldMutation.onSettled`, matching `transitionMutation`/`sprintMoveMutation` in FieldsSection.
- reasoning_checkpoint:
    hypothesis: "useFieldMutation.onSettled never invalidates ['gh-all-data', boardId], the query key the sprint board cards read from, so assignee (and all field) edits leave the board stale until a full reload that refetches gh-all-data."
    confirming_evidence:
      - "SprintBoardTab.tsx:622 reads cards from useGhAllData(boardId), whose query key is ['gh-all-data', boardId] (useGhAllData.ts:69)."
      - "useFieldMutation.onSettled (useFieldMutation.ts:47-62) invalidates ['jira-issue-detail'], ['jira-issues','sprint-board'] (no subscriber), invalidateGhBacklogData (['gh-backlog']), epics/fixversion/version-counts — but NOT invalidateGhAllData."
      - "Assignee change routes through this hook: FieldsSection handleAssigneeSelect/handleAssignToMe (lines 339/346) call mutation.mutate, where mutation = useFieldMutation (IssueDetailSidebar.tsx:125)."
      - "The sibling transitionMutation (FieldsSection.tsx:265) and sprintMoveMutation (290) DO call invalidateGhAllData and refresh the board correctly — confirming gh-all-data is the right key."
    falsification_test: "If after adding invalidateGhAllData to onSettled the board card still shows a stale assignee, the hypothesis is wrong."
    fix_rationale: "Adding invalidateGhAllData(queryClient, boardId) to onSettled invalidates the exact cache entry the board renders from, triggering a refetch — addressing the root cause (missing invalidation) not a symptom."
    blind_spots: "boardId may be null when useBoardId hasn't resolved; the fallback (invalidate all gh-all-data) covers that, matching FieldsSection's pattern. Did not runtime-execute the app (no live Jira)."

## Symptoms (immutable — see above)

## Eliminated

## Evidence

- timestamp: 2026-06-03
  checked: Knowledge base (.planning/debug/knowledge-base.md)
  found: No entry matches cache/invalidation/sprint-board keywords. Prior entries are worklog 500, notification sound, updater ACL, duplicate notifications, paste menu.
  implication: Novel pattern; no shortcut hypothesis.

- timestamp: 2026-06-03
  checked: Sprint board card data source (SprintBoardTab.tsx)
  found: Cards render from `useGhAllData(boardId)` (line 622). useGhAllData uses query key `['gh-all-data', boardId]` (useGhAllData.ts:69). invalidateGhAllData invalidates `['gh-all-data']` / `['gh-all-data', boardId]` (useGhAllData.ts:104-108).
  implication: Board freshness depends on the `gh-all-data` cache entry being invalidated.

- timestamp: 2026-06-03
  checked: Assignee mutation path (FieldsSection.tsx)
  found: handleAssigneeSelect (line 339) and handleAssignToMe (line 346) call `mutation.mutate({ fieldName: 'assignee', ... })`. `mutation` is a prop = `useFieldMutation(issueKey, baseUrl, sidebarBoardId)` (IssueDetailSidebar.tsx:125). Priority, story points, labels, fixVersions also route through the same `mutation`.
  implication: All these field edits share useFieldMutation's invalidation behavior.

- timestamp: 2026-06-03
  checked: useFieldMutation.onSettled invalidations (useFieldMutation.ts:47-62)
  found: Invalidates ['jira-issue-detail', ...], ['jira-issues','sprint-board'] (no subscriber found), invalidateGhBacklogData (['gh-backlog']), ['jira-epics-basic'], ['jira-fixversion-issues'], ['jira-version-counts']. Does NOT call invalidateGhAllData.
  implication: The exact key the board reads (['gh-all-data', boardId]) is never invalidated → board stays stale until full reload refetches it. ROOT CAUSE.

- timestamp: 2026-06-03
  checked: Sibling mutations in FieldsSection (transitionMutation, sprintMoveMutation)
  found: Both call `invalidateGhAllData(queryClient, boardId)` in onSettled (lines 265, 290) — and status transitions DO refresh the board (per inline comment "Phase 75: also invalidate GH all-data so sprint board columns refresh").
  implication: gh-all-data is confirmed as the correct invalidation target; useFieldMutation simply omits it. Scope: affects parent issues too (same hook), not subtask-specific.

## Resolution

- root_cause: `useFieldMutation.onSettled` (taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts) invalidates the backlog envelope (`invalidateGhBacklogData` → `['gh-backlog']`) and a dead key `['jira-issues','sprint-board']`, but never invalidates `['gh-all-data', boardId]` — the cache entry the sprint board cards read from via `useGhAllData`. Assignee (and priority/story-point/label/fixVersion) edits made on the issue/subtask detail page therefore leave the board card stale until a full reload refetches gh-all-data.
- fix: Add `invalidateGhAllData(queryClient, boardId)` to `useFieldMutation.onSettled`, mirroring the sibling `transitionMutation`/`sprintMoveMutation` handlers. Removed the dead `['jira-issues','sprint-board']` invalidation.
- verification: tsc --noEmit clean; 45 tests pass (FieldsSection.test, IssueDetailSheet.test, useGhAllData.test). onSettled now invalidates ['gh-all-data', boardId] (board card source) in addition to gh-backlog. Human verification PASSED in real Jira environment (user confirmed 2026-06-03): board card assignee updates without reload.
- files_changed:
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
</content>
</invoke>
