---
phase: quick-261105-mqh
plan: 01
subsystem: ui
tags: [person-picker, jira, assignee, react-query]
requires: []
provides:
  - Shared PersonPicker/PersonPickerPanel + useAssignableUserSearch
affects: [issue-detail, create-edit-issue, subtask-templates, standup, worklogs]
key-files:
  created:
    - taskflow/src/components/ui/person-picker.tsx
    - taskflow/src/components/ui/use-assignable-user-search.ts
    - taskflow/src/components/ui/person-picker.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.test.tsx
  modified:
    - taskflow/src/services/jira/users.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/ (modal, form, queries, custom fields, template row)
    - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
    - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
completed: 2026-11-05
---

# Quick 261105-mqh: Universal assignee picker

The issue-detail sidebar assignee popover is now one shared `PersonPicker` used at all 7 person-selection sites. All user searches are server-side (debounced 200ms, `username=` param), and the fetch-once capped `assignable-users` queries are gone.

## Commits
- Task 1: shared picker, hook, `fetchAssignableUsers` opts (`issueKey`, `maxResults`), FieldsSection migrated
- Task 2: Create/Edit modal assignee and required user custom fields; reducer holds `selectedAssignee: PersonValue`; `ASSIGNEE_BLUR` and blur timer removed
- Task 3: SubtaskTemplateRow (placeholders as extra options, concrete usernames resolved via `fetchJiraUserByName`), BulkCreate query removed, Standup `PersonPickerPanel` with "Me" option, Worklogs `PersonPicker` (size `sm`)

## Deviations from Plan

1. **[Rule 3 - test mock] `CreateEditIssueModal.test.tsx` auth-store mock** returned the whole state object regardless of selector; the shared picker reads `useAuthStore(selector)`. The mock was fixed to honour selectors (production code unchanged).
2. **[Scope addition] `SubtaskTemplateRow.test.tsx`** added (not in the plan's files list) to cover the Task 3 behaviours for template rows; plus a required-user-custom-field test in `CreateEditIssueModal.test.tsx` and a search-term assertion in the Worklogs tests.
3. **Worklogs CLEAN-01 test rewritten**: the close-timer it tested no longer exists; it now asserts no post-unmount state updates while the picker is open.
4. `fetchAssignableUsers` now always appends `&maxResults=50` (was Jira default, also 50) and encodes `issueKey`.
5. Worktree base was reset to 7745fd29 per the branch check; `npm ci` was run in the inner `taskflow/` dir (no node_modules in the worktree).
6. biome `--write` was run only on the 7 files touched in Task 3 (import ordering/format).

## Known notes
- Standup trigger markup unchanged; only the popover body changed (now `w-80 p-2`, shared look, adds username muted column and filter placeholder "Search people…").
- Verification: full vitest (288 files, 4501 tests), `tsc --noEmit`, and biome on touched files all pass at each commit.

## Self-Check: PASSED
