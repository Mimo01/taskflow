---
status: resolved
trigger: "Merge requests in MR Attention take really long time to load. Shows 'No MR' message then loads after a while. On dashboard they don't load at all."
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T14:40:00Z
---

## Current Focus

hypothesis: CONFIRMED — Root cause fixed and skeleton loading states added for Stronghold token-read window.
test: 10/10 MR-related tests pass after skeleton addition
expecting: Skeleton shown immediately on mount; replaced by real content once both token and query resolve
next_action: archive

## Symptoms

expected: MRs load within 1-2 seconds
actual: MR Attention shows "No MR" briefly then loads slowly; Dashboard MRs never load
errors: No errors visible in browser console or network tab
reproduction: Open MR Attention page or Dashboard — MRs are slow or absent
started: Has always been slow — never worked correctly

## Eliminated

## Evidence

- timestamp: 2026-03-13T00:01:00Z
  checked: MrAttentionTab.tsx lines 41-58
  found: gitlabToken and jiraToken are loaded from Stronghold via separate useEffect hooks, only triggering after gitlabBaseUrl/jiraBaseUrl are available from the store (async rehydration). Results stored in local state via setGitlabToken/setJiraToken.
  implication: Token is unavailable for at least one render cycle (and however long Stronghold takes to respond), delaying all downstream queries.

- timestamp: 2026-03-13T00:01:30Z
  checked: MrAttentionTab.tsx lines 78-83
  found: currentUser query is enabled only when `!!gitlabBaseUrl && !!gitlabToken`. This means it cannot start until the useEffect above resolves. This query fetches userId via GET /api/v4/user (validateGitLab).
  implication: userId is unavailable until AFTER gitlabToken is set, creating a two-step sequential cascade: (1) wait for token from Stronghold, (2) wait for user API call to complete.

- timestamp: 2026-03-13T00:02:00Z
  checked: MrAttentionTab.tsx lines 98-144
  found: Main MR query enabled only when `!!gitlabBaseUrl && !!gitlabToken && !!userId`. userId comes from the currentUser query above.
  implication: MR list can only start fetching after BOTH async steps complete. Shows "No MR" (empty state with mrQueryData=undefined) until step 2 of the cascade finishes.

- timestamp: 2026-03-13T00:02:30Z
  checked: auth.store.ts lines 43-53
  found: Auth store already has a `gitlabUserId: number | null` field with a `setGitlabUserId` action. This is persisted via Tauri Store (survives restarts).
  implication: On second launch, gitlabUserId is available immediately after store rehydration — no need to call validateGitLab at all for MrAttentionTab to get the userId.

- timestamp: 2026-03-13T00:03:00Z
  checked: dashboard/index.tsx lines 45-51
  found: Dashboard also reads gitlabToken from Stronghold via useEffect, then passes it as a prop to MrHealthPanel. MrHealthPanel receives gitlabToken="" until the useEffect resolves.
  implication: MrHealthPanel's userId query is disabled until gitlabToken prop is non-empty, then MR query blocked until userId resolves. Same two-step cascade as MrAttentionTab — explains why dashboard MRs never appear (the cascade never fully completes before user navigates away, or is extra slow).

- timestamp: 2026-03-13T00:03:30Z
  checked: auth.store.ts setGitlabUserId usage
  found: auth.store has setGitlabUserId — need to verify it's actually called during onboarding/validation.
  implication: If gitlabUserId is populated in the store, MrAttentionTab can read it directly and skip the validateGitLab call entirely.

## Resolution

root_cause: Two-step async cascade in both MrAttentionTab and Dashboard/MrHealthPanel. Step 1: token read from Stronghold via useEffect (async, takes time). Step 2: userId fetched via validateGitLab API call — only starts after step 1 completes. The MR query is gated on BOTH being ready (`enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId`). During the cascade, the component renders with mrQueryData=undefined and data=[], showing "No MRs requiring attention." The auth store already has a gitlabUserId field but setGitlabUserId was never called — so userId was always null causing the MR query to never fire on the dashboard.
fix: |
  1. GitLabStep.tsx: call setGitlabUserId(user.id) in onSuccess after validateGitLab
  2. TokenSection.tsx: call setGitlabUserId(userId) in onSuccess for both gitlabUrlMutation and gitlabMutation
  3. MrAttentionTab.tsx: read gitlabUserId from useAuthStore directly, remove validateGitLab useQuery entirely
  4. MrHealthPanel.tsx: read gitlabUserId from useAuthStore(s => s.gitlabUserId), remove validateGitLab useQuery entirely
  5. Test mocks: add gitlabUserId: 42 to all useAuthStore mock returns in MrAttentionTab.test.tsx; update MrHealthPanel.test.tsx useAuthStore mock to support selector form
verification: 10/10 MrAttentionTab and MrHealthPanel tests pass (including after skeleton addition)
files_changed:
  - taskflow/src/routes/onboarding/GitLabStep.tsx
  - taskflow/src/routes/settings/TokenSection.tsx
  - taskflow/src/routes/dashboard/MrAttentionTab.tsx
  - taskflow/src/routes/dashboard/MrHealthPanel.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx
  - taskflow/src/routes/dashboard/MrHealthPanel.test.tsx
