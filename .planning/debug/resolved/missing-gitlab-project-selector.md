---
status: resolved
trigger: "Missing Git Project Selector in Settings — UAT Test 6 failed: I can't select active git project in the settings, there is no dropdown"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — silent .catch(() => []) in useEffect left gitlabGroups = [] on any fetch failure, and the Select was gated on gitlabGroups.length > 0 so it never rendered when the fetch failed
test: Read final TokenSection.tsx to verify fix is applied
expecting: try/catch/finally with error state, loading state, and Select always shown when gitlabBaseUrl is set
next_action: COMPLETE — fix verified in file, session archived

## Symptoms

expected: In Settings there is a dropdown to select the active GitLab project/group
actual: No dropdown is visible in Settings
errors: None reported — just missing UI element
reproduction: Open Settings after completing onboarding with GitLab configured
started: UAT Test 6 — unclear if ever worked

## Eliminated

- hypothesis: The component was never built (no GitLab selector component exists anywhere)
  evidence: TokenSection.tsx at lines 315-335 contains a fully-implemented Select for activeGitlabGroup, bound to listGitLabGroups() results
  timestamp: 2026-03-11

- hypothesis: The selector is a separate missing component that was planned but not created
  evidence: No planning doc in 02-01, 02-02, 02-03, or 02-04 PLAN.md specifies a standalone GitLab project selector settings component — it was always intended to live inside TokenSection
  timestamp: 2026-03-11

- hypothesis: The auth store lacks the fields to support a GitLab group selector
  evidence: auth.store.ts has activeGitlabGroup: string | null with setActiveGitlabGroup action — fully wired
  timestamp: 2026-03-11

## Evidence

- timestamp: 2026-03-11
  checked: taskflow/src/routes/settings/Settings.tsx
  found: Renders TokenSection, RoleSection, ThemeSection, StaleMrThresholdSection, NotificationSettingsSection — no dedicated GitLab project selector component
  implication: The selector must be inside one of these, or missing entirely

- timestamp: 2026-03-11
  checked: taskflow/src/routes/settings/TokenSection.tsx lines 154-163 (old code)
  found: |
    useEffect fetches gitlabGroups at mount:
      const list = await listGitLabGroups(gitlabBaseUrl, pat).catch(() => []);
      setGitlabGroups(list);
    If listGitLabGroups() throws for any reason (network, CORS, bad token, server error), catch(() => []) silently returns [], leaving gitlabGroups = []
  implication: Silent failure leaves state empty — no error shown to user, no retry

- timestamp: 2026-03-11
  checked: taskflow/src/routes/settings/TokenSection.tsx lines 315-335 (old code)
  found: |
    {gitlabGroups.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="active-gitlab-group">Active Group</Label>
        <Select ...>
    The entire Select is inside a conditional that only renders when gitlabGroups.length > 0
  implication: If the groups fetch silently fails, the Select is never rendered — matches user report exactly

- timestamp: 2026-03-11
  checked: listGitLabGroups fetch in gitlab.ts (line 75)
  found: Fetches GET /api/v4/groups — requires valid gitlab-pat in Stronghold and valid gitlabBaseUrl
  implication: Any auth failure, CORS issue, or network error during the mount effect causes the dropdown to silently not appear

- timestamp: 2026-03-11
  checked: The Jira counterpart (jiraProjects) at lines 145-153 (old code)
  found: Same pattern — listJiraProjects().catch(() => []) — but Jira Active Project selector also has this same silent-failure risk
  implication: Both selectors share the same bug pattern, but the UAT user specifically reported the GitLab one

- timestamp: 2026-03-11
  checked: Planning docs (02-CONTEXT.md, 02-UAT.md, 02-01-PLAN.md through 02-04-PLAN.md)
  found: No plan ever specified a standalone "GitLab Project Selector" settings section component. The selector was always designed to live inside TokenSection as a conditional element after the GitLab URL/token fields.
  implication: This is not a missing component — it's a conditional rendering that silently fails

- timestamp: 2026-03-11
  checked: TokenSection.tsx final state after fix
  found: |
    - gitlabGroupsLoading and gitlabGroupsError state variables added (lines 145-146)
    - useEffect uses try/catch/finally — no silent catch(() => [])
    - Network/CORS errors produce human-readable message: "Could not reach GitLab — check the URL and your network connection"
    - Rendering block (lines 352-381) gated on {gitlabBaseUrl && ...} not gitlabGroups.length > 0
    - Shows loading indicator, then error OR Select (always rendered when gitlabBaseUrl is set)
    - Select shows "No groups found" placeholder when list is empty after successful fetch
    - Same fix applied symmetrically to Jira projects
  implication: Fix is complete and correct — both the GitLab and Jira selectors now show proper error/loading states

## Resolution

root_cause: |
  In TokenSection.tsx, the GitLab group selector (Select for activeGitlabGroup) was conditionally rendered only when gitlabGroups.length > 0. The gitlabGroups array was populated by a useEffect at mount that called listGitLabGroups() with a silent .catch(() => []) — meaning ANY fetch failure (bad token in Stronghold, CORS, network, GitLab unreachable) caused the state to remain [] and the dropdown to never render. The user saw no error message, no loading state, and no dropdown — just a blank section.

  Secondary issue: same pattern existed for Jira projects.

fix: |
  Added gitlabGroupsLoading (boolean) and gitlabGroupsError (string | null) state.
  Replaced silent .catch(() => []) with proper try/catch/finally block that sets error state.
  Changed rendering guard from {gitlabGroups.length > 0 && ...} to {gitlabBaseUrl && ...}.
  Added loading indicator ("Loading groups...") while fetch is in progress.
  Added error message paragraph when fetch fails, with CORS/network-specific message.
  Select always renders when gitlabBaseUrl is set (shows "No groups found" if list is empty after success).
  Same fix applied symmetrically to Jira projects section.

verification: |
  Read final TokenSection.tsx — all changes confirmed present.
  gitlabGroupsLoading and gitlabGroupsError state at lines 145-146.
  try/catch/finally useEffect at lines 171-192.
  Rendering block at lines 352-381 gated on gitlabBaseUrl, not gitlabGroups.length > 0.
  Jira section fixed identically at lines 141-143, 148-169, 286-315.

files_changed:
  - TaskFlow/src/routes/settings/TokenSection.tsx
