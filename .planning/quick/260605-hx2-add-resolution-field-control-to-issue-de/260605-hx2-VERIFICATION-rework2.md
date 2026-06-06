---
phase: 260605-hx2-add-resolution-field-control-to-issue-de (rework2 — board drag-to-done resolution picker)
verified: 2026-06-06T16:52:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification:
  previous_status: issues_found (REVIEW-rework2)
  previous_score: n/a (review, not verification)
  gaps_closed:
    - "CR-01: concurrent drag during pending probe/dialog now guarded by dragTokenRef bail-after-await"
    - "CR-02: pendingResolution overwrite prevented (sync guard rejects 2nd drop) + dialog keyed by issueKey + selectedId reset on issueKey/allowedValues change"
    - "WR-01: block branch now clears pendingResolution for the same issue"
    - "WR-02: probe-failure with transition.hasScreen=true surfaces a card error and fires NO request; only no-screen failures fall back to plain"
    - "WR-04: end-to-end handleDragEnd tests added (dialog / block / probe-failure hasScreen true+false / concurrent-drag race)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Drag a story into the Done column on the live ESHOP sprint board"
    expected: "A resolution-picker dialog (BoardResolutionDialog) appears; the card has NOT moved yet. Picking a resolution + Confirm moves the card and Jira shows the resolution set on the issue."
    why_human: "Whether the ESHOP Done transition actually exposes fields.resolution.allowedValues is a live-Jira-config-dependent runtime probe; cannot be verified without the live instance."
  - test: "Drag a story into a non-resolution-capable column (e.g. In Progress)"
    expected: "Card moves immediately, no dialog, no resolution field in the POST body."
    why_human: "Depends on live workflow config for which transitions are resolution-capable."
  - test: "Open the resolution dialog from a drag, then click Cancel"
    expected: "No transition fires; card stays in its original column."
    why_human: "Visual / interaction confirmation on the live board."
---

# Phase 260605-hx2 rework2: Board Drag-to-Done Resolution Picker — Verification Report

**Phase Goal:** Dragging a story into a resolution-capable transition (e.g. Done) on the sprint board presents a resolution picker modal; confirming executes the transition with `fields.resolution`; non-resolution-capable transitions transition immediately with no fields; cancel performs no transition; required-but-empty allowedValues blocks (no doomed request). Concurrency races must be guarded. Source root is the nested `taskflow/` dir.
**Verified:** 2026-06-06T16:52:00Z
**Status:** human_needed
**Re-verification:** Yes — verifying the fixes for REVIEW-rework2 findings (CR-01/CR-02/WR-01/WR-02/WR-04) against the actual codebase.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Dragging into a resolution-capable transition opens a resolution-picker dialog instead of moving the card immediately | ✓ VERIFIED | `handleDragEnd` async probe (SprintBoardTab.tsx:1165-1223): `decision.kind === 'dialog'` → `setPendingResolution(...)` with no optimistic move; dialog rendered at :1814-1829. End-to-end test (d=test a) :950-986 asserts dialog opens with correct issueKey + allowedValues and `postTransition` NOT called. |
| 2 | Confirming a resolution executes the dragged transition with `fields.resolution` and the card moves | ✓ VERIFIED | `handleResolutionConfirm` (:1257-1269) → `handleTransition(..., resolution)` → `postTransition(..., { resolution })` (:1337-1340). Forwarding shape proven at unit level: transitions.test.ts:54-73 asserts body `fields: { resolution: { id } }` and `{ resolution: null }`. Dialog payload proven: SprintBoardTab.test.tsx:808-849 (`{id}` and `null`). |
| 3 | Cancelling the dialog performs no transition and the card stays in place | ✓ VERIFIED | `onOpenChange` (:1821-1823) clears `pendingResolution` only; no transition call. Card never optimistically moved (truth 1). Cancel button is a `DialogClose` (BoardResolutionDialog.tsx:103). |
| 4 | Dragging into a non-resolution-capable transition transitions immediately with no fields | ✓ VERIFIED | `decision.kind === 'plain'` branch (:1244-1253) calls `handleTransition` with NO resolution arg → `postTransition(...)` 4-arg (no fields, :1341-1343). Context-menu 4-arg test :853-905 asserts `call).toHaveLength(4)`. transitions.test.ts:75-83 asserts `fields` key absent. |
| 5 | Required-but-empty resolution (allowedValues length 0) blocks with a message and fires no request | ✓ VERIFIED | `resolveDropResolution` returns `{kind:'block'}` for `required && empty/absent` (transitions.ts:65-67); branch (:1225-1241) sets card error and returns. transitions.test.ts:166-173 (block branches). End-to-end test b :988-1020 asserts message shown + `postTransition` NOT called. |
| 6 | Existing right-click / context-menu transition callers are unaffected | ✓ VERIFIED | `handleTransition` uses rest-param presence check (`resolutionArg.length`, :1300-1302); context-menu callers (:1654, :1769) pass 4 args. Test :853-905 confirms exactly-4-arg `postTransition`. |

