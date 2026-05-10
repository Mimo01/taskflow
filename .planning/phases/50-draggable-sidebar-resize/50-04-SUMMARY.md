---
plan: 50-04
phase: 50-draggable-sidebar-resize
status: complete
wave: 3
started: "2026-05-10"
completed: "2026-05-10"
---

# Plan 50-04: Human Verification — Summary

## What Was Verified

Human verification of all drag-to-resize interactions across four sidebar/panel locations. Two bugs were found during verification and fixed inline before approval.

## Bugs Found and Fixed

### Bug 1: Detail page drag direction reversed
- **Root cause**: `useResizable` hook computed `width + delta` where a positive delta (moving right) increased width. For left-edge handles, moving left should increase width — delta needed negation.
- **Fix**: Added `direction?: 'right' | 'left'` option to `useResizable`. Detail page call sites pass `direction: 'left'` to negate the delta.
- **Commit**: `4a8ada6`

### Bug 2: Collapse button blocked by drag handle z-index
- **Root cause**: Drag handle was `z-20`, collapse chevron button was `z-10` — drag handle intercepted click events at the sidebar edge.
- **Fix**: Raised collapse button from `z-10` to `z-30`.
- **Commit**: `4a8ada6`

### Bug 3: Drag handle trigger zone felt off-center
- **Root cause**: CSS `box-sizing: border-box` means `right: 0` places the handle at the padding edge, 1px inside the visual border. Hit zone was entirely inside the sidebar.
- **Fix**: Sidebar handle changed to `-right-px w-3` (covers the border pixel, 12px total). Detail page handles widened to `w-3` (12px inside, constrained by `overflow-auto` clipping).
- **Commit**: `ea1aaef`

## Verification Results

| Check | Result |
|-------|--------|
| SC-1: Main nav sidebar drag (160–320px) | ✓ Approved |
| SC-2: Detail page right panel drag (Issue, MR, Release) | ✓ Approved |
| SC-3: Cursor ew-resize on hover, border highlight | ✓ Approved |
| SC-4: Width persists across app restart | ✓ Approved |
| SC-5: Smooth resize, no jank or text selection | ✓ Approved |
| D-01: Collapse/expand restores last drag width | ✓ Approved |
| D-02: Drag handle absent when sidebar collapsed | ✓ Approved |
| D-03: Three detail pages persist width independently | ✓ Approved |

## Self-Check: PASSED
