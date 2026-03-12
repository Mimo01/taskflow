---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "GitLab onboarding wizard shows a project picker (not group picker) after token validation"
    - "GitLab settings panel shows an active project dropdown (not active group)"
    - "Selecting a GitLab project stores its numeric ID as activeGitlabProject and its name_with_namespace as activeGitlabProjectPath in auth store"
    - "ReleasesTab fetches milestones from the project-level endpoint using activeGitlabProject numeric ID — no group path lookup needed"
    - "Notification polling query key uses activeGitlabProject instead of activeGitlabGroup"
  artifacts:
    - path: "taskflow/src/services/gitlab.ts"
      provides: "listGitLabProjects() and fetchProjectMilestones() functions"
      exports: ["listGitLabProjects", "fetchProjectMilestones", "GitLabProject"]
    - path: "taskflow/src/stores/auth.store.ts"
      provides: "activeGitlabProject: number | null and activeGitlabProjectPath: string | null fields"
      contains: "activeGitlabProject"
    - path: "taskflow/src/stores/onboarding.store.ts"
      provides: "gitlabProject and gitlabProjects fields"
      contains: "gitlabProject"
    - path: "taskflow/src/routes/onboarding/GitLabStep.tsx"
      provides: "Project picker UI in onboarding wizard"
    - path: "taskflow/src/routes/settings/TokenSection.tsx"
      provides: "Active project dropdown in settings"
    - path: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
      provides: "Milestones via project-level endpoint, no group-to-project resolution"
  key_links:
    - from: "GitLabStep.tsx"
      to: "auth.store.ts"
      via: "setActiveGitlabProject(project.id) and setActiveGitlabProjectPath(project.name_with_namespace)"
      pattern: "setActiveGitlabProject"
    - from: "ReleasesTab.tsx"
      to: "fetchProjectMilestones in gitlab.ts"
      via: "useQuery with activeGitlabProject (numeric ID)"
      pattern: "fetchProjectMilestones.*activeGitlabProject"
    - from: "useNotificationPolling.ts"
      to: "queryClient.getQueryData"
      via: "query key with activeGitlabProject instead of activeGitlabGroup"
      pattern: "gitlab-mrs.*activeGitlabProject"
---

<objective>
Replace GitLab group selection with project selection throughout the app.

Purpose: Users need to pick a specific GitLab project (not a group) as their active context. This enables project-scoped milestone fetching and removes the intermediate group-to-project lookup in ReleasesTab.
Output: Updated auth store, onboarding wizard, settings panel, ReleasesTab, notification hook, gitlab service, and all affected tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/5-change-gitlab-active-group-selection-to-/5-CONTEXT.md
</context>

<interfaces>
<!-- Current auth store shape (to be replaced) -->
```typescript
// auth.store.ts — CURRENT (to be changed)
interface AuthState {
  activeGitlabGroup: string | null;          // REMOVE
  setActiveGitlabGroup: (group: string | null) => void;  // REMOVE
  // ADD:
  activeGitlabProject: number | null;
  activeGitlabProjectPath: string | null;
  setActiveGitlabProject: (id: number | null, path: string | null) => void;
}

// onboarding.store.ts — CURRENT (to be changed)
interface OnboardingState {
  gitlabGroup: string | null;      // RENAME → gitlabProject: number | null
  gitlabGroups: GitLabGroup[];     // RENAME → gitlabProjects: GitLabProject[]
}
```

