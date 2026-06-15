---
slug: aio-cycle-progress-empty
status: resolved
root_cause_revision: 2
trigger: "When I open AIO cycle through the sidebar and properly go through the selection, it loads correctly. However when I pin the cycle to the toolbar and go directly into the cycle (with fresh cache), the progress bar on top doesn't populate with data"
created: 2026-06-15
updated: 2026-06-15
---

# Debug Session: aio-cycle-progress-empty

## Symptoms

- **Expected:** Navigating directly into a pinned AIO cycle (via toolbar, fresh cache) populates the top progress bar with data.
- **Actual:** On direct pinned-toolbar navigation with fresh cache, the top progress bar does not populate. Going through the sidebar selection works correctly.
- **Recovery:** Navigating away from the cycle and back populates the progress bar.
- **Errors:** None — console is clean, requests appear to succeed.
- **Scope:** Only the top progress bar is empty. The rest of the cycle view (test list, etc.) loads fine.
- **Reproduction:** Pin a cycle to the toolbar → with fresh cache, navigate directly into the cycle via the pinned toolbar entry → top progress bar stays empty.

## Current Focus

- hypothesis: On direct pinned-tab navigation with fresh cache, `jiraProjectIdQuery` is not cached (unlike the sidebar path where `AioProjectOverviewPage` pre-warms it). `cycleQuery` resolves before `jiraProjectIdQuery`, causing the Tabs section to render with `aioGate = false`. Since `summaryQuery` is disabled (`enabled: aioGate && !!cycleNumericId && !tokenLoading`), `summaryQuery.isLoading = false`, so `showProgressSkeleton = false`. The progress bar section then renders "No runs recorded" instead of a skeleton. It should eventually recover when `jiraProjectIdQuery` resolves, BUT the `showProgressSkeleton` check uses `summaryQuery.isLoading` which only becomes `true` once the query is actually enabled. The window between "Tabs first render" and "jiraProjectIdQuery resolves" incorrectly shows "No runs recorded" with no indication that data is still loading.
- test: Verify that (1) `jiraProjectIdQuery` pre-warm is the difference between sidebar and pinned-tab paths, and (2) the `showProgressSkeleton` logic fails to show skeleton when `aioGate = false`.
- expecting: The progress bar section shows "No runs recorded" while `jiraProjectId` is still being fetched, then switches to skeleton, then to data. The fix is to extend `showProgressSkeleton` to cover the case where `aioGate` is not yet true but credentials and cycleNumericId are available (meaning: data is expected but not yet fetchable because jiraProjectId is missing).
- next_action: Write the structured reasoning checkpoint, then apply the fix.
- reasoning_checkpoint:
  hypothesis: "The progress bar shows 'No runs recorded' on fresh-cache pinned-tab navigation because `summaryQuery` is disabled (enabled: aioGate && !!cycleNumericId) while `jiraProjectIdQuery` is still in-flight. Since a disabled TanStack Query v5 query has isLoading=false, `showProgressSkeleton` evaluates to false and the progress bar renders the 'No runs recorded' fallback instead of a loading skeleton. This window disappears on sidebar navigation because `jiraProjectIdQuery` is already cached by `AioProjectOverviewPage`."
  confirming_evidence:
    - "sidebar path: AioProjectOverviewPage populates ['jira', jiraBaseUrl, 'project-numeric-id', projectKey] with staleTime 1h; AioCycleDetailPage uses the exact same query key, so jiraProjectId is immediately available → aioGate = true from first render"
    - "pinned-tab fresh cache: no AioProjectOverviewPage pre-warm; both cycleQuery and jiraProjectIdQuery start simultaneously; cycleQuery resolves first → Tabs render → aioGate still false → summaryQuery disabled → isLoading=false in TQ v5"
    - "TanStack Query v5 disabled query: status='pending', fetchStatus='idle', isLoading = isPending && isFetching = true && false = false (confirmed from TQ v5 source)"
    - "showProgressSkeleton = summaryQuery.isLoading && !hasSummaryData && !hasRunsData = false && ... = false — skeleton never shows during the gap"
    - "recovery (navigate away and back): jiraProjectIdQuery is now cached (staleTime 1h), so aioGate=true from mount, summaryQuery fires immediately"
  falsification_test: "If jiraProjectIdQuery is cached at mount time (e.g., by pre-fetching it before rendering AioCycleDetailPage from a pinned tab), the progress bar would never show 'No runs recorded' transiently — this would disprove the hypothesis."
  fix_rationale: "Extend showProgressSkeleton to also cover the case where summaryQuery is not yet enabled (aioGate false or cycleNumericId null) but we expect data to arrive (credGate is true). This prevents the 'No runs recorded' flash during the jiraProjectIdQuery in-flight window."
  blind_spots: "Haven't verified whether the 'No runs recorded' state is permanent (jiraProjectId query always fails) or transient (it eventually recovers). If it recovers, the bug is a UX flash, not a data loading failure."
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-15T00:00:00Z
  checked: AioCycleDetailPage.tsx — summaryQuery enabled gate
  found: "enabled: aioGate && !!cycleNumericId && !tokenLoading" where aioGate = credGate && !!jiraProjectId
  implication: summaryQuery only fires after BOTH cycleQuery and jiraProjectIdQuery resolve

