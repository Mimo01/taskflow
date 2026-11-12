---
phase: quick-261112-msr
plan: 01
subsystem: ui
tags: [cmdk, popover, settings, onboarding, pagination]
requires: []
provides:
  - SearchableSelect shared component
  - Fully paginated listGitLabProjects and listProjectBoards
affects: [settings-connections, settings-integrations, onboarding-wizard]
key-files:
  created:
    - taskflow/src/components/ui/searchable-select.tsx
    - taskflow/src/components/ui/searchable-select.test.tsx
  modified:
    - taskflow/src/test/setup.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/jira/sprints.ts
    - taskflow/src/routes/settings/ConnectionsSection.tsx
    - taskflow/src/components/jira/BoardPicker.tsx
    - taskflow/src/routes/onboarding/JiraStep.tsx
    - taskflow/src/routes/onboarding/GitLabStep.tsx
    - taskflow/src/components/integrations/AioBlock.tsx
    - taskflow/src/components/integrations/ReleaseManagementBlock.tsx
decisions:
  - No WIZARD_VERSION bump (picker affordance only)
  - Stale/unknown selected value is shown via the trigger placeholder (raw key), preserving old fallback display
metrics:
  completed: 2026-11-12
---

# Quick 261112-msr: Searchable project/board selectors Summary

One shared Popover + cmdk `SearchableSelect` now powers the Jira project, Jira board, GitLab project, AIO project and Release Management project pickers in both Settings and the wizard, and the GitLab project / Jira board fetchers return every page.

## Commits

- 90f0020a: feat - shared SearchableSelect (+ tests, jsdom scrollIntoView stub)
- 287f750c: fix - paginate GitLab project and Jira board lists
- 62c0875d: feat - migrate 7 call sites and update tests

## What changed

- SearchableSelect: field-style trigger (same ids so Label htmlFor works), search matches label and keywords (name + key/id), arrow/Enter/Escape via cmdk + Popover, leading check slot, "No matches" empty state. Uses `cmdk` `Item` directly to get a leading (not trailing) check.
- listGitLabProjects follows `X-Next-Page` (falls back to page-size==100), cap 50 pages; errors on any page throw as before.
- listProjectBoards follows `startAt`/`isLast`, cap 20 pages, any failure still returns [].
- Call sites keep ids/placeholders/handlers; RM keeps the "None" sentinel option.

## Deviations from Plan

1. [Rule 3 - test fix] `gitlab.test.ts` existing single-page success mock gained `headers: new Headers()`, since the paginating code reads `response.headers` (real Responses always have it). The assertion is unchanged; production code was not bent to the old mock.
2. [Test mechanics] JiraStep.test previously found the trigger via `getByRole('combobox')` (Base UI Select role); now `getByLabelText('Select Project')`. The "hidden before validation" assertion was changed the same way, since the old `combobox` query would trivially pass.
3. [Test mechanics] AioBlock.test and IntegrationsSection.test dropped the native `<select>` mock of `ui/select` and drive the real popover. A helper waits for the fetch to resolve because the picker is briefly rendered (empty, before the query starts) then swapped for the loading row, which remounts the trigger. Assertions' intent preserved; the old placeholder "—" option no longer exists so expected option lists no longer include it. Added one AIO test that search matches by project key.
4. Added the Jira picker search test in ConnectionsSection.test as the plan required.
5. Worktree HEAD was reset to base 91cb826d per the branch check, and `node_modules` was symlinked from the main checkout (untracked/ignored) to run the hooks.

## Known Stubs

None. TokenSection.tsx (dead code) deliberately untouched.

## Verification

Full vitest (5086 passed) + biome + tsc ran in the pre-commit hook for each commit. Manual in-app check (search boxes in Settings > Connections, Integrations, wizard) not performed.

## Self-Check: PASSED

Created files exist; commits 90f0020a, 287f750c, 62c0875d present on branch worktree-agent-a31578bfd1ecf0955.
