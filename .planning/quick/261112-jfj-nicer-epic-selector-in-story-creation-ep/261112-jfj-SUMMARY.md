---
phase: quick-261112-jfj
plan: 01
subsystem: ui
tags: [epic-picker, jira, popover, react-query]
requires: []
provides:
  - shared server-searching EpicPicker (inline + field variants) and EpicPill
  - editable Epic row in the story detail sidebar
key-files:
  created:
    - taskflow/src/services/jira/epics.ts
    - taskflow/src/services/jira/epics.test.ts
    - taskflow/src/components/ui/use-epic-search.ts
    - taskflow/src/components/ui/epic-picker.tsx
    - taskflow/src/components/ui/epic-picker.test.tsx
  modified:
    - taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditForm.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
decisions:
  - Epic link write goes through the existing field PUT; the Agile /epic/{key}/issue fallback was NOT built (research A1, only if UAT shows the PUT failing)
  - Key-clause JQL retries once without the key clause on failure (A2)
metrics:
  tasks: 3
  completed: 2026-11-12
---

# Quick 261112-jfj: Nicer epic selector + sidebar epic picker Summary

Shared `EpicPicker` (Popover, debounced server-side open-epic JQL search, coloured pill rows, muted key, check, "No epic") used in the create/edit modal and as the editable Epic row in the story sidebar (optimistic set/clear via `useFieldMutation`, "Open KEY" footer).

## Commits

- dd9b92d5 Task 1: `services/jira/epics.ts` (buildEpicSearchJql, searchOpenEpics, fetchEpicSummary), `use-epic-search.ts`, 12 tests
- b3354fee Task 2: `epic-picker.tsx` + 10 tests, modal swap, removed capped `['epics', projectKey]` query and `epicOpen`/`epicFilter` state, `['jira-epic-stories']` invalidation on create/edit
- 1f6fc321 Task 3: sidebar Epic row, `useFieldMutation` invalidations (`jira-epic-stories`, `jira-epic-worklogs`, `jira-epic-status-history`), sidebar uses `fetchEpicSummary`, 8 new FieldsSection tests

## Deviations from Plan

**1. [Rule 1 - Bug] Infinite render loop in useEpicSearch** (found in Task 2 test run, which hung). `result.data ?? []` produced a new array each render; EpicPicker feeds results to the trigger via an effect + setState, so it re-rendered forever. Fixed in production code with a module-level stable `EMPTY` array (commit b3354fee). Not a mock accommodation.

**2. [Scope-adjacent] `epicIssue` prop on FieldsSection** is no longer destructured/read (the picker resolves the epic itself through the shared `['jira-issue-name']` key). The prop remains in the interface and IssueDetailSidebar still passes it, to keep the change small and avoid churning existing test fixtures. Candidate for later cleanup.

**3. Project key source:** the plan says `f.project?.key`; I used `f.project?.key ?? activeJiraProject`, because FieldsSection already reads `activeJiraProject` and test fixtures carry no `project`.

**4. Environment:** worktree was reset to the expected base 6b29db60 at start (initial HEAD was e7e50155); `taskflow/node_modules` is a symlink to the main checkout's (untracked/ignored).

No test mocks were bent to fit production code.

## Verification

- Full vitest suite passes at each commit via the pre-commit hook (last: 5031 passed).
- `tsc --noEmit` clean. biome: no diagnostics in touched files (remaining warnings are pre-existing, e.g. `components/ui/chart.tsx`).
- `src/services/jira.ts` untouched (`fetchEpicsBasic` / `['jira-epics-basic']` unchanged).
- `grep epicFilter|epicOpen` in create-edit-issue is empty; `['epics', projectKey]` query is gone.

## Known Stubs

None.

## Open item for UAT

Confirm in a live Jira that setting/clearing the Epic Link via field PUT works on the edit screen (research A1). If it fails, add the Agile `POST /rest/agile/1.0/epic/{key}/issue` (and `/epic/none/issue`) fallback.

## Self-Check: PASSED

Files exist and commits dd9b92d5, b3354fee, 1f6fc321 are on branch worktree-agent-af3c684b279936d88.
