---
phase: quick-260606-o5y-on-sprint-board-story-rows-open-issue-pr
reviewed: 2026-06-06T00:00:00Z
depth: quick
files_reviewed: 2
files_reviewed_list:
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase quick-260606-o5y: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** quick (diff-scoped to commits 743a2d82 and 0ec11e41)
**Files Reviewed:** 2
**Status:** issues_found

## Summary

The change ports TaskCard's PEEK-01/PEEK-05 click split into `StoryHeaderRow`: the row
body becomes a `div[role=button]` that opens the issue peek (`onOpenIssue`), while the issue
key is demoted to an inner `<button>` that navigates full-page (`onOpenDetail`) with
`stopPropagation`. The chevron and epic pill also `stopPropagation`.

The mouse/click path is correct: chevron, key, and epic pill all call `e.stopPropagation()`
on their `onClick`, so a click on them does not bubble to the body peek. The
`div[role=button]` keeps inner `<button>`s valid HTML, matching the accepted TaskCard
pattern. The three wiring sites in `SprintBoardTab.tsx` (virtual list, non-virtual fallback,
sticky overlay) are consistent — each passes `onOpenDetail={setSelectedIssueKey}` and
`onOpenIssue={onOpenIssue}`, mirroring the TaskCard wiring (key → full-page, body → peek).

Two correctness gaps remain on the keyboard path (see WR-01, WR-02). No security or
blocker-class issues found in scope.

## Warnings

### WR-01: Keyboard activation of the key button also fires the body peek (double action)

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:125-139, 191-197`
**Issue:** The inner key `<button>` calls `e.stopPropagation()` only on its `onClick`
handler. Native buttons synthesize a `click` from an Enter/Space keypress, but the
underlying `keydown` event still bubbles independently. The row `div[role=button]` has an
`onKeyDown` that fires `onOpenIssue?.(storyKey)` for Enter/Space. So when a keyboard user
focuses the key button and presses Enter (or Space):
- the button's synthetic click fires `onOpenDetail(storyKey)` (full-page nav), AND
- the keydown bubbles to the row div, firing `onOpenIssue(storyKey)` (peek).

Both navigations fire from one keypress. The same latent gap exists in the reference
`TaskCard.tsx`, so the divergence is "faithful port of an existing bug" — but it is still a
real keyboard-only defect introduced into this component. The chevron and epic pill have the
same exposure (Enter on the chevron toggles collapse AND opens peek).
**Fix:** Guard the row `onKeyDown` so it ignores key events that originated on an inner
interactive element, e.g.:
```tsx
onKeyDown={(e) => {
  if (e.target !== e.currentTarget) return; // ignore bubbled keydown from inner buttons
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onOpenIssue?.(storyKey);
  }
}}
```
Alternatively, add `onKeyDown={(e) => e.stopPropagation()}` to each inner `<button>`.

### WR-02: Row body keyboard handler lacks the justDragged guard that the click path has elsewhere

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:191-197`
**Issue:** TaskCard guards both `onClick` and `onKeyDown` with `if (justDragged?.current) return;`
to suppress a stray peek-open after a drag drop. StoryHeaderRow has no such guard. In the
current wiring this is benign because story header rows are not draggable (only subtask/task
cards register `useDraggable`). However, the omission is an undocumented assumption: if a
future change makes story rows draggable (or the row participates in a drag where pointer-up
lands on it), the body peek will fire spuriously. The intent ("story headers are not
draggable, so no guard needed") is not stated in the component.
**Fix:** Add a short comment at the `onClick`/`onKeyDown` site noting story rows are
intentionally non-draggable and therefore need no `justDragged` guard, so the divergence from
TaskCard is deliberate rather than an oversight.

## Info

### IN-01: `onOpenIssue?.` optional-chaining is dead inside the split branch

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:191, 195`
**Issue:** The `div[role=button]` branch is only rendered when `useKeyBodySplit === !!onOpenIssue`
is `true`, so `onOpenIssue` is guaranteed defined inside that branch. The `onOpenIssue?.(storyKey)`
optional call can never short-circuit there. Harmless, but the `?.` implies a nullability that
cannot occur on this path and slightly obscures intent.
**Fix:** Either narrow with a local `const open = onOpenIssue;` after the `useKeyBodySplit`
check and call `open(storyKey)`, or leave as-is and accept the defensive `?.`.

### IN-02: Biome suppression comment references "epic" but epic pill stop-propagation is correct

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:187`
**Issue:** The updated suppression comment now reads "inner key/chevron/epic are `<button>`".
This is accurate (the epic pill is a `<button>` with `stopPropagation`), and the comment was
correctly broadened in commit 0ec11e41. No action required — noting only that the claim was
verified against lines 155-169 and holds. The assignee avatar, status badge, and subtask
count remain non-interactive `<span>`s, so their clicks correctly bubble to the body peek as
intended.
**Fix:** None required.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
