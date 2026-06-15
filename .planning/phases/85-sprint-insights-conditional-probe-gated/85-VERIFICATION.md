---
phase: 85-sprint-insights-conditional-probe-gated
verified: 2026-06-15T19:05:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "parseBurndownChanges returns ascending-timestamp points anchored at startTime, clamped non-negative (V5 defensive parse) per INSIGHT-02"
    status: failed
    reason: "The function exists and its ordering/non-negativity properties are technically true, but it anchors the series at remaining:0 and accumulates deltas upward from zero instead of seeding running from the actual committed sprint scope. This means the burndown line starts at 0 and climbs before descending — the opposite of a remaining-work burndown. The unit test only asserts timestamp order and non-negativity; it never pins a concrete remaining value. The 'ideal' Line element in BurndownChart.tsx also has no data because parseBurndownChanges never derives the workRateData guideline despite the code comment claiming it does. The shape rendered is a net-cumulative-delta line, not a remaining-work burndown."
    artifacts:
      - path: "taskflow/src/routes/dashboard/dashboardMetrics.ts"
        issue: "parseBurndownChanges line 364: seeds { t: startTime, remaining: 0 } and running = 0. The anchor should reflect the initial committed scope (sum of the first 'added' entries), not zero. The chart will display an upward-sloping shape until scope fully clears, never a classic top-left-to-bottom-right burndown."
      - path: "taskflow/src/routes/dashboard/dashboardMetrics.test.ts"
        issue: "parseBurndownChanges test (lines 521-539) only asserts timestamps and non-negativity. It never asserts that points[1].remaining == 28800 after the add-entry, or that points[2].remaining == 0 after the complete-entry. The incorrect remaining:0 seed would still pass all existing assertions."
      - path: "taskflow/src/routes/dashboard/BurndownChart.tsx"
        issue: "Line element with dataKey='ideal' (lines 146-154) always renders zero data because parseBurndownChanges returns BurndownPoint with only {t, remaining} — no 'ideal' key. The comment attributes this to 'workRateData derivation in parseBurndownChanges' but that derivation was never implemented."
    missing:
      - "parseBurndownChanges must seed 'running' from the initial committed scope (sum of statC.newValue for entries where oldValue===0 or added===true at the earliest timestamps), then accumulate decrements as work completes — so points[0].remaining equals the sprint's total initial estimate and the line descends toward zero."
      - "The unit test must assert concrete remaining values (e.g. after the add-entry remaining=28800; after the complete-entry remaining=0) to pin the curve shape, not just ordering."
      - "Either implement the workRateData → ideal guideline derivation (adding an 'ideal' key to BurndownPoint and computing it from workRateData rate data), or remove the dead <Line dataKey='ideal'> from BurndownChart.tsx."

  - truth: "A runtime fetch error surfaces the ChartWrapper error/retry state and never blanks the Dashboard [velocity section — criterion 2 independent error state]"
    status: failed
    reason: "VelocityChart.tsx only passes sprintsError (the closed-sprints list query error) to ChartWrapper. The per-sprint useQueries fan-out errors are never inspected: sprintIssueQueries[i].error is not read anywhere, and no fanoutError variable exists. A 500 or timeout on any per-sprint fetch silently maps those sprints to 0 SP (fetchSprintIssuesBySprintId returns [] on !res.ok), causing them to drop from qualifyingSprints. The user sees either a distorted chart or 'Not enough sprint data' with no error indication and no retry affordance — violating criterion 2's 'independent loading/error state' requirement for the velocity section."
    artifacts:
      - path: "taskflow/src/routes/dashboard/VelocityChart.tsx"
        issue: "Lines 74-107: useQueries fan-out queries are mapped but only q.isLoading is checked (line 92). q.error is never collected. ChartWrapper receives error={sprintsError} only — per-sprint fetch failures are silently swallowed as empty data."
      - path: "taskflow/src/services/jira.ts"
        issue: "fetchSprintIssuesBySprintId line 2570: returns [] on !res.ok, making a failed sprint indistinguishable from an empty sprint upstream."
    missing:
      - "Collect fanout errors: const fanoutError = sprintIssueQueries.find((q) => q.error)?.error"
      - "Pass the combined error to ChartWrapper: error={sprintsError ?? fanoutError ?? null}"
      - "Provide a combined retry handler: onRetry={() => { void refetchSprints(); sprintIssueQueries.forEach((q) => void q.refetch()); }}"
      - "Gate series computation on all queries succeeding (not just settling): allQueriesSettled && !fanoutError before computing velocitySeries"
