---
status: diagnosed
trigger: "ESHOP issue 393120 shows no executions in AIO test runs section but live traceability endpoint returns 2 impacted executions both in cycle ESHOP-CY-1011 (cycle ID 14041): testRun 263794 (ESHOP-TC-8477) and testRun 263793 (ESHOP-TC-8478)."
created: 2026-05-13T22:56:00Z
updated: 2026-05-13T23:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "AioTestRunsSection's 'primary cycle' partitioning routes BOTH runs (same cycle ESHOP-CY-1011) into `inCycleRefs`, then the `r.detail.steps.length > 0` filter at line 476 culls them when `testRunSteps[]` is empty (e.g. passing runs without step content). Result: `data.runs = []` and `data.impactedExecutions = []`, so defensive null-return at line 606 hides the entire section. ImpactedExecutionsList only renders for CROSS-cycle refs — same-cycle empty-step runs have no rendering path at all."
  confirming_evidence:
    - "User says both runs are in cycle ESHOP-CY-1011 (same cycle). Partitioning logic at AioTestRunsSection.tsx:408-425 sets primaryCycleKey to the most-frequent cycle key — when only one cycle is referenced, both items go to inCycleRefs (line 422). crossCycleRefs stays empty (line 423-425)."
    - "User reports testRunStatusID 53. Phase 52 Plan 52-05 SUMMARY line 73 confirms 'ESHOP uses 51=NotRun, 53=Passed, 54=Failed, 55=Blocked'. Both runs are PASSED. Probe B observed that this instance's testers often do not fill in actualResult on passing runs, and even leave testRunSteps[] empty for trivial passes."
    - "AioTestRunsSection.tsx:476 hard-filters in-cycle results by `r.detail.steps.length > 0`. Any in-cycle run with empty testRunSteps[] is dropped from data.runs entirely. There is NO secondary path that surfaces such runs as 'impacted executions' — the impactedExecutions path (line 491-496) only receives crossCycleResults."
    - "AioTestRunsSection.tsx:606 defensive null-return: `if (!hasInCycleRuns && !hasImpactedExecutions) return null` — when both arrays are empty, the section is HIDDEN ENTIRELY (matches user's silent empty-state observation: 'i dont see any executions there')."
    - "Cascade explanation for Gap 2 (AioAttachmentsGrid missing): the grid is rendered only when the section renders at all (line 631). The defensive null at line 606 short-circuits the whole render before the grid mounts. UAT note at 54-HUMAN-UAT.md lines 31-35 already hypothesised this cascade — confirmed."
  falsification_test: "Add console.log at AioTestRunsSection.tsx:430-438 to dump `inCycleResults` for issue 393120. Expected if hypothesis is correct: 2 entries, each with `detail.steps.length === 0` (or `detail === null`). If detail.steps.length > 0 for either, the hypothesis is wrong and we must investigate why StepTable still doesn't render. Alternatively: temporarily change line 476 from `.filter((r) => r.detail.steps.length > 0)` to no-op and reload — section should now appear with empty step tables."
  fix_rationale: "Either (a) widen the impactedExecutions path to include in-cycle runs with empty steps as well — so ImpactedExecutionsList renders ANY run linked to the issue regardless of cycle or steps, OR (b) drop the `steps.length > 0` filter and let StepTable render an empty body OR a 'No step data' inline state, OR (c) treat single-cycle traceability as 'all impacted executions' by default (skip primary-cycle partitioning when only one cycle is present)."
  blind_spots:
    - "Cannot directly inspect the live `fetchAioTestRunDetail` response for runs 263794/263793 without running the app — the hypothesis that `testRunSteps[]` is empty is INFERRED from Probe B's observation that this instance's testers skip step content on passing runs. The detail fetch could also be returning 404 (filtered at line 469-475 with same end result) — both branches lead to the same observable bug."
    - "Secondary hypothesis NOT eliminated: `item.test?.detail?.key` filter at projects.ts:73 could be discarding all defect-traceability items if the actual response shape differs from the assumed `test.detail.key` path. Probe C (54-PROBE-FINDINGS.md) confirmed the TOP-LEVEL keys include `test` but never confirmed `test.detail.key` is populated for defect items. No service-level unit test exists for fetchAioTraceabilityTestCases (projects.test.ts only covers fetchAioProjects). Plan-phase --gaps must add a probe to confirm `item.test.detail.key` shape before implementing the fix, OR add logging to confirm linkedTestCases.length > 0 at AioTestRunsSection.tsx:388."
    - "Tertiary hypothesis NOT eliminated: c_pId query param. User's verbatim live URL includes `?c_pId=13806` but the service code at projects.ts:62 does NOT send it. Probe C tested the endpoint without `c_pId` and got data, so the param is probably optional for the API itself, but worth a quick check via apiFetch debug-log capture."

