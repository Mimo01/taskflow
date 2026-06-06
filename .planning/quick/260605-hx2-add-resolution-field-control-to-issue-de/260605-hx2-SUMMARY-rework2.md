---
phase: quick-260605-hx2
plan: rework2
subsystem: sprint-board / jira-transitions
tags: [drag-to-transition, resolution, dialog, jira, dnd-kit]
requires:
  - postTransition optional-fields presence-check (transitions.ts)
  - fetchIssueTransitionsWithFields + transitionsWithFieldsKey (transitions.ts)
  - StatusPopover three-branch resolution logic (pattern mirrored)
provides:
  - resolveDropResolution pure decision helper (dialog/block/plain)
  - BoardResolutionDialog presentational resolution picker
  - board drag-to-resolution-capable transition flow with resolution prompt
affects:
  - SprintBoardTab handleDragEnd / handleTransition
tech-stack:
  added: []
  patterns:
    - "pure decision helper extracted as the load-bearing unit-test seam"
    - "sync early-return guards stay before the async probe IIFE in handleDragEnd"
    - "presence-checked optional resolution arg via tuple-rest (not truthiness)"
key-files:
  created:
    - taskflow/src/routes/dashboard/BoardResolutionDialog.tsx
  modified:
    - taskflow/src/services/jira/transitions.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/services/jira/transitions.test.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
decisions:
  - "resolveDropResolution lives in transitions.ts (pure, no React/network) so it is the unit-test seam; drag handler delegates to it"
  - "handleTransition resolution arg is a tuple-rest so presence is detected by arguments length, preserving {resolution:null} clears and not affecting context-menu callers"
  - "probe failure falls back to a plain transition rather than blocking a valid move"
metrics:
  duration: ~20m
  completed: 2026-06-06
---

# Phase quick-260605-hx2 Plan rework2: Board Drag-to-Resolution Picker Summary

Dragging a sprint-board card into a resolution-capable transition (e.g. Done) now opens a resolution-picker dialog and executes the dragged transition with `fields.resolution` only after the user confirms — closing the second UAT rework where the board path never prompted for a resolution like the sidebar/StatusPopover already do.

## What Was Built

- **`resolveDropResolution(meta)`** — a PURE, exported, unit-tested decision helper in `services/jira/transitions.ts` returning a discriminated union: `{kind:'dialog', allowedValues}` (allowedValues length > 0), `{kind:'block'}` (required but empty — WR-05), or `{kind:'plain'}` (no resolution field / optional-and-empty / no meta). Re-exported (plus the `DropResolutionDecision` type) from the `@/services/jira` barrel per the dual-file gotcha.
- **`BoardResolutionDialog`** — a presentational dialog mirroring `confirm-sprint-move-dialog` (same Dialog primitives, `showCloseButton={false}`, controlled open). Renders `allowedValues` as selectable buttons plus an explicit Unresolved option; Confirm is disabled until a selection is made and calls `onConfirm({id})` or `onConfirm(null)`. Holds no data-fetching logic.
- **SprintBoardTab drag wiring** — `handleDragEnd` keeps all sync early-return guards (`!over`, `transitionId===null`, missing issue, missing `transition`) and the sync cleanup/`justDragged` guard BEFORE entering a `void (async () => …)()` probe IIFE. The probe `fetchQuery`s transitions-with-fields keyed on the dragged issue's CURRENT status id (shared cache key with StatusPopover/sidebar), classifies via `resolveDropResolution`, then: dialog → open picker with no optimistic move; block → set a card error and fire nothing; plain → call `handleTransition` exactly as today. Probe fetch failure falls back to a plain transition.
- **`handleTransition`** — extended with an optional trailing `resolution` arg via a tuple-rest so presence is detected by `arguments.length` (not truthiness), preserving `{resolution:null}` clears. When present it forwards `{resolution}` as `fields` to `postTransition`; when absent it calls the 4-arg form. Optimistic update + rollback + `invalidateGhAllData` unchanged; existing context-menu caller (`onTransition={handleTransition}`) is unaffected.

## Invariants Honored

- `resolveDropResolution` is pure — imports only the `JiraTransitionWithFields` type; no React, no query client, no network.
- Sync guards remain in the synchronous body of `handleDragEnd`, before the async probe IIFE.
- No optimistic card move occurs on the dialog branch until the user confirms; cancel/close clears `pendingResolution` and performs no transition (card never moved).
- `handleTransition`'s resolution arg is optional and presence-checked, so context-menu callers and a `{resolution:null}` clear both work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree node_modules not resolvable for tooling**
- **Found during:** verification (tsc/biome/vitest could not resolve modules from the worktree).
- **Issue:** The worktree's nested `taskflow/` had no `node_modules`; biome/tsc/vitest binaries and type declarations live in the main checkout.
- **Fix:** Symlinked the main checkout's `node_modules` into the worktree `taskflow/` dir (gitignored — not committed) and ran tooling with the main checkout's `.bin` on PATH.
- **Files modified:** none committed (node_modules is gitignored).

Otherwise the plan executed as written. (Biome auto-organized the new barrel export ordering and wrapped a long JSX line — both are formatter normalizations applied via `biome check --write`, not behavioral changes.)

## Verification

- `npm run check` (biome check + tsc --noEmit): **clean, exit 0** (461 files, no fixes/errors).
- `vitest run transitions.test.ts SprintBoardTab.test.tsx` (basename pattern per constraint): **3 files passed, 59 tests passed**. (`transitions.test.ts` matches both `services/jira` and `greenhopper` files; SprintBoardTab matched once.)
- Targeted `vitest run src/services/jira/transitions.test.ts src/routes/dashboard/SprintBoardTab.test.tsx`: **2 files, 35 tests passed** — includes the 6 new `resolveDropResolution` branch tests, the 2 BoardResolutionDialog confirm tests ({id} / null), and the handleTransition 4-arg context-menu forwarding test.
- Manual against live ESHOP (out of automated scope): drag to Done → dialog → pick resolution → card moves with resolution set; drag to non-resolution status → immediate move; cancel → no change.

## Known Stubs

None — the dialog is fully wired to live data (probe-sourced `allowedValues`) and the transition execution path.

## Commits

- c9bd464e — feat: add BoardResolutionDialog resolution picker
- 0180372f — feat: wire board drag-to-resolution picker (helper + barrel + drag flow)
- 9b432ae5 — test: cover resolveDropResolution + dialog confirm wiring

## Self-Check: PASSED

All 5 created/modified source files present on disk; all 3 task commits present in git history.
