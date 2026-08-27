---
status: resolved
trigger: "There is a problem on My Tasks page. When I open any task in the sidebar and change something (like task status) it doesn't get immediately updated in the task list with the new info. It updates on full reload or on next scheduled data refresh. There is probably a cache problem"
created: 2026-08-27
updated: 2026-08-27
---

# Debug Session: my-tasks-stale-after-edit

## Symptoms

- **Expected behavior:** Editing a task (e.g. status) in the detail sidebar on the My Tasks page should immediately reflect the new value in the task list.
- **Actual behavior:** The task list keeps showing stale data after the sidebar edit. It only updates on a full page reload or on the next scheduled background data refresh.
- **Error messages:** None visible in console/network tab (per user, not yet exhaustively checked).
- **Timeline:** Unknown when this started; not confirmed to have ever worked correctly.
- **Reproduction:** Open My Tasks page, open any task in the sidebar, change its status, observe the task list does not update immediately. Not yet confirmed whether this is status-specific or affects all editable fields (only status tested so far).
- **Suspected cause (user hypothesis):** Cache invalidation issue — likely a query cache (e.g. React Query) not being invalidated/updated when the sidebar mutation succeeds.

## Current Focus

reasoning_checkpoint:
  hypothesis: "Sidebar field/status mutations (useFieldMutation.ts, FieldsSection.tsx transitionMutation/resolutionTransitionMutation/sprintMoveMutation) never invalidate the ['jira-issues', ...] query-key family used by MyTasksPage (my-tasks / my-tasks-all / my-tasks-reported queries), so the My Tasks list keeps rendering the pre-edit cached data until staleTime (30s) elapses or a full reload remounts the page."
  confirming_evidence:
    - "MyTasksPage.tsx uses useQuery with queryKey ['jira-issues','my-tasks',...], ['jira-issues','my-tasks-all',...], ['jira-issues','my-tasks-reported',...], staleTime 30_000, placeholderData keep-previous."
    - "useFieldMutation.ts onSettled invalidates: jira-issue-detail, jira-subtask-enrichment, gh-all-data, gh-backlog-data, jira-epics-basic, jira-fixversion-issues, jira-version-counts — no 'jira-issues' key anywhere."
    - "FieldsSection.tsx transitionMutation (status change — the exact symptom reported) onSettled invalidates jira-issue-detail, jira-issue-changelog, jira-issue-transitions-fields, jira-subtask-enrichment, jira-epic-stories, jira-parent-detail, gh-all-data, gh-backlog, jira-epics-basic, jira-fixversion-issues, jira-version-counts — also no 'jira-issues' key. Same for resolutionTransitionMutation and sprintMoveMutation."
    - "grep across src for the literal key \"'jira-issues'\" shows it is only ever used as a queryKey by consumers (MyTasksPage, dashboard/index.tsx sprint-board, SubtasksPanel, MyIssuesCard, TodayColumn, StandupNotesPage, CommandPalette, RecentItemsPopover) and read via getQueriesData in main.tsx for title lookup — never as an invalidateQueries target."
  falsification_test: "If a mutation elsewhere already invalidated ['jira-issues'] (e.g. via a global/queryClient default onSuccess handler), the list would refresh immediately despite this local omission. Grepped entire src/ for invalidateQueries targeting 'jira-issues' — zero matches, so no such global handler exists."
  fix_rationale: "Adding queryClient.invalidateQueries({ queryKey: ['jira-issues'] }) to the onSettled of the sidebar's field/status/sprint mutations addresses the root cause directly: react-query's default prefix matching (exact:false) means invalidating ['jira-issues'] also invalidates every scoped variant (my-tasks, my-tasks-all, my-tasks-reported, sprint-board, etc.) without needing to enumerate each one, and it's the same 'invalidate the family by prefix' pattern already used elsewhere in this file for jira-subtask-enrichment / jira-epic-stories."
  blind_spots: "Have not yet run the app end-to-end to watch a live network/query-cache trace confirming staleness before the fix; relying on static code-path analysis (query keys defined vs. invalidated). Also have not fully audited every OTHER sidebar mutation (e.g. LogWorkPopover, WatcherToggle, AttachmentsSection) for the same omission — scoping the fix to the mutations directly implicated by the reported symptom (status/field edits) plus the closely related sprint-move/resolution mutations in the same file."

