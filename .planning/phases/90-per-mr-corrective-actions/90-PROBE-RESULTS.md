# Phase 90 Probe Results — MR-approval / protected-branch rules (D-16)

## Status

`status: not-run`

## Raw output

PROBE NOT RUN — the developer has no shell access to a live GitLab PAT in this environment (2026-08-11). `probe.sh` is committed and ready; re-run it and replace this section when live access is available.

## Findings

- `reset_approvals_on_push: NOT PROBED`
- `approved_by_count: NOT PROBED`
- `release_pattern_protected: NOT PROBED`

## A1 resolution

No `http_status`/`response_body` captured — PROBE D was never run.

`A1: UNRESOLVED (probe D skipped)`

Per the plan this does NOT block Task 3: `flattenGitLabError` handles all three GitLab error-body shapes (string, string[], field-keyed object) defensively regardless of which one this instance actually emits.

## D-16 ruling

Per **D-16** (hard user decision), this result changes no UI: no confirm dialog, no warning, no extra tooltip line on retarget, whatever the approval/protected-branch answer turns out to be — regardless of outcome. Downstream agents must not reintroduce friction on retarget citing this evidence.

D-16 holds a fortiori while the probe is unrun. An unanswered probe is not license to add defensive UI; the no-dialog decision stands exactly as if the probe had returned a benign result.