## Symptoms

expected: When ESHOP issue has linked test cases but no runs in the latest active (primary) cycle, the `No test runs in active cycle` EmptyState is replaced with `ImpactedExecutionsList` — a compact list showing one row per impacted execution (test case key + title, cycle key, run ID, colored status chip), with chip colors driven by `detail.run.status` (PASS/FAIL/BLOCKED/NOT_EXECUTED).

actual: UI shows NO executions at all on the AIO test runs section. Live traceability endpoint at `/rest/aio-tcms/1.0/project/13806/traceability/defect/393120?c_pId=13806` returns 2 impacted executions: testRun 263794 — ESHOP-TC-8477, and testRun 263793 — ESHOP-TC-8478. Both in cycle ESHOP-CY-1011 (cycle ID 14041). testRunStatusID 53 (= "Passed" per Phase 52 status ID mapping). Cycle is active (endDate 2026-05-30, today 2026-05-14). Both linked to defect 393120 via testRunDefects[].defectID.

errors: None reported (silent empty state)

reproduction: Open issue ESHOP-393120 in tauri app (npm run tauri dev), look at AIO test runs section. Live API: GET /rest/aio-tcms/1.0/project/13806/traceability/defect/393120?c_pId=13806

started: discovered during 2026-05-14 UAT of Phase 54 (post 54-00 through 54-07)

## Eliminated

- hypothesis: "Base path mismatch — code uses /rest/aio-tcms-api/1.0/ but user URL uses /rest/aio-tcms/1.0/"
  evidence: "client.ts:16-17 exports BOTH paths. projects.ts:65 calls aioFetch with `AIO_PROJECTS_API_PATH` (= '/rest/aio-tcms/1.0') for the traceability endpoint — matches the user's verbatim URL. The /rest/aio-tcms-api/1.0/ path is used for other endpoints (testcycle, testrun, attachment) where it IS the correct base."
  timestamp: 2026-05-13T22:58:00Z

- hypothesis: "aioEnabled gate is OFF"
  evidence: "User states 'inline AIO images work' elsewhere in the app, which requires aioEnabled=true. The gate at AioTestRunsSection.tsx:572 would fail-fast if aioEnabled were false, and the missing section is consistent with that — but the user's contextual evidence rules it out."
  timestamp: 2026-05-13T22:59:00Z

## Evidence

- timestamp: 2026-05-13T22:58:00Z
  checked: "AIO service base path for traceability endpoint"
  found: "projects.ts:62-65 constructs `/project/${aioProjectId}/traceability/${type}/${jiraIssueNumericId}` and passes AIO_PROJECTS_API_PATH ('/rest/aio-tcms/1.0'). Matches user's verbatim URL — leading hypothesis from <debug_context> ruled out."
  implication: "Base path is correct. Look elsewhere for the bug."

- timestamp: 2026-05-13T22:58:30Z
  checked: "primary-cycle partitioning logic at AioTestRunsSection.tsx:408-425"
  found: "When all runs are in the same cycle (e.g., ESHOP-CY-1011 with 2 refs), cycleCounts becomes Map{ ESHOP-CY-1011 => 2 }; primaryCycleKey = 'ESHOP-CY-1011'; inCycleRefs gets BOTH refs; crossCycleRefs is empty. So the 'no-runs path' (ImpactedExecutionsList) is never triggered."
  implication: "The Gap 1 fix only handles CROSS-cycle runs as 'impacted executions'. Same-cycle runs always go through the StepTable rendering path, which requires non-empty steps."

- timestamp: 2026-05-13T22:59:00Z
  checked: "in-cycle steps filter at AioTestRunsSection.tsx:476"
  found: ".filter((r) => r.detail.steps.length > 0) — runs with empty testRunSteps[] are dropped from data.runs. No fallback rendering path for such runs in the inCycle branch."
  implication: "If both runs return empty testRunSteps[] (likely on passing runs per Probe B observation), data.runs becomes []. Combined with empty impactedExecutions, defensive null-return at line 606 fires."

- timestamp: 2026-05-13T22:59:30Z
  checked: "Phase 52 status ID mapping for ESHOP"
  found: "52-05-SUMMARY.md line 73: 'ESHOP uses 51=NotRun, 53=Passed, 54=Failed, 55=Blocked'. testRunStatusID 53 = Passed."
  implication: "Both runs are PASSED. Probe B noted this instance's testers often skip step content on passing runs ('actualResult: field absent entirely when not filled in'). Empty testRunSteps[] is highly plausible."

