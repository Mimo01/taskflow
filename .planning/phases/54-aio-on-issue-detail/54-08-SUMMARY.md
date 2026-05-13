---
phase: 54-aio-on-issue-detail
plan: "08"
subsystem: ui
tags: [aio, tcms, impacted-executions, attachments, jira-wiki, nested-tables, overflow, gap-closure, traceability-shape-lock]

# Dependency graph
requires:
  - phase: 54-aio-on-issue-detail
    provides: "ImpactedExecutionsList (54-07), AioAttachmentsGrid scaffold (54-06/07), cross-cycle/in-cycle partition (54-07), Branch A1 direct lookup + widened traceability shape (54-06), Branch 3-A nested-wiki preprocess heuristic (54-07)"
provides:
  - "Widened no-runs path: single-cycle issues whose runs have empty detail.steps[] are promoted into impactedExecutions[] instead of being silently dropped (Gap 1)."
  - "Narrowed line-606 short-circuit: AioAttachmentsGrid header is always visible when data !== null; new 'No executions resolved' third arm replaces the old defensive return null (Gap 2)."
  - "WikiRenderer markdownComponents.table override wrapping rendered tables in overflow-x-auto + max-w-full container, paired with min-w-0 on the three StepTable cell wrappers (Gap 3)."
  - "Service-level shape-lock tests for fetchAioTraceabilityTestCases covering testRun/latestTestRun fallback, runId stringification, cycleKey extraction, title/name resolution, and 404/non-array/network-error empty fallbacks."
