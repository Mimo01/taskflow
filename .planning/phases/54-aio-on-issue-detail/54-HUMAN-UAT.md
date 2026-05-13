---
status: diagnosed
phase: 54-aio-on-issue-detail
source: [54-VERIFICATION.md]
started: 2026-05-14T00:25:00Z
updated: 2026-05-14T20:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Gap 1 — Impacted executions list renders on no-runs path with real per-run status chips
expected: When an issue has linked test cases but no runs in the latest active (primary) cycle, the bare 'No test runs in active cycle' EmptyState is GONE and is replaced by a compact list showing one row per impacted execution (test case key + title, cycle key, run ID, colored status chip). Chip colors differ between PASS/FAIL/BLOCKED rows — not all gray 'Not Run'. Rows are read-only.
result: issue
reported: |
  i dont see any executions there. the story i am looking at should have 2 (defect 393120):
  - testRun 263794 — ESHOP-TC-8477 'B2B_VAS_5 GB za 5,13 €' in cycle ESHOP-CY-1011 (cycle ID 14041), testRunStatusID 53
  - testRun 263793 — ESHOP-TC-8478 'B2B_VAS_Viac rýchlych dát FUP 200 GB' in cycle ESHOP-CY-1011 (cycle ID 14041), testRunStatusID 53
  Live API path: /rest/aio-tcms/1.0/project/13806/traceability/defect/393120?c_pId=13806
  Both executions linked to defect 393120 via testRunDefects[].defectID. Cycle 14041 active (endDate 1779141600000 = 2026-05-30).
severity: major

### 2. Gap 2 — AioAttachmentsGrid populates on no-runs path
expected: On a no-runs ESHOP issue whose impacted-execution step content contains inline `[file.png|url]` refs, the 'AIO attachments' collapsible header is visible AND ≥1 thumbnail appears in the grid. When no inline image refs exist, the header still renders with the empty-state 'No inline image attachments found in linked test runs.' inside. Clicking a thumbnail opens the in-app ImageLightbox via the AuthImage bridge-URL translation path.
result: issue
reported: "i dont see the new section at all. inline aio images work"
severity: major
note: |
  AioAttachmentsGrid header not rendering on no-runs path issue 393120. Inline AIO image
  rendering works elsewhere — likely cascades from Test 1 root cause (no impacted
  executions means no data feeds aioAttachments memo at AioTestRunsSection.tsx:552).
  Verify whether grid is unconditionally rendered (empty-state branch) once data is non-null.

### 3. Gap 3 — Nested wiki (`{panel}` with embedded `[name|url]` list) renders inside table cells
expected: Open an ESHOP issue whose failed test runs contain step content matching the verbatim Finding 1 fixture (`{panel}` block inside a `|cell|` table row). The step table renders without breaking — the panel content and the `VAS.png` text anchor render INSIDE the table cell. Clicking the link opens the in-app ImageLightbox (not the OS browser).
result: issue
reported: "images work but the layout is still kind of broken. The table doesnt break in the middle like it used to but the pannel is not rendered in one cell of a table but overflows and breaks the layout in the section of the table where it is located"
severity: major
note: |
  Partial improvement on the previous Finding 1 (table no longer breaks in the middle, lightbox/image routing intact), but the `{panel}` block embedded inside a `|cell|` of a wiki table row still overflows the cell — content escapes its containing <td> and disrupts the table layout in that row/section. Suggests `mergeOpenTableRows` / `flattenInlineCalloutsForTableRow` heuristics fire but the panel's flattened HTML ends up as a sibling of the cell rather than inside it (or the cell's contents bleed outside its width).

### 4. ROADMAP SC end-to-end on a happy-path issue
expected: All four ROADMAP SCs visually confirmed on a real ESHOP issue (e.g. 393120): (1) section appears only when aioEnabled=true and loads lazily without blocking issue body; (2) step table renders Step/Expected/Actual columns with colored failure chips; (3) section is hidden (no error) when no AIO test cases linked; (4) attachment images open in the existing in-app ImageLightbox. Toggle aioEnabled OFF/ON to confirm gating.
result: skipped
reason: "User skipped — earlier gap failures (Tests 1-3) need resolution before end-to-end SC verification is meaningful. Re-run after gap closure."

## Summary

