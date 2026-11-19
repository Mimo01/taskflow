---
phase: quick-261119-rgb
plan: 01
subsystem: wiki-editor
tags: [wiki-editor, toolbar, styling, searchable-select]
requires: []
provides:
  - TOOLBAR_PRESSED_CLASS shared pressed style (ToolbarButton + ModeToggle)
  - SearchableSelect variant="ghost"
affects:
  - taskflow/src/components/wiki-editor/toolbar
  - taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
  - taskflow/src/components/ui/searchable-select.tsx
tech-stack:
  added: []
  patterns: [shared pressed-class constant, additive variant prop on shared primitive]
key-files:
  created: []
  modified:
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx
    - taskflow/src/components/wiki-editor/toolbar/OverflowMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/InsertMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx
    - taskflow/src/components/wiki-editor/toolbar/ModeToggle.tsx
    - taskflow/src/components/wiki-editor/toolbar/ModeToggle.test.tsx
    - taskflow/src/components/wiki-editor/nodeviews/CodeBlockView.tsx
    - taskflow/src/components/wiki-editor/nodeviews/nodeviews.test.tsx
    - taskflow/src/components/ui/searchable-select.tsx
decisions:
  - Pressed = neutral foreground-alpha fill + inset hairline ring (accent == muted in this theme, so bg-accent equalled hover)
  - More|Insert divider only renders with More (Task 2 breakpoint shift later superseded by Task 4)
  - Toolbar overflow is measurement-driven - room = items region + spacer (+ More block / Insert label added back); splitToolbar(preset, roomPx) stays pure
  - SearchableSelect ghost variant is additive; default trigger class string is byte-identical
metrics:
  completed: 2026-11-19
  tasks: 4 (incl. 2 scope additions)
---

# Quick 261119-rgb: Polish wiki editor toolbar visuals Summary

The toolbar's top corners now follow the frame's rounded border, pressed buttons use a clearly visible colourless style, the More menu sits right after the formatting items and before a divider and + Insert, and the code block header has a quiet ghost language trigger.

## Tasks

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 Corners + pressed state | ed1aa48a | Toolbar root `rounded-t-[calc(var(--radius-lg)-1px)]`. Scroller is fully rounded in full preset and top-rounded in compact. No overflow-hidden on the frame. New exported `TOOLBAR_PRESSED_CLASS` (foreground/10 fill, inset ring at foreground/15, stronger dark-theme values). Tests assert ring/fill on pressed and none when unpressed. |
| 2 More before Insert | 4b128d5d | DOM order is items, overflowed-link anchor, More, divider (only when `overflowItems.length > 0`), Insert, spacer, mode controls. The More menu now uses `align="start"`. OVERFLOW_BREAKPOINTS, INLINE_CLASS and the doc comment are updated in lockstep with the plan's values. The fit test adds 13px while More shows and starts at 372 (full) / 358 (compact). New Toolbar tests cover the More/divider/Insert order and the missing divider when nothing overflows. |
| 3 Code block header | 57a8997f | `SearchableSelect` takes `variant?: 'default' \| 'ghost'`. Ghost is borderless, h-6 and label-only with a size-3.5 chevron and hover fill. The default class string is unchanged. The code header is `h-8 bg-muted/60 border-border/60 px-1.5 density-compact:h-7`, and Noformat gets `px-1.5`. Tests check that the trigger text is exactly "Java" and that there is no `border-input`. |
| 4 Measured overflow fitting (scope addition) | 61050bff | Overflow now follows the measured room rather than fixed breakpoints. A layout effect and a ResizeObserver on the toolbar, items region and spacer measure the room for the items: items region width + flex-1 spacer width, which is exactly what the pinned controls, padding and gaps leave over. The width of the More block (now one `data-toolbar-more` span holding the overflowed-link anchor, More and the divider) and of the Insert label are added back, so the measured room does not depend on whether they show and the split cannot oscillate. The real Text style trigger width is measured too, since its label varies. `splitToolbar(preset, roomPx, { textStylePx })` stays pure: everything inline if it fits (the Insert label only if it fits as well), otherwise it reserves the More block (+4 for the link anchor) and moves items out in OVERFLOW_ORDER until the rest fits. `OVERFLOW_BREAKPOINTS`, `INLINE_CLASS` and `INSERT_LABEL_CLASS` are removed, so no container-query gating is left to disagree with the JS. `InsertMenu` takes `showLabel` instead of `labelClassName`. Before the first measurement (toolbar width 0: jsdom, hidden) nothing overflows and the label is hidden. The Toolbar no longer takes `frameRef`. **This supersedes the Task 2 breakpoint shift.** |
| Scope addition: ModeToggle | 4b9d146a | The active Rich/Source segment uses `cn(TOOLBAR_PRESSED_CLASS, 'font-semibold')` in place of `bg-accent ... text-accent-foreground`. A ModeToggle test asserts the shared classes. |

