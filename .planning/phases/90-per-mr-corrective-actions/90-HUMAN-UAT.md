---
status: partial
phase: 90-per-mr-corrective-actions
source: [90-VERIFICATION.md]
started: 2026-08-11T16:10:00Z
updated: 2026-08-11T16:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Re-verify MRFIX-03 independence after the CR-01 fix

The original live UAT (Plan 04, step 6) was approved against code that still had the
CR-01 rollback defect: a whole-array cache restore meant a *failing* action reverted a
sibling action's already-successful write. The fix (commit `8e8e4676`) replaced this with
a field-scoped inverse patch and is covered by a passing regression test that asserts
cache contents directly — but no human has re-confirmed it against live GitLab.

The original UAT would not have caught this: it only surfaces when one action FAILS while
the other SUCCEEDS. A clean run where both succeed looks identical either way.

expected: On an MR row flagged in both BR and MS columns — click MS (let it succeed),
then click BR against a target that will FAIL (e.g. disconnect the network, or use a
locked/closed MR). The BR cell turns red with a readable tooltip. **The MS cell must KEEP
its green check** — it must not revert to an orange `⚠` flag. Then trigger a background
refetch (switch window away and back): the MS success and the BR red state both persist.
result: [pending]

### 2. Run the roadmap-mandated GitLab probe (D-16)

`probe.sh` is committed and ready but was never run — no GitLab PAT was reachable in any
execution environment across all four plans. `90-PROBE-RESULTS.md` is recorded
`status: not-run` and RESEARCH Open Question A1 remains `UNRESOLVED (probe D skipped)`.

Per decision D-16 the outcome changes NO UI regardless of the answer, so this does not
block the phase goal — but it is an explicit roadmap deliverable that remains unfulfilled.

expected: From the repo root, with a live PAT in the environment:
`GITLAB_BASE_URL="https://git.devel.sun.orange.sk" GITLAB_PAT="<pat>" PROJECT_ID="455" SAMPLE_MR_IID="<approved MR>" SCRATCH_MR_IID="<throwaway MR>" bash .planning/phases/90-per-mr-corrective-actions/probe.sh`
Then replace the `## Raw output`, `## Findings`, and `## A1 resolution` sections of
`90-PROBE-RESULTS.md` with the real output. PROBE D is expected to FAIL with a 4xx —
that failure body is the A1 ground truth. A 2xx means the scratch MR's target branch was
changed and needs a manual revert in GitLab.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
