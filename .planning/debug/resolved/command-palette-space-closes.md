# Debug: Command palette closes when typing Space

**Status:** RESOLVED — 2026-06-18
**Symptom:** In the apps search window (Command Palette), typing into the input and pressing Space closed the window instead of inserting a space.

## Root cause
`CommandPalette.tsx` renders a full-screen backdrop `div` (role=button) with an
`onKeyDown` that calls `onClose()` on `Escape`/`Enter`/`Space` (lines 280-285).
The inner content panel (lines 288-293) stopped `onClick` propagation but its
`onKeyDown` was a no-op `() => {}`. Keydown events from the `CommandInput`
therefore bubbled up to the backdrop, where `e.key === ' '` triggered `onClose()`.

## Fix
Made the content panel actually stop keydown propagation, symmetric with its
existing `onClick` stopper:

```diff
- onKeyDown={() => {}}
+ onKeyDown={(e) => e.stopPropagation()}
```

Escape still closes the palette — it's handled globally via `useHotkeys('escape', ...)`
(line 92, `enableOnFormTags`), not by event bubbling, so it is unaffected.

## Verification
- `tsc --noEmit`: no CommandPalette errors.
- Space now inserts into the input; Enter selects the highlighted result; Escape still dismisses.
