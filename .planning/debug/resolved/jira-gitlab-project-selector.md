---
slug: jira-gitlab-project-selector
status: resolved
trigger: Shouldn't there be a project selector for jira and gitlab in settings in connections?
created: 2026-05-14
updated: 2026-05-14
---

## Symptoms

- **Expected:** In Settings > Connections, there should be a project selector for Jira and GitLab integrations.
- **Actual:** No project selector is visible for Jira or GitLab connections — credentials/URL fields appear but no project picker.
- **Errors:** No console errors — just missing UI.
- **Timeline:** Unsure if it ever existed.
- **Repro:** Open Settings > Connections > Jira or GitLab.

## Current Focus

hypothesis: ConnectionsSection.tsx only renders URL and token fields — it never fetches or displays a project picker for Jira or GitLab. The auth store has activeJiraProject/activeGitlabProject state and setters, and both listJiraProjects and listGitLabProjects service functions exist, but ConnectionsSection never calls them or renders a Select UI for them.
test: Confirm ConnectionsSection.tsx has no reference to listJiraProjects, listGitLabProjects, setActiveJiraProject, or setActiveGitlabProject.
expecting: No such references — the feature was simply never wired up.
next_action: Implement project selectors in ConnectionsSection
reasoning_checkpoint: The AIO integration (IntegrationsSection.tsx) shows the exact pattern to follow — useQuery to fetch projects after connection, Select component to pick one, persisted key in store. Same pattern applies to Jira (activeJiraProject key, listJiraProjects) and GitLab (activeGitlabProject id + path, listGitLabProjects).

## Evidence

- timestamp: 2026-05-14T00:00:00Z
  finding: ConnectionsSection.tsx renders only URL + token + Test Connection + Save. No project picker, no call to listJiraProjects/listGitLabProjects, no setActiveJiraProject/setActiveGitlabProject.
  file: taskflow/src/routes/settings/ConnectionsSection.tsx

- timestamp: 2026-05-14T00:00:01Z
  finding: auth.store.ts has activeJiraProject (string|null), activeGitlabProject (number|null), activeGitlabProjectPath (string|null), setActiveJiraProject, setActiveGitlabProject — the data model is complete.
  file: taskflow/src/stores/auth.store.ts

- timestamp: 2026-05-14T00:00:02Z
  finding: listJiraProjects(baseUrl, token) exists in services/jira/projects.ts, returns JiraProject[]{id,key,name}.
  file: taskflow/src/services/jira/projects.ts

- timestamp: 2026-05-14T00:00:03Z
  finding: listGitLabProjects(baseUrl, token) exists in services/gitlab.ts, returns GitLabProject[]{id,name,path_with_namespace}.
  file: taskflow/src/services/gitlab.ts

- timestamp: 2026-05-14T00:00:04Z
  finding: IntegrationsSection.tsx demonstrates the full pattern — useEffect to readSecret, useQuery gated on url+token, Select with sorted options, persisted key.
  file: taskflow/src/routes/settings/IntegrationsSection.tsx

- timestamp: 2026-05-14T00:00:05Z
  finding: ConnectionsSection.test.tsx already mocks listJiraProjects and listGitLabProjects (returns []) and mocks setActiveJiraProject/setActiveGitlabProject — test infrastructure is primed for the feature.
  file: taskflow/src/routes/settings/ConnectionsSection.test.tsx

## Eliminated

- Bug in service layer: listJiraProjects and listGitLabProjects both exist and look correct.
- Missing store state: auth.store has all necessary fields and setters.
- Conditional rendering issue: the section simply never renders a picker at all.

## Resolution

root_cause: ConnectionsSection never implements project selection. The UI was never built — only URL/token fields and Test Connection were wired up. The auth store and service functions for listing and persisting the selected project exist but are unused from this section.
fix: Add project Select pickers to ConnectionsSection — one for Jira (fetches listJiraProjects after successful token read, stores to setActiveJiraProject) and one for GitLab (fetches listGitLabProjects, stores id+path via setActiveGitlabProject). Mirror the IntegrationsSection pattern: useEffect to readSecret, useQuery gated on baseUrl+token, sorted Select options, inline loading/error states.
verification: Confirmed missing feature, not a regression. No fix applied — to be tracked as a new feature.
files_changed: 
