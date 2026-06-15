---
phase: 85-sprint-insights-conditional-probe-gated
verified: 2026-06-15T19:15:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "parseBurndownChanges anchor defect (CR-01): cumulative-delta model retained and documented; non-finite epoch keys now filtered; BurndownPoint gains optional ideal field; linear ideal guideline derived (peak scope → 0 at endTime) and wired through BurndownChart via burndownRaw.endTime; dead <Line dataKey='ideal'> now has data; tests pin concrete remaining ([0, 28800, 0]) and ideal ([28800, 21600, 7200]) values, plus clamp and no-window cases — 44/44 tests pass"
    - "Velocity fan-out error swallowing (CR-02): fanoutError = sprintIssueQueries.find((q) => q.error)?.error ?? null now collected at VelocityChart.tsx line 90; ChartWrapper receives error={sprintsError ?? fanoutError}; onRetry refetches sprint list AND all per-sprint queries"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open the Dashboard with an active Jira connection. Confirm the Sprint Insights row (VelocityChart + BurndownChart) renders at the bottom below Activity and Releases."
    expected: "Two chart cards render side-by-side on desktop (lg:grid-cols-2), stacked on mobile. Each card has a title header and loading state while data fetches."
    why_human: "Visual layout cannot be verified by grep."
  - test: "If 3+ closed sprints with personal SP exist, confirm the Personal Velocity BarChart shows committed (faint bar) and completed (solid bar) per sprint with sprint names on X-axis."
    expected: "Grouped BarChart with 'Committed' (var(--chart-1) at 40% opacity) and 'Completed' (var(--chart-2) solid) legend entries. X-axis labels are sprint names."
    why_human: "Correct data mapping and chart rendering require a live browser session with real Jira data."
  - test: "Verify the Sprint Burndown chart Y-axis shows hour values (e.g. '8h', '16h') and the tooltip shows 'Xh Ym' format."
    expected: "Y-axis tick labels end with lowercase 'h'. Tooltip shows formatted hours+minutes (e.g. '7h 30m')."
    why_human: "Axis and tooltip rendering require browser execution."
  - test: "Verify the burndown line shape: the 'Remaining' area should start near the full sprint estimate and descend toward zero, and the dashed 'Ideal' guideline should be visible from peak scope to 0 at sprint end."
    expected: "Area chart begins at committed scope and curves downward. Dashed guideline overlays the expected linear pace. This is the runtime confirmation of CR-01 fix correctness against live GreenHopper DC data."
    why_human: "Requires a live Jira DC connection with burndown data. GreenHopper .changes field semantics are MEDIUM-confidence (executor flagged); user accepted residual risk. Only real data confirms the cumulative-delta model reconstructs the expected shape."
  - test: "While on the Dashboard, cut the Jira connection (e.g. change the token). Confirm the burndown card shows its own error/retry state but the velocity card (if loaded) remains visible. Then confirm the velocity card also shows an error/retry state independently."
    expected: "Each chart card shows ChartWrapper error state with retry button independently. Other Dashboard sections remain rendered (independent degradation D-09)."
    why_human: "Network failure simulation cannot be automated in grep-based verification."
---

# Phase 85: Sprint Insights (Conditional — Probe-Gated) Verification Report

**Phase Goal:** Before writing any chart code, run live probes of the closed-sprint REST endpoint and the GreenHopper burndown endpoint on the real Jira DC instance; build each chart only if its probe confirms the data is obtainable at acceptable cost; cleanly omit any chart whose probe fails without affecting the rest of the Dashboard.