human_verification:
  - test: "Open the Dashboard with an active Jira connection. Confirm the Sprint Insights row (VelocityChart + BurndownChart) renders at the bottom below Activity and Releases."
    expected: "Two chart cards render side-by-side (or stacked on narrow screens) in a grid-cols-1 lg:grid-cols-2 gap-4 row."
    why_human: "Cannot verify visual layout or chart card presence without running the application in a browser."
  - test: "If 3+ closed sprints with personal SP exist: verify the Personal Velocity BarChart shows committed (faint) and completed (solid) bars per sprint, with sprint names on the X-axis."
    expected: "Grouped bar chart with 'Committed' (var(--chart-1) at 40% opacity) and 'Completed' (var(--chart-2) solid) legend entries. X-axis labels are sprint names."
    why_human: "Visual rendering and correct data mapping require runtime browser inspection."
  - test: "Verify the Sprint Burndown chart Y-axis shows hour values (e.g. '8h', '16h') not story-point values, and the tooltip shows 'Xh Ym' format."
    expected: "Y-axis tick labels end with lowercase 'h'; tooltip shows remaining in hours+minutes format (e.g. '7h 30m')."
    why_human: "Y-axis and tooltip content can only be verified at runtime in a browser."
  - test: "Verify the burndown line shape: it should start near the full sprint estimate and decrease toward zero over time (classic top-left to bottom-right shape), not climb from zero."
    expected: "The 'Remaining' area chart begins at the sprint's committed estimate and decreases as work is completed."
    why_human: "Requires a live Jira DC connection with burndown data. Also directly verifies CR-01 (the anchor bug identified in the review) in the actual rendered output — automated tests do not cover the curve shape."
  - test: "While on the Dashboard, cut the Jira connection (e.g. disconnect network or change the token). Confirm the burndown card shows its own error/retry state but the velocity card (if loaded) remains visible."
    expected: "BurndownChart card shows an error state with retry button. VelocityChart and all other Dashboard sections remain rendered (independent degradation D-09)."
    why_human: "Runtime network failure simulation cannot be automated in grep-based verification."
---

# Phase 85: Sprint Insights (Conditional — Probe-Gated) Verification Report

**Phase Goal:** Before writing any chart code, run live probes of the closed-sprint REST endpoint and the GreenHopper burndown endpoint on the real Jira DC instance; build each chart only if its probe confirms the data is obtainable at acceptable cost; cleanly omit any chart whose probe fails without affecting the rest of the Dashboard.

**Verified:** 2026-06-15T19:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase begins with documented probe results written to the phase context file before implementation | ✓ VERIFIED | 85-CONTEXT.md `<probe_results>` section records Probe A (PASS), Probe B (PASS), Probe C (PASS) with dates, specific data shapes confirmed, and PO cost approval — all dated 2026-06-15 before implementation |
| 2 | If INSIGHT-01 probe succeeds: personal velocity chart renders committed vs completed SP across last N closed sprints; data via fetchClosedSprints + fetchSprintIssuesBySprintId; staleTime: Infinity; independent loading/error state | PARTIAL | fetchClosedSprints and fetchSprintIssuesBySprintId are correctly wired with staleTime: Infinity. VelocityChart renders the BarChart with the correct series. However, per-sprint fetch errors are silently swallowed (CR-02) — the section's error state only covers the closed-sprint list query, not the fan-out. This violates the 'independent loading/error state' sub-requirement. |
| 3 | If INSIGHT-01 probe fails: velocity chart cleanly omitted, no error surfaced, code comment documents the probe outcome | ✓ VERIFIED | Probe passed so this path is the runtime fallback. VelocityChart contains the D-10 probe-outcome comment. The component is unconditionally built; runtime absence is handled via ChartWrapper error/empty states. The phase-context file records the probe pass. |
| 4 | If INSIGHT-02 burndown probe succeeds: sprint burndown chart renders for active sprint; degrades independently if endpoint unavailable mid-session | PARTIAL | BurndownChart.tsx exists, fetches via fetchBurndown with staleTime: 30_000, and degrades independently via ChartWrapper. However, parseBurndownChanges seeds remaining at 0 instead of the committed sprint scope, producing an incorrect cumulative-delta line (CR-01). The `<Line dataKey="ideal">` renders no data because the ideal field is never computed. The chart renders but shows mathematically incorrect burndown shape. |
| 5 | If INSIGHT-02 burndown probe fails: burndown chart cleanly omitted, decision documented in phase context file | ✓ VERIFIED | Probe passed so this path is the runtime fallback. 85-CONTEXT.md documents probe outcome. BurndownChart uses isEmpty={!hasBurndownData} so an empty-changes response cleanly shows the ChartWrapper empty state. |

