---
phase: quick-261029-qez
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/aio-refresh.ts
  - taskflow/src/lib/aio-refresh.test.ts
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
autonomous: true
requirements: [QUICK-261029-qez]

must_haves:
  truths:
    - "The Test cycles page (/aio-project/:projectKey) has a Refresh control in its header. It looks exactly like the Backlog / Sprint Board one: 'Refreshed: HH:MM:SS' muted text plus an icon-only RefreshCw button"
    - "Clicking it refetches the folder tree, folder counts, project status config, the cycle list for the selected folder and then the cycle summaries. The KPI tiles, charts and list update without a full-page skeleton"
    - "The cycle detail page (/aio-cycle/:projectKey/:cycleKey) has the same Refresh control in the CycleHeader title row, before the Pin button"
    - "Clicking it refetches cycle detail, runs and the status map, and then the cycle summaries, step summary and the Jira defect issues of the fresh runs. KPI tiles, burndown, Executions and Defects tabs all show fresh data"
    - "While a refresh is in flight the icon spins (animate-spin) and the button is disabled"
  artifacts:
    - path: "taskflow/src/lib/aio-refresh.ts"
      provides: "refreshAioCycleList and refreshAioCycleDetail invalidation helpers (upstream-first ordering)"
      exports: ["refreshAioCycleList", "refreshAioCycleDetail"]
    - path: "taskflow/src/lib/aio-refresh.test.ts"
      provides: "Unit tests for the key sets, the ordering and the defect predicate"
  key_links:
    - from: "taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx"
      to: "refreshAioCycleList"
      via: "Refresh button onClick"
      pattern: "refreshAioCycleList\\("
    - from: "taskflow/src/routes/dashboard/AioCycleDetailPage.tsx"
      to: "refreshAioCycleDetail"
      via: "onRefresh prop passed to CycleHeader"
      pattern: "refreshAioCycleDetail\\("
---

<objective>
Add a Refresh button to the AIO Test cycles page (AioProjectOverviewPage) and to the AIO cycle detail page (AioCycleDetailPage via CycleHeader). Reuse the app's existing refresh-button markup exactly.

Discovery findings, so the executor does not need to look again:
- There is NO shared RefreshButton component or useRefresh hook. Every page inlines the same markup. The canonical version is in BacklogPage.tsx (around lines 1321-1342) and SprintBoardTab.tsx (around lines 1696-1718):
  - a `<span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>`, where lastRefreshed is `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}` or '' when dataUpdatedAt is 0
  - a `<button type="button">` with className `inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors`, with `disabled` while fetching, and with aria-label and title both set
  - inside it, `<RefreshCw className={fetching ? 'size-3 animate-spin' : 'size-3'} />` from lucide-react
  Copy this markup verbatim. Do not create a new component, a new style or a text label.
- Cycles page query keys (all in AioProjectOverviewPage.tsx): ['aio', base, 'folders', pk], ['aio', base, 'cycle-count', pk], ['aio', base, 'project-config', pk] (status config, feeds initializeAioStatusMap), ['aio', base, 'cycles-detail', pk, selectedFolderID] (needs the folders and count-map data), ['aio', base, 'cycle-summaries', pk, allIDs.join(',')] (its key comes from the cycles-detail data). The owner user-by-username queries and the project-numeric-id query are identity/static and are left alone.
- Detail page query keys: useAioCycleData gives ['aio', base, 'cycle-detail', pk, ck], ['aio', base, 'status-map-init', pk], ['aio', base, 'cycle-summaries', pk, String(numericId)] and ['aio', base, 'runs', pk, ck]. useCycleStepStats gives ['aio', base, 'cycle-step-summary', pk, String(numericId)]. useCycleDefects gives ['jira', base, 'issue-lightweight', <NUMERIC defect id string>], derived from runs[].jiraDefectIDs. The child components (CycleKpiTiles, CycleBurndown, ExecutionsList, DefectsList, DefectSummary) have no queries of their own. They render from these hooks.
- Upstream staleness (MEMORY: enrichment invalidation no-op): the summaries are keyed by the cycle IDs and the defects by the runs' jiraDefectIDs. Invalidating them in parallel with their upstream can refetch against stale inputs. So the helpers await the upstream invalidation first, and only then invalidate the derived queries. For defects, the fresh runs are read from the cache after the runs refetch settles.

Purpose: users can pull fresh AIO data without a reload or navigating away.
Output: one tested helper module, plus the Refresh controls wired into both pages.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
@taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
@taskflow/src/routes/dashboard/aio-cycle/useAioCycleData.ts
@taskflow/src/routes/dashboard/aio-cycle/useCycleDefects.ts
@taskflow/src/lib/issue-lightweight-cache.ts

