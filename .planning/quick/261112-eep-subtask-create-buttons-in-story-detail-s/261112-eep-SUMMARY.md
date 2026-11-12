# Quick 261112-eep: Subtask create control in Subtasks section header - Summary

**Story/task detail now always shows a "Subtasks" heading row with a right-aligned split create control (Add subtask + chevron menu with "Bulk create subtasks…"), a muted "No subtasks" line when empty, and no old bottom button row.**

## Commits

- f40739ae: feat(quick-261112-eep): add SubtaskCreateControl split button
- a4499b60: feat(quick-261112-eep): always-rendered Subtasks header with split create control

## Changes

- New `taskflow/src/routes/dashboard/issue-detail/SubtaskCreateControl.tsx` (+ test, 3 tests): outline `sm` "Add subtask" joined to an `icon-sm` chevron DropdownMenu trigger (Base UI `render` prop), `align="end"`, one item "Bulk create subtasks…".
- `IssueDetailContent.tsx`: header row `flex h-7 items-center justify-between mb-1`; "Subtasks" or "Subtasks (N)" where N comes from the base `subtasks` field; "No subtasks" iff `subtasks.length === 0`; `subtaskListContent` now renders only the `ul`; old bottom button row removed; modal wiring unchanged; unused `Plus`/`LayoutList` imports removed.
- `SubtasksSkeleton.tsx`: removed the heading placeholder bar.
- `IssueDetailContent.test.tsx`: new `Subtasks section header (261112-eep)` describe (5 tests) plus a file-level `vi.mock('./BulkCreateSubtasksModal')` stub (applies to the whole file; the existing tests do not depend on the real modal).

## Deviations from Plan

None to production code. Test-only note: the BulkCreateSubtasksModal mock is file-level (vi.mock is hoisted), as the plan prescribed. `biome check --write` was run on the 3 touched files only (import/format normalisation of the lucide import after removing two names).

Environment: the worktree HEAD was at e7e50155, not the expected base, so it was hard-reset to 5f84792f per the branch check. `taskflow/node_modules` symlink created (untracked/ignored, not committed).

## Verification

Targeted vitest pass; full pre-commit suite (vitest 4925 passed), biome and tsc passed on both commits. biome reports one pre-existing info-level (unsafe-fix) note in IssueDetailContent.tsx, not related.

## UAT notes

- Header uses `size="sm"` / `icon-sm` with a fixed `h-7` row (+4px vs other section headings). Alternative for exact parity: `size="xs"` / `icon-xs` (keep `text-xs` + `size-3.5` icons) with row `h-6 mb-1`.
- Switching to two separate buttons is confined to `issue-detail/SubtaskCreateControl.tsx`.

## Self-Check: PASSED

## UAT round 1 (2026-11-12) — c31efdd2

Feedback: "too squished; subtask header differs from Attachments; unify everything on issue detail".
Rendered Now / A (quiet labels) / B (strong titles + icons) preview; user chose **A** + **two separate buttons**.

- New shared `issue-detail/SectionHeader.tsx` (+test): `h-7 mb-2` row, `text-sm font-medium text-muted-foreground` h3,
  muted count without parentheses ("Subtasks 2"), optional collapse chevron after the label (aria-expanded), actions `ml-auto gap-2`.
- Applied to Description, Attachments, Stories, Subtasks, Parent, Progress (`mb-0`, section owns space-y-5), Activity.
- `SubtaskCreateControl`: split button → two outline sm buttons "Bulk create" + "Add subtask" (review WR-01 seam issue moot).
- Attachments: bold icon+chevron header → SectionHeader; empty state → muted italic "No attachments" (drag-drop hint line dropped).
- Out of scope: sidebar field-group labels (uppercase "Linked Issues") and Activity's centred empty state left as is.

**UAT:** Approved by user 2026-11-12 after round 1 (unified SectionHeader, c31efdd2).