## Deviations from Plan

- **Scope addition (coordinator/user request):** The ModeToggle active segment now uses the shared pressed constant (commit 4b9d146a). The plan had listed ModeToggle as out of scope.
- **Test expectations adjusted for new breakpoints (Task 2):** The plan only called out `splitToolbar('compact', 360)`, but three full-preset probes in `splits full preset by width` also depended on the old numbers. They were moved by +16 to keep what each one checks: 400→420 (italic inline), 430→446 (bullet overflowed, underline inline) and 540→556 (colour last overflowed).
- **Scope addition 2 (coordinator/user request), Task 4:** Overflow fitting is now measurement-driven (commit 61050bff). In the create/edit issue modal, sub/sup were always in More even though the toolbar had free space, because the old static model assumed 214px of pinned controls. Task 2's +16px breakpoint shift and the INLINE_CLASS lockstep tests no longer exist. Task 2's ordering (More, divider, Insert) is kept, now as the measured More block.
  - Tests: toolbar-config.test.ts was rewritten around `itemsWidth`/`TOOLBAR_PX`. It covers the all-fit/label threshold, the ~620px full-preset case with sub/sup inline, OVERFLOW_ORDER, the measured Text style width, a fit check at every room width, and a check that nothing overflows unnecessarily. Toolbar.test.tsx stubs `getBoundingClientRect` (`setRoom`) instead of the frame ResizeObserver width. It adds a 620px sub/sup test, an Insert-label test, and a stability test where the items region loses the More width while More shows, as in a browser. I confirmed the stability test fails when the More add-back is removed. compact.test.tsx needed no change: it only asserts that the toolbar is present, and in the WikiEditor the compact preset renders no Toolbar.
  - Constants still in use: button 28 / gap 4 / divider 13 / More block 45 / link anchor 4 / Insert label 37, from the 98 UAT WebKit measurements. The pinned widths are no longer constants. Text style is measured, with 98 as the fallback.
- **Extra test:** `has no pressed ring when pressed is false` was added to ToolbarButton.test.tsx. The plan covered "false/undefined", and the existing test only exercised undefined.

## Verification

- `npx vitest run src/components/wiki-editor src/components/ui`: 77 files, 850 tests passed (after Task 4).
- `npx biome check` on touched files is clean. The only warning in the toolbar dir is pre-existing, in the untouched TableGridPicker.tsx.
- `npx tsc --noEmit` is clean.
- Note: in this worktree the pre-commit hook reported "no TypeScript changes staged, skipping tsc and tests" for every commit. It does not seem to detect `taskflow/`-prefixed paths from the outer root. I ran all checks manually before each commit.

## Known Stubs

None.

## Self-Check: PASSED

- Commits ed1aa48a, 4b128d5d, 57a8997f, 4b9d146a and 61050bff are present on worktree-agent-a4034a6f1220a19ff.
- All modified files exist.