- timestamp: 2026-05-13T22:59:45Z
  checked: "service-level test coverage for fetchAioTraceabilityTestCases"
  found: "projects.test.ts only tests fetchAioProjects. NO unit test exists for fetchAioTraceabilityTestCases. The `item.test?.detail?.key` filter at projects.ts:73 is unverified at the unit level."
  implication: "Secondary hypothesis remains in play: if item.test.detail.key is not populated for defect items, all items get filtered out → linkedTestCases.length === 0 → null return at line 388. Plan-phase must include a probe step to dump the full item shape OR add temporary logging to AioTestRunsSection."

- timestamp: 2026-05-13T22:59:50Z
  checked: "cascade from Test 1 → Test 2 (Gap 2 AioAttachmentsGrid missing)"
  found: "AioAttachmentsGrid renders at AioTestRunsSection.tsx:631, AFTER the line-606 defensive null-return. If section returns null, grid never mounts. UAT note at 54-HUMAN-UAT.md:31-35 already hypothesised this cascade — confirmed by code trace."
  implication: "Fixing Test 1 (Gap 1) root cause will also fix Test 2 (Gap 2). The 'likely_cascades_from: 1' annotation in HUMAN-UAT is correct."

## Resolution

root_cause: |
  Two-part failure on the no-runs path for ESHOP-393120:

  1. PRIMARY (high confidence): When all traceability-linked runs are in a SINGLE cycle, the
     `primaryCycleKey` partitioning logic at AioTestRunsSection.tsx:408-425 puts every run
     into `inCycleRefs` and leaves `crossCycleRefs` empty. The Gap 1 ImpactedExecutionsList
     code path (line 629) is only reached when `crossCycleRefs` is non-empty — so same-cycle
     runs NEVER render as impacted executions. They MUST go through the StepTable path.

  2. CASCADING (high confidence): The StepTable path then hard-filters in-cycle runs by
     `r.detail.steps.length > 0` at line 476. Passing runs (testRunStatusID 53) on this
     ESHOP instance frequently have empty testRunSteps[] arrays — Probe B observed testers
     skip step content for trivial passes. Both runs are passed → both filtered out →
     data.runs = []. crossCycleRefs is empty → data.impactedExecutions = []. Defensive
     null-return at line 606 hides the entire section, which also suppresses
     AioAttachmentsGrid (cascade to Gap 2).

  The Gap 1 fix in Plan 54-07 was designed for the case where "linked test cases have
  runs only in NON-primary cycles" — but ESHOP-393120 is in the OPPOSITE case: linked
  runs are in the primary (only) cycle but have no step content. The contract of
  ImpactedExecutionsList ("renders one row per impacted execution regardless of cycle
  or step assignment") was not implemented for the single-cycle case.

fix: |
  Pending — diagnose-only mode.

  Recommended direction for plan-phase --gaps (any ONE of the three is sufficient):

  OPTION A — Widen ImpactedExecutionsList to cover BOTH in-cycle empty-steps and cross-cycle runs.
    Change: when an in-cycle run's `detail.steps.length === 0` OR detail === null, ALSO push it into impactedExecutions[] (not just data.runs[]).
    Render rule: ImpactedExecutionsList shown whenever data.runs is empty AND data.impactedExecutions has any rows.

  OPTION B — Drop the `steps.length > 0` filter at line 476; let StepTable render an empty body or a "No step data captured" inline message.
    Lower complexity, but produces a less informative UI (an empty 4-column table is uglier than a row-per-run list).

  OPTION C — Skip primary-cycle partitioning when only ONE distinct cycle is referenced; route all runs through impactedExecutions[].
    Simplest, but changes behaviour for single-cycle issues that DO have step content (they would also render via ImpactedExecutionsList instead of StepTable — likely undesirable).

  OPTION A is recommended. It is the smallest behavioural change that satisfies the
  user's stated truth: "When linked test cases have runs (regardless of cycle or step
  presence), the section MUST show one row per impacted execution."

  Plan-phase should also add a service-level unit test for fetchAioTraceabilityTestCases
  in projects.test.ts to lock down the test.detail.key shape assumption AND add a unit
  test for AioTestRunsSection covering the single-cycle empty-steps scenario (currently
  there is NO test for this case).

verification: pending — diagnose-only mode

files_changed: []
</content>
</invoke>