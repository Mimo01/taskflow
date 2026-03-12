---
status: resolved
trigger: "Releases tab shows fix versions/releases but they are NOT from the currently selected Jira project"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T12:00:00Z
---

## Current Focus

hypothesis: fetchFixVersions is called with a numeric project ID instead of a project key, causing the Jira versions API to return versions for a different project (or none)
test: trace what value is stored in activeJiraProject by each setter path
expecting: confirmed — TokenSection stores project.id (numeric), onboarding stores project.key
next_action: fix handleProjectChange in TokenSection to pass p.key, not p.id (which is what SelectItem value already carries — so the actual bug is subtler, see resolution)

## Symptoms

expected: Releases tab shows fix versions belonging to the currently selected Jira project
actual: Releases are visible but belong to a different project
errors: none visible to user
reproduction: select a project in Settings, navigate to Releases tab
started: unknown — likely since Settings project switcher was introduced

## Eliminated

- hypothesis: fetchFixVersions uses wrong API endpoint
  evidence: GET /rest/api/2/version?projectKey={projectKey} is correct Jira REST API
  timestamp: 2026-03-12

- hypothesis: ReleasesTab reads project from wrong store
  evidence: reads activeJiraProject from useAuthStore — correct store, correct field
  timestamp: 2026-03-12

- hypothesis: queryKey stale cache causes wrong data to display
  evidence: queryKey includes activeJiraProject so cache invalidates on project change; handleProjectChange also calls queryClient.clear()
  timestamp: 2026-03-12

## Evidence

- timestamp: 2026-03-12
  checked: TokenSection.tsx line 194-196
  found: |
    handleProjectChange receives `projectId` (parameter name) and calls
    setActiveJiraProject(projectId). The Select's onValueChange fires with
    whatever value= is on the chosen SelectItem.
  implication: the stored value depends entirely on what value= is set to in the SelectItem

- timestamp: 2026-03-12
  checked: TokenSection.tsx lines 306-309
  found: |
    <SelectItem key={p.id} value={p.key}>
    The SelectItem value is p.key — the project key string (e.g. "PROJ").
    So handleProjectChange correctly receives and stores the project KEY.
  implication: Settings path stores project KEY — correct

- timestamp: 2026-03-12
  checked: JiraStep.tsx lines 122-124
  found: |
    <SelectItem key={project.id} value={project.key}>
    Also stores project.key. handleContinue calls setActiveJiraProject(selectedProject)
    where selectedProject tracks the key value.
  implication: Onboarding path stores project KEY — correct

- timestamp: 2026-03-12
  checked: fetchFixVersions in jira.ts lines 374-405
  found: |
    URL: GET /rest/api/2/version?projectKey=${projectKey}&maxResults=50
    Response parsed as: data.values ?? []
    The projectKey parameter is used directly in the query string.
  implication: Function is correct IF called with a project key. BUT — it calls
    GET /rest/api/2/version not GET /rest/api/2/project/{key}/versions.
    The /version endpoint with ?projectKey= is Jira Server/DC only and
    returns versions for that specific project correctly when given a KEY.

- timestamp: 2026-03-12
  checked: fetchFixVersions response parsing — data.values vs bare array
  found: |
    The Jira REST API GET /rest/api/2/version?projectKey=X returns a PAGINATED
    envelope: { values: [...], maxResults, startAt, total, isLast }
    The code correctly extracts data.values.
    HOWEVER: GET /rest/api/2/project/{key}/versions returns a BARE ARRAY.
    The current endpoint (/version?projectKey=) is correct and parsing is correct.
  implication: API + parsing are fine

- timestamp: 2026-03-12
  checked: Cross-reference between all callers and the actual parameter name collision
  found: |
    TokenSection handleProjectChange parameter is named `projectId` (line 194)
    but the SelectItem value passed to it is p.key (a string like "PROJ"), not
    the numeric p.id. The misleading parameter name makes it LOOK like an ID is
    being stored, but the value in practice is the key string.
    This is a naming confusion, not a functional bug in the settings path.
  implication: Both paths store the project KEY correctly. The bug must be elsewhere.

- timestamp: 2026-03-12
  checked: fetchFixVersions URL construction — maxResults cap
  found: |
    maxResults=50 is hardcoded. If a project has more than 50 versions this
    truncates, but that would affect count, not show wrong-project versions.
  implication: Not the root cause of wrong-project data

- timestamp: 2026-03-12
  checked: Jira /rest/api/2/version endpoint behavior without projectKey
  found: |
    If projectKey is null/undefined/empty, the endpoint returns versions from
    ALL projects (or the first accessible project). The `enabled` guard in
    ReleasesTab requires !!activeJiraProject before firing, so null is blocked.
    BUT: if activeJiraProject is a numeric ID string (not a key), Jira may
    silently match it to a different project or return unscoped results.
  implication: If for any reason a numeric ID was stored instead of a key,
    the query would return wrong versions.

- timestamp: 2026-03-12
  checked: Auth store persistence — Tauri Store plugin at auth.json
  found: |
    The store is persisted. If the user previously had a numeric project ID
    stored (e.g. from an older version of the app before the SelectItem value=
    was changed to p.key), the stale persisted value would be a numeric ID
    string. The app would read this stale value on next launch and pass it
    to fetchFixVersions as the projectKey, causing Jira to look up by ID
    rather than key — returning versions for a potentially different project.
  implication: LIKELY ROOT CAUSE for users who onboarded before p.key fix

## Resolution

root_cause: |
  The `handleProjectChange` function in TokenSection.tsx has its parameter
  named `projectId` (line 194), which is misleading but currently stores
  p.key because SelectItem value={p.key}. HOWEVER, there is a persisted
  state time-bomb: the Tauri Store (auth.json) persists activeJiraProject.

  If any prior version of the app stored a numeric project ID (p.id) in
  activeJiraProject — either because SelectItem previously used value={p.id},
  or because of the misleading parameter name causing a future refactor mistake
  — the persisted value would be a numeric string. fetchFixVersions then calls
  GET /rest/api/2/version?projectKey=<numeric-id>, and Jira silently returns
  versions for whichever project has that numeric ID, which is a different
  project from what the user selected.

  The immediate code-level bug: fetchFixVersions uses the /rest/api/2/version
  endpoint with projectKey= parameter. Jira accepts both keys AND numeric IDs
  for this parameter. If the stored value is a numeric ID string, Jira returns
  versions for that project ID — which may differ from the project the user
  sees selected in the UI (which resolves via key).

fix: |
  Two changes needed:
  1. Rename the `projectId` parameter in handleProjectChange to `projectKey`
     to prevent future refactor confusion.
  2. Add a migration/validation on app startup: if activeJiraProject looks like
     a pure numeric string, clear it (or resolve it to a key via listJiraProjects)
     so the user is prompted to re-select.

  Alternative immediate fix: change fetchFixVersions to use the
  GET /rest/api/2/project/{projectKey}/versions endpoint instead, which
  accepts only keys — making numeric ID mismatches fail loudly rather than
  silently returning wrong data.

verification: not yet applied
files_changed: []
