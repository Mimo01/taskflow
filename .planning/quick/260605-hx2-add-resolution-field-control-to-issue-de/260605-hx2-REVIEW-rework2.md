---
phase: 260605-hx2-add-resolution-field-control-to-issue-de (rework2 — board drag-to-done resolution picker)
reviewed: 2026-06-06
depth: quick
files_reviewed: 6
findings:
  blocker: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 260605-hx2 rework2: Code Review (board drag resolution picker)

## Verified-correct
- `resolveDropResolution(meta)` matches StatusPopover `handleSelect` (StatusPopover.tsx:119-139) three branches exactly; genuinely pure (only api-error/apiFetch/types imported; helper reads only `meta.fields.resolution`). Edge cases (meta/fields/allowedValues undefined vs empty) handled.
- jira.ts barrel re-export of `resolveDropResolution` correct (jira.ts:602-617, dual-file gotcha honored).
- `handleTransition` resolution arg is presence-checked (rest-param `arguments.length`), preserving `{resolution:null}` clears and leaving the two context-menu callers unaffected (4-arg test SprintBoardTab.test.tsx:820-873).
- Non-issue: `setDropModel(null)` does not corrupt the in-flight closure's `dropModel`/`localIssues` reads within a single drag.

## Blockers

### CR-01: Concurrent drag during a pending probe/dialog corrupts dropModel-derived resolution
**File:** taskflow/src/routes/dashboard/SprintBoardTab.tsx:1105-1199
`handleDragEnd` resolves the transition synchronously (good) but the async IIFE awaits `queryClient.fetchQuery` (cold network on cache miss). Nothing prevents a second drag while it is pending — `handleDragStart` resets `dropModel`/`activeId` for the new card, and if drop A's probe resolves into the `dialog` branch it calls `setPendingResolution(A)` while the user is mid-drag of card B; the dialog opens unexpectedly over an unrelated drag.
**Fix:** Gate re-entry with a drag token captured at drag start; after the await, bail if `dragTokenRef.current !== token`. Optionally block new drags while `pendingResolution !== null`.

### CR-02: pendingResolution silently overwritten before confirm → wrong resolution for wrong issue
**File:** taskflow/src/routes/dashboard/SprintBoardTab.tsx:1167-1177, 1759-1770
If drop A sets `pendingResolution=A` (dialog) and drop B then sets `pendingResolution=B` before confirm, the single dialog instance re-renders with B's data but its internal `selectedId` (BoardResolutionDialog.tsx:50) is NOT reset — a selection made for A applies to B on confirm (posts A's resolution id against issue B, possibly an id absent from B's allowedValues).
**Fix:** Prevent a second pending dialog (tie to CR-01 guard) AND key the dialog by issue: `<BoardResolutionDialog key={pendingResolution.issueKey} … />`, and reset `selectedId` when `issueKey`/`allowedValues` change.

## Warnings

### WR-01: `block` branch doesn't clear a prior pending dialog; block error is stickier than StatusPopover's
**File:** SprintBoardTab.tsx:1179-1189
The `block` branch sets a card error but doesn't clear `pendingResolution` (inconsistent state if a dialog is open). The block error only auto-clears on the next optimistic transition (no dismissal affordance), unlike StatusPopover's popover-scoped WR-05 message.
**Fix:** Clear `pendingResolution` for the same issue when entering `block`; confirm the card-error dismissal lifecycle is intended.

### WR-02: Probe-failure fallback fires a possibly-doomed plain transition after an optimistic move
**File:** SprintBoardTab.tsx:1153-1164
On probe failure the code fires a plain transition. If that transition actually required a resolution, Jira 400s after the card optimistically moved → jump-to-Done-then-rollback, worse than the `block` message. Tradeoff is deliberate but risky on transient failures.
**Fix:** On probe failure where GH `hasScreen` suggests a screen, surface a retry/error instead of firing; only fall back to plain when metadata gives no resolution signal.

### WR-03: `toStatusCategoryKey` cast can mislabel optimistic column (pre-existing, widened)
**File:** SprintBoardTab.tsx:1262-1266 (also categoryOf:91-93)
Unvalidated `as { key: 'new'|'indeterminate'|'done' }`; unexpected/undefined keys silently bucket to 'new'. Pre-existing in the context-menu path; the dialog-confirm path now also flows through it.
**Fix:** Validate against the three known keys before the optimistic write; warn on unexpected.

### WR-04: No end-to-end test for the handleDragEnd dialog/block/probe-failure/race branches
**File:** SprintBoardTab.test.tsx:773-874
Tests cover the dialog confirm in isolation and the context-menu 4-arg path, but not a real drop through `handleDragEnd` into dialog/block/probe-failure, nor the concurrent-drag race — exactly where CR-01/CR-02 live.
**Fix:** Drive `onDragEnd` with `fetchIssueTransitionsWithFields` mocked to capable / required-empty / failing, asserting dialog opens with correct issueKey/allowedValues, block fires no postTransition, and a second drag during a pending dialog doesn't corrupt state.

_Reviewer: Claude (gsd-code-reviewer), depth quick_
