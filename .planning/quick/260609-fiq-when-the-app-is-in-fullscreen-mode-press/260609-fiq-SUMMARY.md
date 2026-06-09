---
phase: quick
plan: 260609-fiq
subsystem: app-shell
tags: [fullscreen, keyboard, tauri, esc]
dependency_graph:
  requires: []
  provides: [fullscreen-esc-guard]
  affects: [taskflow/src/main.tsx]
tech_stack:
  added: []
  patterns: [capture-phase-keydown, tauri-window-api, useRef-for-async-state]
key_files:
  created: []
  modified:
    - taskflow/src/main.tsx
decisions:
  - "Capture-phase addEventListener used instead of useHotkeys — bubble phase fires too late to call preventDefault() before WKWebView exits fullscreen"
  - "isFullscreenRef (not useState) used to avoid re-render on resize; the ref is read only inside the event handler"
  - "tauri://resize event chosen as the fullscreen state sync trigger — macOS fires resize on both enter and exit fullscreen"
metrics:
  duration: ~5 min
  completed: 2026-06-09
---

# Phase quick Plan 260609-fiq: Fullscreen ESC Guard Summary

Prevent ESC from exiting macOS native fullscreen via a capture-phase keydown listener that calls `preventDefault()` only when the app is in fullscreen and no overlay (palette, shortcuts, about, peek) is open.

## What Was Built

Added to `AppLayout` in `taskflow/src/main.tsx`:

1. `isFullscreenRef = useRef(false)` — tracks macOS fullscreen state without causing re-renders.
2. A `useEffect` with dependency array `[paletteOpen, shortcutsOpen, aboutOpen, peekIssueKey]` that:
   - Calls `getCurrentWindow().isFullscreen()` on mount to initialise the ref.
   - Subscribes to `tauri://resize` events (macOS fires these on fullscreen toggle) to keep the ref current.
   - Registers a `capture: true` `keydown` listener (`handleEscCapture`) that calls `e.preventDefault()` when: key is Escape, fullscreen is active, and no overlay consumer is open.
   - Cleans up both the DOM listener and the Tauri resize unlisten on unmount / dep change.

## Tasks

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Add fullscreen ESC guard to AppShell | d2007c4c | Done |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary surface introduced. The handler only reads `e.key` (no DOM mutation) and the `isFullscreenRef` is updated only by the trusted Tauri API.

## Self-Check: PASSED

- `taskflow/src/main.tsx` modified with `isFullscreenRef`, `syncFullscreen`, `handleEscCapture`, capture-phase listener and Tauri resize subscription.
- Commit `d2007c4c` present in git log.
- `biome check ./src/main.tsx` — clean (no errors).
- `tsc --noEmit` — no errors in `main.tsx`.
- Pre-existing errors in `gitlab.ts`, `CommandPalette.tsx`, `BacklogPage.tsx` are unrelated to this change.
