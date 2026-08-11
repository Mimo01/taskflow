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

## Live UAT (Plan 04)

**Note:** this section records the Plan 04 Task 2 live-UAT checkpoint outcome only. It is a separate activity from the D-16 read-only probe above — the probe (`probe.sh`) was still never run in this execution environment. `status: not-run` above continues to describe the probe, not the UAT.

**Verdict:** approved — the developer ran the app against the live GitLab instance and replied verbatim "approved" to all ten checkpoint steps, including step 3 (the manual Tab-key / `group-focus-visible/fix:` focus-reveal check that jsdom could not prove — now resolved by human verification, not by an automated test).

**Per-step record** (blanket approval; no per-step detail was volunteered by the developer beyond "approved" — nothing below is fabricated):

1. Reveal (D-01/D-02/D-03) — passed (no detail reported)
2. Tooltips (D-03) — passed (no detail reported)
3. Keyboard focus reveal (D-04, `group-focus-visible/fix:`) — passed (no detail reported)
4. Retarget (MRFIX-01, D-06) — passed (no detail reported)
5. Assign milestone (MRFIX-02) — passed (no detail reported)
6. Independence (MRFIX-03, D-09) — passed (no detail reported)
7. Failure + retry (D-07/D-08/D-10) — passed (no detail reported); the plan required recording the verbatim failure-tooltip text as ground truth for D-10, but no tooltip text was reported by the developer, so none is recorded here — **not fabricated**
8. Unavailable (MRFIX-04, D-14) — passed (no detail reported)
9. Degraded (D-15) — passed (no detail reported)
10. Approval side effect (D-16, observation only) — **not reported**. The GitLab probe remains unrun and RESEARCH Open Question A1 remains `UNRESOLVED (probe D skipped)`; this UAT approval does not resolve either. Both stay as open items for the phase.

**MR iids exercised:** not reported by the developer.

**D-16 honoured: no confirm dialog, no warning, no toast on retarget** — per the developer's blanket "approved" covering steps 4/6, which explicitly required no dialog/warning/toast to appear.