total: 4
passed: 0
issues: 3
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Impacted executions list renders on no-runs path showing one row per impacted execution (test case key + title, cycle key, run ID, colored status chip) when linked test cases have runs only in non-primary cycles."
  status: failed
  reason: |
    User reported: looking at issue ESHOP defect 393120 (jiraProjectID 10134, AIO project 13806) — no executions shown in UI, but the live traceability endpoint returns 2 impacted executions both in cycle ESHOP-CY-1011 (ID 14041): testRun 263794 (ESHOP-TC-8477) and testRun 263793 (ESHOP-TC-8478). Both linked to defect 393120 via testRunDefects[].defectID. Cycle is active (endDate 2026-05-30, today 2026-05-14). Verbatim live URL: /rest/aio-tcms/1.0/project/13806/traceability/defect/393120?c_pId=13806
  severity: major
  test: 1
  root_cause: |
    Two-part failure on the no-runs path. (a) Primary-cycle partitioning at AioTestRunsSection.tsx:408-425 routes ALL traceability runs into `inCycleRefs` whenever only ONE cycle is referenced (both ESHOP runs are in cycle ESHOP-CY-1011, so crossCycleRefs ends up empty — ImpactedExecutionsList path at line 629 is unreachable). (b) Then the in-cycle path hard-filters via `r.detail.steps.length > 0` at line 476 — both runs have testRunStatusID 53 (Passed), which on this ESHOP instance typically return empty testRunSteps[] (Probe B observation: testers skip step content on trivial passes). Result: data.runs=[], data.impactedExecutions=[], defensive null-return at line 606 silently hides the whole section.
    Eliminated hypothesis: aio-tcms-api vs aio-tcms base-path concern — client.ts:16-17 exports both, projects.ts:65 correctly uses AIO_PROJECTS_API_PATH (/rest/aio-tcms/1.0) for traceability, matching the user's verbatim URL.
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:408-425"
      issue: "primary-cycle partitioning treats single-cycle case as all-in-cycle; no path to ImpactedExecutionsList"
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:476"
      issue: "r.detail.steps.length > 0 filter drops in-cycle runs with empty steps; no fallback render"
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:606"
      issue: "defensive null-return hides section when both runs[] and impactedExecutions[] empty"
    - path: "taskflow/src/services/aio/projects.ts:55-89"
      issue: "fetchAioTraceabilityTestCases has no unit test — assumed item.test.detail.key shape is unverified"
  missing:
    - "Widen no-runs path: push in-cycle runs with detail===null OR detail.steps.length===0 into data.impactedExecutions[] instead of dropping at line 476"
    - "Change render rule near line 618 to show ImpactedExecutionsList whenever data.runs.length===0 && data.impactedExecutions.length>0"
    - "Add unit test for fetchAioTraceabilityTestCases in projects.test.ts (locks in item.test.detail.key shape)"
    - "Add AioTestRunsSection unit test covering the single-cycle / empty-steps scenario"
  debug_session: .planning/debug/aio-no-impacted-executions-eshop-393120.md

- truth: "AioAttachmentsGrid header is visible on no-runs path with either thumbnails or an empty-state message; clicking a thumbnail opens in-app ImageLightbox via AuthImage bridge translation."
  status: failed
  reason: |
    User reported: 'i dont see the new section at all. inline aio images work'. On issue ESHOP 393120 (no-runs / impacted-executions path), the AIO attachments header is missing entirely. Inline AIO images render correctly in other contexts, so the AuthImage bridge translation and lightbox plumbing are intact — the failure is upstream: AioAttachmentsGrid is gated on data presence which is empty because Test 1 root cause leaves data.impactedExecutions empty.
  severity: major
  test: 2
  cascades_from: 1
  root_cause: |
    Cascade from Gap 1 — the defensive guard at AioTestRunsSection.tsx:606 (`if (!hasInCycleRuns && !hasImpactedExecutions) return null`) short-circuits the entire <section> before reaching AioAttachmentsGrid at line 631. Once Gap 1 fix populates data.impactedExecutions, the section renders and the attachments grid (which is unconditionally inside the section and renders its own empty-state header internally) re-appears. AioAttachmentsGrid implementation (lines 150-212) is correct — the header <button> renders unconditionally with empty-state text inside via `attachments.length===0 ? <p>... : <grid>`.
    Secondary concern (contract honesty, lower priority): even after Gap 1 is fixed, the line-606 guard still violates the Gap 2 truth on D-04 second-case issues where linked test cases exist but no executions resolve at all. Consider dropping the section-level short-circuit and adding a third arm to the branches at lines 618-630 ('No executions resolved' notice) so the AioAttachmentsGrid empty state always renders when data!==null. Existing test AioTestRunsSection.test.tsx:201-216 would need updating.
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:606"
      issue: "defensive guard short-circuits section before AioAttachmentsGrid at line 631 is reached"
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx:201-216"
      issue: "test asserts section is null when both run arrays empty — locks in current behaviour, contradicts Gap 2 contract"
  missing:
    - "Primary fix: ensure Gap 1 fix populates data.impactedExecutions so hasImpactedExecutions becomes true and the line-606 guard no longer fires"
    - "Secondary fix: narrow the line-606 guard so the section + AioAttachmentsGrid empty-state still render when data!==null but both arrays are empty"
    - "Update AioTestRunsSection.test.tsx:201-216 to assert AioAttachmentsGrid empty-state header is present in the linked-but-no-executions case"
  debug_session: .planning/debug/aio-attachments-header-missing.md

