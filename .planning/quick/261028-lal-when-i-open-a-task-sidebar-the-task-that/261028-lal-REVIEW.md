---
phase: 261028-lal
reviewed: 2026-10-28T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/stores/peek.store.ts
  - taskflow/src/lib/peek-highlight.ts
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 261028-lal: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The store, selector and main.tsx migration are sound. `useIsPeeked` uses a boolean selector, so each row re-renders only when its own state flips. The `setPeekIssueKey` dependency added to the effect is stable. No functional updater calls on the setter remain. Overlay clones are excluded. No security issues. The only problems are class-ordering conflicts: `cn` uses tailwind-merge, so a later `bg-*` class silently removes an earlier one.

## Warnings

### WR-01: StoryHeaderRow peek tint is always overridden, so only the bar shows

**File:** `taskflow/src/routes/dashboard/StoryHeaderRow.tsx:111-120`
**Issue:** `isPeeked && PEEKED_ROW_CLASS` comes before the `isExpanded`/`isFlagged` branches. Every branch of that ternary sets a `bg-*` class (`bg-muted/40` or `bg-yellow-100`), so tailwind-merge drops `bg-primary/5` in all cases. The tint never renders on story headers. Only the inset shadow survives, which differs from the other row types.
**Fix:** Move the peek class after the ternary, as a separate `cn` argument. Then decide explicitly how it interacts with flagged. Alternatively, apply only the shadow part for rows that already have a background.

### WR-02: Inconsistent peek vs flagged precedence across components

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:311-314`; `taskflow/src/routes/my-tasks/MyTaskRow.tsx:315-321`
**Issue:** In BacklogRow the peek class comes after the flagged ternary. The peeked `bg-primary/5` overrides `bg-yellow-100`, so a peeked flagged row loses its flagged highlight. In MyTaskRow and TaskCard the peek class comes before the flagged class, so flagged wins and the tint is lost. The same state therefore renders differently per surface.
**Fix:** Pick one rule, for example flagged background wins and the peek bar and ring always show. Apply it consistently by placing `showPeek && ...` in the same position relative to the flagged and focused classes in every component. Better still, split the shared constants into a background part and a shadow part.

## Info

### IN-01: Duplicated `data-peeked` and `className` between the two render paths

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:335-362`; `taskflow/src/routes/dashboard/TaskCard.tsx:375-407`
**Issue:** `data-peeked` is added in two parallel branches in each file. It must be kept in sync by hand, and an easy omission is likely on future edits.
**Fix:** Build a shared props object, for example `const peekAttr = { 'data-peeked': showPeek ? 'true' : undefined }`, and spread it in both branches.

---

_Reviewed: 2026-10-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
