---
phase: quick-260528-ct1
plan: "01"
subsystem: a11y / lint
tags: [biome, a11y, lint, accessibility]
dependency_graph:
  requires: []
  provides: [clean-biome-baseline]
  affects: [biome-lint-pipeline]
tech_stack:
  added: []
  patterns: [biome-ignore-suppression, aria-hidden-decorative-svg, aria-pressed-toggle, semantic-html-header, onKeyDown-keyboard-parity]
key_files:
  created: []
  modified:
    - taskflow/src/components/app/AppIcon.tsx
    - taskflow/src/components/app/KeyboardShortcutsPanel.tsx
    - taskflow/src/components/ui/empty-state.test.tsx
    - taskflow/src/components/ui/label.tsx
    - taskflow/src/components/ui/input-group.tsx
    - taskflow/src/routes/dashboard/SprintGoalBanner.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/BacklogFilterBar.tsx
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/routes/dashboard/AuthImage.tsx
    - taskflow/src/routes/dashboard/ImageLightbox.tsx
    - taskflow/src/routes/dashboard/MentionPopover.tsx
decisions:
  - "aria-pressed on BacklogFilterBar button (not aria-selected on li) — correct semantics for multi-select toggle"
  - "biome-ignore on InputGroup role=group divs — fieldset not viable for Tailwind flex layout"
  - "biome-ignore on AioCycleDetailPage tr role=button — tr cannot be structurally replaced by button in table"
  - "role=presentation on CommandPalette inner div and ImageLightbox inner content div — propagation stoppers should not be in accessibility tree"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-28"
  tasks_completed: 3
  files_modified: 12
  warnings_fixed: 20
---

# Phase quick-260528-ct1 Plan 01: Biome A11y Warnings Fix Summary

**One-liner:** Resolved all 20 remaining Biome a11y warnings across 12 files using aria-hidden, semantic HTML swaps, aria-pressed toggles, onKeyDown keyboard parity handlers, and targeted biome-ignore suppressions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Mechanical / single-line fixes (8 files, 8 warnings) | 9abca2ee | AppIcon, KeyboardShortcutsPanel, empty-state.test, label, input-group, SprintGoalBanner, AioCycleDetailPage, BacklogFilterBar |
| 2 | Keyboard handlers on clickable non-interactive elements (5 files, 12 warnings) | c8bbe684 | input-group, CommandPalette, AuthImage, ImageLightbox, MentionPopover |
| 3 | Full verification + regression check | (no source edits) | — |

## Verification Results

- `npx biome check ./src` — exit 0, 0 errors, 0 warnings
- `vitest run` — 129 test files passed, 0 failures, 1555 tests passed

## Fixes Applied

### Task 1 — Mechanical fixes

1. **AppIcon.tsx** — `aria-hidden="true"` on decorative app icon SVG (`noSvgWithoutTitle`)
2. **KeyboardShortcutsPanel.tsx** — `aria-hidden="true"` on inline magnifying-glass SVG (`noSvgWithoutTitle`)
3. **empty-state.test.tsx** — `type="button"` on test `<button>` element (`useButtonType`)
4. **label.tsx** — `biome-ignore noLabelWithoutControl` — generic Label primitive, callers provide htmlFor
5. **input-group.tsx** (×2) — `biome-ignore useSemanticElements` on both `<div role="group">` elements — fieldset styling incompatibility
6. **SprintGoalBanner.tsx** — `<div role="banner">` replaced with native `<header>` element (`useSemanticElements`)
7. **AioCycleDetailPage.tsx** — `biome-ignore useSemanticElements` on `<tr role="button">` — tr cannot become button in a table
8. **BacklogFilterBar.tsx** — removed `aria-selected` from `<li>`, added `aria-pressed={selected.has(option)}` to inner `<button>` (`useAriaPropsSupportedByRole`)

### Task 2 — Keyboard handlers

9. **input-group.tsx InputGroupAddon** — `onKeyDown` Enter/Space to focus parent input (keyboard parity with click-to-focus)
10. **CommandPalette.tsx outer backdrop div** — `role="button"` + `tabIndex={0}` + `onKeyDown` Escape/Enter/Space calling `onClose`
11. **CommandPalette.tsx inner content div** — `role="presentation"` + `onKeyDown` stopPropagation
12. **AuthImage.tsx** (×2, both img instances) — guarded `role`, `tabIndex`, `onKeyDown` Enter/Space when `onClick` prop is present
13. **ImageLightbox.tsx outer dialog div** — `onKeyDown` Escape calling `onClose` (mirrors existing document-level listener)
14. **ImageLightbox.tsx inner content div** — `role="presentation"` + `onKeyDown` stopPropagation
15. **MentionPopover.tsx** — `onKeyDown` Enter on `<div role="option">` calling `onSelect(user)`

## Deviations from Plan

None — plan executed exactly as written. All fixes matched the pre-decided patterns in RESEARCH.md.

## Known Stubs

None.

## Threat Flags

None — changes are attribute/handler additions only, no new network endpoints or auth paths.

## Self-Check: PASSED

- All 12 modified files exist and were committed
- Task 1 commit: 9abca2ee (verified in git log)
- Task 2 commit: c8bbe684 (verified in git log)
- `npx biome check ./src` exits 0
- vitest run: 129/129 test files pass