**Verified:** 2026-06-15T19:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure in commit f8a3faba (two blockers addressed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase begins with documented probe results written to the phase context file before implementation | VERIFIED | 85-CONTEXT.md `<probe_results>` section records Probe A (PASS), Probe B (PASS), Probe C (PASS) with 2026-06-15 dates, specific data shapes, and PO cost approval — all predating implementation commits |
| 2 | INSIGHT-01 velocity chart: committed vs completed SP via fetchClosedSprints + fetchSprintIssuesBySprintId; staleTime: Infinity; independent loading/error state (criterion 2) | VERIFIED | fetchClosedSprints and fetchSprintIssuesBySprintId wired with staleTime: Infinity. fanoutError collected at VelocityChart.tsx line 90 (`sprintIssueQueries.find((q) => q.error)?.error ?? null`). ChartWrapper receives `error={sprintsError ?? fanoutError}`. onRetry refetches both sprint list and all per-sprint queries. Per-sprint errors no longer silently map to empty data. |
| 3 | INSIGHT-01 omission path: cleanly omitted with no error surfaced if probe fails; code comment documents outcome | VERIFIED | Probe passed so runtime fallback applies. D-10 probe-outcome comment present in VelocityChart.tsx. Independent degradation via ChartWrapper. Phase context records probe pass. |
| 4 | INSIGHT-02 burndown chart for active sprint; degrades independently if endpoint unavailable mid-session (criterion 4) | VERIFIED | BurndownChart.tsx exists. parseBurndownChanges cumulative-delta model retained and documented with block comment explaining GreenHopper scopechangeburndownchart semantics. Non-finite epoch keys filtered. BurndownPoint.ideal field added. Linear ideal guideline derived from peak remaining at startTime → 0 at endTime. BurndownChart now passes burndownRaw.endTime to parseBurndownChanges. `<Line dataKey="ideal">` now has data when a sprint window exists. 44/44 tests pass including concrete-value assertions for remaining ([0, 28800, 0]) and ideal ([28800, 21600, 7200]). ChartWrapper handles independent error/retry. |
| 5 | INSIGHT-02 omission path: cleanly omitted, decision documented (criterion 5) | VERIFIED | Probe passed so runtime fallback applies. 85-CONTEXT.md records probe outcome. isEmpty={!hasBurndownData} in BurndownChart gives clean ChartWrapper empty state when changes is empty. |

**Score:** 5/5 truths verified

### Gaps Closed Since Previous Verification

**CR-01 (previously BLOCKER) — parseBurndownChanges anchor:**

Prior state: seeded `{ t: startTime, remaining: 0 }` and `running = 0`. The BurndownPoint type had no `ideal` field. The `<Line dataKey="ideal">` rendered empty data. Tests only asserted timestamp ordering and non-negativity.

Fix verified in dashboardMetrics.ts lines 327-418:
- BurndownPoint now declares `ideal?: number` with a full JSDoc explanation (lines 327-339)
- parseBurndownChanges block comment (lines 342-369) documents the cumulative-delta model and explicitly instructs against "fixing" it to monotone — the model is correct for GreenHopper's delta-keyed format
- Non-finite epoch key filter added (`Number.isFinite(n)`) at line 385
- Seed remains `remaining: 0` intentionally — the first change entry will raise remaining to the committed scope (correct for cumulative-delta interpretation)
- Ideal guideline computed at lines 408-415: `peak = max(p.remaining)`, then per-point `ideal = peak * (1 - clamp(frac, 0, 1))`
- BurndownChart.tsx now passes `burndownRaw.endTime` as third argument (line 81), enabling the guideline

Test assertions (dashboardMetrics.test.ts lines 521-574) now pin:
- `remaining` values: `[0, 28800, 0]` (add 28800s → complete → 0)
- `ideal` values with window: `[28800, 21600, 7200]`
- `ideal` undefined with no window / degenerate window (endTime <= startTime)
- Clamp case: over-decrement stays at 0

All 44 tests pass (previously 40 — 4 new parseBurndownChanges tests added).

**CR-02 (previously BLOCKER) — Velocity fan-out error swallowing:**

Prior state: VelocityChart only passed `sprintsError` (closed-sprint list error) to ChartWrapper. `sprintIssueQueries[i].error` was never read. Failed per-sprint fetches silently returned `[]`, making a failed sprint indistinguishable from an empty sprint.

Fix verified in VelocityChart.tsx lines 87-133:
- Line 90: `const fanoutError = sprintIssueQueries.find((q) => q.error)?.error ?? null;`
- Line 128: ChartWrapper receives `error={sprintsError ?? fanoutError}`
- Lines 130-133: onRetry calls `void refetchSprints()` plus `for (const q of sprintIssueQueries) void q.refetch()`
- Explanatory comment (lines 87-90) documents the CR-02 motivation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/dashboardMetrics.ts` | computePersonalVelocitySeries, parseBurndownChanges, formatHoursMinutes, VelocityPoint, BurndownPoint (with ideal field) | VERIFIED | All exports present. BurndownPoint.ideal field added with JSDoc. parseBurndownChanges derives ideal guideline when endTime provided. Non-finite key filter in place. 44/44 tests pass. |
| `taskflow/src/routes/dashboard/dashboardMetrics.test.ts` | parseBurndownChanges tests with concrete remaining + ideal values | VERIFIED | 5 parseBurndownChanges tests: concrete remaining ([0,28800,0]), ideal values ([28800,21600,7200]), clamp, no-window, null-input. All pass. |
| `taskflow/src/routes/dashboard/VelocityChart.tsx` | Personal velocity BarChart, staleTime: Infinity, fanoutError collected, ChartWrapper wired to combined error | VERIFIED | fanoutError at line 90; ChartWrapper error={sprintsError ?? fanoutError}; combined retry handler; D-10 comment present. |
| `taskflow/src/routes/dashboard/BurndownChart.tsx` | Active-sprint burndown AreaChart, hours Y-axis, ideal Line with data, independent error state | VERIFIED | parseBurndownChanges called with burndownRaw.endTime (line 81). ideal Line (lines 152-160) now has data when sprint window present. Hours Y-axis (/3600). Independent ChartWrapper error/retry. |
| `taskflow/src/services/jira.ts` | fetchClosedSprints, fetchSprintIssuesBySprintId barrel exports | VERIFIED | Both functions present (verified in prior run, no changes to jira.ts in this commit) |
| `taskflow/src/lib/concurrency.ts` | getVelocityLimit() — pLimit(3) separate from getJiraLimit() | VERIFIED | Unchanged from prior verification — still passing |
| `taskflow/src/services/jira/greenhopper/burndown.ts` | fetchBurndown with apiPath='' override | VERIFIED | Unchanged from prior verification — still passing |
| `taskflow/src/routes/dashboard/index.tsx` | Sprint Insights row with VelocityChart + BurndownChart in grid-cols-1 lg:grid-cols-2 gap-4 | VERIFIED | Unchanged from prior verification — still passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| VelocityChart.tsx | ChartWrapper error state | `sprintsError ?? fanoutError` | VERIFIED | Combined error passes sprint-list AND per-sprint errors to ChartWrapper |
| VelocityChart.tsx | per-sprint refetch on retry | `q.refetch()` in onRetry | VERIFIED | `for (const q of sprintIssueQueries) void q.refetch()` at lines 132-133 |
| BurndownChart.tsx | ideal Line | `burndownRaw.endTime` → parseBurndownChanges | VERIFIED | endTime passed at line 81; BurndownPoint.ideal populated; Line dataKey="ideal" renders data |
| BurndownChart.tsx | parseBurndownChanges + formatHoursMinutes | import from ./dashboardMetrics | VERIFIED | Both imported and used — unchanged |
| All other links from prior verification | (see prior report) | | VERIFIED | No regressions detected |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| VelocityChart.tsx | velocitySeries | computePersonalVelocitySeries ← useQueries fan-out ← fetchSprintIssuesBySprintId | Yes — real Jira issues; errors now surfaced | VERIFIED |
| BurndownChart.tsx | burndownPoints | parseBurndownChanges ← fetchBurndown ← greenhopperFetch | Yes — real GreenHopper response; cumulative-delta model documented | VERIFIED |
| BurndownChart.tsx | ideal (Line) | parseBurndownChanges ← burndownRaw.endTime | Yes when sprint window present; undefined otherwise (chart hides Line) | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All parseBurndownChanges tests pass (including new concrete-value assertions) | `cd taskflow && npx vitest run src/routes/dashboard/dashboardMetrics.test.ts --reporter=verbose` | 44/44 passed | PASS |
| fanoutError collected from useQueries | `grep -n "fanoutError" VelocityChart.tsx` | Line 90: `const fanoutError = sprintIssueQueries.find((q) => q.error)?.error ?? null;` | PASS |
| ChartWrapper receives combined error | `grep -n "sprintsError.*fanoutError\|fanoutError.*sprintsError" VelocityChart.tsx` | Line 128: `error={sprintsError ?? fanoutError}` | PASS |
| onRetry refetches per-sprint queries | `grep -n "q.refetch" VelocityChart.tsx` | Line 132: `for (const q of sprintIssueQueries) void q.refetch()` | PASS |
| BurndownChart passes endTime to parseBurndownChanges | `grep -n "endTime" BurndownChart.tsx` | Line 81: `burndownRaw.endTime` as third argument | PASS |
| BurndownPoint.ideal field defined | `grep -n "ideal" dashboardMetrics.ts` | Lines 336-339: `ideal?: number` in BurndownPoint interface; lines 408-415: derivation | PASS |
| ideal Line element present | `grep -n "dataKey.*ideal\|ideal.*dataKey" BurndownChart.tsx` | Line 154: `dataKey="ideal"` | PASS |
| Non-finite key filter added | `grep -n "isFinite" dashboardMetrics.ts` | Line 385: `.filter((n) => Number.isFinite(n))` | PASS |
| Hours Y-axis (no SP) | `grep "/ 3600" BurndownChart.tsx` | Lines 119, 128 | PASS |
| No hardcoded boardId | `grep -c "6708" VelocityChart.tsx BurndownChart.tsx` | 0 occurrences | PASS |
| No debt markers (TBD/FIXME/XXX) | grep on modified files | 0 occurrences | PASS |

### Anti-Patterns Found

No new anti-patterns. All previously identified blockers resolved:

| Item | Previous Status | Current Status |
|------|----------------|----------------|
| parseBurndownChanges anchor at zero | BLOCKER | RESOLVED — model documented, ideal guideline added, tests pin values |
| VelocityChart fan-out errors swallowed | BLOCKER | RESOLVED — fanoutError collected and wired to ChartWrapper |
| `<Line dataKey="ideal">` dead wiring | WARNING | RESOLVED — BurndownPoint.ideal field added, endTime wired through |
| parseBurndownChanges test only asserts ordering/non-negativity | WARNING | RESOLVED — tests now pin concrete remaining and ideal values |

### Residual Acknowledgment

The executor flagged `.changes` field semantics in the GreenHopper scopechangeburndownchart response as MEDIUM-confidence. The cumulative-delta interpretation (scope additions raise remaining, completions lower it) is documented in the parseBurndownChanges block comment and retained as the correct reconstruction model. The user accepted the residual risk that live DC data could reveal edge cases in field semantics. Human verification item 4 covers runtime confirmation.

### Human Verification Required

#### 1. Visual Sprint Insights Row Layout

**Test:** Open the Dashboard with an active Jira connection. Scroll to the bottom and confirm the Sprint Insights row (two chart cards) appears below Activity and Releases.
**Expected:** Two cards side-by-side on desktop (grid-cols-2 on lg screens), stacked on mobile. Each card has a title header and loading state while data fetches.
**Why human:** Visual layout cannot be verified by grep.

#### 2. Personal Velocity Chart — Data Rendering

**Test:** If 3+ closed sprints with personal SP exist, confirm the Personal Velocity BarChart shows committed (faint bar, behind) and completed (solid bar, front) for each sprint with sprint names on the X-axis.
**Expected:** Grouped BarChart with two bars per sprint. Legend shows "Committed" and "Completed". Chart is not empty.
**Why human:** Correct data mapping and chart rendering require a live browser session with real Jira data.

#### 3. Burndown Chart Y-Axis Unit

**Test:** With an active sprint, confirm the burndown Y-axis ticks show values like "8h", "16h" and the tooltip shows "Xh Ym" format — not raw seconds or story points.
**Expected:** Y-axis labels end with lowercase 'h'. Tooltip shows formatted hours+minutes (e.g. "7h 30m").
**Why human:** Axis and tooltip rendering require browser execution.

#### 4. Burndown Chart Shape + Ideal Guideline (CR-01 runtime confirmation)

**Test:** With the burndown chart rendered for an active sprint, verify (a) the "Remaining" area starts near the full sprint estimate and decreases over time, and (b) a dashed "Ideal" guideline is visible from the peak scope down to 0 at sprint end.
**Expected:** Area chart begins at or near the total remaining hours and curves downward. Dashed guideline overlays the expected linear pace. The cumulative-delta model should produce a descending curve on a normal sprint where scope is committed at activation and burned down from there.
**Why human:** Requires a live Jira DC connection with burndown data. The GreenHopper .changes field semantics are MEDIUM-confidence; user accepted this residual risk. Only live data confirms the model reconstructs the expected shape.

#### 5. Velocity and Burndown Error Independence

**Test:** After both chart sections load, disable network access or change the Jira token. Trigger a retry on the velocity card. Confirm the velocity card shows an error/retry state without affecting the burndown card, and vice versa.
**Expected:** Each chart card shows ChartWrapper error state with retry button independently. Other Dashboard sections remain rendered (independent degradation D-09).
**Why human:** Network failure simulation requires browser DevTools. Also confirms the fanoutError fix (CR-02) surfaces correctly at runtime.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INSIGHT-01 | 85-01, 85-02, 85-03 | Personal velocity trend (committed vs completed SP, last N closed sprints, ≥3 guard, cleanly omitted if probe fails, independent error state) | VERIFIED | Velocity chart built, data layer wired, ≥3 guard implemented, fanoutError now collected and surfaced — criterion 2 independent error state fully satisfied |
| INSIGHT-02 | 85-01, 85-02, 85-04 | Sprint burndown chart (GreenHopper endpoint, cleanly omitted if probe fails, independent degradation) | VERIFIED | Burndown chart built, fetcher wired with correct path/error-envelope, independent degradation present, parseBurndownChanges now derives correct cumulative-delta curve with ideal guideline |

---

_Verified: 2026-06-15T19:15:00Z_
_Re-verification: after commit f8a3faba (CR-01 + CR-02 gap closure)_
_Verifier: Claude (gsd-verifier)_
