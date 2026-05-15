# Phase 58 — UAT

Tested against `https://jira.orange.sk`, cycle `ESHOP-CY-1011` (48 runs), 2026-05-15.

## Mid-UAT Fix Applied

**Check #1 initially failed** — progress bar did not appear before runs table.

Root cause diagnosed via console diagnostics: `normalizeCycle()` in `cycles.ts` did not pass through `raw.ID`, so `cycleQuery.data.ID` was always `undefined`, `cycleNumericId` stayed `null`, and `summaryQuery` never fired. Fix: added `ID?: number` to `RawCycle`, `AioCycle`, and `normalizeCycle()`. Committed in `c232ff7`.

After fix: `summaryQuery` fires at ~0.38s (right after detail resolves), progress bar visible well before the 11s runs request completes.

## Check Results

| # | Check | Verdict | Notes |
|---|-------|---------|-------|
| 1 | Progress bar appears before runs table | ✅ | After fix — bar appears at ~0.4s, runs at ~11s |
| 2 | Initial load fires requests in correct order | ✅ | credGate→TRUE at +0.01s, cycleQuery at +0.38s, summaryQuery fires immediately after |
| 3 | Progress bar colours match status counts | ✅ | |
| 4 | In Progress segment shows for in-progress runs | ✅ | |
| 5 | Defects tab: exactly K Jira fetches for K unique defect IDs | ✅ | Component-level useQuery dedup confirmed |
| 6 | Defects tab Triggered-By column correct | ✅ | |
| 7 | Clicking defect key navigates to /issue/{key} | ✅ | |
| 8 | Hard-reload: no 401 flash | ✅ | credGate gates all queries |
| 9 | Zero requests with missing auth before page renders | ✅ | |
| 10 | Filter chips toggle / keyboard nav works | ✅ | |
| 11 | Pin/Unpin persists after refresh | ✅ | |
| 12 | Breadcrumb navigation correct | ✅ | |
| 13 | Row click and keyboard Enter navigate to run detail | ✅ | |
| 14 | Empty cycle shows "No test runs found" | ✅ | |
| 15 | Summary blocked → progress bar falls back to run counts | ✅ | Graceful degradation path verified |

## UAT Verdict

UAT_VERDICT: PASS
Cycle tested: ESHOP-CY-1011 (48 runs)
Closed cycle tested: ESHOP-CY-1011 (isClosed: true)
Date: 2026-05-15
