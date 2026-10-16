---
status: resolved
trigger: "there is a bug on aio tc detail page, the Execution Distribution graph shows empty on reload page. after the data gets loaded, page update renders it correctly. so the problem is only when lazy loaded data"
created: 2026-10-16
updated: 2026-10-16
---

## Symptoms

- **Expected:** On the AIO test case detail page, the "Execution Distribution" chart renders its data on a fresh page load / reload.
- **Actual:** After a reload the chart is empty. Once the data has loaded and the page re-renders for some other reason (any page update), the chart renders correctly.
- **Errors:** none reported.
- **Timeline:** unknown; noticed now.
- **Reproduction:** open an AIO test case detail page, reload the page (cold cache) → Execution Distribution graph empty. Data that arrives lazily (async) is not reflected until a subsequent re-render.
- **Follow-up from user (2026-10-16):** The other charts on the page work and show a skeleton loader while loading; only Execution Distribution lacks one. The fix must include a skeleton loader for this chart, matching the existing charts' skeleton component/pattern. Both a matching skeleton AND the chart rendering once the data lands are required.
- **Follow-up 2 (2026-10-16):** User verified the skeleton shows, but its timing differed from the other charts (revealed earlier than Burndown and Defects).

## Hints (from project memory — verify, don't assume)

- Module map mount-order dep: AIO status map is populated only by the overview page mount; deep-link/reload leaves it empty → consumers must init it via a query, not rely on another page's effect.
- Reactive cache-read: imperative getQueryData()/module-level map reads in render are non-reactive.
- Query-key churn blink / container-size: recharts ResponsiveContainer with 0 size on first mount can also render empty until a re-render.
- App code lives in inner taskflow/taskflow/ (src, npm, vitest, biome).

## Current Focus

hypothesis: CONFIRMED: React Compiler memoized summaryCounts on summaryDistribution only; the status map was read through a hidden module lookup (normalizeStatusById)
next_action: none (resolved, user verified)

## Evidence

- First pass (cycle detail page): countsLoading/hasSummaryData treated a settled-but-unusable summary as final; AioCycleDetailPage.tsx and aio-cycle/useAioCycleData.ts changed, 2 regression tests added (failed before, pass after).
- Main session applied follow-up: ExecutionDonut in aio-cycle/CycleKpiTiles.tsx now uses loading={countsLoading || !runs}, so it reveals together with Burndown and Defects. The Pass-rate tile still shows early from the summary.
- Test 'progress bar renders from cycle summary while runs are still loading' updated to expect exec-donut-skeleton.
- Dashboard suite passes (1478), biome clean. tsc failed only on an untracked scratch file src/routes/dashboard/Scratch.test.tsx; it no longer exists on disk (verified), so it cannot block the pre-commit hook.

## Eliminated

- Recharts donut mount itself (renders slices immediately in a scratch test).
- Status-map race (already handled by waitingForStatusMap and status-map-init query).

## Resolution

root_cause: The app builds with React Compiler (vite.config.ts); vitest does not. The compiler memoized summaryCounts in useAioCycleData keyed only on summaryDistribution (`if ($[64] !== summaryDistribution)`), treating normalizeStatusById as pure, but it reads a mutable module-level status map. On cold reload the summary landed before the status map, every ID resolved to 'notRun', and the stale result survived the re-render when the map arrived. The donut showed a grey ring with "0/N executed" until a refetch produced a new summary object. The earlier passes (settled-empty summary, skeleton timing) were real but secondary.
fix: initializeAioStatusMap returns the map (null on failure/empty); the status-map-init query returns it (throws when unusable); summaryCounts reads statusMap directly, so the compiler tracks it as a dependency. hasSummaryData requires non-zero summary counts (falls back to runs otherwise). ExecutionDonut loading={countsLoading || !runs} so it reveals with Burndown/Defects (user request). waitingForStatusMap/aioStatusMapReady removed as redundant.
verification: User verified in the app. Regression test 'recomputes summary counts when the status map arrives after the summary' run through a temporary React Compiler vitest config: original hook → "0/3executed" (fails), fixed hook → passes; without the compiler the original hook passes (why tests never caught it). Full suite 3767 passed, biome + tsc clean.
files_changed: [taskflow/src/lib/aioUtils.ts, taskflow/src/routes/dashboard/aio-cycle/useAioCycleData.ts, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx]
follow_up: Running the whole suite under React Compiler fails 4 tests (EpicDetailSheet.test.tsx EPIC-03-A/B, IssueDetailSheet.test.tsx ISSUE-01 open/close). Unrelated to this fix; worth investigating before switching vitest to the compiler.

## Update 2026-10-16 (second pass)
- Only 'Execution Distribution' in src is CycleKpiTiles on AioCycleDetailPage ("tc" = test cycle); page is right.
- ExecutionDonut already uses AioDonutSkeleton (same as defect donuts) while countsLoading; jsdom cold-load orderings (summary-first, runs-first, config-last) all go skeleton -> donut with 3 paths. Recharts static size path fine.
- Remaining data-driven cause (unconfirmed live): summary with totalTests>0 but absent/empty testRunDistribution -> hasSummaryData true, zero counts, empty ring until refetch. Fix: hasSummaryData requires summed distribution > 0 (useAioCycleData.ts). Test added; red pre-fix, green post-fix. Full dashboard suite, biome, tsc clean.
