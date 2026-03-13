---
status: resolved
trigger: "On app restart/change, Jira URL and GitLab URL settings sometimes get lost while other settings survive."
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — markDisconnected() in apiFetch.ts calls setJiraConnected(false) / setGitlabConnected(false) without a baseUrl, which causes `baseUrl ?? null` to overwrite stored URLs with null
test: Fix applied — setters now use functional update to preserve existing URL when baseUrl is undefined
expecting: URLs survive 401 responses and network errors; only change when explicitly passed
next_action: Await human verification in app

## Symptoms

expected: Jira URL and GitLab URL persist across app restarts and changes
actual: Occasionally (rare, 1-2 times) Jira URL and/or GitLab URL are wiped/reset to empty while other settings remain intact
errors: No known error messages
reproduction: Random/unclear — no consistent trigger identified. Has happened with both Jira URL and GitLab URL separately.
started: Happened once or twice total; no clear correlation with a specific event (restart, update, etc.)

## Eliminated

(none — root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-13T00:00:00Z
  checked: auth.store.ts setJiraConnected / setGitlabConnected implementations
  found: Both setters unconditionally overwrite the URL field: `set({ jiraConnected: connected, jiraBaseUrl: baseUrl ?? null })`
  implication: When called without baseUrl (which markDisconnected does), the URL is set to null

- timestamp: 2026-03-13T00:00:00Z
  checked: apiFetch.ts markDisconnected() function
  found: Calls `auth.setJiraConnected(false)` / `auth.setGitlabConnected(false)` — no baseUrl argument — on any 401 response or network error/timeout
  implication: Every API auth failure or network error erases the stored Jira/GitLab URL

## Resolution

root_cause: |
  setJiraConnected and setGitlabConnected in auth.store.ts always overwrote jiraBaseUrl/gitlabBaseUrl,
  even when called without a baseUrl argument (using `baseUrl ?? null`). The markDisconnected()
  function in apiFetch.ts calls these setters with only `false` (no baseUrl) whenever a 401 response
  or network error/timeout occurs. This silently erased the stored URL.

fix: |
  Changed both setters to use a functional set() call that reads current state:
    setJiraConnected: (connected, baseUrl) =>
      set((state) => ({
        jiraConnected: connected,
        jiraBaseUrl: baseUrl !== undefined ? baseUrl : state.jiraBaseUrl,
      }))
  URL is now only updated when baseUrl is explicitly provided; omitting it preserves the stored value.

verification: All 21 Settings-related tests pass; 6 pre-existing unrelated dashboard test failures unchanged.
files_changed:
  - taskflow/src/stores/auth.store.ts
