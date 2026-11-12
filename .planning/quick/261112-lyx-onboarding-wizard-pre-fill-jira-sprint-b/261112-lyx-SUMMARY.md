---
phase: quick-261112-lyx
plan: 01
subsystem: onboarding
tags: [onboarding, jira, zustand, regression-test]
key-files:
  modified:
    - taskflow/src/routes/settings/DebugModeSection.tsx
  created:
    - taskflow/src/routes/settings/DebugModeSection.test.tsx
decisions:
  - "Seed jiraBoardId from useAuthStore.jiraBoardIds[activeJiraProject] in handleResetWizard"
metrics:
  completed: 2026-11-12
---

# Quick 261112-lyx: Pre-fill Jira sprint board on wizard re-run

Re-running the onboarding wizard now pre-selects the saved Jira sprint board for the active project, by seeding `jiraBoardId` (and clearing stale `jiraBoards`) in `handleResetWizard`.

## What changed

- `DebugModeSection.tsx`: added a `jiraBoardIds` auth-store selector. `handleResetWizard` now sets `jiraBoards: []` and `jiraBoardId: activeJiraProject ? (jiraBoardIds[activeJiraProject] ?? null) : null`.
- `DebugModeSection.test.tsx` (new): 3 tests using the real zustand stores: saved board seeded (42) with stale boards cleared; null when no board is saved; null when there is no active project.

## Verification

- Test 1 was run before the fix and failed (`expected null to be 42`); it passes after.
- Onboarding tests pass; biome clean on both files; tsc clean; full pre-commit vitest suite passed (318 files).

## Commit

- 39ca82f6: fix(quick-261112-lyx): pre-fill Jira sprint board when re-running onboarding wizard

## Deviations from Plan

None. One note: the worktree HEAD started at e7e50155 and was hard-reset to the specified base 04689086 per the branch check.

## Self-Check: PASSED
