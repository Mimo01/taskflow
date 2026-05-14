---
status: partial
phase: 54-aio-on-issue-detail
source: [54-VERIFICATION.md]
started: 2026-05-14T00:25:00Z
updated: 2026-05-14T09:15:00Z
re_uat_round: 2
fix_commits: ["7a99427", "9862672", "65463bb"]
---

## Current Test

Round 2 partial: Test 1 PASS, Test 2 PASS, Test 3 FAIL (awaiting user screenshots), Test 4 pending.

## Tests

### 1. Gap 1 RE-UAT — Impacted executions list renders on no-runs path with real per-run status chips
expected: On ESHOP-393120 (defect with 2 linked test runs in single cycle ESHOP-CY-1011, both testRunStatusID 53 = Passed), the AIO Test Runs section MUST appear with the "Impacted executions (across all cycles)" header and 2 rows (one per linked test case: ESHOP-TC-8477 / ESHOP-TC-8478), each showing test case key + title + cycle key (ESHOP-CY-1011) + run ID (263794 / 263793) + a colored status chip whose color reflects the live API's run.status (green PASS chip). Rows are read-only.
result: pass
reported: "I can see AIO test runs correctly."
prior_round_1_result: issue (gap diagnosed, fix landed in 54-08 commit 7a99427)

### 2. Gap 2 RE-UAT — AioAttachmentsGrid header always visible on no-runs path
expected: On the same ESHOP-393120 issue, BELOW the Impacted executions list, the collapsible "AIO attachments" header MUST be visible (paperclip icon + count). Expanded by default. Either ≥1 thumbnail (if step content carries `[file.png|url]` refs) OR the "No inline image attachments found in linked test runs." empty state visible inside. Clicking a thumbnail (if present) opens the in-app ImageLightbox via the AuthImage bridge-URL translation path.
result: pass
reported: "I can see AIO attachments but they are always empty (empty-state text visible)."
note: Empty-state behavior is the contract — ESHOP-393120 runs have empty testRunSteps[] so there are no inline [file.png|url] refs to discover. Header visible + empty-state text matches the Gap 2 contract truth.
prior_round_1_result: issue (gap diagnosed, fix landed in 54-08 commit 7a99427 — line-606 guard narrowed, AioAttachmentsGrid now sibling on all 3 render arms)

### 3. Gap 3 RE-UAT — Nested wiki (`{panel}` inside `|cell|`) renders inside table cell without breaking outer column
expected: Open an ESHOP issue whose failed test runs contain step content matching the verbatim Finding 1 fixture (a `{panel}` block embedded inside a `|cell|` table row with `# [VAS.png|...]`). The outer StepTable renders WITHOUT BREAKING LAYOUT. The inner wiki table either fits inside the Step column OR scrolls horizontally inside it (the page itself does NOT widen). The `{panel}` content (including the VAS.png anchor) renders INSIDE the step table cell. Clicking the VAS.png anchor opens the in-app ImageLightbox (not the OS browser).
result: issue
reported: "The rendering of the 'panel' is better but it still breaks the table."
severity: major
evidence:
  expected_screenshot: .planning/phases/54-aio-on-issue-detail/screenshots/gap3-round2-expected.png
  actual_screenshot: .planning/phases/54-aio-on-issue-detail/screenshots/gap3-round2-actual.png
note: |
  Round 2 evidence shows the breakage is PARSER-LEVEL (not CSS overflow as 54-08 assumed):
  (1) Multi-line cell content fractures vertically — `• 5 GB (12657037, 5,13 €)` becomes a phantom row beneath `FAILED: Plati pre paušály S, M, L:` instead of staying in the Step cell.
  (2) Wiki link `[VAS.png|url]` inside the flattened panel span keeps its literal `|`, breaking markdown table column parsing — `# Kosik.png` escapes the table entirely as a sibling below.
  (3) Numbered list `# item` inside the panel loses its semantics — demoted to bare `#` text with awkward panel styling.
  Full diagnosis: .planning/debug/panel-still-breaks-table-round-2.md
prior_round_1_result: issue (gap diagnosed, fix landed in 54-08 commit 9862672 — WikiRenderer.markdownComponents.table wraps in overflow-x-auto, StepTable td wrappers gain min-w-0 — but root cause was misframed as CSS overflow when actual cause is parser-level)
debug_session: .planning/debug/panel-still-breaks-table-round-2.md

