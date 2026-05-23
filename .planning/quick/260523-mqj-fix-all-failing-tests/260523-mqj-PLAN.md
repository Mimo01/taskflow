---
quick_id: 260523-mqj
type: quick
plan: 1
description: fix all failing tests
files_modified: []  # Determined at runtime by test failures
autonomous: true

must_haves:
  truths:
    - "Running `npm test` from taskflow/ exits 0 (all tests pass)"
    - "No tests are silently skipped to hide failures"
    - "Each fix has a clear root-cause-driven justification (not symptom suppression)"
  artifacts:
    - path: ".planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md"
      provides: "Triage report of initial failure clusters and chosen fix strategy per cluster"
  key_links:
    - from: "vitest run"
      to: "exit code 0"
      via: "all test files pass under jsdom environment"
      pattern: "Test Files .* passed"
---

<objective>
Fix all failing tests in the taskflow/ Vitest suite.

Purpose: Restore green test suite so future work can rely on tests as a quality gate. Several stores, hooks, and components have tests; failures here block trustworthy CI signal.
Output: Triage file (FAILURES.md), source/test edits that resolve each failure cluster at the root cause, and a green `npm test` run.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/package.json
@/Users/mimo/Documents/Projects/taskflow/taskflow/vitest.config.ts

# Test runner
# - Command: `npm test` (resolves to `vitest run`) — MUST be run from `taskflow/` (the inner workspace), NOT the repo root
# - Environment: jsdom, globals enabled, setup file at `src/test/setup.ts`
# - `passWithNoTests: true` is set — DO NOT rely on "no tests found" as a pass signal; the suite has ~20+ files
#
# Project gotchas (load-bearing — read STATE.md decisions section before editing source):
# - `jira.ts` dual-file gotcha: imports come from `jira.ts` (legacy), NOT `jira/` modules. Edit `jira.ts` if a test fails against jira logic.
# - Timezone bucketing: use `.slice(0, 10)` on string timestamps, NEVER `toLocaleDateString()` (Phase 62 decision).
# - Tempo pagination defaults to 50 records — paginate to exhaustion if a test mocks paginated responses.
#
# Lint/format: project uses Biome (`npm run check`). Do NOT introduce lint regressions; do NOT run `--no-verify` unless a pre-commit hook fails on PRE-EXISTING unrelated warnings (per user memory).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Triage failing tests and write FAILURES.md</name>
  <files>.planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md</files>
  <action>
Run the full Vitest suite from the `taskflow/` directory:

    cd taskflow && npm test 2>&1 | tee /tmp/260523-mqj-initial.log

Then create `.planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md` containing:

1. Summary line: total test files passed/failed, total tests passed/failed/skipped.
2. A bullet list of every failing test file with:
   - File path (e.g. `src/stores/auth.store.test.ts`)
   - Failing test name(s)
   - One-line failure cause (error message head, e.g. `TypeError: Cannot read properties of undefined (reading 'foo')` or `expected 5, received 4`).
3. Cluster the failures by root cause. Clusters are groups that likely share ONE fix (e.g. "all stores using `localStorage` mock signature drift" or "all components depending on changed `jira.ts` export shape"). Each cluster gets:
   - A cluster ID (C1, C2, ...)
   - The list of failing tests in it
   - A proposed fix strategy (one sentence — what file/abstraction to change, and whether the fix lives in source code or test setup)
4. If `npm test` exits 0 (suite already green), write FAILURES.md with `## Status: GREEN` and skip Task 2 — proceed directly to Task 3 to confirm.

Do NOT edit any source/test files in this task. Triage only.
  </action>
  <verify>
    <automated>test -f .planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md && grep -E "^## (Status|Cluster|Failures)" .planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md</automated>
  </verify>
  <done>FAILURES.md exists with summary, per-file failures, and clustered fix strategy (or a GREEN status note if no failures exist).</done>
</task>

<task type="auto">
  <name>Task 2: Fix each cluster at the root cause</name>
  <files>(determined per cluster — record actual paths in commit messages)</files>
  <action>
Work through clusters in FAILURES.md in order. For each cluster:

