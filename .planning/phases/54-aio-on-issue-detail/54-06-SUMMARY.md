---
phase: 54-aio-on-issue-detail
plan: "06"
subsystem: ui
tags: [aio, tcms, jira-wiki, react-markdown, jira2md, tauri-opener, traceability]

# Dependency graph
requires:
  - phase: 54-aio-on-issue-detail
    provides: "AIO test runs section on issue detail (Plan 54-05 shipped section + thumbnails + collapsible blocks + status chips)"
  - phase: 51-aio-service-layer
    provides: "aioFetch client + AIO type definitions (AioTestCase, AioTestRun, AioTestRunStep, AioPage)"
provides:
  - "Global WikiRenderer <a> override routing external clicks through openUrl from @tauri-apps/plugin-opener (Tauri-webview no longer hijacked by Jira-wiki links)"
  - "AIO step content (step / expectedResult / actualResult) rendered via WikiRenderer — tables, {color}, {panel}, h4. headings, bold, hard breaks"
  - "preprocessJiraMarkup normalises `hN.X` (no space) and `\\\\` hard breaks — real-data jira2md gaps caught against ESHOP fixtures"
  - "Direct-lookup perf path (Branch A1): traceability response widened to extract embedded testRun.ID + testCycle.detail.key; success path skips fetchAioCycles AND fetchAioTestRunsForCycle entirely"
  - "fetchAioTestRunDetail service exported through aio/index.ts — returns { run, steps } in a single request, parallelised by the caller via Promise.all"
  - "New types AioTestCaseWithRuns (superset of AioTestCase, structural compatibility preserved) and AioTraceabilityRunRef"
affects: [55, 56, future-aio-work, any-wiki-renderer-caller]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global <a> override on WikiRenderer (one renderer-level fix vs. per-caller prop threading)"
    - "Direct-lookup branch on stepsQuery — skips the whole pagination + filter pipeline when the upstream linkage already contains the run reference"
    - "Sub-branch traceability via commit-body decision-line citation (`Branch chosen: Direct lookup ... — sub-branch A1`) keeps probe-to-impl audit trail explicit"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
    - taskflow/src/services/aio/projects.ts
    - taskflow/src/services/aio/types.ts
    - taskflow/src/services/aio/issue-steps.ts
    - .planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md

key-decisions:
  - "Global <a> override on WikiRenderer (not per-instance prop) — every WikiRenderer caller had the same Tauri-webview-hijack problem"
  - "Branch A1 (extend traceability) over A2/A3 — Probe C1 confirmed run linkage; C2 (silently ignored) and C3 (all 404) ruled out"
  - "fetchAioTestRunDetail returns { run, steps } in one request (vs. two separate fetches) — minimises round trips on the parallelised per-link loop"
  - "Legacy queryFn path preserved intact for `jiraNumericId === null` — tests-only / migration callers continue to work"
  - "Rule 1 auto-fix: preprocessJiraMarkup normalises `hN.X` and `\\\\` — jira2md leaves both unmodified and real ESHOP content depends on them"

patterns-established:
  - "Wiki content in Tauri webview: always route external <a href> through openUrl with preventDefault — never let the webview navigate in-place to untrusted URLs"
  - "Traceability-extended fetcher: when an existing endpoint already carries the linkage you need to a downstream resource, widen the type extraction rather than adding a new endpoint"
  - "Probe-decision-driven branching in plans: a single `### Decision` line in PROBE-FINDINGS.md picks the implementation sub-branch deterministically"

requirements-completed: [AIOI-02, AIOI-03]

# Metrics
duration: ~30min
completed: 2026-05-13
---

# Phase 54 Plan 06: AIO Step Wiki Rendering + Direct Run Lookup Summary