### 4. ROADMAP SC end-to-end UAT on a happy-path issue
expected: Verify all four ROADMAP success criteria on a happy-path ESHOP issue (e.g. a defect linked to an active cycle with populated step content) — (1) section appears only when aioEnabled=true and loads lazily without blocking the main issue body; (2) step table renders Step/Expected/Actual columns with colored failure chips per row (PASS green / FAIL red / BLOCKED orange); (3) section is hidden (no error state) when no AIO test cases are linked to the issue; (4) attachment images within steps + AIO attachments grid thumbnails both open in the existing in-app ImageLightbox (NOT the OS browser). Toggle aioEnabled OFF/ON in Settings to confirm gating.
result: pending
note: Deferred until Gap 3 resolved — end-to-end SC4 (attachment images open in lightbox) cannot be fully verified while the failed-step rendering still breaks layout.
prior_round_1_result: skipped (deferred until Tests 1-3 resolved — now ready)

## How to run

```
cd taskflow && npm run tauri dev
```

Confirm `aioEnabled` is ON in Settings → AIO toggle. For Test 1-2, open issue ESHOP-393120 in the dashboard. For Test 3, open an ESHOP issue with the Finding 1 fixture in failed-step content. For Test 4, pick any happy-path issue.

Reply "approved" if all 4 PASS, or describe failures with screenshots/DOM if any FAILS.

## Summary

total: 4
passed: 2
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

<!-- Round 1 gaps preserved below for diagnosis history. All three have fix commits landed in plan 54-08; status will move to `resolved` once re-UAT confirms. -->

- truth: "Impacted executions list renders on no-runs path showing one row per impacted execution (test case key + title, cycle key, run ID, colored status chip) when linked test cases have runs only in non-primary cycles."
  status: resolved
  uat_round_2: pass
  resolved_at: "2026-05-14T09:15:00Z"
  fix_commit: "7a99427"
  fix_plan: "54-08"
  reason: |
    User reported: looking at issue ESHOP defect 393120 (jiraProjectID 10134, AIO project 13806) — no executions shown in UI, but the live traceability endpoint returns 2 impacted executions both in cycle ESHOP-CY-1011 (ID 14041): testRun 263794 (ESHOP-TC-8477) and testRun 263793 (ESHOP-TC-8478). Both linked to defect 393120 via testRunDefects[].defectID. Cycle is active (endDate 2026-05-30, today 2026-05-14). Verbatim live URL: /rest/aio-tcms/1.0/project/13806/traceability/defect/393120?c_pId=13806
  severity: major
  test: 1
  root_cause: |
    Two-part failure on the no-runs path. (a) Primary-cycle partitioning at AioTestRunsSection.tsx:408-425 routes ALL traceability runs into `inCycleRefs` whenever only ONE cycle is referenced (both ESHOP runs are in cycle ESHOP-CY-1011, so crossCycleRefs ends up empty — ImpactedExecutionsList path at line 629 is unreachable). (b) Then the in-cycle path hard-filters via `r.detail.steps.length > 0` at line 476 — both runs have testRunStatusID 53 (Passed), which on this ESHOP instance typically return empty testRunSteps[] (Probe B observation: testers skip step content on trivial passes). Result: data.runs=[], data.impactedExecutions=[], defensive null-return at line 606 silently hides the whole section.
    Eliminated hypothesis: aio-tcms-api vs aio-tcms base-path concern — client.ts:16-17 exports both, projects.ts:65 correctly uses AIO_PROJECTS_API_PATH (/rest/aio-tcms/1.0) for traceability, matching the user's verbatim URL.
  fix_landed: |
    Plan 54-08 commit 7a99427 — split inCycleResults into inCycleWithSteps (→ data.runs) and inCycleWithoutSteps (→ data.impactedExecutions[]); in-cycle promotions appended after cross-cycle in the concatenation. Service-level shape-lock tests for fetchAioTraceabilityTestCases landed in commit 65463bb (8 new tests covering testRun/latestTestRun fallback, runId stringification, cycleKey extraction, 404/non-array/network-error empty fallback). New unit test "single-cycle empty-steps" covers the ESHOP-393120 scenario in AioTestRunsSection.test.tsx.
  debug_session: .planning/debug/aio-no-impacted-executions-eshop-393120.md

