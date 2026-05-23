# Quick Task 5: Change GitLab active group selection to project selection in wizard and settings - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the "Active Group" concept in GitLab integration with "Active Project". Both the onboarding wizard (GitLabStep.tsx) and the settings (TokenSection.tsx) currently let the user pick a GitLab group — change this to pick a GitLab project instead. Update all downstream code that uses the active group (ReleasesTab, auth store, etc.) to work with a project ID instead.

</domain>

<decisions>
## Implementation Decisions

### Project listing method
- Fetch a flat list of all accessible projects via GitLab API: `GET /api/v4/projects?membership=true`
- No group picker step — replace it directly with a project picker
- Applies to both the onboarding wizard and the settings panel

### Milestone scope
- Switch from group-level milestones (`/api/v4/groups/{groupPath}/milestones`) to project-level milestones (`/api/v4/projects/{id}/milestones`)
- Only fetch milestones for the selected project

### Stored value
- Store the numeric GitLab project ID (number) as `activeGitlabProject`
- Rename `activeGitlabGroup: string | null` → `activeGitlabProject: number | null` in auth store
- Also rename the onboarding store field from `gitlabGroup` to `gitlabProject`
- Store the project name/path string alongside the ID for display purposes (e.g., `activeGitlabProjectPath: string | null` for labels in UI)

### Claude's Discretion
- How to display the project in dropdowns (show `name_with_namespace` or `path_with_namespace`)
- Whether to also store the project's namespace/group path for any future group-level operations
- Order/filtering of the project list (can sort by `last_activity_at` descending for relevance)
- Query cache key naming conventions for the new project-scoped queries

</decisions>

<specifics>
## Specific Ideas

- New GitLab API function needed: `listGitLabProjects(baseUrl, token)` → `GET /api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`
- The `fetchGroupProjects` local function in ReleasesTab.tsx becomes unnecessary (project ID is already known)
- `fetchGroupMilestones` in gitlab.ts should be supplemented or replaced with a `fetchProjectMilestones` function
- Tags fetching in ReleasesTab already uses project ID (`fetchProjectTags`) — no change needed there
- Notification polling hook reads `['gitlab-mrs', gitlabBaseUrl, activeGitlabGroup]` — query key should be updated to use project identifier

</specifics>
