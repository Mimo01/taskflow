# Phase 56: Redesign AIO Cycles Page, Optimize AIO Loading Performance, Add Defects and Executions Views - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three improvements to the existing AIO feature set:

1. **Redesign the AIO cycles page** (`AioProjectOverviewPage.tsx`) — add per-cycle summary stats (progress bar + pass/fail/blocked/not-run counts) with progressive loading per row. Satisfies AION-03.
2. **Add Executions and Defects tabs to cycle detail** (`AioCycleDetailPage.tsx`) — reorganize the page into a tabbed layout (Executions | Defects). Executions tab = current run table with clickable rows linking to `AioTestRunDetailPage`. Defects tab = enriched defect list with Jira issue title + status + source test case. Satisfies AIOC-03 (promoted to full tab).
3. **Optimize AIO token loading** — extract the `useEffect + readSecret('jira-pat')` waterfall repeated in 3+ AIO pages into a shared `useAioCredentials()` hook.

No new routes beyond what already exists. No write actions. No changes to the AIO service layer endpoints.

</domain>

<decisions>
## Implementation Decisions

### Cycles page redesign
- **D-01:** Each cycle row shows a mini progress bar + pass/fail/blocked/not-run counts. The progress bar mirrors the existing full-size bar on `AioCycleDetailPage` — same color scheme (green/red/orange/muted). *(Claude's discretion — user deferred)*
- **D-02:** Column layout: Key (mono) | Name (NavLink) | Status badge | Progress bar + counts. No date column — `AioCycle` type does not carry a date field and adding one requires unverified API fields. *(Claude's discretion)*
- **D-03:** **Progressive loading.** The cycle list renders immediately from the existing `fetchAioCycles` call. Each row fires its own `useQuery(['aio', jiraBaseUrl, 'runs', projectKey, cycle.key], ...)` for run stats; counts fill in as responses arrive. A skeleton bar (e.g., `<Skeleton className="h-1.5 w-full" />`) is shown per row until its stats query resolves. This avoids blocking the cycle list on N run fetches.
- **D-04:** The stats computation per row reuses the exact same `counts` reduction already in `AioCycleDetailPage.tsx` (`normalizeStatus` → `{ pass, fail, blocked, notRun }` accumulator). The researcher should confirm whether `fetchAioTestRunsForCycle` is the correct call or if a lighter count-only endpoint exists.

### Cycle detail: tabs layout
- **D-05:** `AioCycleDetailPage` gets a tab bar immediately below the progress section (which stays visible above all tabs). Two tabs: **Executions** and **Defects**. Default active tab: **Executions**. *(Claude's discretion — user deferred)*
- **D-06:** Tab component: shadcn `<Tabs>` primitive from `taskflow/src/components/ui/tabs.tsx` (already used in Settings pages). `Tabs.Root` wraps both the progress section and tab bar. `Tabs.List` renders the two triggers. `Tabs.Content` contains each view.
- **D-07:** The filter chips toolbar (NOT_EXECUTED / PASS / FAIL / BLOCKED) moves into the Executions tab, above the run table. It does not appear on the Defects tab.

### Executions tab
- **D-08:** Executions tab = the existing run table (Test Case | Status | Date) promoted to a tab. Each row is now **clickable** and navigates to `AioTestRunDetailPage` (`/aio-cycle/:projectKey/:cycleKey/run/:runId`). The `breadcrumbStore` push pattern from `AioCycleDetailPage` and `IssueDetailPage` applies here (push current cycle entry before navigating to run detail).
- **D-09:** Run rows use `<NavLink>` or a click handler — planner picks the cleanest approach given how `AioCycleDetailPage` currently uses `useBreadcrumbStore`. Do not change the run detail page itself.

### Defects tab
- **D-10:** Defects tab shows each unique defect key enriched with Jira issue data: **key** (mono, NavLink to `/issue/:key`) | **title** (from `fetchJiraIssueByKey` or `fetchIssueSummary`) | **status chip** | **triggered by** (test case key(s) derived from `run.defects` — no extra API call needed).
- **D-11:** Each defect row fires a `useQuery` for its Jira issue data. Defect counts per cycle are small (typically < 20). Use `fetchJiraIssueByKey` which already exists at `taskflow/src/services/jira/issues.ts`. *(Claude's discretion — user deferred to option 1 "Key + title + status")*
- **D-12:** "Triggered by" column: list the `testCaseKey` values from runs that carry this defect key in their `defects[]` array. Derived from the already-fetched runs data — no additional API call. Each key links to its execution row in the Executions tab (or planner uses plain text if linking across tabs is complex).
- **D-13:** If `allDefects.length === 0` for the cycle, the Defects tab shows the `<EmptyState>` component: "No defects" / "No defects are linked to runs in this cycle."

### Token loading optimization
- **D-14:** Create `taskflow/src/hooks/useAioCredentials.ts` exporting a single hook:
  ```ts
  function useAioCredentials(): { token: string | null; isLoading: boolean }
  ```
  The hook encapsulates `useState<string | null>(null)` + `useState<boolean>(true)` + `useEffect(() => { readSecret('jira-pat').then(setToken).catch(() => setToken(null)).finally(() => setIsLoading(false)); }, [])`.
- **D-15:** All three AIO pages (`AioProjectOverviewPage`, `AioCycleDetailPage`, `AioTestRunDetailPage`) replace their inline `useEffect + readSecret` with `const { token, isLoading } = useAioCredentials()`. `useQuery.enabled` gates on `!!jiraBaseUrl && !!token && !isLoading` (the `!isLoading` guard prevents a brief flash where `token === null` with `isLoading === false`).
- **D-16:** Any new AIO components added in this phase (cycle row stats component, defect row component) also use `useAioCredentials()` — they do NOT pass the token as a prop from the page. *(Actually this is a planner decision — if the token is already loaded in the parent page component, prop-drilling from the page is fine and avoids redundant Stronghold reads. Planner picks the cleanest approach.)*

### Claude's Discretion
- Visual design of the mini progress bar on cycle rows: narrow (h-1.5 or h-2) horizontal bar, same green/red/orange/muted color scheme. Counts shown as small text below or to the right of the bar.
- The exact `Tabs.Root`/`Tabs.List` layout — whether the tab bar sits flush with the progress section border or has a small padding gap. Follow the visual rhythm of `Settings` pages (which use the same `<Tabs>` component).
- Whether clicking a run row in the Executions tab uses `<NavLink>` on the `<tr>` (with `cursor-pointer` class) or a `useNavigate()` + `onClick` handler. Planner picks the approach that doesn't break keyboard navigation.
- `useAioCredentials` placement — `src/hooks/` is the natural home. If a `src/hooks/index.ts` barrel exists, add the export there.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior AIO phase contexts (primary references)
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-04/D-09: credential loading pattern (`readSecret('jira-pat')`), `['aio', jiraBaseUrl, ...]` query key prefix, `AioPage<T>` wrapper, `aioFetch()` base path. Foundation for all AIO service calls.
- `.planning/phases/52-aio-navigation-project-pages/52-CONTEXT.md` — routing conventions (`/aio-project/:projectKey`, `/aio-cycle/:projectKey/:cycleKey`), sidebar gating, breadcrumb push pattern.
- `.planning/phases/53-cycle-detail-header-pinning/53-CONTEXT.md` — cycle detail page patterns, status chip style, `useDelayedLoading`, `usePinnedTabsStore`, `useBreadcrumbStore`.
- `.planning/phases/55-aio-project-selection-in-settings/55-CONTEXT.md` — `selectedAioProjectKey` in settings, sidebar deep-link to `/aio-project/:projectKey`. Confirms that Phase 56 pages are still reached from the same routes.

### Files under edit (primary)
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` — cycles page; redesign target. Add per-cycle stats rows with progressive loading.
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — cycle detail page; add tabs, move filter chips into Executions tab, add clickable run rows, add Defects tab.
- `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` — may need updates for the new cycle-row stats skeleton state.

### Files under edit (new)
- `taskflow/src/hooks/useAioCredentials.ts` — NEW hook. Extracts `useEffect + readSecret` pattern.

### AIO service layer (read-only for this phase)
- `taskflow/src/services/aio/types.ts` — `AioCycle`, `AioTestRun`, `AioPage<T>`. Researcher should verify if any new field (e.g., date on cycle) is needed and whether it can be added without breaking existing consumers.
- `taskflow/src/services/aio/cycles.ts` — `fetchAioCycles()`, `fetchAioCycleDetail()`. Used by the cycles page and cycle detail page.
- `taskflow/src/services/aio/issue-runs.ts` — `fetchAioTestRunsForCycle()`. Used for per-cycle stats rows on the redesigned cycles page.
- `taskflow/src/services/aio/index.ts` — Barrel. Add any new exports here.

### Jira service (for defects enrichment)
- `taskflow/src/services/jira/issues.ts` — `fetchJiraIssueByKey`. Used by the Defects tab to enrich each defect key with title + status. Researcher should confirm the return shape includes `summary` and `status.name`.
- `taskflow/src/services/jira.ts` line 24 — barrel re-export of `fetchJiraIssueByKey`.

### UI primitives
- `taskflow/src/components/ui/tabs.tsx` — shadcn `<Tabs>` component. Used for the Executions | Defects tab bar on cycle detail.
- `taskflow/src/components/ui/skeleton.tsx` — `<Skeleton>` for per-row stats loading state on cycles page.
- `taskflow/src/components/ui/badge.tsx` — status chips (existing pattern from cycle detail).
- `taskflow/src/components/ui/empty-state.tsx` — "No defects" state for the Defects tab.

### Existing pages used as patterns
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — `normalizeStatus`, counts reduction, filter chips, progress bar, `useBreadcrumbStore` push. Direct analog to copy from.
- `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` — route params `{ projectKey, cycleKey, runId }`. Target of the clickable run rows in the Executions tab.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.8 — AION-03 (per-cycle summary stats), AIOC-03 (defects list, enriched). Phase 56 covers both.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)` (`aio/issue-runs.ts`): Existing paginated run fetcher. Used for per-cycle stats on the redesigned cycles page. Each cycle row fires one call.
- `fetchAioCycles(baseUrl, token, projectKey)` (`aio/cycles.ts`): Existing call; cycles page already uses it. No change needed.
- `fetchAioCycleDetail(baseUrl, token, projectKey, cycleKey)` (`aio/cycles.ts`): Already used in cycle detail. No change.
- `fetchJiraIssueByKey` (`services/jira/issues.ts`): Existing Jira issue fetch. Defects tab fires one per defect key.
- `useDelayedLoading` hook: 200ms flicker prevention. All AIO pages use it; cycle detail continues to use it.
- `<Skeleton>` (`ui/skeleton.tsx`): Per-row stats loading placeholder on cycles page.
- `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` (`ui/tabs.tsx`): Tab primitives for cycle detail.
- `<EmptyState>` (`ui/empty-state.tsx`): Already used in `AioProjectOverviewPage` and `AioCycleDetailPage`. Re-used for Defects tab empty state.
- `aioCycleStatusBadgeClass`, `aioRunStatusBadgeClass` (`lib/statusStyles.ts`): Status chip color classes. Defects tab uses `aioRunStatusBadgeClass` for run status, Jira status chip styled the same way as elsewhere in issue detail.

### Established Patterns
- **Stats reduction (from `AioCycleDetailPage.tsx`):** `(runs ?? []).reduce((acc, run) => { const norm = normalizeStatus(run.status); acc[norm]++; return acc; }, { pass:0, fail:0, blocked:0, notRun:0 })`. Copy verbatim or extract to a shared util.
- **Progress bar color scheme:** green-500 (pass) / red-500 (fail) / orange-400 (blocked) / bg-muted (notRun). Same classes on cycles page mini bars.
- **AIO query key prefix:** `['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]` (Phase 51). Per-row stats queries reuse this key, meaning cycle detail already has the data cached after first visit.
- **Credential loading (current):** `useEffect(() => { readSecret('jira-pat').then(setToken).catch(() => null); }, [])`. Replaced by `useAioCredentials()` in all AIO pages.
- **Breadcrumb push before navigate:** `useBreadcrumbStore.getState().push({ label: cycleName, path: currentPath })` before `navigate(runDetailPath)`. Run row clicks in Executions tab follow this pattern.
- **shadcn Tabs usage:** Settings pages (`AppearanceSection.tsx` or similar) use `<Tabs>` — planner should read one for the exact import and layout pattern before implementing.

### Integration Points
- `AioProjectOverviewPage.tsx`: Each cycle row gains a child component (e.g., `<CycleStatsRow cycleKey={cycle.key} />`) or inline `useQuery` for stats. The outer page continues to call `fetchAioCycles`.
- `AioCycleDetailPage.tsx`: Wrap existing content in `<Tabs.Root defaultValue="executions">`. Move filter chips + run table into `<TabsContent value="executions">`. Add `<TabsContent value="defects">` with defect-enrichment logic.
- `useAioCredentials.ts` (new): Drop-in replacement for 3 existing `useEffect + readSecret` blocks. Same return shape as today's `[token, setToken]` but structured as `{ token, isLoading }`.
- Routes: No new routes needed. Executions tab links to existing `/aio-cycle/:projectKey/:cycleKey/run/:runId` (or the run detail path — researcher should confirm the exact route pattern from `routes.tsx`).

</code_context>

<specifics>
## Specific Ideas

- Mini progress bar on cycle rows: narrow (h-1.5) horizontal bar, same green/red/orange/muted scheme as the full-size bar. Counts text sits below the bar as `text-xs text-muted-foreground`, matching the style in `AioCycleDetailPage`.
- Executions tab run rows: clickable full row (not just a link column) with `cursor-pointer` hover style matching the existing `hover:bg-muted/30` pattern. Clicking navigates to `AioTestRunDetailPage` with the breadcrumb pushed.
- Defects tab layout: table with columns Key | Title | Status | Triggered By. Each key is a `<NavLink to="/issue/:key">`. Status chip uses the existing Jira status badge pattern from the issue detail pages.
- `useAioCredentials` is a leaf hook — no dependencies on Zustand or React Query. Pure `useState + useEffect + readSecret`. Easily testable in isolation.

</specifics>

<deferred>
## Deferred Ideas

- **Pre-loading AIO token into `useAuthStore` at app startup** — user explicitly chose the shared hook over this approach. If perceived performance remains a concern after Phase 56 ships (noticeable delay on first AIO page visit), a Phase 57 can upgrade to store-level pre-loading without changing consumers of `useAioCredentials`.
- **Route-level pre-loading (loader pattern)** — the React Router `loader` approach was considered and deferred for the same reason.
- **Date column on cycles page** — `AioCycle` doesn't carry a date field today. Could be added in a future phase once the AIO API's date fields are probed (researcher should note if a `createdDate` or `updatedDate` is visible on the raw cycle response).
- **Total run count column** — derivable from the run stats but adds visual noise. Deferred; the progress bar + counts already communicate total implicitly.
- **Executions tab: executor/tester column** — showing who ran each test requires verifying an `executor` or `assignee` field on `AioTestRun`. Not asked for in this phase; deferred if the API exposes it.
- **Multi-image lightbox for defect attachments** — out of scope; deferred from Phase 54.
- **Write actions on defects (add/remove defect links)** — AIOWR-02; deferred per REQUIREMENTS.md.

</deferred>

---

*Phase: 56-redesign-aio-cycles-page-optimize-aio-loading-performance-ad*
*Context gathered: 2026-05-14*
