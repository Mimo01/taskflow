# Quick Task 260617-dd2: Change search shortcut cmd+k → cmd+f — Research

**Researched:** 2026-06-17
**Domain:** Keyboard shortcut rebind in Tauri + react-hotkeys-hook
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- cmd+f opens search everywhere in the app (all views, globally)
- Intercept cmd+f and suppress the native browser find-in-page behavior entirely
- Remove cmd+k entirely — clean break, no alias kept

### Claude's Discretion
- Exact mechanism for intercepting the native cmd+f
- Which component/hook currently registers cmd+k and how to update it
</user_constraints>

---

## Summary

The command palette is opened by `mod+k` registered in two places: (1) a `useHotkeys('mod+k', ...)` call in `main.tsx` AppLayout, and (2) a native macOS menu bar accelerator `CmdOrCtrl+K` in `src-tauri/src/lib.rs`. Both must be updated.

The critical complexity is cmd+f: it is the browser's built-in find-in-page shortcut. In a Tauri WebView (WKWebView on macOS), the native find bar does not appear by default — Tauri does not expose a find-in-page UI — but the browser still intercepts the keydown event before JavaScript receives it, which means a plain `useHotkeys('mod+f')` will NOT fire reliably. The correct mechanism is a `keydown` capture-phase listener (or `useHotkeys` with `{ preventDefault: true }` at capture phase). The existing ESC fullscreen handler in main.tsx already demonstrates this pattern with `document.addEventListener('keydown', handleEscCapture, { capture: true })`.

`react-hotkeys-hook` v5 supports `{ preventDefault: true }` which calls `e.preventDefault()` before the hotkey fires — this is sufficient to block the WKWebView find-in-page behavior (confirmed by the same mechanism used for `mod+b` sidebar toggle, which also calls `e.preventDefault()`). [ASSUMED — not verified against WKWebView find-in-page behavior specifically; the existing `mod+b` preventDefault pattern is the closest analogue]

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hotkey registration (web) | Frontend (main.tsx) | — | useHotkeys in AppLayout is the single source of truth for web-layer shortcuts |
| Native menu accelerator | Tauri Rust (lib.rs) | — | macOS menu bar accelerators are Rust-side only |
| Shortcut display label | shortcuts.ts registry | KeyboardShortcutsPanel | SHORTCUTS array drives the panel; displayKeys is the human-readable label |

---

## Exact Change Locations

### 1. `taskflow/src/main.tsx` — line 246–249

Current:
```typescript
// PALETTE-01: Cmd+K opens command palette
useHotkeys('mod+k', (e) => {
  e.preventDefault();
  setPaletteOpen(true);
});
```

Change `'mod+k'` to `'mod+f'`. The `e.preventDefault()` call is already present and is the correct mechanism to suppress find-in-page. [VERIFIED: codebase]

### 2. `taskflow/src-tauri/src/lib.rs` — line 176–179

Current:
```rust
let command_palette_item = MenuItemBuilder::new("Command Palette")
    .id("menu-command-palette")
    .accelerator("CmdOrCtrl+K")
    .build(handle)?;
```

Change `"CmdOrCtrl+K"` to `"CmdOrCtrl+F"`. [VERIFIED: codebase]

### 3. `taskflow/src/lib/shortcuts.ts` — line 62–69

Current entry for `open-palette`:
```typescript
{
  id: 'open-palette',
  defaultKey: '⌘K',
  description: 'Open command palette',
  category: 'General',
  displayKeys: ['⌘', 'K'],
},
```

Change `defaultKey` to `'⌘F'` and `displayKeys` to `['⌘', 'F']`. [VERIFIED: codebase]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Suppressing browser find-in-page | Custom capture listener | `e.preventDefault()` already in existing useHotkeys handler — just change the key string |

---

## Common Pitfalls

### Pitfall 1: WKWebView find-in-page interception order
**What goes wrong:** On macOS, WKWebView may intercept Cmd+F before JavaScript's `keydown` event fires (bubble phase), causing the hotkey handler to never run.
**How to avoid:** The existing handler already calls `e.preventDefault()` which, per react-hotkeys-hook v5 behavior, fires before default browser action. The existing `mod+b` toggle uses this same pattern and works. [ASSUMED — no authoritative WKWebView documentation confirming Cmd+F specifically is blocked this way; validate manually after implementation]
**Fallback if it doesn't work:** Use a capture-phase `document.addEventListener('keydown', ..., { capture: true })` with `e.preventDefault()` — the same approach already used for the ESC fullscreen handler in main.tsx at line 540–549.

### Pitfall 2: Menu accelerator still triggers find
**What goes wrong:** Even if the web layer intercepts Cmd+F, the macOS menu bar accelerator `CmdOrCtrl+F` (once added) fires a `menu-command-palette` event — but if the menu bar item isn't updated, it still sends the old `CmdOrCtrl+K` event, and there will be no handler for Cmd+F from the menu.
**How to avoid:** Update the Tauri lib.rs accelerator in the same commit. Both changes must land together.

### Pitfall 3: Test file still references old shortcut
**What goes wrong:** `CommandPalette.test.tsx` and `KeyboardShortcutsPanel.test.tsx` may assert on the `⌘K` display label or test `mod+k` hotkey behavior.
**How to avoid:** Search both test files for `K` references after the change.

---

## Files to Touch (Complete List)

| File | Change |
|------|--------|
| `taskflow/src/main.tsx` | `'mod+k'` → `'mod+f'` (line 246) |
| `taskflow/src-tauri/src/lib.rs` | `"CmdOrCtrl+K"` → `"CmdOrCtrl+F"` (line 178) |
| `taskflow/src/lib/shortcuts.ts` | `defaultKey: '⌘K'`, `displayKeys: ['⌘','K']` → `'⌘F'`, `['⌘','F']` (lines 66–68) |
| `taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx` | Update any assertions on `⌘K` |
| `taskflow/src/components/app/CommandPalette.test.tsx` | Update any hotkey assertions |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `e.preventDefault()` in react-hotkeys-hook v5 is sufficient to block WKWebView's Cmd+F find-in-page | Common Pitfalls | If wrong, Cmd+F opens both the native find bar AND the palette; fallback is capture-phase listener |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `taskflow/src/main.tsx` — PALETTE-01 useHotkeys registration, line 246 [VERIFIED: codebase]
- Codebase: `taskflow/src-tauri/src/lib.rs` — CmdOrCtrl+K menu accelerator, line 178 [VERIFIED: codebase]
- Codebase: `taskflow/src/lib/shortcuts.ts` — SHORTCUTS registry, open-palette entry [VERIFIED: codebase]
- Codebase: `taskflow/src/main.tsx` — ESC capture-phase fullscreen handler, lines 540–549 (fallback pattern) [VERIFIED: codebase]
