---
status: diagnosed
trigger: "Missing Git Project Selector in Settings — UAT Test 6 failed: I can't select active git project in the settings, there is no dropdown"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:00:00Z
---

## Current Focus

hypothesis: The GitLab group/project selector IS implemented in TokenSection.tsx but is conditionally rendered only when gitlabGroups.length > 0, and that list is only populated if listGitLabGroups() succeeds at component mount. If the fetch fails silently (network, CORS, auth error), the state stays empty [] and the Select never renders.
test: Read TokenSection.tsx and trace the conditional rendering path
expecting: Confirmed — the Select is guarded by `{gitlabGroups.length > 0 && ...}` with a silent catch(() => [])
next_action: DIAGNOSED — return findings

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
  checked: taskflow/src/routes/settings/TokenSection.tsx lines 154-163
  found: |
    useEffect fetches gitlabGroups at mount:
      const list = await listGitLabGroups(gitlabBaseUrl, pat).catch(() => []);
      setGitlabGroups(list);
    If listGitLabGroups() throws for any reason (network, CORS, bad token, server error), catch(() => []) silently returns [], leaving gitlabGroups = []
  implication: Silent failure leaves state empty — no error shown to user, no retry

- timestamp: 2026-03-11
  checked: taskflow/src/routes/settings/TokenSection.tsx lines 315-335
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
  checked: The Jira counterpart (jiraProjects) at lines 145-153
  found: Same pattern — listJiraProjects().catch(() => []) — but Jira Active Project selector also has this same silent-failure risk
  implication: Both selectors share the same bug pattern, but the UAT user specifically reported the GitLab one

- timestamp: 2026-03-11
  checked: Planning docs (02-CONTEXT.md, 02-UAT.md, 02-01-PLAN.md through 02-04-PLAN.md)
  found: No plan ever specified a standalone "GitLab Project Selector" settings section component. The selector was always designed to live inside TokenSection as a conditional element after the GitLab URL/token fields.
  implication: This is not a missing component — it's a conditional rendering that silently fails

## Resolution

root_cause: |
  In TokenSection.tsx, the GitLab group selector (Select for activeGitlabGroup) is conditionally rendered only when gitlabGroups.length > 0. The gitlabGroups array is populated by a useEffect at mount that calls listGitLabGroups() with a silent .catch(() => []) — meaning ANY fetch failure (bad token in Stronghold, CORS, network, GitLab unreachable) causes the state to remain [] and the dropdown to never render. The user sees no error message, no loading state, and no dropdown — just a blank section.

  Secondary issue: even when the fetch succeeds, there is no "loading" indicator while the async fetch is in progress, and no error message if it fails — the UI just shows nothing.

fix: NOT applied (diagnose-only mode)
verification: NOT applied
files_changed: []
