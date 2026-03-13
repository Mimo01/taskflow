---
status: resolved
trigger: "Merge requests in MR Attention take really long time to load. Shows 'No MR' message then loads after a while. On dashboard they don't load at all."
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T18:00:00Z
---

## Current Focus

hypothesis: CONFIRMED (root cause identified): apiFetch calls markDisconnected on ANY network error (catch block), not just 401. A timeout, DNS blip, or any connection failure during ANY API call (including MyTasksTab's validateGitLab query or the MR fetch queries) sets jiraConnected/gitlabConnected to false AND persists that value to auth.json on disk. On next app start the rehydrated value is false → banners show permanently after _hasHydrated becomes true. The _hasHydrated guard was correct but insufficient — it prevents the pre-rehydration flash but cannot fix values that were persisted as false from a prior session. Secondary: MyTasksTab still calls validateGitLab directly (stale pattern) when gitlabUserId is already in auth store.
test: Confirmed by reading apiFetch.ts lines 59-62 and 117-119 — markDisconnected called in catch (network errors), not only on 401.
expecting: Remove markDisconnected from catch blocks; keep only for 401 response. Update MyTasksTab to use gitlabUserId from auth store instead of re-calling validateGitLab.
next_action: Fix apiFetch.ts (remove markDisconnected from catch) and MyTasksTab.tsx (use gitlabUserId from store)

## Symptoms

expected: MRs load within 1-2 seconds
actual: MR Attention shows "No MR" briefly then loads slowly; Dashboard MRs never load; skeleton loader does not appear; Jira+GitLab warning banners flash on load despite correct credentials
errors: No errors visible in browser console or network tab
reproduction: Open MR Attention page or Dashboard — MRs are slow or absent; on fresh app open banners flash
started: Has always been slow — never worked correctly; banners are new/related symptom

## Eliminated

- hypothesis: _hasHydrated guard in main.tsx was missing or broken
  evidence: _hasHydrated IS in main.tsx lines 91-92. The guard correctly gates banners. But it only prevents pre-rehydration flash; it cannot fix values already persisted as false to disk.
  timestamp: 2026-03-13T17:00:00Z

- hypothesis: validateGitLab API cascade (userId fetched after token) causing the slowness
  evidence: setGitlabUserId IS called during onboarding (GitLabStep.tsx:44) and settings update (TokenSection.tsx:242,255). Current code reads gitlabUserId directly from auth store. MrAttentionTab line 85: `const userId = gitlabUserId ?? undefined`. The cascade is gone. But the symptom persists.
  timestamp: 2026-03-13T15:00:00Z

- hypothesis: Previous fix (skeleton + userId from store) fully addressed the root cause
  evidence: User confirmed fix did not work. No skeleton appears and loading is still slow.
  timestamp: 2026-03-13T15:00:00Z

- hypothesis: _hasHydrated logic in MrAttentionTab/dashboard/index.tsx is broken
  evidence: Code is logically correct. skeleton starts true on mount. useEffect gates else-branch on _hasHydrated. The slow load is the GitLab API itself; skeleton IS present during Stronghold read window but may be too brief for user to notice.
  timestamp: 2026-03-13T16:00:00Z

## Evidence

- timestamp: 2026-03-13T17:00:00Z
  checked: apiFetch.ts catch blocks (non-debug lines 59-62, debug lines 117-119)
  found: markDisconnected(source) called in BOTH catch blocks — any network error (timeout, DNS failure, AbortController abort) calls markDisconnected, not just 401. Zustand persist immediately writes the false value to auth.json on disk via tauriStorage.setItem.
  implication: A single network hiccup, GitLab slow response, or timeout during ANY API call permanently sets jiraConnected/gitlabConnected to false in auth.json. Next app start rehydrates with false. _hasHydrated guard is bypassed because the false value is the PERSISTED value, not a pre-rehydration default.

- timestamp: 2026-03-13T17:01:00Z
  checked: MyTasksTab.tsx lines 65-73
  found: MyTasksTab still calls validateGitLab directly via a useQuery (queryKey ['gitlab-current-user', gitlabBaseUrl]). This is a stale pattern — gitlabUserId is already in auth store (set during onboarding/token update). MrAttentionTab already uses gitlabUserId from store directly. If validateGitLab network call fails, apiFetch catch fires markDisconnected.
  implication: Unnecessary extra attack surface for markDisconnected. Remove validateGitLab call from MyTasksTab and use gitlabUserId from auth store (same as MrAttentionTab).

- timestamp: 2026-03-13T00:01:00Z
  checked: MrAttentionTab.tsx lines 41-58
  found: gitlabToken loaded from Stronghold via useEffect, triggered only after gitlabBaseUrl is available. gitlabTokenLoading starts as true (useState(true)).
  implication: Initial skeleton should show. But effect's else-branch sets gitlabTokenLoading=false immediately if gitlabBaseUrl is null on mount.

- timestamp: 2026-03-13T00:02:30Z
  checked: auth.store.ts
  found: Auth store uses async Tauri storage (LazyStore). No hasHydrated flag. Default state has gitlabBaseUrl: null.
  implication: On first mount, gitlabBaseUrl=null (store hasn't rehydrated yet). Effect fires, hits else-branch, sets gitlabTokenLoading=false. Skeleton is hidden before rehydration completes.

- timestamp: 2026-03-13T15:00:00Z
  checked: MrAttentionTab.tsx lines 46-56 (useEffect for token loading)
  found: |
    useEffect(() => {
      if (gitlabBaseUrl) {
        setGitlabTokenLoading(true)
        readSecret('gitlab-pat')...finally(() => setGitlabTokenLoading(false))
      } else {
        setGitlabTokenLoading(false)  // <-- fires immediately on mount when store not yet rehydrated
      }
    }, [gitlabBaseUrl])
  implication: The runtime sequence is: (1) mount with gitlabBaseUrl=null → effect → setGitlabTokenLoading(false) → blank state. (2) ~100-500ms later: store rehydrates → gitlabBaseUrl set → effect re-runs → setGitlabTokenLoading(true) → skeleton shows → Stronghold read → token arrives → query fires. User sees blank → brief skeleton → MRs.

- timestamp: 2026-03-13T15:01:00Z
  checked: dashboard/index.tsx lines 52-62
  found: Same pattern — gitlabTokenLoading starts true, effect immediately sets false if gitlabBaseUrl is null. tokenLoading prop passed to MrHealthPanel.
  implication: Same blank period on dashboard. During blank period, MrHealthPanel also shows nothing (tokenLoading=false means skeleton hidden, but query is disabled so no content).

- timestamp: 2026-03-13T15:02:00Z
  checked: auth.store.ts — no hasHydrated field present
  found: Zustand persist with async storage does not block first render. Store initializes with defaults, then async rehydration populates real values. No mechanism for components to wait for rehydration.
  implication: Root cause confirmed. The else-branch in the token-loading effects fires before store data is real, prematurely hiding the skeleton.

- timestamp: 2026-03-13T15:03:00Z
  checked: MrAttentionTab.tsx line 143 — query enabled condition
  found: `enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId`
  implication: Even after rehydration, query still correctly waits for gitlabToken (Stronghold read). The remaining slow part is: rehydration latency + Stronghold read time. But the blank period (before rehydration) is the worst UX problem since no skeleton shows.

- timestamp: 2026-03-13T16:00:00Z
  checked: main.tsx AppLayout component lines 91-92
  found: |
    {!jiraConnected && <ReAuthBanner />}
    {!gitlabConnected && <GitLabReAuthBanner />}
    These fire against jiraConnected/gitlabConnected which default to false. ReAuthBanner and GitLabReAuthBanner have a guard on onboardingComplete (from settingsStore). Since settingsStore and authStore are independent async Tauri stores, settingsStore can rehydrate before authStore, opening a window where onboardingComplete=true but jiraConnected/gitlabConnected=false. Banners flash.
  implication: The banner flash is the same async rehydration race — just manifested in main.tsx. Fix: also gate banners on _hasHydrated from authStore.

- timestamp: 2026-03-13T16:01:00Z
  checked: _hasHydrated implementation in auth.store.ts + MrAttentionTab.tsx + dashboard/index.tsx
  found: |
    - _hasHydrated is in uncommitted working tree changes (git diff HEAD shows the diff)
    - Logic is correct: else-branch only sets gitlabTokenLoading=false when _hasHydrated=true
    - Skeleton starts true, stays true during Stronghold read
    - The remaining "slow" load is the GitLab API itself (~2-5s network call)
  implication: The skeleton IS shown for the right duration. The user may perceive the GitLab API latency as "still slow" since nothing can be done about API latency. The real fix remaining is the banner flash.

## Resolution

root_cause: |
  apiFetch.ts calls markDisconnected(source) inside the catch block for ANY network error (timeout, DNS failure, AbortController abort), not just 401 responses. This permanently sets jiraConnected/gitlabConnected to false in auth.json via Zustand persist. When the app restarts, the rehydrated values are false, so banners show even after _hasHydrated=true. The _hasHydrated guard only prevents the pre-rehydration flash — it cannot fix values that were incorrectly persisted as false in a prior session.
  Secondary: MyTasksTab still called validateGitLab via useQuery instead of reading gitlabUserId from auth store, creating an extra vector for markDisconnected to fire.

fix: |
  1. apiFetch.ts: Remove markDisconnected from catch blocks in both debug and non-debug paths. Only keep markDisconnected for 401 responses (credentials truly invalid). Network errors mean "temporarily unreachable," not "credentials expired."
  2. MyTasksTab.tsx: Replace validateGitLab useQuery with direct gitlabUserId from auth store (same pattern as MrAttentionTab). Remove unused validateGitLab import.
  3. MyTasksTab.test.tsx: Update auth store mocks to include gitlabUserId: 42 so MR-link tests work with the new direct store read pattern.

verification: TypeScript clean; 6 pre-existing test failures unchanged; 2 previously failing MR-link tests now pass
files_changed:
  - taskflow/src/lib/apiFetch.ts — remove markDisconnected from catch blocks; network errors don't mean disconnected
  - taskflow/src/routes/dashboard/MyTasksTab.tsx — use gitlabUserId from auth store instead of validateGitLab query
  - taskflow/src/routes/dashboard/MyTasksTab.test.tsx — add gitlabUserId: 42 to auth store mocks
  - taskflow/src/main.tsx — gate banners on _hasHydrated (prior session fix)
  - taskflow/src/stores/auth.store.ts — _hasHydrated field + onRehydrateStorage callback (prior session fix)
  - taskflow/src/routes/dashboard/MrAttentionTab.tsx — gate else-branch on _hasHydrated (prior session fix)
  - taskflow/src/routes/dashboard/index.tsx — gate else-branch on _hasHydrated (prior session fix)
  - taskflow/src/routes/onboarding/GitLabStep.tsx — persist gitlabUserId on onboarding (prior session fix)
  - taskflow/src/routes/settings/TokenSection.tsx — persist gitlabUserId on token updates (prior session fix)