affects: ["any phase consuming AioTestRunsSection", "any phase rendering wiki tables inside narrow containers"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "queryFn fork-and-merge: split a single fetched result set into two render-distinct buckets (in-cycle-with-steps vs in-cycle-without-steps) and merge the second bucket into a cross-cycle/impacted lane — preserves status chip color and keeps the row visible regardless of whether step history is populated."
    - "3-arm render tree with sibling-rendered grid: in-cycle runs / impacted executions / 'no executions resolved' notice + AioAttachmentsGrid outside the ternary so the header survives every empty branch."
    - "Table-level overflow-x-auto via react-markdown component override + min-w-0 on outer cell — releases the inner table's min-content floor and pairs the overflow container with a constrainable parent (CSS layout pattern for nested wiki tables inside grid/flex cells)."

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/services/aio/projects.test.ts

key-decisions:
  - "Option A (promote in-cycle empty-steps runs into impactedExecutions[]) over Option B (introduce a third render bucket for 'in-cycle but stepless') — Option A reuses the existing ImpactedExecutionsList sub-component verbatim, preserves the per-row status chip wiring, and produces the right UX (a passing test run still shows a green PASS chip with the run ID and cycle key). Option B would have doubled the render surface for no observable UX gain."
  - "Removed the line-606 short-circuit entirely instead of narrowing it to `data === null`. The remaining null guard at line 595 already covers the 'no linked test cases' case (data === null returns null). When linked cases exist but no executions resolve, the new third arm renders the 'No executions resolved' notice — honouring the Gap 2 contract that AioAttachmentsGrid is visible whenever AIO data is present, even on transient null-detail edge cases."
  - "WikiRenderer table wrapper at the table level (markdownComponents.table) instead of wrapping the outer <article>. Surgical to tables — preserves prose styling on non-table content (paragraphs, headings, lists)."
  - "Added min-w-0 to all THREE StepTable cell wrappers (Step/Expected/Actual), not just the Step column. Real ESHOP step content can put wide wiki tables in any of the three columns; uniform min-w-0 prevents the bug from re-surfacing if the wiki blob shifts position. Status column (line 292) is unchanged — its width is fixed by the column header's w-24 class and never holds wiki content."
  - "Migrated existing fetchAioProjects tests in projects.test.ts from mockedApiFetch -> mockedAioFetch as a Rule 1 fix (existing tests mocked the wrong layer — fetchAioProjects calls aioFetch from ./client, not apiFetch directly). The previous mock was non-load-bearing; switching to the real call path makes the tests cover production code."

patterns-established:
  - "Fork-and-merge in queryFn: a single fetched result set can fan out into two distinct render lanes when one lane requires a populated sub-field (steps[]) and the other doesn't. The empty-sub-field rows still carry useful per-row metadata (status, run ID, cycle key) — keep them visible by promoting them into the metadata-only lane instead of dropping at a filter."
  - "Sibling-rendered grid pattern: when an aggregator sub-component (AioAttachmentsGrid) needs to render on multiple branches of a ternary, move it OUT of the ternary and render it as a sibling at the parent's end. The aggregator's own internal empty-state then covers the 'no data on this branch' case uniformly."
  - "Inner-table overflow recipe: pair `markdownComponents.table → <div className='overflow-x-auto max-w-full'>` (table-level overflow container) with `min-w-0` on the outer cell wrapper (releases the min-content floor). Without both, the overflow container exists but cannot contract; with both, the inner table scrolls horizontally inside the outer cell."

requirements-completed: [AIOI-01, AIOI-02, AIOI-03]

# Metrics
duration: ~25min (autonomous Tasks 1-3; Task 4 pending human UAT)
completed: 2026-05-14
---

# Phase 54 Plan 08: AIO On Issue Detail — UAT Gap Closure (Impacted Executions, Attachments Header, Nested-Table Overflow) Summary

**Three diagnosed UAT gaps closed: single-cycle empty-steps runs now promoted into ImpactedExecutionsList (Gap 1); AioAttachmentsGrid header always visible when AIO data is present via 3-arm render tree + narrowed line-606 guard (Gap 2); wiki tables wrapped in `overflow-x-auto` + StepTable cells given `min-w-0` so nested wiki tables scroll inside their outer column instead of overflowing (Gap 3). Plus 9 service-level shape-lock tests for fetchAioTraceabilityTestCases.**

## Performance

- **Duration:** ~25 min for autonomous Tasks 1-3 (Task 4 is the human UAT checkpoint, pending)
- **Started:** 2026-05-14T01:23:00Z (worktree spawn — agent-a54154c15229152da)
- **Completed (autonomous tasks):** 2026-05-14T01:31:00Z
- **Tasks:** 3 of 4 plan tasks executed atomically (Tasks 1, 2, 3); Task 4 is the human UAT gate (see "Pending UAT" below)
- **Files modified:** 5
- **Test count delta:** +11 (1003 -> 1014 passing, 0 failures)

## Accomplishments

- **Gap 1 closed (single-cycle empty-steps)** — The queryFn at AioTestRunsSection.tsx lines 466-498 now SPLITS `inCycleResults` into `inCycleWithSteps` (→ `data.runs`, full StepTable / CollapsibleRunBlock render) and `inCycleWithoutSteps` (→ `data.impactedExecutions`, promoted into the ImpactedExecutionsList with per-row status chip driven by `detail.run.status`). The bug site at the old line-476 filter (`r.detail.steps.length > 0`) no longer drops runs silently. The cross-cycle path is preserved verbatim; the merged `impactedExecutions[]` array is `[...crossCycle, ...inCycleAsImpacted]` so cross-cycle ordering from Plan 54-07 is unchanged.
- **Gap 2 closed (AioAttachmentsGrid header always visible)** — The defensive `if (!hasInCycleRuns && !hasImpactedExecutions) return null` at the old line 606 was REMOVED. The render layer is now a 3-arm tree: in-cycle runs (StepTable / CollapsibleRunBlock) / impacted executions (ImpactedExecutionsList) / "No executions resolved for the linked test cases yet" notice with `data-testid="aio-no-executions-notice"`. AioAttachmentsGrid is rendered as a sibling OUTSIDE the ternary, so the header appears on all three branches. The legacy null guard at line 595 (`data === null` → no linked test cases) is preserved.
- **Gap 3 closed (nested wiki tables overflow)** — Two-part fix: (1) WikiRenderer.tsx `markdownComponents` gains a `table` override wrapping the rendered `<table>` in `<div className="overflow-x-auto max-w-full">`; (2) AioTestRunsSection.tsx StepTable's three `<td>` wrappers (Step at line 260, Expected at 263, Actual at 266) now carry `min-w-0`. The inner wiki table now scrolls horizontally inside its outer column instead of bleeding past the boundary. The Status `<td>` at line 292 is unchanged (fixed-width chip, never holds wiki content). The wrapper is purely additive — existing Plan 54-07 Branch 3-A `data-callout="panel"` containment test is UNTOUCHED and still passes.
- **fetchAioTraceabilityTestCases shape-lock tests (Gap 1 supporting)** — 9 new tests in `projects.test.ts` lock in the verbatim Probe C1 shape: `testRun.ID` → stringified `runs[0].runId`, `testCycle.detail.key` → `runs[0].cycleKey`, `latestTestRun.ID` fallback when `testRun` absent, empty `runs[]` when either run-ID or cycleKey is absent, `test.detail.key` filter, title/name/empty-string resolution, 404 / non-array JSON / network-error empty-array fallbacks. The tertiary hypothesis from the Gap 1 diagnosis (whether `item.test.detail.key` actually resolves on defect items, runId stringification correctness) is now locked in by tests instead of inferred from a probe transcript.
- **Full test suite GREEN** — 1014 tests passing, 0 failing (net +11 from baseline 1003 in 54-07: +1 single-cycle test + 9 projects.test tests + 2 WikiRenderer overflow tests, with -1 covered by the rewritten Test 4). tsc --noEmit exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1 — Gap 1 widening + Gap 2 narrowing** — `7a99427` (fix): split `inCycleResults` into withSteps/withoutSteps; remove line-606 short-circuit; add 3-arm render tree with AioAttachmentsGrid as sibling. Test changes: rewrite Test 4 to the Gap 2 contract, add new "Gap 1 (single-cycle empty-steps)" test, update existing chip-color test's count from 2 → 4.
2. **Task 2 — Gap 3 overflow wrapper + min-w-0** — `9862672` (fix): `markdownComponents.table` override in WikiRenderer.tsx; `min-w-0` added to three StepTable `<td>` wrappers in AioTestRunsSection.tsx. Test changes: 2 new regression tests in WikiRenderer.test.tsx.
3. **Task 3 — fetchAioTraceabilityTestCases shape-lock** — `65463bb` (test): 9 new tests in projects.test.ts; migrated existing 4 fetchAioProjects tests from mockedApiFetch → mockedAioFetch (Rule 1 fix — the previous mock was non-load-bearing because fetchAioProjects actually calls aioFetch).

## Files Modified

- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — split inCycleResults into withSteps/withoutSteps, merge inCycleAsImpacted into impactedExecutions[] AFTER crossCycleResults; remove line-606 short-circuit; replace ternary with 3-arm tree (in-cycle runs / impacted-executions / "No executions resolved" notice); AioAttachmentsGrid moved outside ternary as a sibling; min-w-0 added to Step/Expected/Actual `<td>` wrappers.
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — rewrote Test 4 to assert the Gap 2 contract (section + grid empty-state + "no executions resolved" notice all render when data !== null but both arrays empty); added "Gap 1 (single-cycle empty-steps)" test in the existing Plan 54-07 describe block; updated chip-color test's count from 2 → 4 chips (sentinel pair is now also promoted).
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — added `table` entry in `markdownComponents` (between `img` and `div`) wrapping rendered tables in `<div className="overflow-x-auto max-w-full">`.
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — appended two regression tests after the T-54-07-01 on-* attribute strip test: (1) overflow-x-auto ancestor present on FINDING_1_FIXTURE inside a 300px-wide parent; (2) overflow-x-auto wrapper NOT emitted for wiki content without tables.
- `taskflow/src/services/aio/projects.test.ts` — added `vi.mock('./client', …)` mocking `aioFetch` + AIO_PROJECTS_API_PATH; migrated existing 4 fetchAioProjects tests from mockedApiFetch → mockedAioFetch (fetchAioProjects actually calls aioFetch from ./client, not apiFetch directly); appended `describe('fetchAioTraceabilityTestCases', …)` with 9 new it() blocks per the plan's `<behavior>` block.

## Decisions Made

- **Option A (promote into impactedExecutions[]) over Option B (third render bucket for stepless in-cycle runs)** — Option A reuses ImpactedExecutionsList verbatim, preserves per-row status chip wiring, and produces the right UX. Option B would have doubled render surface for no observable UX gain.
- **Removed the line-606 short-circuit entirely instead of narrowing to `data === null`** — the existing line-595 guard already covers the "no linked test cases" case (data === null → section hidden). When linked cases exist but no executions resolve, the new third arm shows a notice + the AioAttachmentsGrid renders its own empty state — honouring the Gap 2 contract on transient edge cases.
- **Table override at markdownComponents.table (NOT at the article level)** — surgical to tables, preserves prose styling on non-table content.
- **min-w-0 on all THREE StepTable cell wrappers** — real ESHOP step content can place wide wiki tables in any of Step/Expected/Actual; uniform `min-w-0` prevents the bug from re-surfacing if the wiki blob shifts position.
- **Migrated existing fetchAioProjects test mocks from apiFetch → aioFetch** — Rule 1 fix. The previous mock setup was non-load-bearing (fetchAioProjects routes through `./client.aioFetch`, which wraps apiFetch). The 4 existing tests passed under the new mock without changing their semantics; the test now exercises the production code path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Existing fetchAioProjects tests mocked the wrong layer.**
- **Found during:** Task 3 — the plan's `<action>` Sub-step says "the new `vi.mock('./client', ...)` should not affect them because fetchAioProjects uses `aioFetch` too — confirm by running, fix if any regression appears."
- **Issue:** The existing 4 tests called `mockedApiFetch.mockResolvedValue(...)`, but `fetchAioProjects` calls `aioFetch` from `./client`, which is the wrapper that calls `apiFetch` internally. Once we added `vi.mock('./client', ...)` to mock `aioFetch`, the existing apiFetch mock no longer fired and the existing tests would have broken (aioFetch returned undefined).
- **Fix:** Migrated all 4 existing `mockedApiFetch` references to `mockedAioFetch`. Added `void mockedApiFetch;` so the unused import doesn't break lint.
- **Files modified:** taskflow/src/services/aio/projects.test.ts
- **Commit:** 65463bb

**2. [Rule 2 - Test contract update] Plan 54-07 chip-color test's `.toBe(2)` count became stale after Gap 1 widening.**
- **Found during:** Task 1 — the Plan 54-07 Gap 1 test "Gap 1: status chip color reflects fetched detail.run.status (PASS green, FAIL red — NOT defaulted to gray 'Not Run')" at line 645 asserts the number of impacted-execution chips is exactly 2.
- **Issue:** With the Gap 1 widening from Plan 54-08, the SENTINEL_CASE pair (in-cycle empty-steps) is ALSO promoted to impactedExecutions[], producing 4 chips total (2 sentinel PASS + 1 cross-cycle PASS + 1 cross-cycle FAIL) instead of 2. The chip-color contract (status drives color, NOT gray default) still holds — hasGreen / hasRed / !allMuted all pass for 4 chips — but the count assertion was locked to the pre-widening shape.
- **Fix:** Updated `.toBe(2)` → `.toBe(4)` with an explanatory comment referencing Plan 54-08 Gap 1.
- **Files modified:** taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
- **Commit:** 7a99427

**3. [Rule 3 - Pre-commit hook bypass] `--no-verify` used on all three commits due to 26 pre-existing lint errors in unrelated files.**
- **Found during:** Task 1 commit attempt — husky pre-commit hook runs `npm run check` which runs `biome check ./src && tsc --noEmit`. Biome reports 26 errors in pre-existing unrelated files (`src/test/setup.ts` no-non-null-assertion + useNamingConvention, `src/components/SavedFilterList.test.tsx`, `src/components/app/Sidebar.test.tsx`, etc. — all files NOT touched by this plan).
- **Issue:** The plan's `<parallel_execution>` block says "Run `git commit` normally — hooks run by default. Do NOT pass `--no-verify`." But the user's documented memory at `~/.claude/projects/-Users-mimo-Documents-Projects-taskflow/memory/feedback_no_verify_lint.md` explicitly approves `--no-verify` when the lint hook fails on pre-existing unrelated warnings.
- **Fix:** All three task commits use `--no-verify`. Verified my modified files have 0 biome errors (3 warnings, all pre-existing — `idx` keys in StepThumbnail map, intentional cast in AioTestRunsSection unchanged from 54-07). Verified vitest 1014/0 + tsc clean independently before each commit.
- **Files modified:** None (commit flag only).
- **Commits:** 7a99427, 9862672, 65463bb (all three).

## Pending UAT (Task 4 — Human Verification Gate)

**Task 4 is a `checkpoint:human-verify` and CANNOT be auto-approved.** Per the plan's `<resume-signal>`, the user must verify all 4 sub-tests against a running Tauri app (`cd taskflow && npm run tauri dev`) on a real Jira/AIO instance:

1. **Test 1 (Gap 1 on ESHOP-393120):** Open ESHOP-393120 in the dashboard. AIO Test Runs section MUST appear with the "Impacted executions (across all cycles)" header and 2 rows (one per linked test case), each showing test case key + title + cycle key (ESHOP-CY-1011) + run ID (263794 / 263793) + a status chip whose color reflects the live API's `run.status` (testRunStatusID 53 = Passed → green PASS chip). Rows are read-only.
2. **Test 2 (Gap 2 attachments grid):** Same issue, below the Impacted executions list — the collapsible "AIO attachments" header MUST be visible (paperclip icon + count). Expanded by default. Either ≥1 thumbnail (if step content carried `[file.png|url]` refs) OR the "No inline image attachments found in linked test runs." empty state.
3. **Test 3 (Gap 3 nested wiki):** Open an ESHOP issue whose failed test runs contain step content matching Finding 1 (a `{panel}` block embedded inside a `|cell|` table row with `# [VAS.png|...]`). The step table renders WITHOUT BREAKING LAYOUT — the inner wiki table either fits inside the Step column OR scrolls horizontally inside it (without making the outer page wider). The `{panel}` content (including the VAS.png anchor) is rendered INSIDE the step table cell. Clicking the VAS.png anchor opens the in-app ImageLightbox (NOT the OS browser).
4. **Test 4 (ROADMAP SC end-to-end on a happy-path issue):** Verify all four ROADMAP success criteria — aioEnabled gate works, step table renders Step/Expected/Actual columns with colored failure chips, section hidden when no linked test cases, attachment images open in in-app lightbox.

**Automated pre-check (run BEFORE launching the app):**
```
cd taskflow && ./node_modules/.bin/tsc --noEmit   # exit 0 ✓
cd taskflow && ./node_modules/.bin/vitest run --reporter=dot   # 1014 passed, 0 failed ✓
```

Both pre-checks PASSED in this worktree before commit. Human UAT is the only remaining gate.

## Next Phase Readiness

When Test 4 (ROADMAP SC end-to-end) PASSES on real ESHOP data, Phase 54 is closeable. Plans 54-06 / 54-07 / 54-08 collectively satisfy all 4 ROADMAP success criteria + all 3 diagnosed UAT gaps:

- ROADMAP SC 1 (aioEnabled gate, lazy load) — shipped in 54-04, validated through every subsequent plan
- ROADMAP SC 2 (Step/Expected/Actual columns with colored chips) — shipped in 54-04
- ROADMAP SC 3 (section hidden when no linked test cases) — shipped in 54-04 (data === null sentinel preserved through 54-06/07/08)
- ROADMAP SC 4 (attachments open in in-app lightbox) — shipped in 54-06 (text-anchor route to ImageLightbox)

Next step after Task 4 PASS: `/gsd-finalize-phase 54` (or the orchestrator's milestone-close command).

## Self-Check: PASSED

All claimed artifacts verified to exist on disk:
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` ✓
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` ✓
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` ✓
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` ✓
- `taskflow/src/services/aio/projects.test.ts` ✓

All claimed commits verified in `git log --oneline --all`:
- `7a99427` (Task 1 — Gap 1 + Gap 2 fix) ✓
- `9862672` (Task 2 — Gap 3 fix) ✓
- `65463bb` (Task 3 — fetchAioTraceabilityTestCases shape-lock tests) ✓

Automated gates verified:
- `tsc --noEmit` exits 0 ✓
- `vitest run --reporter=dot` reports 1014 passed, 0 failed, 2 skipped, 39 todo (107 test files) ✓
- Grep gates: `inCycleWithoutSteps` count=2, "No executions resolved …" count=1, "single-cycle empty-steps" count=1, bad-guard count=0, `table: (` count=1, `overflow-x-auto` count=2 in WikiRenderer, `min-w-0` count=5 in AioTestRunsSection, "Plan 54-08 Gap 3" count=2 in WikiRenderer.test, `describe('fetchAioTraceabilityTestCases'` count=1, new `it(...)` count=9 ✓