**WikiRenderer-based step content with openUrl-routed external links + Branch A1 direct lookup (skipping full cycle scan via widened traceability extraction)**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-13T22:12:32Z
- **Completed:** 2026-05-13T22:30:00Z (approx — Task 3 still pending UAT)
- **Tasks:** 2 of 3 implementation tasks complete (Task 3 checkpoint pending)
- **Files modified:** 8 (6 src files + 2 planning docs)

## Accomplishments

- **Finding 1 closed:** Step `step` / `expectedResult` / `actualResult` cells now render via `WikiRenderer` — tables, `{color}`, `{panel}`, `h4.`, `*bold*`, and `\\` hard breaks render correctly on real ESHOP wiki fixtures.
- **External link hijack closed (Finding 1 sub-issue):** `WikiRenderer` now overrides `<a>` globally — external clicks route through `openUrl` from `@tauri-apps/plugin-opener` with `preventDefault`. Tauri webview no longer navigates in-place when a user clicks a Jira-wiki `[name|url]` attachment link. Fix applies to all 7+ WikiRenderer surfaces (issue descriptions, comments, MR descriptions, AIO step content, etc.).
- **Finding 2 closed (Branch A1):** `AioTestRunsSection`'s success path NO LONGER calls `fetchAioCycles` or `fetchAioTestRunsForCycle`. The widened traceability response (Probe C1 confirmed embedded `testRun.ID` + `testCycle.detail.key`) is the sole source of run linkage; `fetchAioTestRunDetail` fetches each run in parallel via `Promise.all`. The full cycle scan that previously paginated thousands of runs on every issue open is gone on the dominant path.
- **Service surface widened cleanly:** new `AioTestCaseWithRuns` and `AioTraceabilityRunRef` types in `aio/types.ts`; new exported `fetchAioTestRunDetail` in `aio/issue-steps.ts`. Legacy `fetchAioTestRunsForCycle` retained for the `jiraNumericId === null` fallback path and any future cross-cycle callers.

## Task Commits

Each task was committed atomically (probe-first plan structure):

0. **Task 0: Probe C — direct run lookup feasibility** — `340153c` (probe, **pre-Plan 54-06 execution**; recorded by the human in the prior session)
1. **Task 1: Render step content via WikiRenderer + route external links through openUrl** — `3bfb0d2` (feat)
2. **Task 2: Replace full cycle scan with direct lookup (Branch A1)** — `16e2f4b` (perf)
3. **Task 3: Human UAT gate** — **pending** (checkpoint:human-verify, not auto-passed; see "Task 3 Pending" below)

**Plan metadata commit:** to be added by the orchestrator after Task 3 closes.

## Files Created/Modified

- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — added global `<a>` override (openUrl + preventDefault on external href; plain `<a>` for `#anchor` / no-href); extended `preprocessJiraMarkup` with two real-data normalisations (`hN.X` and `\\` hard break); fixed `@ts-expect-error` placement after Task 1 biome auto-format.
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — added 3 tests for the `<a>` override (external click calls openUrl exactly once; `#anchor` does NOT call openUrl; falsy href does NOT call openUrl); mocked `@tauri-apps/plugin-opener`.
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — `StepTable` Step / Expected / Actual cells now render via `<WikiRenderer wikiText={...} />` (preserves the dash fallback for `NOT_EXECUTED` / empty actual); `stepsQuery.queryFn` split into Branch A1 direct-lookup path (`jiraNumericId !== null`) and legacy fallback (`jiraNumericId === null`); imported new `fetchAioTestRunDetail`.
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — widened `vi.mock('@/services/aio', ...)` factory to include `fetchAioTraceabilityTestCases` AND `fetchAioTestRunDetail`; mocked `@tauri-apps/plugin-opener`; refreshed stale "INTENDED RED STATE" docstring; added 5 wiki-rendering tests (table, `{color}`, `{panel}`, `[name|url]` + openUrl assertion, `h4.`+bold+hard break) using fixtures pasted verbatim from `54-06-UAT-FINDINGS.md`; added Branch A1 perf test asserting BOTH `fetchAioCycles` AND `fetchAioTestRunsForCycle` were NOT called on the success path AND that the unique run-ID-derived body from the mocked detail response appears in the DOM.
- `taskflow/src/services/aio/projects.ts` — widened `RawTraceabilityItem` to include `testRun?.ID`, `latestTestRun?.ID`, and `testCycle?.detail?.key`; `fetchAioTraceabilityTestCases` now returns `AioTestCaseWithRuns[]` with embedded runs; legacy `AioTestCase` export preserved.
- `taskflow/src/services/aio/types.ts` — added exported `AioTraceabilityRunRef` and `AioTestCaseWithRuns` interfaces (the latter is structurally a superset of `AioTestCase` so existing typed callers continue to compile).
- `taskflow/src/services/aio/issue-steps.ts` — added exported `fetchAioTestRunDetail(baseUrl, token, projectKey, cycleKey, runId)` that returns `{ run: AioTestRun, steps: AioTestRunStep[] } | null` from the same `?assignSteps=true` endpoint already used by `fetchAioTestRunSteps`; introduced `RawRunDetail`, `toRunChipStatus`, and `normalizeRunDate` helpers (private to the module).
- `.planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md` — committed in `340153c` before Plan 54-06 began (Task 0 evidence: Probe C1 yes / C2 silently-ignored / C3 all-404, Decision = Branch A1).