next_action: "None — user confirmed fix works live. Session resolved and archived."

## Evidence

- timestamp: 2026-08-27T00:00:00Z
  checked: MyTasksPage.tsx query definitions (lines 257-334)
  found: Three useQuery calls with queryKey prefix ['jira-issues', 'my-tasks'|'my-tasks-all'|'my-tasks-reported', ...], staleTime 30_000, placeholderData (prev) => prev (keep-previous-data — masks staleness visually until refetch)
  implication: List only refreshes on 30s staleTime elapse + refetch trigger (focus/mount) or full reload — matches user's exact symptom description

- timestamp: 2026-08-27T00:05:00Z
  checked: src/routes/dashboard/issue-detail/useFieldMutation.ts (shared field-edit mutation used by sidebar FieldsSection for assignee/priority/labels/fixVersions/story points)
  found: onSettled invalidates jira-issue-detail, jira-subtask-enrichment, gh-all-data(+scoped), gh-backlog-data(+scoped), jira-epics-basic, jira-fixversion-issues, jira-version-counts. No 'jira-issues' invalidation.
  implication: Non-status field edits from the sidebar also fail to refresh My Tasks list — bug is not status-specific, confirms user's open question in Symptoms.reproduction

- timestamp: 2026-08-27T00:10:00Z
  checked: src/routes/dashboard/issue-detail/FieldsSection.tsx transitionMutation (status change), resolutionTransitionMutation, sprintMoveMutation onSettled blocks
  found: Same pattern — invalidates jira-issue-detail/changelog/transitions-fields, jira-subtask-enrichment, jira-epic-stories, jira-parent-detail, gh-all-data, gh-backlog, jira-epics-basic, jira-fixversion-issues, jira-version-counts, jira-sprint-list (sprintMove only). Never 'jira-issues'.
  implication: Confirms root cause for the exact reported symptom (status change via StatusPopover -> handleTransition -> transitionMutation)

- timestamp: 2026-08-27T00:12:00Z
  checked: grep -rn "'jira-issues'" src (all files, non-test)
  found: Only appears as a queryKey definition (consumers) or in getQueriesData reads (main.tsx breadcrumb title resolution) — never in an invalidateQueries call anywhere in the codebase
  implication: No global/shared handler covers this gap; the omission is total, not a scoping edge case

## Eliminated

## Resolution

root_cause: "Sidebar mutations (useFieldMutation.ts field edits; FieldsSection.tsx transitionMutation/resolutionTransitionMutation/sprintMoveMutation) never invalidate the ['jira-issues'] query-key family, which is what MyTasksPage's three scope queries (my-tasks, my-tasks-all, my-tasks-reported) are keyed under. The list therefore only reflects an edit after the query's 30s staleTime elapses and a refetch fires (or a full reload), never immediately on mutation settle."
fix: "Added `queryClient.invalidateQueries({ queryKey: ['jira-issues'] })` to the onSettled callback of: (1) useFieldMutation.ts's shared field-edit mutation (assignee/priority/labels/fixVersions/story points), and in FieldsSection.tsx: (2) transitionMutation (status change), (3) resolutionTransitionMutation (in-place resolution), (4) sprintMoveMutation (sprint/backlog move). React Query's default prefix matching means invalidating ['jira-issues'] also invalidates every scoped variant consumed elsewhere (my-tasks, my-tasks-all, my-tasks-reported, sprint-board, sprint-board-today-full, etc.) without enumerating each one."
verification: "Ran full existing test suites for src/routes/dashboard/issue-detail (12 files, 164 passed/2 skipped) and src/routes/my-tasks/MyTasksPage.test.tsx (8 passed) — no regressions. Ran `npx tsc --noEmit` — clean, no type errors. Root cause mechanism understood and directly addressed (missing invalidation of the exact key family the stale list is keyed under). User manually verified live in the running app — confirmed fixed."
files_changed:
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
