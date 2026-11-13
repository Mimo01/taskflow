---
phase: 261113-cth
reviewed: 2026-11-13T00:00:00Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/hooks/useScrolledPast.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueTitleBlock.tsx
  - taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx
  - taskflow/src/routes/dashboard/issue-detail/issue-actions.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 261113-cth: Code Review Report

**Depth:** quick (targeted read of the diff, no test execution)

## Summary

No security issues found. The observer lifecycle is sound: callback refs held in state re-arm the hook on mount and unmount, `resetKey` covers an issue swap, and cleanup disconnects. Parent link and loading state survive the PeekPanel merge. The type icon does not (WR-02). Header aria-labels are preserved. No React Compiler module-level read hazards were found. The findings below are mostly behavioural regressions and edge cases.

## Warnings

### WR-01: IssueDetailSheet silently loses Edit and Pin, and has no header

**File:** `taskflow/src/routes/dashboard/IssueDetailSheet.tsx:28-60`
**Issue:** `onEdit`, `isPinned` and `onTogglePin` are removed from the destructuring and from `IssueDetailBody`, but they are probably still in `IssueDetailSheetProps` (not verified; the props block was outside the diff). Callers can pass them and nothing happens. The sheet also now renders no `IssueDetailHeader`, so Refresh, Pin, Edit, Log work, Open in Jira, Clone and Copy link are all gone from it, with no replacement. `IssueDetailSheet` has no non-test importers in `src` at present, so this is currently latent rather than user-visible. The risk is that the dead props mislead anyone wiring the sheet back in.
**Fix:** Either mount `IssueDetailHeader` in the sheet, or remove the unused props from `IssueDetailSheetProps` and state the descope explicitly.

### WR-02: The peek loses the issue-type icon until the user scrolls

**File:** `taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx:112-136`
**Issue:** The type icon is rendered only in the `compact` branch. The old PeekPanel header showed the type icon (and the key) permanently. `IssueTitleBlock` shows only the key text. In the loaded, non-scrolled state the type is no longer visible in the peek or on the page.
**Fix:** Show `IssueTypeIcon` in `IssueTitleBlock` next to the key, or keep it in the header's left slot in all loaded states.

### WR-03: useScrolledPast reports "past" when the target is hidden or detached

**File:** `taskflow/src/hooks/useScrolledPast.ts:25`
**Issue:** `!isIntersecting && boundingClientRect.bottom <= rootBounds.top` is true for a `display:none` or zero-rect target. Its rect is all zeros, so `bottom (0) <= root.top` holds whenever the scroller is not at viewport y=0, which is the usual case because the scroller sits below the 3rem header. The header would then wrongly show the compact title. Related edge: `rootBounds` is null when the root is hidden, and the `?? 0` fallback makes the same wrong guess.
**Fix:** Ignore degenerate rects, for example `if (e.boundingClientRect.height === 0 && e.boundingClientRect.width === 0) { setPast(false); return; }`. Also treat a null `rootBounds` as "not past".

### WR-04: Sticky SectionHeader's gutter bleed is only valid when --detail-px matches the real padding

**File:** `taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx:46-48`
**Issue:** The `-mx` and `px` come from the `--detail-px` custom property. The scroller sets it (1.5rem on the page, 1rem in the peek) by hand, separately from the real padding classes (`p-6`, `px-4`). Any component that renders sections outside those scrollers (the Sheet, where the property is unset and falls back to 0) gets a header with an opaque background narrower than the gutter. In the Sheet the scroller is `p-6` with sticky `top-0`, so scrolled content shows beside and above the pinned header. The `sticky` doc comment also requires the header to be a direct child of its `<section>`, and nothing enforces that. All current call sites comply.
**Fix:** Set `--detail-px` in the Sheet scroller, or pass `sticky={false}` there. Optionally add a dev-time assertion for the direct-child requirement.

### WR-05: Hover and focus overlays can render under sticky z-20 headers

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:652-655`, `taskflow/src/routes/dashboard/issue-detail/SectionHeader.tsx:47`
**Issue:** The headers and the composer are now `z-20` with opaque backgrounds, while the page's own overlay convention is a `relative z-10` row. The resize handle in the same layout is also `z-20`, but it lives in a different scroller, so it does not collide. Non-portaled absolute popovers inside content (peek highlight, row overlays) will now clip under the headers, which is the intended sticky behaviour. However, the composer's `z-20` can cover non-portaled popovers rendered from the activity list (mention or emoji pickers) that were previously unobstructed.
**Fix:** Verify that every popover opened from inside the scroller is portaled. If any are not, portal them, or lower the sticky z-index to 10 and raise the specific overlays instead.

## Info

### IN-01: AIO section heading changed and icon dropped

**File:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:717`
**Issue:** The title is now "AIO test runs" while the `<section aria-label>` is still "AIO Test Runs". Tests or users matching on the old text may break, and the two labels are inconsistent. The `FlaskConical` icon is dropped from this header, though the import is still used elsewhere in the file.
**Fix:** Align the casing of the two labels. Pick the project's sentence-case convention for both.

### IN-02: "Copied" state is not announced and the accessible name is static

**File:** `taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx:238-249`
**Issue:** `aria-label="Copy Jira link"` stays fixed while the visible text switches to "Copied". The aria-label overrides the content, so screen readers get no feedback.
**Fix:** Use `aria-label={copiedLink ? 'Copied' : 'Copy Jira link'}` or add a live region.

### IN-03: Duplicated edit and clone value builders

**File:** `taskflow/src/routes/dashboard/issue-detail/issue-actions.ts:5-52`
**Issue:** `buildEditInitialValues` and `buildCloneInitialValues` repeat about nine identical field mappings. The `as number` and `as string` casts on `issue.fields[...]` hide null and undefined issues, and `?? null` only partly mitigates them.
**Fix:** Extract a shared `baseInitialValues(issue, spKey, epicKey)` and spread it into both.

---

_Reviewed: 2026-11-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
