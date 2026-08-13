---
phase: 90-per-mr-corrective-actions
plan: 01
subsystem: api
tags: [gitlab, error-handling, service-layer, vitest]

# Dependency graph
requires:
  - phase: 89-three-channel-drift-detection
    provides: MrDriftSection.tsx, driftDetection.ts, useReleaseDetail.ts (the mutation targets this endpoint will be wired into by later plans in this phase)
provides:
  - flattenGitLabError — the single shared normaliser for all three GitLab error-body shapes (string, string[], field-keyed object), never [object Object]
  - updateMergeRequest — the phase's only new GitLab write endpoint, PUT target_branch/milestone_id only
  - probe.sh + 90-PROBE-RESULTS.md — roadmap-mandated D-16 probe scaffold, committed but not yet run against live GitLab
affects: [90-02, 90-03, 90-04 (later plans in this phase that wire updateMergeRequest into useReleaseDetail mutations)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flattenGitLabError as the single shared error-body normaliser — future GitLab write endpoints should call it instead of reinventing a narrower widening"
    - "Explicit-pick request body construction (never spread/stringify the raw fields argument) for any endpoint with a caller-controllable field allowlist"

key-files:
  created:
    - .planning/phases/90-per-mr-corrective-actions/probe.sh
    - .planning/phases/90-per-mr-corrective-actions/90-PROBE-RESULTS.md
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts

key-decisions:
  - "Probe not run — no live GitLab PAT available in this execution environment; 90-PROBE-RESULTS.md written as an honest status: not-run record per orchestrator instruction, not fabricated"
  - "A1 (RESEARCH Open Question) left UNRESOLVED (probe D skipped) — non-blocking because flattenGitLabError already handles all three known GitLab error-body shapes defensively"
  - "updateMilestone/createBranch/createMilestone deliberately left byte-unchanged — back-porting flattenGitLabError into them is out of scope for this plan"

patterns-established:
  - "flattenGitLabError(body: unknown): string | undefined — three-branch normalisation (string as-is, array joined with ', ', field-keyed object joined with '; ') for any new GitLab write endpoint's error handling"

requirements-completed: [MRFIX-01, MRFIX-02]

# Metrics
duration: 9min
completed: 2026-08-11
---

# Phase 90 Plan 01: Service-Layer Foundation & Probe Summary

**`updateMergeRequest` added to gitlab.ts as the phase's only new GitLab write endpoint, backed by a shared `flattenGitLabError` normaliser that closes the carried-forward WR-01 `[object Object]` defect; the roadmap-mandated D-16 approval/protected-branch probe is scaffolded and committed but not run — no live GitLab PAT was available in this execution environment.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-11T14:02:39+02:00
- **Completed:** 2026-08-11T14:11:16+02:00
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `probe.sh` written, covering the three read-only endpoints (project approvals, sample-MR approvals, fully paginated protected branches) plus one deliberately-invalid PUT to capture RESEARCH Open Question A1's error-shape ground truth — token-safe, no valid write possible
- `90-PROBE-RESULTS.md` recorded honestly as `status: not-run` with all four required headings intact, so the file shape stays valid for downstream agents and a future re-run is obviously owed
- `flattenGitLabError` added as the single shared normaliser for GitLab's three error-body shapes (D-10, closes 88-REVIEW WR-01 for this phase's write path)
- `updateMergeRequest` added — PUTs only `target_branch`/`milestone_id` through `apiFetch('gitlab', ...)`, explicit-pick body construction (T-90-01), 401/403 → `ApiError`, other non-2xx → `Error`, both composed only from `flattenGitLabError` or a fixed literal (T-90-02)
- 16 new tests (9 `updateMergeRequest` + 7 `flattenGitLabError`) added to `gitlab.test.ts`; full suite green (2322 passed, 0 failed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the read-only approvals / protected-branch probe script** - `7f11ac15` (feat)
2. **Task 2: Run the probe against live GitLab and record 90-PROBE-RESULTS.md** - `18b620b0` (docs) — recorded as `not-run`, no live PAT available
3. **Task 3: Add flattenGitLabError and updateMergeRequest to gitlab.ts** - `86385652` (feat)

_No separate plan-metadata commit yet — the final `docs(90-01): complete...` commit follows this SUMMARY._

## Files Created/Modified

- `.planning/phases/90-per-mr-corrective-actions/probe.sh` - read-only approvals/protected-branch probe + one deliberately-invalid scratch PUT for error-shape ground truth
- `.planning/phases/90-per-mr-corrective-actions/90-PROBE-RESULTS.md` - honest not-run record; D-16 ruling restated in full
- `taskflow/src/services/gitlab.ts` - added `flattenGitLabError` and `updateMergeRequest`
- `taskflow/src/services/gitlab.test.ts` - added `describe('flattenGitLabError')` and `describe('updateMergeRequest')`

## Decisions Made

- Probe not run in this environment (no live GitLab PAT reachable); `90-PROBE-RESULTS.md` written as an honest `status: not-run` record rather than fabricated or reconstructed output, per explicit orchestrator instruction and the hard prohibition on fabricating probe output.
- A1 left `UNRESOLVED (probe D skipped)` — does not block Task 3 because `flattenGitLabError`'s three-branch normalisation already covers every documented GitLab error-body shape (string, string[], field-keyed object) regardless of which one this instance actually emits.
- D-16 ruling restated as holding a fortiori while the probe is unrun: an unanswered probe is not license to add defensive UI (no confirm dialog, no warning, no tooltip line).

## Deviations from Plan

### Auto-fixed Issues

None — Task 3 followed RESEARCH Pattern 1/2 exactly as specified (three-branch flattener; `updateMilestone` skeleton for the PUT function; explicit-pick body per the T-90-01 threat mitigation).

**1. [Checkpoint routing] Task 2 written as `not-run` instead of live probe output**
- **Found during:** Task 2 (checkpoint:human-verify)
- **Issue:** The plan's checkpoint expected the developer to paste live probe output. This execution environment has no shell access to a GitLab PAT (it lives in the Tauri Stronghold vault, unreadable here), and the orchestrator explicitly instructed not to wait for or fabricate output.
- **Resolution:** Wrote `90-PROBE-RESULTS.md` as an honest `status: not-run` documentation record with all four required headings, A1 marked `UNRESOLVED (probe D skipped)`, and the D-16 ruling restated in full per the orchestrator's exact wording.
- **Files modified:** `.planning/phases/90-per-mr-corrective-actions/90-PROBE-RESULTS.md`
- **Verification:** All Task 2 acceptance-criteria greps pass (four headings present, A1 line matches, `reset_approvals_on_push:` literal present, "no confirm dialog"/"no warning" present, no leaked credential pattern, no `taskflow/src` file touched).
- **Committed in:** `18b620b0`

---

**Total deviations:** 1 (checkpoint routing, orchestrator-directed — not a Rule 1-4 auto-fix)
**Impact on plan:** No scope creep. Task 3 proceeded exactly as written since `flattenGitLabError`'s defensive coverage of all three error shapes makes the probe non-blocking for the phase's actual code.

## Issues Encountered

None beyond the probe-environment constraint documented above.

## User Setup Required

None - no external service configuration required. **However, the live-GitLab probe is still owed**: re-run `.planning/phases/90-per-mr-corrective-actions/probe.sh` with a real `GITLAB_PAT`, `SAMPLE_MR_IID` (an MR with ≥1 approval), and `SCRATCH_MR_IID` (a throwaway MR) when shell access to the vault-stored PAT is available, then replace the `## Raw output` / `## Findings` / `## A1 resolution` sections of `90-PROBE-RESULTS.md` with the live result.

## Open Item for the Phase

**The D-16 roadmap probe was never run, and RESEARCH Open Question A1 remains unresolved.** This is flagged explicitly as a carried-forward open item for Phase 90 (not silently dropped): `90-PROBE-RESULTS.md` is marked `status: not-run` and `probe.sh` is ready to execute. It does not block any code in this plan or subsequent plans in this phase — `flattenGitLabError` handles all three known GitLab error-body shapes defensively regardless of which one this instance actually emits — but the approval-reset/protected-branch fact base for this team's project is still unconfirmed.

## Next Phase Readiness

- `updateMergeRequest` and `flattenGitLabError` are ready for later plans in this phase to wire into `useReleaseDetail.ts`'s retarget/assign-milestone mutations (modelled on `createBranchMutation`/`createMilestoneMutation`)
- No blockers for Plan 02 onward; the unresolved probe is documentation-only and does not gate mutation wiring per D-16

---
*Phase: 90-per-mr-corrective-actions*
*Completed: 2026-08-11*
