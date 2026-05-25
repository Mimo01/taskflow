---
slug: missing-project-pickers
status: resolved
trigger: "In setting conntection tab, I don't see the jira or github project pickers"
created: 2026-05-26
updated: 2026-05-26
---

# Debug Session: missing-project-pickers

## Symptoms

- expected: In the Settings connection tab, the Jira and GitHub (GitLab?) project pickers should appear so the user can select projects.
- actual: The project pickers are not visible in the Settings connection tab.
- errors: None visible on screen or in the browser console.
- timeline: Just noticed — unsure whether it ever worked.
- connection_state: Connections are authenticated (credentials entered, connection appears valid), but pickers still do not render.
- reproduction: Open Settings → connection tab while connections are authenticated.

## Current Focus

- hypothesis: CONFIRMED — The project pickers were never built into ConnectionsSection. The feature only exists in the onboarding flow (JiraStep.tsx / GitLabStep.tsx). The ConnectionsSection was built in Plan 18-03 as a pure credential-entry component (URL + Token + Test Connection) and was never extended to include project selection.
- next_action: RESOLVED — fix applied.

## Evidence

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/settings/ConnectionsSection.tsx
  note: Component renders only URL field, token field, Save, and Test Connection. No project picker exists anywhere in the file. No conditional rendering gated on connection state.

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/settings/ConnectionsSection.test.tsx
  note: Test mocks include activeJiraProject and activeGitlabProject in the auth store mock, and listJiraProjects/listGitLabProjects in service mocks — confirming the feature was anticipated but never implemented.

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/onboarding/JiraStep.tsx + GitLabStep.tsx
  note: Both onboarding steps implement the full flow: validate credentials → fetch project list → show inline dropdown → commit selection to authStore. This is the reference implementation the Settings Connections tab should mirror.

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/stores/auth.store.ts
  note: setActiveJiraProject(project: string | null) and setActiveGitlabProject(id: number | null, path: string | null) are both available. activeJiraProject and activeGitlabProject are persisted. All needed state management exists.

## Eliminated

- Console errors / runtime crash: no errors visible.
- Auth store missing project fields: fields exist and are persisted.
- Project list API missing: listJiraProjects and listGitLabProjects both exist in services.

## Resolution

- root_cause: The project pickers were never implemented in ConnectionsSection. The component was created in Plan 18-03 as credential-entry only. No conditional rendering, no project list fetch, no Select dropdown — the feature was simply absent.
- fix: Extended ConnectionsSection to mirror the onboarding step pattern. After a successful "Test Connection", the component now fetches the project list and renders an inline project picker. If already connected on mount, the current selection is shown. On picker change, the auth store is updated immediately.
- specialist_hint: typescript
