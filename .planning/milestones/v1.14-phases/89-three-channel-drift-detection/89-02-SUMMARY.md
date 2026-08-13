---
phase: 89-three-channel-drift-detection
plan: 02
subsystem: frontend
tags: [pure-logic, drift-detection, gitlab, jira, vitest]

# Dependency graph
requires:
  - phase: 89-01
    provides: GitLabMR widened with target_branch/draft, fetchBranchTargetedMRs/fetchAllProjectMRs/fetchOpenProjectMRs
provides:
  - "driftDetection.ts — the phase's primary pure module: unionMRs, selectChannelA, evaluateBranchDrift, evaluateMilestoneDrift, evaluateTaskDrift, classifyMrState, extractMrTaskKeys, buildDriftRows, countFlaggedMRs, computeRowDriftCount, buildIssueMrIndex"
  - "33 passing unit tests covering every exported function"
affects: [89-03, 89-04, 89-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React-free pure module colocated with its test file, matching releaseSummaries.ts/releaseBranch.ts precedent"
    - "Map<mrId, {mr, channels}> union with per-entry Set<Channel> provenance, first-seen-wins on duplicate id"
    - "D-10 state-classification gate: single `mr.state === 'opened'` check covers open+draft without a separate draft field guard"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
    - taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts
    - .planning/phases/89-three-channel-drift-detection/89-02-SUMMARY.md
  modified: []

key-decisions:
  - "All three plan tasks landed in a single commit (9d1fafc3) instead of three — see Deviations"
  - "wrongMilestoneByKey is empty whenever matchedMilestoneId is null, even though a keyless-milestone MR would otherwise satisfy the 'milestone is absent or differs' offending condition — matches the plan's explicit behavior spec for buildIssueMrIndex"

patterns-established:
  - "Comments that document a forbidden code pattern (e.g. 'do not add a mr.draft guard') must avoid the literal string being grepped for in acceptance criteria — rephrase to reference 'the draft field' instead of writing the exact expression"

requirements-completed: [DRIFT-04, DRIFT-05, DRIFT-06, DRIFT-07, DRIFT-08, DRIFT-09]

# Metrics
duration: ~50min (including one session interruption)
completed: 2026-08-11
---

# Phase 89 Plan 02: Three-Channel Drift Detection Pure Module Summary

**Created `driftDetection.ts`: unions three MR-discovery channels with per-MR provenance, evaluates the three D-10/D-11/D-12-aware drift predicates, assembles deterministically-sorted rows, and derives both the detail-page (D-13) and Releases-list (D-14) drift counts — 33 unit tests, all green.**

## Performance

- **Duration:** ~50 min (one transient network interruption mid-session; work resumed from disk state per coordinator instruction, no redo)
- **Tasks:** 3/3 (functionally complete; committed as 1 commit — see Deviations)
- **Files created:** 3 (driftDetection.ts, driftDetection.test.ts, this SUMMARY)

## Accomplishments

- `unionMRs` / `selectChannelA` — three-channel union into `Map<number, {mr, channels}>` keyed by `mr.id` (not `iid`), first-seen-wins on duplicate id, immutable inputs; Channel A's discovery filter reuses `linkMRToTask` (DRIFT-01/04)
- `evaluateBranchDrift` / `evaluateMilestoneDrift` / `evaluateTaskDrift` / `classifyMrState` — the three drift predicates plus the D-10 state-classification gate. Drafts are evaluated and counted (GitLab's `state` stays `'opened'` for a draft; no separate `draft`-field guard was added). Merged/closed/locked MRs are muted. `evaluateTaskDrift` returns a three-valued `TaskDriftReason` (`'no-linked-task'` | `'not-in-fix-version'` | `null`) per D-11/D-12, checking ALL extracted keys (title + source_branch), not just the first
- `extractMrTaskKeys` — the single source of truth for title+branch key extraction, shared between the TASK predicate and the future UI tooltip
- `buildDriftRows` — assembles the full row set: unevaluated MRs get `na`/`na`/`na`/`flagged: false` with no predicate calls (D-10 gate); evaluated MRs get `na` on BR/MS when `releaseBranchName`/`matchedMilestoneId` is null (D-18 degraded state) while TASK always evaluates; deterministic flagged-first, then-iid-descending sort, proven order-independent of input array order by test
- `countFlaggedMRs` (D-13) — counts flagged ROWS, not flags (an MR with 3 flagged columns contributes 1)
- `computeRowDriftCount` (D-14) — the Releases-list branch+milestone-only count; deliberately excludes TASK; relevance-then-drift two-step filter over a project-wide open-MR fetch
- `buildIssueMrIndex` (D-05/D-06) — re-sources the Issues table's MR cell from the three-channel union, reusing `matchIssuesToMRs` (not reimplemented) and returning byte-identical `matchedRows`/`wrongMilestoneByKey` shapes
- 33 unit tests across 9 `describe` blocks (`unionMRs`, `Channel A`, `evaluateBranchDrift`, `evaluateMilestoneDrift`, `evaluateTaskDrift`, `state classification`, `countFlaggedMRs`, `buildDriftRows`, `computeRowDriftCount`, `buildIssueMrIndex`), including the D-10 draft-is-evaluated regression test and the row-sort order-independence proof
- Full suite: 2297 passed (up from the 89-01 baseline of 2264), 2 skipped, 13 todo — no regressions
- `npx tsc --noEmit` exits 0; `npx biome check` on the two new files exits 0 after one auto-format pass

## Task Commits

1. **Tasks 1–3 (union/Channel A, predicates/state gate, assembly/counts/index)** — `9d1fafc3` (feat) — see Deviations for why this landed as one commit instead of three

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` — the phase's primary deliverable: contract types (`Channel`, `DriftMark`, `TaskDriftReason`, `DriftRow`) plus 11 exported functions (`unionMRs`, `selectChannelA`, `evaluateBranchDrift`, `evaluateMilestoneDrift`, `evaluateTaskDrift`, `classifyMrState`, `extractMrTaskKeys`, `buildDriftRows`, `countFlaggedMRs`, `computeRowDriftCount`, `buildIssueMrIndex`), 351 lines
- `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts` — 33 tests, `makeMR`/`makeIssue` fixture builders copied from `releaseSummaries.test.ts`'s harness style
- `.planning/phases/89-three-channel-drift-detection/89-02-SUMMARY.md` — this file

## Decisions Made

- `buildIssueMrIndex`'s `wrongMilestoneByKey` is guarded to stay empty whenever `matchedMilestoneId` is null — the plan's behavior spec explicitly states "with `matchedMilestoneId: null` returns every `mr` as null and an empty `wrongMilestoneByKey`", so the offending-MR scan only runs when a milestone id exists to compare against.

## Deviations from Plan

### Process deviation (not a functional deviation)

**1. All three tasks landed in a single commit instead of three atomic per-task commits**
- **Found during:** commit step, after a transient network interruption (ENOTFOUND) cut the session mid-flow
- **What happened:** The implementation was authored as one continuous pass across all three tasks' scope (the union/predicates/assembly logic is tightly interdependent — `buildDriftRows` in Task 3 calls `unionMRs` from Task 1 and `classifyMrState`/the three predicates from Task 2, and the test file's `describe` blocks were written incrementally against the growing implementation in the same editing session). By the time the pre-commit hook's full-suite run first went green, all three tasks' code was already present together, and the network interruption occurred immediately before the first commit was made — so there was no earlier committed checkpoint to split from.
- **Why not split retroactively:** Splitting the single on-disk diff into three commits after the fact (e.g. via `git add -p`) would require either (a) temporarily reverting later-task code to fabricate a Task-1-only state that never actually existed as a real intermediate step, which would misrepresent the actual implementation history, or (b) committing files that reference not-yet-defined functions, which would fail `tsc --noEmit` in the pre-commit hook (this repo's hook runs the full test suite and cannot be bypassed with `--no-verify` per the execution protocol). Neither option produces an honest per-task commit history, so the work was committed as a single commit with a full task-by-task description in the commit message body instead.
- **Additional context — the RED/GREEN TDD split was also not separately committed:** an initial RED-only test file (importing from a not-yet-existing `driftDetection.ts`) was manually verified to fail via `npx vitest run` before implementation began (confirming the TDD RED step was genuinely exercised), but this repo's husky pre-commit hook runs the FULL test suite (not just changed files) and blocks any commit that leaves a test failing — so a RED-only commit was not possible without `--no-verify`, which is prohibited. The RED state was verified manually instead of via a standalone commit.
- **Impact:** No functional impact — all acceptance criteria for all three tasks are met and independently verifiable (see Self-Check below). The only effect is that `git log` shows one commit spanning all three tasks' file changes instead of three.

## Issues Encountered

- One transient network error (ENOTFOUND) interrupted the session between finishing implementation/verification and running the first `git commit`. No work was lost — the coordinator's resume message confirmed both files were intact on disk and the full suite was green at the point of interruption. Verification (`npx vitest run`, `npx tsc --noEmit`) was re-run after resuming and reconfirmed green before committing.

## User Setup Required

None.

## Next Phase Readiness

- `driftDetection.ts` exports everything the phase's remaining plans need: `buildDriftRows`/`DriftRow` for the new MR-drift section component, `countFlaggedMRs` for the detail-page aggregate, `computeRowDriftCount` for `ReleasesTab.tsx`'s D-15 indicator slot, and `buildIssueMrIndex` for re-sourcing `IssuesSection.tsx`'s MR cell (D-05/D-06).
- The D-10 draft-is-evaluated regression test (`state classification` describe block) stands guard against a future refactor reverting to DRIFT-08's literal text, per the threat register's T-89-08 mitigation.
- `UnmatchedMRsSection.tsx` deletion (D-02, absorbed into the new section) and `useReleaseDetail.ts` wiring (three new queries) are out of this plan's scope — deferred to later waves per the plan's file list (`driftDetection.ts`/`.test.ts` only).

---
*Phase: 89-three-channel-drift-detection*
*Completed: 2026-08-11*

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` — FOUND on disk
- `taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts` — FOUND on disk
- Commit `9d1fafc3` — FOUND in `git log --oneline`
- `npx vitest run src/routes/dashboard/release-detail/driftDetection.test.ts` — 33/33 passed
- `npx vitest run` (full suite) — 2297 passed, 2 skipped, 13 todo, 0 failed
- `npx tsc --noEmit` — exits 0
- All acceptance-criteria greps (React-free, D-10/D-11 mentions, no `new RegExp`, no `mr.draft`/`due_date` literal, `state === 'opened'` gate present, `matchIssuesToMRs` reused, `computeRowDriftCount` excludes `evaluateTaskDrift`) — confirmed passing