1. Re-read the failing tests AND the production code they exercise to confirm the root cause (not just the symptom).
2. Decide whether the bug is in:
   a. **Production code** — fix the source file. The test was right.
   b. **Test code** — fix the test (drifted mock signatures, stale fixtures, brittle assertions on implementation details). The production code was right.
   c. **Test setup / mocks** — fix `src/test/setup.ts` or shared test helpers. Multiple tests broke for the same reason.
3. Apply the fix. Re-run ONLY that file's tests to confirm:

       cd taskflow && npm test -- <path-to-test-file>

4. Commit the cluster fix with a message like:

       fix(tests): <cluster description> (cluster C<N>)

   Bundle multiple files in one commit ONLY when they share a single root cause (per FAILURES.md cluster). Otherwise one commit per logical fix.

Rules — do NOT:
- Skip tests with `.skip` / `.only` to make the suite pass. If a test is genuinely obsolete (production code legitimately removed), DELETE the test and note WHY in the commit message.
- Loosen assertions (e.g. `expect(x).toBeTruthy()` instead of `expect(x).toBe(5)`) to dodge a real bug.
- Add catch-all try/swallow around assertions.
- Edit `jira/` modules when fixing jira-related test failures — edit `jira.ts` (dual-file gotcha, see context).
- Run `git commit --no-verify` unless the pre-commit hook fails on unrelated pre-existing warnings (and note that in the commit).

If a cluster's fix turns out to require redesign beyond a test fix (e.g. an API contract change with cascading impact), STOP, document the blocker in FAILURES.md under that cluster, and surface it in the summary instead of forcing a fix.
  </action>
  <verify>
    <automated>cd taskflow && npm test 2>&1 | tail -20 | grep -E "Test Files.*passed|Tests.*passed" | grep -v "failed"</automated>
  </verify>
  <done>Every cluster in FAILURES.md is either marked FIXED with a commit ref, or marked BLOCKED with a written explanation. No clusters left in unknown state.</done>
</task>

<task type="auto">
  <name>Task 3: Confirm green suite and record outcome</name>
  <files>.planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md</files>
  <action>
Run the full suite one final time from a clean state:

    cd taskflow && npm test 2>&1 | tee /tmp/260523-mqj-final.log

Append a `## Final Result` section to `FAILURES.md` containing:
- Final tally: `Test Files: N passed (N)` and `Tests: N passed (N)` (copy from vitest summary line)
- List of commits made during Task 2 (short SHA + subject)
- Any clusters left as BLOCKED, with rationale and recommended follow-up

Then run a final sanity check that Biome is still happy on touched files:

    cd taskflow && npm run check

If Biome surfaces issues introduced by the test fixes, fix them. If it surfaces pre-existing unrelated warnings, leave them and note in the summary.

If the final `npm test` is NOT green (e.g. clusters remain BLOCKED), the plan finishes in a partial state — DO NOT pretend it succeeded. The Final Result section must reflect reality.
  </action>
  <verify>
    <automated>cd taskflow && npm test 2>&1 | tail -5 | grep -qE "Test Files +([0-9]+) passed \(\1\)" && grep -q "## Final Result" .planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md</automated>
  </verify>
  <done>`npm test` exits 0 with all test files passing, OR FAILURES.md documents remaining BLOCKED clusters with rationale. Final Result section written either way.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm test` exits 0 (or remaining failures are explicitly BLOCKED and documented).
- No `.skip` / `.only` added to dodge failures.
- FAILURES.md contains triage, per-cluster fix notes, and Final Result.
- Biome check (`npm run check`) does not regress on files touched by this plan.
</verification>

<success_criteria>
- Full Vitest suite is green when run from `taskflow/` (or every non-green test has a written, justified BLOCKED entry in FAILURES.md).
- Each fix is committed with a message identifying the cluster and root cause.
- No test was muted, skipped, or had its assertions weakened to fake a pass.
</success_criteria>

<output>
Create `.planning/quick/260523-mqj-fix-all-failing-tests/260523-mqj-SUMMARY.md` when done, listing:
- Final test tally
- Per-cluster outcome (FIXED / BLOCKED + commit SHA + one-line root cause)
- Any follow-up work surfaced during triage
</output>