- timestamp: 2026-06-15T00:00:01Z
  checked: main.tsx pinned tab click handler (lines 582-592)
  found: "navigate(`/aio-cycle/${meta.projectKey}/${key}`)" — no pre-warming of jiraProjectIdQuery
  implication: pinned-tab navigation provides no cache warm-up for jiraProjectIdQuery

- timestamp: 2026-06-15T00:00:02Z
  checked: AioProjectOverviewPage.tsx jiraProjectIdQuery (lines 283-288)
  found: same query key ['jira', jiraBaseUrl, 'project-numeric-id', projectKey] with staleTime 60 * 60 * 1000
  implication: sidebar path pre-warms jiraProjectIdQuery; pinned-tab path does not

- timestamp: 2026-06-15T00:00:03Z
  checked: showProgressSkeleton logic (AioCycleDetailPage.tsx line 756)
  found: "const showProgressSkeleton = summaryQuery.isLoading && !hasSummaryData && !hasRunsData"
  implication: when summaryQuery is disabled (aioGate=false), isLoading=false in TQ v5, showProgressSkeleton=false → "No runs recorded" renders instead of skeleton

- timestamp: 2026-06-15T00:00:04Z
  checked: TanStack Query v5 version (@tanstack/react-query ^5.90.21)
  found: isLoading = isPending && isFetching; disabled queries have fetchStatus='idle' so isFetching=false → isLoading=false
  implication: confirms the disabled-query isLoading=false behavior

## Eliminated

## Resolution (REVISION 2 — TRUE root cause)

- root_cause: "`normalizeStatusById` (lib/aioUtils.ts) reads a MODULE-LEVEL `runtimeAioStatusMap` that is populated ONLY by `initializeAioStatusMap()`, which is called ONLY from `AioProjectOverviewPage.tsx:309`. The sidebar path always mounts the overview page first, so the map is populated before the detail page renders. Direct pinned-tab navigation with a fresh cache never mounts the overview, so `runtimeAioStatusMap` stays `{}` and `normalizeStatusById` falls back to 'notRun' for EVERY status ID — the progress bar shows all test cases as Not Run. (Revision 1's skeleton/isLoading→isPending diagnosis treated a misobserved symptom; the bar was never 'No runs recorded', it was all-Not-Run.)"
- fix: "AioCycleDetailPage now initializes the status map itself via a reactive `aioStatusMapQuery` (useQuery gated on aioGate, /config response is React-Query cached so no duplicate HTTP). Modelled as a query (not a fire-and-forget useEffect) so completion re-renders and `summaryCounts` recomputes with the populated map. `showProgressSkeleton` extended with `waitingForStatusMap = hasSummaryData && !aioStatusMapReady` so the bar holds a skeleton (instead of flashing all-Not-Run) until the map is ready; the runs fallback uses raw-string `normalizeStatus` and is unaffected."
- verification: "47/47 tests pass. Added regression test 'initializes the AIO status map itself on direct pinned-tab navigation (all-Not-Run regression)' which empties the runtime map before render and asserts the distribution resolves to 1 Pass/1 Fail/1 Not Run. Confirmed RED→GREEN: test fails (shows Not Run: 3) when the status-map query is disabled, passes with the fix. tsc + biome clean. NEEDS HUMAN RUNTIME UAT with a real fresh Tauri cache + pinned-tab navigation."
- files_changed:
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx

## Resolution (REVISION 1 — superseded, partial)

- root_cause: "On direct pinned-tab navigation with fresh cache, `jiraProjectIdQuery` has not been pre-warmed (unlike the sidebar path where `AioProjectOverviewPage` populates it with a 1-hour staleTime). When `cycleQuery` resolves first, the Tabs section renders with `aioGate = false` (jiraProjectId still null). `summaryQuery` is disabled (`enabled: aioGate && !!cycleNumericId`). In TanStack Query v5, a disabled query has `fetchStatus='idle'` so `isLoading = false`. The old check `showProgressSkeleton = summaryQuery.isLoading && ...` evaluated to `false`, causing the progress bar to render 'No runs recorded' while the data was still pending."
- fix: "Changed `showProgressSkeleton` from using `summaryQuery.isLoading` to `summaryQuery.isPending` in `AioCycleDetailPage.tsx`. In TQ v5, `isPending = true` for both disabled-but-never-fetched queries and actively-fetching queries — exactly the condition needed. Also extended the condition to cover `summaryQuery.isError && runsQuery.isPending` for the edge case where summary errors but runs are still loading."
- verification: "46/46 tests pass in AioCycleDetailPage.test.tsx including new regression test 'shows skeleton (not No runs recorded) when jiraProjectIdQuery is still in-flight on fresh-cache navigation'."
- files_changed:
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