## Decisions Made

- **Branch A1 (winner):** Probe C1 confirmed `testRun.ID` + `testCycle.detail.key` embedded on every traceability item (>=90% coverage). C2 (`?testCaseKey=` / `?testCaseID=` filter) silently ignored, C3 (cross-cycle `/testcase/{key}/testrun`) all-404. A1 is the only viable direct-lookup path.
- **`fetchAioTestRunDetail` returns `{ run, steps }` (not separate fetches):** the run-detail endpoint already returns the run-level status + steps in a single response. Splitting would double the request count on the parallelised per-link loop with no benefit.
- **Legacy path preserved (`jiraNumericId === null`):** existing tests rely on `fetchAioTestCasesForIssue` + `fetchAioCycles` + `fetchAioTestRunsForCycle` + `fetchAioTestRunSteps`. Keeping the path intact avoided a wider test-rewrite blast radius and any potential break for callers that don't yet pass `jiraIssueId`.
- **Global `<a>` override (not per-instance prop):** WikiRenderer is used in 7+ surfaces — every one has the same Tauri-webview-hijack risk. A global override is the single correct fix; per-instance prop threading would have been needless boilerplate.
- **`fetchAioTestRunsForCycle` retained (not deleted):** still used by the legacy `jiraNumericId === null` path and remains a useful primitive for any future cross-cycle aggregation. Removing it now would require a wider test refactor for zero gain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `preprocessJiraMarkup` normalises `hN.X` (no space) and `\\` hard breaks**
- **Found during:** Task 1, while writing the `h4. + bold + hard break` test against the verbatim ESHOP fixture from `54-06-UAT-FINDINGS.md`.
- **Issue:** jira2md leaves `h4.*Steps*` unchanged (output: `####**Steps**`, no space after `####`) — markdown ATX heading requires `#### ` (with space), so the result renders as a `<p>` containing literal `####` text, not as an `<h4>`. Similarly, Jira `\\` hard breaks pass through jira2md unchanged and never become markdown hard breaks. Both are real-data gaps that block the UAT acceptance criteria.
- **Fix:** Added two regex normalisations to `preprocessJiraMarkup` (executes before jira2md): `^(h[1-6]\.)(\S)` → `$1 $2` for the heading-no-space case; `[ \t]*\\\\[ \t]*\n` → `  \n` and `[ \t]\\\\[ \t]` → `  \n` for the hard-break case.
- **Files modified:** `taskflow/src/routes/dashboard/WikiRenderer.tsx` (preprocessJiraMarkup function only).
- **Verification:** `h4. + bold + hard break` test in `AioTestRunsSection.test.tsx` now passes (was failing before the fix); all pre-existing WikiRenderer tests still GREEN (26 + 3 new = 29 passed in WikiRenderer.test.tsx).
- **Committed in:** `3bfb0d2` (Task 1 commit).