- truth: "Nested {panel} blocks embedded inside |cell| of a wiki table row render INSIDE the cell without breaking table layout; links open in-app ImageLightbox."
  status: failed
  reason: |
    User reported: 'images work but the layout is still kind of broken. The table doesnt break in the middle like it used to but the pannel is not rendered in one cell of a table but overflows and breaks the layout in the section of the table where it is located'. Partial Branch 3-A improvement (no mid-table break, image routing intact) but the panel content still escapes its containing <td> — appears as sibling rather than child of the cell, or overflows the cell's bounds. Heuristic in WikiRenderer.tsx mergeOpenTableRows + flattenInlineCalloutsForTableRow + <span data-callout> path needs to keep the panel HTML contained inside the cell's contentEditable scope.
  severity: major
  test: 3
  root_cause: |
    NOT a <span data-callout> escape — the panel IS structurally contained inside the inner wiki table's <td> (confirmed by WikiRenderer.test.tsx:290-316 and live jira2md probe). The actual bug is a layout-integration failure between two NESTED tables:
    1. AioTestRunsSection.tsx StepTable (lines 240-304) renders an OUTER React table with a 'Step' column.
    2. The full wiki blob (containing its OWN ||header||/|row| wiki table with the embedded {panel}) is passed as ONE value to ONE <td> of the outer Step column (line 261).
    3. WikiRenderer.tsx <article> wrapper (line 359) has `prose ... max-w-none` with NO `overflow-x-auto` and NO table markdownComponents override.
    4. The outer <td className="px-4 py-3"> (line 260) has NO `min-w-0` and NO `overflow-x-auto`.
    5. The INNER wiki table grows wider than the outer Step column allows and overflows. The {panel} (with `border-l-4 ... p-3 my-2`) is the visually loudest element so the user perceives it as 'escaping its cell'.
    Existing Gap 3 test only checks structural containment, not widths/overflow — which is why the bug shipped despite a passing test.
  artifacts:
    - path: "taskflow/src/routes/dashboard/WikiRenderer.tsx:359"
      issue: "<article> wrapper lacks overflow container around rendered tables; no table markdownComponents override"
    - path: "taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:260"
      issue: "outer <td className=\"px-4 py-3\"> wraps WikiRenderer with no min-w-0 / no overflow constraint"
    - path: "taskflow/src/routes/dashboard/WikiRenderer.test.tsx:290-316"
      issue: "Gap 3 test only asserts structural containment; layout/overflow regression test missing"
  missing:
    - "Add `table` entry to markdownComponents in WikiRenderer.tsx that wraps rendered <table> in <div className=\"overflow-x-auto max-w-full\">"
    - "Add `min-w-0` to outer <td> wrappers in AioTestRunsSection.tsx StepTable (lines 260, 263, 266) so the column releases its min-content floor and the inner overflow container can scroll"
    - "Optional polish: emit a distinct data-callout-variant=\"inline-table\" marker in flattenInlineCalloutsForTableRow + slimmer style (px-1 border-l-2 my-0) in the span override to reduce visual loudness of panel inside tight cells"
    - "Regression test: render the Probe E Finding-1 fixture inside a fixed-width outer container, assert inner table is wrapped in an overflow-x-auto ancestor"
  debug_session: .planning/debug/panel-overflows-table-cell.md