**Score:** 3/5 truths fully verified (2 partially met — one with a correctness defect, one with incomplete error propagation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/dashboardMetrics.ts` | computePersonalVelocitySeries, parseBurndownChanges, formatHoursMinutes, VelocityPoint, BurndownPoint | ✓ VERIFIED | All five exports confirmed at lines 258, 296, 327, 348, 272. D-03 comment present verbatim. V5 defenses present (changes ?? {}, ?? 0, Math.max). Anchor seeded at remaining:0 — incorrect but code exists. |
| `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` | 7 mandated Vitest tests — all passing | ✓ VERIFIED | All 40 tests pass including all 7 Phase 85 tests. However parseBurndownChanges test does not pin concrete remaining values (known gap from IN-04 in review). |
| `taskflow/src/routes/dashboard/VelocityChart.tsx` | Personal velocity BarChart, props-only, staleTime: Infinity, independent error state | PARTIAL | File exists (170 lines), 'use no memo', props-only, staleTime: Infinity, D-10 comment, correct chart structure. Per-sprint fan-out errors not surfaced to ChartWrapper (CR-02). |
| `taskflow/src/routes/dashboard/BurndownChart.tsx` | Active-sprint burndown AreaChart, hours Y-axis, independent error state | PARTIAL | File exists (161 lines), correct structure, hours Y-axis (/3600 conversion), staleTime: 30_000, independent error. parseBurndownChanges anchor defect makes rendered shape incorrect. `ideal` Line has no data. |
| `taskflow/src/services/jira.ts` | fetchClosedSprints, fetchSprintIssuesBySprintId barrel exports | ✓ VERIFIED | Both functions at lines 2499, 2553. fetchClosedSprints uses slice(-n), PAGE=50 pagination, terminates on isLast/short-page. fetchSprintIssuesBySprintId uses Set dedup, never hardcodes customfield_10106. |
| `taskflow/src/lib/concurrency.ts` | getVelocityLimit() — dedicated pLimit(3) | ✓ VERIFIED | module-level const velocityLimit = pLimit(3); getVelocityLimit() returns it. Separate from getJiraLimit()'s pLimit(6), unaffected by setJiraConcurrencyLimit. |
| `taskflow/src/services/jira/greenhopper/burndown.ts` | fetchBurndown with apiPath='' override | ✓ VERIFIED | File exists. greenhopperFetch called with 5th arg '' (empty string), full rapid-charts path, data.ts error envelope mirrored. No hardcoded boardId/sprintId. |
| `taskflow/src/routes/dashboard/index.tsx` | Sprint Insights row with VelocityChart + BurndownChart in grid-cols-1 lg:grid-cols-2 gap-4 | ✓ VERIFIED | Both components imported and rendered at lines 282-304. Grid layout present. boardId from useBoardId. activeSprintId from cache-deduped fetchActiveSprint with matching queryKey. No literal 6708. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| dashboardMetrics.ts | formatHoursMinutes | export | ✓ WIRED | Exported at line 258; WeeklyTrendChart imports from ./dashboardMetrics (no local copy) |
| VelocityChart.tsx | fetchClosedSprints / fetchSprintIssuesBySprintId | useQuery + useQueries | ✓ WIRED | Both imported from @/services/jira, used in query functions |
| VelocityChart.tsx | computePersonalVelocitySeries | import from ./dashboardMetrics | ✓ WIRED | Called at line 94 when all queries settled |
| VelocityChart.tsx | ChartWrapper error state | sprintsError only | PARTIAL | sprintsError wired; fanout errors from useQueries are not collected or surfaced |
| BurndownChart.tsx | fetchBurndown | useQuery queryFn | ✓ WIRED | Imported from @/services/jira, called in queryFn. Not direct greenhopperFetch call. |
| BurndownChart.tsx | parseBurndownChanges + formatHoursMinutes | import from ./dashboardMetrics | ✓ WIRED | Both imported and used. parseBurndownChanges called at line 73; formatHoursMinutes at line 123 |
| BurndownChart.tsx | ideal Line | parseBurndownChanges | NOT_WIRED | BurndownPoint has no 'ideal' field; workRateData never parsed; Line renders empty |
| index.tsx | BurndownChart + VelocityChart | Sprint Insights row | ✓ WIRED | Both imported and rendered with correct props at lines 289-302 |
| index.tsx | activeSprintId | cache-deduped fetchActiveSprint queryKey | ✓ WIRED | queryKey ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId] matches SprintHealthSection |
| greenhopper/burndown.ts | greenhopperFetch | apiPath='' | ✓ WIRED | 5th argument is '' (empty string), confirmed in file |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| VelocityChart.tsx | velocitySeries | computePersonalVelocitySeries ← useQueries fan-out ← fetchSprintIssuesBySprintId | Yes (real Jira issues fetched per sprint) | ✓ FLOWING |
| BurndownChart.tsx | burndownPoints | parseBurndownChanges ← fetchBurndown ← greenhopperFetch | Yes (real GreenHopper response) but computed incorrectly (anchor at 0 not committed scope) | HOLLOW — data flows but shape is wrong |
| BurndownChart.tsx | ideal (Line) | parseBurndownChanges | No — BurndownPoint has no ideal field, workRateData never consumed | DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 7 mandated Vitest tests pass | `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose` | 40/40 passed | ✓ PASS |
| parseBurndownChanges anchor value | Read dashboardMetrics.ts lines 363-365 | Seeds `{ t: startTime, remaining: 0 }` and `running = 0` | ✗ FAIL — should seed from initial committed scope |
| VelocityChart fan-out error surfacing | `grep -n "fanoutError\|sprintIssueQueries.*error\|q\.error" VelocityChart.tsx` | No output | ✗ FAIL — per-sprint errors not inspected |
| BurndownChart hours Y-axis (no SP) | `grep "/ 3600\|Math.round.*3600" BurndownChart.tsx` | `Math.round(v / 3600)h` at line 114; `formatHoursMinutes(v / 3600)` at line 123 | ✓ PASS |
| No hardcoded boardId 6708 in implementation files | `grep -c "6708" BurndownChart.tsx VelocityChart.tsx index.tsx burndown.ts` | 0 occurrences | ✓ PASS |
| fetchClosedSprints tail selection | `grep "slice(-n)" jira.ts` | line 2529: `return allSprints.slice(-n)` | ✓ PASS |
| getVelocityLimit distinct from getJiraLimit | `grep "velocityLimit\|pLimit(3)" concurrency.ts` | Separate module-level const, separate from Limit variable | ✓ PASS |
| No debt markers (TBD/FIXME/XXX) | grep on all 5 modified files | 0 occurrences | ✓ PASS |

### Probe Execution

No probe script is declared in the PLAN must_haves for this phase. The probe harness (`probe.sh`) was run by the research phase (pre-execution) and its results are documented in 85-CONTEXT.md. The phase goal requires that probes be run and documented before implementation — this is verified by the presence of `<probe_results>` in 85-CONTEXT.md with 2026-06-15 dates predating the implementation commits.

| Probe | Status |
|-------|--------|
| Probe A — closed-sprint REST endpoint (INSIGHT-01a) | DOCUMENTED PASS in 85-CONTEXT.md |
| Probe B — SP field on closed-sprint issues (INSIGHT-01b) | DOCUMENTED PASS in 85-CONTEXT.md |
| Probe C — GreenHopper burndown endpoint (INSIGHT-02) | DOCUMENTED PASS in 85-CONTEXT.md |
| PO cost approval | DOCUMENTED APPROVED in 85-CONTEXT.md |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INSIGHT-01 | 85-01, 85-02, 85-03 | Personal velocity trend (committed vs completed SP, last N closed sprints, ≥3 guard, cleanly omitted if probe fails) | PARTIAL | Velocity chart built, data layer wired, ≥3 guard implemented. Per-sprint fetch error not surfaced (CR-02). The 'cleanly omitted on probe fail' path is implemented as runtime degradation. |
| INSIGHT-02 | 85-01, 85-02, 85-04 | Sprint burndown chart (GreenHopper endpoint, cleanly omitted if probe fails) | PARTIAL | Burndown chart built, fetcher wired with correct path/error-envelope, independent degradation present. parseBurndownChanges produces incorrect cumulative-delta shape (CR-01), not remaining-work burndown. ideal guideline always empty (dead wiring). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| dashboardMetrics.ts | 364 | `{ t: startTime, remaining: 0 }` — burndown anchor at zero | BLOCKER | Chart renders cumulative-delta upward slope, not remaining-work burndown. Misleads user about sprint progress. |
| dashboardMetrics.ts | 364-365 | `running = 0` — accumulator seeded at zero instead of committed sprint scope | BLOCKER | Same root cause as above. |
| dashboardMetrics.test.ts | 521-539 | parseBurndownChanges test asserts only timestamps and non-negativity, never concrete remaining values | WARNING | Defect masked — test passes despite incorrect computation. |
| BurndownChart.tsx | 146-154 | `<Line dataKey="ideal">` — references field that does not exist in BurndownPoint | WARNING | Dead chart element, misleading comment. Always renders zero data. |
| VelocityChart.tsx | 74-107 | useQueries fan-out errors never collected | WARNING | Per-sprint fetch failures silently degrade to empty data, violating independent error-state requirement. |

### Human Verification Required

#### 1. Visual Sprint Insights Row Layout

**Test:** Open Dashboard with a live Jira connection. Scroll to the bottom and confirm the Sprint Insights row (two chart cards) appears below Activity and Releases.
**Expected:** Two cards side-by-side on desktop (grid-cols-2 on lg screens), stacked on mobile. Each card has a title header, loading state while data fetches.
**Why human:** Visual layout cannot be verified by grep.

#### 2. Personal Velocity Chart — Data Rendering

**Test:** If ≥3 closed sprints with personal story points exist, confirm the BarChart shows committed (faint bar, behind) and completed (solid bar, front) for each sprint with sprint names on X-axis.
**Expected:** Grouped BarChart with two bars per sprint. Legend shows "Committed" and "Completed". Chart is not empty.
**Why human:** Correct data mapping and chart rendering require a live browser session with real Jira data.

#### 3. Burndown Chart Y-Axis Unit

**Test:** With an active sprint, confirm the burndown Y-axis ticks show values like "8h", "16h" and the tooltip shows "Xh Ym" format — not raw seconds or story points.
**Expected:** Y-axis labels end with lowercase 'h'. Tooltip shows formatted hours+minutes.
**Why human:** Axis and tooltip rendering require browser execution.

#### 4. Burndown Chart Shape (CR-01 runtime verification)

**Test:** With the burndown chart rendered for an active sprint, verify the "Remaining" area starts at approximately the full sprint estimate and decreases over time, not starting near zero and climbing.
**Expected:** The area chart begins at or near the total remaining hours and curves downward toward zero (or current remaining) over the sprint timeline.
**Why human:** This specifically tests whether the parseBurndownChanges anchor bug (CR-01) manifests in the rendered chart or whether real GreenHopper data happens to work around it. Cannot be determined without live data.

#### 5. Velocity Error Independence

**Test:** After the velocity chart loads, disable network access and trigger a manual refetch. Confirm the velocity card shows an error/retry state without affecting the burndown card.
**Expected:** Velocity card shows ChartWrapper error state with retry button. Burndown card (if loaded) remains visible and functional.
**Why human:** Network failure simulation requires browser DevTools.

## Gaps Summary

Two blockers found:

**CR-01 (BLOCKER) — parseBurndownChanges anchor defect:** The burndown parser seeds the series at `remaining: 0` and accumulates deltas from zero upward. A genuine burndown starts at the full committed scope and decreases. The rendered burndown chart shape is mathematically incorrect. The unit test does not pin concrete remaining values, so the defect ships green. This violates success criterion 4 ("burndown chart renders for active sprint") because the chart renders incorrect data, not accurate remaining-work information.

**CR-02 (BLOCKER) — Velocity fan-out errors silently swallowed:** VelocityChart passes only the closed-sprint list error to ChartWrapper. Per-sprint useQueries errors (from fetchSprintIssuesBySprintId returning [] on failure) are never inspected. A failed per-sprint fetch is indistinguishable from an empty sprint, silently corrupting the velocity sums and potentially showing "Not enough sprint data" when data exists. This violates success criterion 2's "independent loading/error state" requirement for the velocity section.

**WR-01 (WARNING) — ideal guideline is dead wiring:** The `<Line dataKey="ideal">` in BurndownChart.tsx always renders empty because parseBurndownChanges never produces an `ideal` field. The comment attributes this to "workRateData derivation" that does not exist.

The two blockers share a single fix path for CR-01 (rewrite the parseBurndownChanges anchor and add a value-asserting test) and an additive fix for CR-02 (collect fanoutError from useQueries and wire it to ChartWrapper). These are contained changes to two files and do not require structural rework.

---

_Verified: 2026-06-15T19:05:00Z_
_Verifier: Claude (gsd-verifier)_