**2. [Rule 3 - Blocking] Fixed `@ts-expect-error` placement after Task 1 biome auto-format**
- **Found during:** Task 2, on first `tsc --noEmit` after editing `WikiRenderer.tsx`.
- **Issue:** Task 1's biome auto-format inserted a blank line between the `@ts-expect-error` directive and the `import j2m from 'jira2md'` line, which broke the directive's binding. TypeScript reported `TS2578: Unused '@ts-expect-error' directive` + `TS7016: Could not find a declaration file for module 'jira2md'`.
- **Fix:** Moved the `@ts-expect-error` line to sit directly above the `import j2m from 'jira2md'` line (no blank line between them).
- **Files modified:** `taskflow/src/routes/dashboard/WikiRenderer.tsx` (top imports block).
- **Verification:** `cd taskflow && npx tsc --noEmit` exits 0.
- **Committed in:** `16e2f4b` (Task 2 commit — bundled with the Branch A1 changes that triggered the rebuild).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's existing acceptance criteria (the `h4.` test was already in the plan; the typecheck-clean criterion is mandatory). No scope creep — neither fix changed product behaviour beyond what the plan called for.

## Threat Flags

None — the plan's `<threat_model>` enumerated `T-54-06-01` (Tampering/Spoofing on wiki `<a href>`) as the threat we needed to mitigate, and Task 1's openUrl routing closes it exactly as designed. No new network endpoints, no new auth paths, no new schema changes. `fetchAioTestRunDetail` reuses the same endpoint already in use by `fetchAioTestRunSteps`.

## Issues Encountered

- **Pre-commit hook fails on pre-existing baseline lint warnings:** `npm run check` reports 29 errors (32 before this plan) on files we did NOT touch. Per `feedback_no_verify_lint.md`, `--no-verify` is approved when the hook fails on pre-existing unrelated issues. Both `3bfb0d2` and `16e2f4b` used `--no-verify`; biome on the 8 files we touched is clean (0 errors).
- **Worktree node_modules missing on first `vitest` run:** spawn-time worktree had no `node_modules`. Resolved with `npm install` (243 packages). No `package.json` changes from this plan.

## Task 3 Pending

Task 3 is `checkpoint:human-verify gate=blocking` — the final UAT against a real ESHOP issue. The orchestrator must surface this checkpoint to the human; no automated step can close it. See plan `<how-to-verify>` for the 7 verification steps (wiki content rendering, external link click, ≤2s cold-load perf target on Branch A1, no D-10/D-08 regressions, other WikiRenderer surfaces still working).

## Next Phase Readiness

- Wiki rendering for AIO step content is shipping-ready pending UAT.
- Direct-lookup perf path is shipping-ready pending UAT — measurable target is ≤2s cold-load first-paint on a production-sized cycle.
- No follow-up plan required if UAT passes. If UAT surfaces additional findings, scope a narrow `54-07` (the plan explicitly leaves room for this via the resume-signal protocol).

## Self-Check: PASSED

- `54-06-SUMMARY.md` present at `.planning/phases/54-aio-on-issue-detail/54-06-SUMMARY.md`
- `taskflow/src/routes/dashboard/WikiRenderer.tsx`, `taskflow/src/services/aio/issue-steps.ts` and the other 6 modified files all present
- Commits `340153c` (probe), `3bfb0d2` (Task 1), `16e2f4b` (Task 2) all reachable in `git log --all`

---
*Phase: 54-aio-on-issue-detail*
*Completed: 2026-05-13 (Tasks 0–2 complete; Task 3 pending human UAT)*