Repo layout: .planning and git are at the outer taskflow/. src, npm, vitest and biome run from the inner taskflow/taskflow/. The pre-commit hook runs the full vitest suite plus biome plus tsc, so each test goes in the same commit as its implementation.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: aio-refresh helpers (upstream-first invalidation) with unit tests</name>
  <files>taskflow/src/lib/aio-refresh.ts, taskflow/src/lib/aio-refresh.test.ts</files>
  <behavior>
    - refreshAioCycleList(qc, base, pk) runs in three awaited stages. Stage 1: invalidate ['aio', base, 'folders', pk], ['aio', base, 'cycle-count', pk] and ['aio', base, 'project-config', pk] together. Stage 2: ['aio', base, 'cycles-detail', pk] (prefix, which covers every selected folder). Stage 3: ['aio', base, 'cycle-summaries', pk] (prefix). The test asserts the call order: no stage-3 call starts before the stage-2 promise resolves.
    - refreshAioCycleDetail(qc, { jiraBaseUrl, projectKey, cycleKey }) has two stages. Stage 1 (awaited, together): ['aio', base, 'cycle-detail', pk, ck], ['aio', base, 'runs', pk, ck] and ['aio', base, 'status-map-init', pk]. Stage 2 (together): ['aio', base, 'cycle-summaries', pk] (prefix), ['aio', base, 'cycle-step-summary', pk] (prefix), and ['jira', base, 'issue-lightweight'] with a predicate.
    - The defect predicate takes its ids from qc.getQueryData(['aio', base, 'runs', pk, ck]) read AFTER stage 1 resolves. It flattens run.jiraDefectIDs mapped to String, skipping empty values, and matches when String(query.queryKey[3]) is in that set. Test: seed runs with jiraDefectIDs [101, 202] after stage 1. The predicate is true for queryKey ['jira', base, 'issue-lightweight', '101'] and false for '999'.
    - When there are no runs or no defect ids, the issue-lightweight invalidation is skipped (no call, or a predicate that matches nothing). Either is fine; assert it does not invalidate unrelated issues.
    - Both helpers return Promise<void> and resolve after every stage settles. invalidateQueries resolves even when a refetch errors, so there is no try/catch needed beyond what the callers do.
  </behavior>
  <action>
    Create taskflow/src/lib/aio-refresh.ts exporting refreshAioCycleList(queryClient: QueryClient, jiraBaseUrl: string | null | undefined, projectKey: string): Promise<void>, and refreshAioCycleDetail(queryClient: QueryClient, args: { jiraBaseUrl: string | null | undefined; projectKey: string; cycleKey: string }): Promise<void>. Implement them exactly as the behavior block says. Use queryClient.invalidateQueries with the default refetchType ('active'), so inactive cached keys are only marked stale. Use Promise.all inside a stage and await between stages.

    Add a JSDoc explaining the upstream-first ordering. The derived keys (summaries keyed by cycle IDs, defects keyed by runs' jiraDefectIDs) must be invalidated after their source has refetched, or they refetch against stale inputs. Also note that the issue-lightweight keys are NUMERIC Jira ids, not issue keys (see issue-lightweight-cache.ts). Type the runs read as AioTestRun[] from '@/services/aio'.

    Write taskflow/src/lib/aio-refresh.test.ts with vitest and a real QueryClient. Spy on invalidateQueries with vi.spyOn, and make each spied call return a deferred promise so the test controls when each stage resolves. The test asserts:
    - the filters (queryKey arrays) per stage;
    - the stage ordering (stage-2 calls are absent until the stage-1 promises resolve);
    - the defect predicate, by calling the captured predicate with fake { queryKey, state } objects.
    Seed the runs with queryClient.setQueryData between stages.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/aio-refresh.test.ts</automated>
  </verify>
  <done>Both helpers are exported. The tests cover the key sets, the stage ordering and the defect predicate, and they pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire the Refresh control into the Test cycles page and the cycle detail header</name>
  <files>taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx, taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx</files>
  <behavior>
    - Overview page: a button named "Refresh cycles" renders in the "Test cycles" header. Clicking it calls queryClient.invalidateQueries with a cycles-detail filter for the project (spy on the QueryClient passed to QueryClientProvider in the test).
    - Detail page: a button named "Refresh cycle" renders in the cycle header. Clicking it invalidates ['aio', base, 'runs', pk, ck].
    - While the refresh promise is pending, the button is disabled and its svg has the animate-spin class.
  </behavior>
  <action>
    Use a local refresh state in each page. Add `const [refreshing, setRefreshing] = useState(false)`. The onClick handler sets it true, awaits the helper, and resets it in finally. Use the `refreshing` flag for the spinner and for `disabled`, instead of OR-ing per-query isFetching. The helper awaits every stage, including defects and summaries, so the spinner covers the whole chain.

    AioProjectOverviewPage.tsx: in the header row (currently `flex flex-shrink-0 items-baseline gap-3 ...` with the h1 and the projectKey span), append a right-aligned group `<div className="ml-auto flex items-center gap-2 self-center">`. It holds the lastRefreshed span and the button, copied verbatim from the BacklogPage markup described in the objective, with aria-label and title "Refresh cycles". lastRefreshed comes from cyclesWithDetailQuery.dataUpdatedAt and follows the Backlog format ('' when 0). onClick calls `void handleRefresh()`, which is guarded by `if (!projectKey) return` and calls refreshAioCycleList(queryClient, jiraBaseUrl, projectKey). The page already has queryClient. Leave the existing onRetry handlers unchanged.

    CycleHeader.tsx: add the props onRefresh: () => void, refreshing: boolean and lastRefreshed: string. In the title row, wrap the existing Pin Button in `<div className="flex flex-none items-center gap-2">`. Put the lastRefreshed span first, then the refresh button (verbatim Backlog markup, aria-label and title "Refresh cycle"), then the unchanged Pin Button. The narrow-layout preference applies: the span stays `hidden sm:inline`, and nothing wraps or stacks.

    AioCycleDetailPage.tsx: import useState and refreshAioCycleDetail. Add a handleRefresh that is guarded on projectKey and cycleKey and calls refreshAioCycleDetail(queryClient, { jiraBaseUrl, projectKey, cycleKey }). Compute lastRefreshed from runsQuery.dataUpdatedAt in the Backlog format. Pass onRefresh, refreshing and lastRefreshed to CycleHeader. Do not touch the skeleton gating: invalidation keeps the cached data, so cycleQuery.isLoading stays false and the page does not flash a skeleton.

    Tests: add the behavior cases to the existing page test files, reusing their makeClient and render helpers. Hold a reference to the client and spy on its invalidateQueries. If existing tests query all buttons by role or count them, update those queries rather than changing production markup.

    Gates: run the targeted tests, then tsc and biome on the changed files only. Do NOT run biome --write on all of src. MEMORY: the biome baseline drifts, so the gate is "no new files flagged".
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/aio-refresh.test.ts src/routes/dashboard/AioProjectOverviewPage.test.tsx src/routes/dashboard/AioCycleDetailPage.test.tsx && npx tsc --noEmit && npx biome check src/lib/aio-refresh.ts src/lib/aio-refresh.test.ts src/routes/dashboard/AioProjectOverviewPage.tsx src/routes/dashboard/aio-cycle/CycleHeader.tsx src/routes/dashboard/AioCycleDetailPage.tsx</automated>
  </verify>
  <done>Both pages show the Backlog-style Refresh control: the 'Refreshed:' text plus a size-3 RefreshCw icon button. Clicking it runs the helper, the icon spins and the button is disabled until all stages settle. The targeted tests, tsc and biome on the changed files pass. The work is committed as one commit with the tests included.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client to AIO/Jira REST | Refresh re-issues existing authenticated GETs/POSTs; no new endpoints or inputs |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-qez-01 | Denial of Service | Refresh button spam | mitigate | The button is disabled while the `refreshing` promise is pending, so repeated clicks cannot stack refetch chains |
| T-qez-02 | Information Disclosure | n/a | accept | No new data surfaces. The same credentialed queries are refetched |
</threat_model>

<verification>
- The targeted vitest files pass, `tsc --noEmit` is clean, and biome flags no new diagnostics in the changed files.
- grep check: `grep -n "RefreshCw" src/routes/dashboard/AioProjectOverviewPage.tsx src/routes/dashboard/aio-cycle/CycleHeader.tsx` finds both, each with the `size-3` / `animate-spin` className used by BacklogPage.
</verification>

<success_criteria>
- Refresh controls on both AIO pages match the existing Backlog/Sprint Board markup exactly.
- Every query each page renders from is refetched, with derived queries (summaries, defects) refetched only after their upstream sources.
- No skeleton flash on refresh. The spinner and disabled state last until the whole chain settles.
</success_criteria>

<output>
Create `.planning/quick/261029-qez-add-refresh-button-to-aio-cycles-and-cyc/261029-qez-SUMMARY.md` when done
</output>
