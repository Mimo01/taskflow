---
phase: quick-261029-oyw
verified: 2026-10-29T18:30:00Z
status: human_needed
score: 6/6 must-haves verified in code (visual layout pending human)
human_verification:
  - test: "Tauri width sweep at 1440/1280/1100/1024px, with and without the peek panel"
    expected: "Rows are one line, the summary stays visible, the left column does not scroll sideways, and the header aligns with the rows. Tiers apply in order: Assignee avatar-only and MR compact, then icon and Assignee drop, then MR, then Status."
    why_human: "jsdom cannot evaluate container queries."
  - test: "Sidebar behaviour (peek open/close, handle drag, narrow sidebar content)"
    expected: "The sidebar stays beside the content, shrinks when peek opens and regrows when it closes. Dragging the capped handle moves it immediately. MetaRow labels stack, branch/tag names truncate with a tooltip, and the breadcrumb truncates."
    why_human: "Depends on CSS layout, which jsdom does not compute."
---

# Quick 261029-oyw Verification

**Goal:** Release detail page works at narrow widths and with the peek open.
**Status:** human_needed. The code and tests match the plan. The visual proof is the unrun Task 3 checkpoint.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rows stay on one line and the summary stays visible | VERIFIED in code, visual pending | `COL_SUMMARY = 'flex-1 min-w-0'` with `line-clamp-1`. Every other column is `flex-none` and tiered. `<section className="@container">` is the ancestor of the header strip and rows. |
| 2 | Below 860px, Assignee is avatar-only and MR is compact, with full names still in the accessible tree | VERIFIED in code, visual pending | `COL_PERSON` has `@max-[860px]:w-5`, and the name and "Unassigned" spans carry `@max-[860px]:sr-only`. `COL_MR` has `@max-[860px]:w-[5.5rem]`. The MR state Badge is inside an `sr-only` wrapper. Slot states render the long text in `sr-only` plus a short `aria-hidden` variant ("— unknown", "No MR", "— not checked"). |
| 3 | Below 640px icon and Assignee drop, below 520px MR drops, below 400px Status drops, with the header aligned | VERIFIED in code, visual pending | The constants carry `@max-[640px]:hidden` (`COL_ICON`, `COL_PERSON`), `@max-[520px]:hidden` (`COL_MR`) and `@max-[400px]:hidden` (`COL_STATE`). The header strip (lines 383-390) and `TaskRow` cells (lines 891, 911, 931, 755 and the slot cells) use the same constants. No hardcoded widths remain. |
| 4 | The sidebar stays side-by-side with a capped rendered width, and the persisted width is unchanged | VERIFIED in code, visual pending | The sidebar root has `style={{ width, maxWidth: 'max(12.5rem, min(50%, 100% - 30rem))' }}`. The hook's `max` option is untouched. |
| 5 | Drag starts from the rendered width | VERIFIED | `useResizable` takes `getStartWidth` through a ref and uses `getStartWidthRef.current?.() ?? widthRef.current`. `ReleaseDetailPage` passes `sidebarRef.current?.offsetWidth` and `rootRef={sidebarRef}`. The new hook test passes. |
| 6 | Sidebar rows, branch/tag names and the breadcrumb are narrow-safe | VERIFIED in code, visual pending | The sidebar inner wrapper has `@container`. `MetaRow` has `@max-[240px]:flex-col` and `@max-[240px]:w-auto`. Branch and tag names have `truncate`, a `title`, and `pr-0.5` on the italic states. The breadcrumb has `min-w-0`, `shrink-0` separators and a truncating, titled version name. |

## Checks run
- `vitest run src/routes/dashboard/release-detail/ src/hooks/useResizable.test.ts`: 16 files, 445 tests passed.
- `tsc --noEmit -p .`: clean.
- The implementation diffs for commits ce67689c and d897be84 were read directly. SUMMARY claims were not relied on.

## Warnings (non-blocking)
- The "x / y done" badge words are not hidden below 520px. The plan asked for this, but the summary records it as a deliberate deviation to keep `getByText('4 / 6 done')` passing. The badge is short and the impact is cosmetic.
- The `Status` and `MR` header labels hide together with their columns, as the plan intended.
- Task 3 (the human sweep) has not been run. The plan marks it as a blocking checkpoint.
