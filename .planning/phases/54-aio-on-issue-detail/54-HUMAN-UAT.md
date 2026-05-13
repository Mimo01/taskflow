---
status: complete
phase: 54-aio-on-issue-detail
source: [54-VERIFICATION.md]
started: 2026-05-14T00:25:00Z
updated: 2026-05-14T20:10:00Z
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
  artifacts: []
  missing: []

- truth: "AioAttachmentsGrid header is visible on no-runs path with either thumbnails or an empty-state message; clicking a thumbnail opens in-app ImageLightbox via AuthImage bridge translation."
  status: failed
  reason: |
    User reported: 'i dont see the new section at all. inline aio images work'. On issue ESHOP 393120 (no-runs / impacted-executions path), the AIO attachments header is missing entirely. Inline AIO images render correctly in other contexts, so the AuthImage bridge translation and lightbox plumbing are intact — the failure is upstream: AioAttachmentsGrid is gated on data presence which is empty because Test 1 root cause leaves data.impactedExecutions empty.
  severity: major
  test: 2
  artifacts: []
  missing: []
  likely_cascades_from: 1

- truth: "Nested {panel} blocks embedded inside |cell| of a wiki table row render INSIDE the cell without breaking table layout; links open in-app ImageLightbox."
  status: failed
  reason: |
    User reported: 'images work but the layout is still kind of broken. The table doesnt break in the middle like it used to but the pannel is not rendered in one cell of a table but overflows and breaks the layout in the section of the table where it is located'. Partial Branch 3-A improvement (no mid-table break, image routing intact) but the panel content still escapes its containing <td> — appears as sibling rather than child of the cell, or overflows the cell's bounds. Heuristic in WikiRenderer.tsx mergeOpenTableRows + flattenInlineCalloutsForTableRow + <span data-callout> path needs to keep the panel HTML contained inside the cell's contentEditable scope.
  severity: major
  test: 3
  artifacts: []
  missing: []