**Score:** 6/6 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `taskflow/src/services/jira/transitions.ts` | pure `resolveDropResolution` three-branch helper | ✓ VERIFIED | :57-69 PURE (reads only `meta.fields.resolution`, no React/network); imports only ApiError/apiFetch/types. Three branches match StatusPopover handleSelect (:119-138) exactly. |
| `taskflow/src/routes/dashboard/BoardResolutionDialog.tsx` | presentational picker dialog (≥40 lines) | ✓ VERIFIED | 111 lines; Dialog primitives reused; allowedValues + Unresolved option; `onConfirm` `{id}`/`null`; `selectedId` reset on issueKey/allowedValues change (CR-02 defense). |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | async probe + dialog wiring + handleTransition forwarding | ✓ VERIFIED | probe keyed on dragged issue status id (:1169-1177); dialog/block/plain branches; concurrency guards; dialog rendered (:1814-1829). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| SprintBoardTab.tsx | `fetchIssueTransitionsWithFields` | `queryClient.fetchQuery` on drop | ✓ WIRED | :1168-1177, keyed via `transitionsWithFieldsKey(issueKey, baseUrl, draggedIssue.fields.status?.id)`. |
| SprintBoardTab.tsx | `resolveDropResolution` | classify matched REST transition | ✓ WIRED | :1208 `const decision = resolveDropResolution(meta)`; `meta = list.find(t => t.id === transitionId)` :1180. |
| SprintBoardTab.tsx | `postTransition` | `handleTransition` resolution → `fields.resolution` | ✓ WIRED | :1337-1343 presence-checked forwarding. |
| BoardResolutionDialog.tsx | Dialog primitives | import from `@/components/ui/dialog` | ✓ WIRED | :13-21 `DialogContent` etc. |
| jira.ts barrel | `resolveDropResolution` | re-export | ✓ WIRED | jira.ts:611-616 re-exports from `./jira/transitions` (dual-file gotcha honored). |

### Concurrency Guards (CONTEXT-mandated)

| Guard | Status | Evidence |
| ----- | ------ | -------- |
| dragTokenRef bail-after-await | ✓ VERIFIED | token captured :1146; bumped in handleDragStart :1092; bail checks after every await/branch (:1179, :1183, :1213, :1227, :1244). |
| pendingResolution not clobbered | ✓ VERIFIED | sync guard rejects 2nd drop while a dialog is open (:1153-1158); post-await re-check (:1213). |
| dialog keyed by issueKey | ✓ VERIFIED | `key={pendingResolution.issueKey}` :1819 + `selectedId` reset effect (BoardResolutionDialog.tsx:57-59). |
| block clears pendingResolution | ✓ VERIFIED | :1232 `setPendingResolution((prev) => prev?.issueKey === issueKey ? null : prev)`. |
| probe-failure hasScreen=true surfaces error (no doomed request) | ✓ VERIFIED | :1190-1195 card error + return; only `hasScreen` false/absent falls back to plain (:1198-1205). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Target test suites green | `npx vitest run src/services/jira/transitions.test.ts src/routes/dashboard/SprintBoardTab.test.tsx` | 2 files, 40 tests passed | ✓ PASS |
| Biome + tsc clean | `npm run check` | Checked 461 files, no fixes applied; tsc no errors | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX in modified files; WR-* references are review IDs in comments documenting intentional design, not unresolved debt | ℹ️ Info | None |

### Test Coverage Note (informational, not a gap)

The plan's Task 3 Part C asked to "drive ONE case where the caller forwards a resolution and assert `postTransition` receives a 5th arg `{ resolution: { id } }`" on the board component. No board-level test asserts the 5-arg `postTransition` call directly. However the forwarding shape IS proven:
- `postTransition` nesting `{ resolution: { id } }` and `{ resolution: null }` → transitions.test.ts:54-73.
- Dialog forwards `{id}`/`null` via onConfirm → SprintBoardTab.test.tsx:808-849.
- `handleResolutionConfirm` → `handleTransition(..., resolution)` → presence-forward to `postTransition` is straight-line code (SprintBoardTab.tsx:1257-1269, 1337-1340).

The complete confirm path is correct in code and proven in composition; only the single integrated 5-arg board assertion is absent. WARNING-level test-coverage observation, not a goal failure — every observable truth is independently verified.

### Human Verification Required

1. **Drag-to-Done opens picker on live ESHOP** — drag a story to Done; expect dialog (card not yet moved); pick + Confirm → card moves and Jira shows resolution. Why human: whether the ESHOP Done transition actually exposes `fields.resolution.allowedValues` is a live-Jira-config-dependent runtime probe.
2. **Non-resolution-capable drag moves immediately** — expect immediate move, no dialog, no resolution in POST. Why human: depends on live workflow config.
3. **Cancel performs no transition** — open dialog from a drag, click Cancel; expect no transition, card stays put. Why human: live-board interaction confirmation.

### Gaps Summary

No blocking gaps. All six observable truths are verified against the actual codebase (`taskflow/src/...`): the pure helper, the dialog component, the async probe with the three branches, the presence-checked `postTransition` forwarding, and all five CONTEXT-mandated concurrency guards are present and exercised by tests. `npx vitest run` (40 tests) and `npm run check` (biome + tsc, 461 files) both pass.

Status is `human_needed` (not `passed`) solely because the live-Jira-config-dependent behavior — whether the ESHOP Done transition actually exposes a resolution screen at runtime — cannot be verified programmatically and requires validation on the live instance, per the task instructions. One informational test-coverage observation (no integrated board-level 5-arg `postTransition` assertion) is noted but does not block the goal.

---

_Verified: 2026-06-06T16:52:00Z_
_Verifier: Claude (gsd-verifier)_
