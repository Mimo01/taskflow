---
phase: quick-5
plan: 01
subsystem: gitlab-integration
tags: [gitlab, auth-store, onboarding, settings, releases, project-selection]
dependency_graph:
  requires: []
  provides: [activeGitlabProject, listGitLabProjects, fetchProjectMilestones]
  affects: [GitLabStep, TokenSection, ReleasesTab, useNotificationPolling]
tech_stack:
  added: []
  patterns: [project-scoped-milestones, numeric-id-store]
key_files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/stores/onboarding.store.ts
    - taskflow/src/routes/onboarding/GitLabStep.tsx
    - taskflow/src/routes/settings/TokenSection.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx
    - taskflow/src/routes/settings/Settings.test.tsx
decisions:
  - Kept @tauri-apps/plugin-http import in ReleasesTab because fetchVersionIssueCounts still uses it directly; plan comment that "all other fetches go via apiFetch" was inaccurate
  - Kept fetchGroupMilestones in gitlab.ts for backward compatibility; existing tests still pass
metrics:
  duration: ~8min
  completed_date: "2026-03-12"
  tasks: 3
  files_modified: 10
---

# Quick Task 5: Change GitLab Active Group Selection to Project Selection — Summary

**One-liner:** Replaced GitLab group selection with project selection throughout app — auth store now stores numeric `activeGitlabProject` + `activeGitlabProjectPath`, onboarding wizard and settings panel fetch `/api/v4/projects?membership=true`, and ReleasesTab fetches milestones from project-level endpoint directly.

## What Was Built

- **gitlab.ts**: Added `GitLabProject` interface, `listGitLabProjects()` (fetches `/api/v4/projects?membership=true&per_page=100`), and `fetchProjectMilestones()` (fetches `/api/v4/projects/{id}/milestones`)
- **auth.store.ts**: Replaced `activeGitlabGroup: string | null` + `setActiveGitlabGroup` with `activeGitlabProject: number | null`, `activeGitlabProjectPath: string | null`, and `setActiveGitlabProject(id, path)`
- **onboarding.store.ts**: Renamed `gitlabGroup`/`gitlabGroups` to `gitlabProject`/`gitlabProjects` (type changed to `number | null` / `GitLabProject[]`)
- **GitLabStep.tsx**: Project picker replaces group picker; calls `listGitLabProjects`, stores project ID + `name_with_namespace` via `setActiveGitlabProject`
- **TokenSection.tsx**: Active Project dropdown replaces Active Group; uses `listGitLabProjects`, controlled by numeric `activeGitlabProject`
- **ReleasesTab.tsx**: Removed `fetchGroupProjects` local function and group→project resolution query; milestones now fetched directly via `fetchProjectMilestones(activeGitlabProject)`
- **useNotificationPolling.ts**: Query key updated from `activeGitlabGroup` to `activeGitlabProject`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c745a6b | Add listGitLabProjects, fetchProjectMilestones, update stores |
| 2 | 6ee7a8c | Update all consumers from group to project selection |
| 3 | 6e2fb62 | Update tests for project-based GitLab selection |

## Deviations from Plan

### Auto-fixed Issues

None.

### Scope Notes

**Kept `@tauri-apps/plugin-http` import in ReleasesTab** — The plan stated to remove it since "all other fetches go via apiFetch", but `fetchVersionIssueCounts` (which was not changed by this task) still uses the `fetch` import directly. Removing it would cause a runtime error, so the import was retained.

**Kept `fetchGroupMilestones` in gitlab.ts** — As specified in the plan, the existing function was kept for backward compatibility. Its unit test continues to pass.

## Verification

- `npx tsc --noEmit`: Only pre-existing errors remain (unused imports in SearchOverlay.test.tsx and JiraStep.tsx — unrelated to this task)
- `npx vitest run`: 186 tests pass; 1 pre-existing failure in MyTasksTab.test.tsx (unrelated to this task)
- No remaining references to `activeGitlabGroup`, `setActiveGitlabGroup`, `gitlabGroup`, `gitlabGroups`, or `fetchGroupProjects` in production code

## Self-Check: PASSED

- [x] taskflow/src/services/gitlab.ts — modified, exports GitLabProject, listGitLabProjects, fetchProjectMilestones
- [x] taskflow/src/stores/auth.store.ts — modified, contains activeGitlabProject
- [x] taskflow/src/stores/onboarding.store.ts — modified, contains gitlabProject
- [x] taskflow/src/routes/onboarding/GitLabStep.tsx — modified, uses listGitLabProjects
- [x] taskflow/src/routes/settings/TokenSection.tsx — modified, uses listGitLabProjects
- [x] taskflow/src/routes/dashboard/ReleasesTab.tsx — modified, uses fetchProjectMilestones
- [x] taskflow/src/hooks/useNotificationPolling.ts — modified, uses activeGitlabProject
- [x] Commits c745a6b, 6ee7a8c, 6e2fb62 exist in git log
