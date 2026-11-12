---
status: resolved
trigger: "when the jira token expires and i need to set up a new one, the app still holds the old data and behaves as if the connection to the system didnt work. I think we need to clear all cache and everything on jira/git token save"
created: 2026-11-12
updated: 2026-11-12
---

## Symptoms
- expected: saving a new Jira/GitLab token in Settings → app works with the new token immediately
- actual: app keeps old (failed) data and acts as if the connection is broken until restart
- reproduction: let PAT expire → Settings → Connections → paste new token → Save → navigate back

## Current Focus
- next_action: UAT in app

## Evidence
- ConnectionsSection.handleSave (Jira + GitLab) stores the PAT and calls setXConnected(true) only — no cache reset.
- QueryClient defaults gcTime: Infinity → queries that failed with 401 on the expired token stay errored for the session.
- ['jira-pat'] query (FieldsSection, IssueDetailSidebar) has staleTime: Infinity → keeps serving the expired PAT to sprint/board lookups → 401 → apiFetch markDisconnected flips jiraConnected back to false.
- Sidebar and useGlobalSearchSources never unmount; they read the PAT into state once, keyed on jiraBaseUrl only.
- Route pages remount after leaving /settings, so their useEffect PAT reads pick up the new token (not affected).
- TokenSection.tsx (has queryClient.clear on project switch) is dead code — not imported anywhere.

## Resolution
- root_cause: credential save never invalidated anything fetched with/holding the old token (query cache incl. ['jira-pat'], and token state in always-mounted Sidebar/global search).
- fix: ConnectionsSection onConnected → queryClient.clear() + auth store bumpCredentialsRevision() (transient, not persisted); Sidebar + useGlobalSearchSources re-read PAT on credentialsRevision.
- verification: 2 new ConnectionsSection tests (fail without fix, pass with it); tsc, biome, 586 related tests green.
- files_changed: src/stores/auth.store.ts, src/routes/settings/ConnectionsSection.tsx (+test), src/components/app/Sidebar.tsx, src/hooks/useGlobalSearchSources.ts
