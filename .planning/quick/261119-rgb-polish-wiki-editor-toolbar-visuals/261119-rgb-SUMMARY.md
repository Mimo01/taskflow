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
  - More|Insert divider only renders with More; every breakpoint except the widest moved +16px
  - SearchableSelect ghost variant is additive; default trigger class string is byte-identical
metrics:
  completed: 2026-11-19
  tasks: 3 (+1 scope addition)
---

# Quick 261119-rgb: Polish wiki editor toolbar visuals Summary

The toolbar's top corners now follow the frame's rounded border, pressed buttons use a clearly visible colourless style, the More menu sits right after the formatting items and before a divider and + Insert, and the code block header has a quiet ghost language trigger.

## Tasks

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 Corners + pressed state | ed1aa48a | Toolbar root `rounded-t-[calc(var(--radius-lg)-1px)]`. Scroller is fully rounded in full preset and top-rounded in compact. No overflow-hidden on the frame. New exported `TOOLBAR_PRESSED_CLASS` (foreground/10 fill, inset ring at foreground/15, stronger dark-theme values). Tests assert ring/fill on pressed and none when unpressed. |
| 2 More before Insert | 4b128d5d | DOM order is items, overflowed-link anchor, More, divider (only when `overflowItems.length > 0`), Insert, spacer, mode controls. The More menu now uses `align="start"`. OVERFLOW_BREAKPOINTS, INLINE_CLASS and the doc comment are updated in lockstep with the plan's values. The fit test adds 13px while More shows and starts at 372 (full) / 358 (compact). New Toolbar tests cover the More/divider/Insert order and the missing divider when nothing overflows. |
| 3 Code block header | 57a8997f | `SearchableSelect` takes `variant?: 'default' \| 'ghost'`. Ghost is borderless, h-6 and label-only with a size-3.5 chevron and hover fill. The default class string is unchanged. The code header is `h-8 bg-muted/60 border-border/60 px-1.5 density-compact:h-7`, and Noformat gets `px-1.5`. Tests check that the trigger text is exactly "Java" and that there is no `border-input`. |
| Scope addition: ModeToggle | 4b9d146a | The active Rich/Source segment uses `cn(TOOLBAR_PRESSED_CLASS, 'font-semibold')` in place of `bg-accent ... text-accent-foreground`. A ModeToggle test asserts the shared classes. |

## Deviations from Plan

- **Scope addition (coordinator/user request):** The ModeToggle active segment now uses the shared pressed constant (commit 4b9d146a). The plan had listed ModeToggle as out of scope.
- **Test expectations adjusted for new breakpoints (Task 2):** The plan only called out `splitToolbar('compact', 360)`, but three full-preset probes in `splits full preset by width` also depended on the old numbers. They were moved by +16 to keep what each one checks: 400→420 (italic inline), 430→446 (bullet overflowed, underline inline) and 540→556 (colour last overflowed).
- **Extra test:** `has no pressed ring when pressed is false` was added to ToolbarButton.test.tsx. The plan covered "false/undefined", and the existing test only exercised undefined.

## Verification

- `npx vitest run src/components/wiki-editor src/components/ui`: 77 files, 845 tests passed. The toolbar suite after the ModeToggle change had 61 tests, all passing.
- `npx biome check` on touched files is clean. The only warning in the toolbar dir is pre-existing, in the untouched TableGridPicker.tsx.
- `npx tsc --noEmit` is clean.
- Note: in this worktree the pre-commit hook reported "no TypeScript changes staged, skipping tsc and tests" for every commit. It does not seem to detect `taskflow/`-prefixed paths from the outer root. I ran all checks manually before each commit.

## Known Stubs

None.

## Self-Check: PASSED

- Commits ed1aa48a, 4b128d5d, 57a8997f and 4b9d146a are present on worktree-agent-a4034a6f1220a19ff.
- All modified files exist.
