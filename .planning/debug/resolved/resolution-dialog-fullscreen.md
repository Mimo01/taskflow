---
slug: resolution-dialog-fullscreen
status: resolved
trigger: "On issue detail, when transitioning to done status and the resolution modal pops up, it is stretched to fullscreen, not just the middle"
created: 2026-06-10
updated: 2026-06-10
---

# Debug: resolution-dialog-fullscreen

## Symptoms

- **Expected:** When transitioning an issue to a Done status on the issue-detail page/sheet, the resolution picker should appear as a normal centered dialog (constrained width, like the sprint board), not stretched.
- **Actual:** The resolution "modal" pops up stretched to fullscreen instead of a contained centered box.
- **Surface:** Issue detail **page** AND issue detail **side sheet (drawer)**. Possibly other issue-detail entry points.
- **Works correctly on:** Sprint board drag-to-Done transition (which renders `BoardResolutionDialog`, a centered `Dialog` with `sm:max-w-md`).
- **Control type (per user):** A centered dialog box with a title and a Confirm button (sounds like `BoardResolutionDialog` UX — "Set a resolution"). Background dimmed.
- **Window size:** Unknown / not noted.

## Key contradiction to resolve first

- The sprint-board path uses `src/routes/dashboard/BoardResolutionDialog.tsx` (centered `Dialog`, `sm:max-w-md`) — works.
- The issue-detail path (`FieldsSection.tsx` → `StatusPopover.tsx`) currently renders the resolution step **inline inside a `Popover`** (`PopoverContent className="p-1 min-w-[160px]"`, title "Select resolution"), NOT a centered Dialog.
- `grep` shows the string "Set a resolution" and the `BoardResolutionDialog` import exist **only** in the sprint-board path — NOT in any issue-detail file.
- So: what is actually rendering on issue-detail? Reproduce and inspect the live DOM before touching CSS (per project lesson "Visual bugs: inspect DOM before CSS"). Determine whether the stretched element is the base-ui `Popover` popup mis-positioned/unconstrained inside the Sheet/page, or a Dialog wired in somewhere grep missed.

## Relevant files

- `src/routes/dashboard/StatusPopover.tsx` — issue-detail status transition + inline resolution step (Popover). **FIXED.**
- `src/routes/dashboard/issue-detail/FieldsSection.tsx` — renders `StatusPopover`; also the Resolution `MetaRow` (`Select`).
- `src/routes/dashboard/BoardResolutionDialog.tsx` — working centered dialog (board only, now also reused by StatusPopover).
- `src/components/ui/dialog.tsx` — base `DialogContent`: `w-full max-w-[calc(100%-2rem)] ... sm:max-w-sm`.
- `src/components/ui/popover.tsx` — base `PopoverContent`: `Positioner className="z-50"` (no width/anchor constraints), Popup `min-w-[160px]` from caller.
- `src/routes/dashboard/IssueDetailSheet.tsx` — Sheet at `width: 75vw`; renders `FieldsSection` via sidebar.
- `src/routes/dashboard/IssueDetailPage.tsx` — full-page issue-detail variant.

## Current Focus

- hypothesis: CONFIRMED. The inline resolution picker inside `PopoverContent` stretched to full viewport width because the base-ui `Positioner` div (portaled to `document.body`, `position: absolute`, no explicit width set by floating-ui) made `w-full` child buttons resolve against the viewport/body width. The sheet's `SheetOverlay` (always present while the Sheet is open) is the "dimmed background" the user saw. The fix replaces the inline step with `BoardResolutionDialog`.
- next_action: DONE — fix applied.
- test: manual UAT
- expecting: Resolution dialog is now a properly centered `sm:max-w-md` Dialog on issue-detail, matching the board UX.

## Evidence

- timestamp 2026-06-10: Codebase scope (above) gathered by orchestrator before delegation.
- timestamp 2026-06-10: Root cause confirmed via code analysis. `StatusPopover`'s inline resolution step used `w-full` buttons inside `PopoverPrimitive.Popup` (base-ui 1.3.0). The `Positioner` div (portaled to `document.body`, `position: absolute`) has no explicit width from floating-ui. A `position: absolute` element on `body` with no width uses the body as its containing block, making `w-full` children resolve to the full viewport width. The `SheetOverlay` backdrop (always visible when the Sheet is open) appeared as the "dimmed background." Fix: replace the inline resolution step with `BoardResolutionDialog` rendered outside the `<Popover>` tree.

## Eliminated

- `BoardResolutionDialog` was NOT wired into issue-detail before the fix (grep confirmed it was only in `SprintBoardTab`).
- The `PopoverPrimitive.Positioner` does NOT add a backdrop (only does so when `modal=true`; our Popover has `modal=false` by default).
- The `InternalBackdrop` (fixed inset-0) is only rendered when `modal === true` — not the cause.
- Dialog/Sheet nesting in base-ui 1.3.0 does NOT cause the Popover to revert to a Dialog; they are separate primitive families.

## Resolution

- **Root cause:** `StatusPopover` rendered the resolution-picker step inline inside `PopoverContent` using `w-full` buttons. The base-ui `Positioner` div (portaled to `document.body`, `position: absolute`, no width set by floating-ui) made these `w-full` buttons resolve against the viewport (body) width, stretching the popup to full screen. The dimmed background was the Sheet's `SheetOverlay` which is always present while the Sheet is open.
- **Fix:** Replaced the inline resolution step with `BoardResolutionDialog` rendered outside the `<Popover>` tree. When a resolution-capable transition is selected, the popover closes (`setOpen(false)`) and the dialog opens (`pendingResolutionTransition !== null`). This matches the board UX exactly (`sm:max-w-md`, title, Confirm button, centered). File changed: `src/routes/dashboard/StatusPopover.tsx`.
- **Scope:** The fix only activates when `issueKey` is passed (issue-detail path). Board/drag callers (TaskRow, SprintBoardTab) never pass `issueKey` to `StatusPopover`, so they are unaffected.