- truth: "AioAttachmentsGrid header is visible on no-runs path with either thumbnails or an empty-state message; clicking a thumbnail opens in-app ImageLightbox via AuthImage bridge translation."
  status: resolved
  uat_round_2: pass
  resolved_at: "2026-05-14T09:15:00Z"
  uat_note: "Header visible + empty-state text shown on ESHOP-393120 — matches contract since runs have empty testRunSteps[] (no inline [file.png|url] refs to discover)."
  fix_commit: "7a99427"
  fix_plan: "54-08"
  reason: |
    User reported: 'i dont see the new section at all. inline aio images work'. On issue ESHOP 393120 (no-runs / impacted-executions path), the AIO attachments header is missing entirely. Inline AIO images render correctly in other contexts, so the AuthImage bridge translation and lightbox plumbing are intact — the failure is upstream: AioAttachmentsGrid is gated on data presence which is empty because Test 1 root cause leaves data.impactedExecutions empty.
  severity: major
  test: 2
  cascades_from: 1
  root_cause: |
    Cascade from Gap 1 — the defensive guard at AioTestRunsSection.tsx:606 (`if (!hasInCycleRuns && !hasImpactedExecutions) return null`) short-circuits the entire <section> before reaching AioAttachmentsGrid at line 631. Once Gap 1 fix populates data.impactedExecutions, the section renders and the attachments grid (which is unconditionally inside the section and renders its own empty-state header internally) re-appears. AioAttachmentsGrid implementation (lines 150-212) is correct — the header <button> renders unconditionally with empty-state text inside via `attachments.length===0 ? <p>... : <grid>`.
  fix_landed: |
    Plan 54-08 commit 7a99427 — line-606 short-circuit removed; render layer now has a 3-arm tree (in-cycle runs / impacted executions / "No executions resolved for the linked test cases yet" notice with data-testid="aio-no-executions-notice"); AioAttachmentsGrid moved outside the ternary as a sibling so the header is rendered on ALL three branches. Test at AioTestRunsSection.test.tsx:201-216 was REWRITTEN to assert the new contract (section + grid empty state visible when data !== null but both arrays empty).
  debug_session: .planning/debug/aio-attachments-header-missing.md

- truth: "Nested {panel} blocks embedded inside |cell| of a wiki table row render INSIDE the cell without breaking table layout; links open in-app ImageLightbox."
  status: partial
  uat_round_2: issue
  uat_round_2_at: "2026-05-14T09:25:00Z"
  uat_note: |
    Round 2: 'rendering of the panel is better but it still breaks the table'. Screenshots received.
    Reframed root cause: PARSER-LEVEL fractures (not CSS overflow). Three independent concerns surfaced:
    (A) mergeOpenTableRows may not consume full panel-bearing row; (B) wiki link `[name|url]` literal `|` breaks markdown table parsing — `# Kosik.png` escapes the table; (C) wiki numbered list `# item` inside panel loses semantics. Full diagnosis: .planning/debug/panel-still-breaks-table-round-2.md
  fix_commit: "9862672"
  fix_plan: "54-08"
  next_plan: "54-09 (pending /gsd:plan-phase 54 --gaps)"
  reason: |
    User reported: 'images work but the layout is still kind of broken. The table doesnt break in the middle like it used to but the pannel is not rendered in one cell of a table but overflows and breaks the layout in the section of the table where it is located'. Partial Branch 3-A improvement (no mid-table break, image routing intact) but the panel content still escapes its containing <td> — appears as sibling rather than child of the cell, or overflows the cell's bounds.
  severity: major
  test: 3
  root_cause: |
    NOT a <span data-callout> escape — the panel IS structurally contained inside the inner wiki table's <td>. The actual bug is a layout-integration failure between two NESTED tables: the inner wiki table (from WikiRenderer) grows wider than the outer Step column allows and overflows. WikiRenderer.tsx <article> had no overflow container around rendered tables; AioTestRunsSection StepTable outer <td> had no min-w-0 to release the min-content floor.
  fix_landed: |
    Plan 54-08 commit 9862672 — WikiRenderer.tsx markdownComponents gained a `table` override wrapping rendered <table> in <div className="overflow-x-auto max-w-full">. AioTestRunsSection.tsx StepTable Step/Expected/Actual <td> wrappers gained `min-w-0` so the column releases its min-content floor and the overflow container can contract + scroll. Regression test in WikiRenderer.test.tsx asserts the wrapper class exists when rendered inside a constrained-width parent.
  debug_session: .planning/debug/panel-overflows-table-cell.md