<!-- New gitlab.ts additions needed -->
```typescript
// New interface
export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
}

// New function
export async function listGitLabProjects(baseUrl: string, token: string): Promise<GitLabProject[]>
// GET /api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc

// New function
export async function fetchProjectMilestones(baseUrl: string, token: string, projectId: number): Promise<GitLabMilestone[]>
// GET /api/v4/projects/{projectId}/milestones?per_page=100
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add listGitLabProjects and fetchProjectMilestones to gitlab.ts + update stores</name>
  <files>
    taskflow/src/services/gitlab.ts,
    taskflow/src/stores/auth.store.ts,
    taskflow/src/stores/onboarding.store.ts
  </files>
  <action>
**gitlab.ts changes:**

1. Add `GitLabProject` interface after `GitLabGroup`:
```typescript
export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
}
```

2. Add `listGitLabProjects` function (after `listGitLabGroups`, keep `listGitLabGroups` in place — it is still used in gitlab.test.ts and can be kept for backward compat):
```typescript
export async function listGitLabProjects(baseUrl: string, token: string): Promise<GitLabProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`;
  // same apiFetch pattern as listGitLabGroups: try/catch network, handle 401/403/other
  // returns data as GitLabProject[] on ok
}
```

3. Add `fetchProjectMilestones` function in the Phase 4 section, replacing the group-level comment. Keep `fetchGroupMilestones` in the file since existing tests reference it — but add the new project-level function:
```typescript
export async function fetchProjectMilestones(baseUrl: string, token: string, projectId: number): Promise<GitLabMilestone[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones?per_page=100`;
  // same apiFetch pattern as fetchGroupMilestones
  // throws 'Failed to fetch milestones' on non-ok
}
```

**auth.store.ts changes:**

In `AuthState` interface:
- Remove `activeGitlabGroup: string | null`
- Remove `setActiveGitlabGroup: (group: string | null) => void`
- Add `activeGitlabProject: number | null`
- Add `activeGitlabProjectPath: string | null`
- Add `setActiveGitlabProject: (id: number | null, path: string | null) => void`

In the `create` call initial state:
- Remove `activeGitlabGroup: null`
- Add `activeGitlabProject: null`
- Add `activeGitlabProjectPath: null`

In actions:
- Remove `setActiveGitlabGroup`
- Add `setActiveGitlabProject: (id, path) => set({ activeGitlabProject: id, activeGitlabProjectPath: path })`

**onboarding.store.ts changes:**

- Change import: remove `GitLabGroup`, add `GitLabProject` from `@/services/gitlab`
- In `OnboardingState` interface: rename `gitlabGroup: string | null` → `gitlabProject: number | null`, rename `gitlabGroups: GitLabGroup[]` → `gitlabProjects: GitLabProject[]`
- In initial state: rename `gitlabGroup: null` → `gitlabProject: null`, rename `gitlabGroups: []` → `gitlabProjects: []`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - `GitLabProject` interface exported from gitlab.ts
    - `listGitLabProjects` and `fetchProjectMilestones` functions exported from gitlab.ts
    - `auth.store.ts` has `activeGitlabProject: number | null`, `activeGitlabProjectPath: string | null`, `setActiveGitlabProject` — no `activeGitlabGroup` remaining
    - `onboarding.store.ts` uses `gitlabProject: number | null` and `gitlabProjects: GitLabProject[]`
  </done>
</task>

<task type="auto">
  <name>Task 2: Update all consumers — GitLabStep, TokenSection, ReleasesTab, useNotificationPolling</name>
  <files>
    taskflow/src/routes/onboarding/GitLabStep.tsx,
    taskflow/src/routes/settings/TokenSection.tsx,
    taskflow/src/routes/dashboard/ReleasesTab.tsx,
    taskflow/src/hooks/useNotificationPolling.ts
  </files>
  <action>
**GitLabStep.tsx:**

Replace the entire file logic:
- Change import: `listGitLabGroups` → `listGitLabProjects`; add `type GitLabProject`
- Destructure `gitlabProject, gitlabProjects` from `useOnboardingStore` (not `gitlabGroup, gitlabGroups`)
- Destructure `setActiveGitlabProject` from `useAuthStore` (not `setActiveGitlabGroup`)
- In `mutation.mutationFn`: call `listGitLabProjects` instead of `listGitLabGroups`
- In `mutation.onSuccess`: `set({ gitlabProjects: projectList })`
- In `handleContinue`: use `selectedProject` (the full `GitLabProject` object or numeric id); call `setActiveGitlabProject(selectedProject.id, selectedProject.name_with_namespace)` and `set({ gitlabValidated: true })`; guard: `if (!selectedProjectId) return`
- In the dropdown: use `gitlabProjects`, `SelectItem key={p.id} value={String(p.id)}`, display `p.name_with_namespace`
- Label changes: "Select Group" → "Select Project", dropdown placeholder "Choose a group..." → "Choose a project..."

**TokenSection.tsx:**

- Change import: remove `listGitLabGroups, type GitLabGroup`, add `listGitLabProjects, type GitLabProject`
- Destructure `activeGitlabProject, setActiveGitlabProject` instead of `activeGitlabGroup, setActiveGitlabGroup`
- Rename local state: `gitlabGroups` → `gitlabProjects` (type `GitLabProject[]`), `gitlabGroupsLoading` → `gitlabProjectsLoading`, `gitlabGroupsError` → `gitlabProjectsError`
- In the `useEffect` that loads the list: call `listGitLabProjects` instead of `listGitLabGroups`; update error string "Failed to load groups" → "Failed to load projects"
- `handleGroupChange` → `handleProjectChange` accepting `string` (the stringified numeric ID), parsing with `parseInt`, calling `setActiveGitlabProject(id, path)` — need to find the matching project in the local list for the path; `queryClient.clear()` remains
- In JSX: label "Active Group" → "Active Project"; id `active-gitlab-group` → `active-gitlab-project`; render `p.name_with_namespace` in items; `Select value={String(activeGitlabProject ?? '')}` for the controlled value; display label uses `activeGitlabProjectPath` from auth store (already in scope via `useAuthStore`)

**ReleasesTab.tsx:**

- Remove the local `fetchGroupProjects` function entirely (no longer needed — project ID is in store directly)
- Remove the `GitLabProject` local interface (it was only needed for group resolution)
- Change import from `fetchGroupMilestones` → `fetchProjectMilestones`
- Change `const { ..., activeGitlabGroup } = useAuthStore()` → `const { ..., activeGitlabProject } = useAuthStore()`
- Remove the `groupProjects` query (was resolving group → project ID)
- Remove `const firstProjectId = groupProjects?.[0]?.id ?? null`
- Update milestones query:
  - queryKey: `['gitlab-milestones', activeGitlabProject]`
  - queryFn: `fetchProjectMilestones(gitlabBaseUrl!, gitlabToken!, activeGitlabProject!)`
  - enabled: `!!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken`
- Update tags query:
  - queryKey: `['gitlab-tags', activeGitlabProject]`
  - queryFn: `fetchProjectTags(gitlabBaseUrl!, gitlabToken!, activeGitlabProject!)`
  - enabled: `!!gitlabBaseUrl && !!gitlabToken && activeGitlabProject !== null`
- Remove the `tauri-apps/plugin-http` import (no longer needed — `fetchGroupProjects` used it directly, all other fetches go via `apiFetch`)

**useNotificationPolling.ts:**

- Rename destructured field: `activeGitlabGroup` → `activeGitlabProject`
- Update query key lookup: `['gitlab-mrs', gitlabBaseUrl, activeGitlabProject]` (was `activeGitlabGroup`)
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    - No TypeScript errors across all modified files
    - `activeGitlabGroup` reference does not appear in any consumer file
    - ReleasesTab has no `fetchGroupProjects` local function and no `@tauri-apps/plugin-http` import
    - `useNotificationPolling` query key uses `activeGitlabProject`
  </done>
</task>

<task type="auto">
  <name>Task 3: Update tests — gitlab.test.ts, ReleasesTab.test.tsx, Settings.test.tsx</name>
  <files>
    taskflow/src/services/gitlab.test.ts,
    taskflow/src/routes/dashboard/ReleasesTab.test.tsx,
    taskflow/src/routes/settings/Settings.test.tsx
  </files>
  <action>
**gitlab.test.ts:**

- Add `listGitLabProjects` to the import list (keep `listGitLabGroups` — its test remains since the function still exists)
- Add a new describe block for `listGitLabProjects`:
```typescript
describe('listGitLabProjects', () => {
  it('listGitLabProjects returns project list on success', async () => {
    const mockProjects = [
      { id: 1, name: 'Frontend', name_with_namespace: 'Org / Frontend', path_with_namespace: 'org/frontend' },
    ];
    vi.mocked(mockFetch).mockResolvedValue({ ok: true, status: 200, json: async () => mockProjects } as Response);
    const result = await listGitLabProjects('https://gitlab.example.com', 'my-token');
    expect(result).toEqual(mockProjects);
  });
});
```
- Add `fetchProjectMilestones` to the import list and add a basic test:
```typescript
describe('fetchProjectMilestones', () => {
  it('fetchProjectMilestones returns milestones for a project', async () => {
    const mockMilestones = [{ id: 10, iid: 1, title: 'Sprint 1', due_date: '2026-04-01', state: 'active', web_url: 'https://gitlab.example.com/project/-/milestones/1' }];
    vi.mocked(mockFetch).mockResolvedValue({ ok: true, status: 200, json: async () => mockMilestones } as Response);
    const result = await fetchProjectMilestones('https://gitlab.example.com', 'my-token', 42);
    expect(result).toEqual(mockMilestones);
    expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(expect.stringContaining('/projects/42/milestones'), expect.any(Object));
  });
});
```

**ReleasesTab.test.tsx:**

- In the `vi.mock('@/services/gitlab', ...)` block: replace `fetchGroupMilestones` with `fetchProjectMilestones`
- In `vi.mock('@/stores/auth.store', ...)`: replace `activeGitlabGroup: 'my-org/team'` with `activeGitlabProject: 42`
- In `beforeEach`: replace `vi.mocked(fetchGroupMilestones)` with `vi.mocked(fetchProjectMilestones)`
- In each individual test that imports `fetchGroupMilestones`: replace with `fetchProjectMilestones`
- The `vi.mock('@tauri-apps/plugin-http', ...)` mock can remain — it is still used by `fetchVersionIssueCounts` inside ReleasesTab

**Settings.test.tsx:**

- In `vi.mock('@/services/gitlab', ...)`: replace `listGitLabGroups` with `listGitLabProjects`; update the mock return value to match `GitLabProject` shape: `[{ id: 1, name: 'My Project', name_with_namespace: 'Org / My Project', path_with_namespace: 'org/my-project' }]`
- In `mockAuthStore`: replace `activeGitlabGroup: 'group-1'` with `activeGitlabProject: 1, activeGitlabProjectPath: 'Org / My Project'`; replace `setActiveGitlabGroup: vi.fn()` with `setActiveGitlabProject: vi.fn()`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - All tests pass (vitest run exits 0)
    - No test references `activeGitlabGroup`, `listGitLabGroups` mock, or `fetchGroupMilestones` mock (except the retained `listGitLabGroups` unit test in gitlab.test.ts)
    - New `listGitLabProjects` and `fetchProjectMilestones` tests present and green
  </done>
</task>

</tasks>

<verification>
After all tasks:
- `npx tsc --noEmit` passes with no new errors
- `npx vitest run` passes all tests
- No remaining references to `activeGitlabGroup`, `setActiveGitlabGroup`, `gitlabGroup`, `gitlabGroups` (as the onboarding field), or `fetchGroupProjects` in consumer files
</verification>

<success_criteria>
- Auth store field is `activeGitlabProject: number | null` + `activeGitlabProjectPath: string | null`
- Onboarding wizard project picker fetches from `/api/v4/projects?membership=true` and displays `name_with_namespace`
- Settings active project dropdown works identically to the active Jira project dropdown pattern
- ReleasesTab milestones use `/api/v4/projects/{id}/milestones` — no group path resolution step
- All existing tests pass; new unit tests cover `listGitLabProjects` and `fetchProjectMilestones`
</success_criteria>

<output>
After completion, create `.planning/quick/5-change-gitlab-active-group-selection-to-/5-SUMMARY.md`
</output>
```
