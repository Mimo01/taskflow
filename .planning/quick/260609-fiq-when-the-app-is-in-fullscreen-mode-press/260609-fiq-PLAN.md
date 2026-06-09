---
phase: quick
plan: 260609-fiq
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/main.tsx
autonomous: true
requirements:
  - FULLSCREEN-ESC-01
must_haves:
  truths:
    - "Pressing ESC while the app is in macOS fullscreen does NOT exit fullscreen"
    - "Pressing ESC while peek panel is open in fullscreen DOES close the peek panel (and keeps fullscreen)"
    - "Pressing ESC while command palette is open in fullscreen DOES close the palette (and keeps fullscreen)"
    - "Pressing ESC while keyboard shortcuts panel is open in fullscreen DOES close it (and keeps fullscreen)"
    - "Pressing ESC while the About dialog is open in fullscreen DOES close it (and keeps fullscreen)"
    - "ESC behavior in non-fullscreen mode is completely unchanged"
  artifacts:
    - path: "taskflow/src/main.tsx"
      provides: "Fullscreen ESC guard in AppShell"
  key_links:
    - from: "taskflow/src/main.tsx"
      to: "@tauri-apps/api/window"
      via: "getCurrentWindow().isFullscreen()"
      pattern: "isFullscreen"
---

<objective>
Prevent ESC from exiting macOS native fullscreen mode.

On macOS, pressing ESC while in the OS native fullscreen (entered via the green traffic-light button) triggers Cocoa / WKWebView to exit fullscreen. This is the default browser/webview behavior where `keydown` with key `Escape` has a default action of exiting fullscreen. Calling `event.preventDefault()` in a capture-phase listener suppresses that default action.

The guard must be conditional: when the peek panel, command palette, keyboard shortcuts panel, or About dialog are open, ESC should still close them (their own `useHotkeys` handlers fire in the bubble phase after our capture-phase listener). We only block the default when none of those consumers are active.

Purpose: Keep the user in fullscreen when pressing ESC with no overlays open.
Output: A single `useEffect` in `AppShell` (main.tsx) that tracks fullscreen state via the Tauri window API and intercepts ESC in capture phase.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/ROADMAP.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/main.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fullscreen ESC guard to AppShell</name>
  <files>taskflow/src/main.tsx</files>
  <action>
In the `AppShell` component in `main.tsx`, add a `useEffect` (near the existing hotkey / menu-event effects, after the `listen` effect block around line 266) that does the following:

1. Declare a `isFullscreenRef = useRef(false)` at the top of the component body alongside the other refs (after `wasStoryCreate`).

2. In the `useEffect`:
   a. Define an async `syncFullscreen` function that calls `await getCurrentWindow().isFullscreen()` and stores the result in `isFullscreenRef.current`. Wrap in `.catch(() => {})`.
   b. Call `syncFullscreen()` immediately on mount.
   c. Subscribe to the Tauri `tauri://resize` event (via `getCurrentWindow().listen('tauri://resize', syncFullscreen)`) — macOS fires a resize when entering/exiting fullscreen. Store the unlisten promise.
   d. Define a `handleEscCapture` function: if `e.key !== 'Escape'` return early. If `isFullscreenRef.current` is false, return early. If any of the "app ESC consumers" is active — `paletteOpen`, `shortcutsOpen`, `aboutOpen`, `peekIssueKey !== null` — return early (let those handlers fire in bubble phase). Otherwise call `e.preventDefault()`.
   e. Register `document.addEventListener('keydown', handleEscCapture, { capture: true })`.
   f. In the cleanup function: call `document.removeEventListener('keydown', handleEscCapture, { capture: true })`, and await-then-call the unlisten function from the Tauri resize listener.

The effect's dependency array should be `[paletteOpen, shortcutsOpen, aboutOpen, peekIssueKey]` so the closure over those booleans stays fresh.

Do NOT use `useHotkeys` for this — it runs in bubble phase and cannot call `preventDefault()` in time to block the macOS fullscreen exit. A manual capture-phase `addEventListener` is required.

`getCurrentWindow` is already imported at line 11. `useRef` is already imported at line 12. No new imports needed.

Keep the existing `useEffect` at line 512-517 (the `setFocus` call) untouched.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>
    `npm run check` passes with no new errors. The `AppShell` component contains a `useRef(false)` for fullscreen tracking, a `useEffect` with `tauri://resize` subscription, and a capture-phase `keydown` listener that calls `preventDefault()` on ESC when fullscreen is active and no overlay is open.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keydown event | Untrusted user input from keyboard; only `e.key` is read (no DOM mutation) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fiq-01 | Denial of Service | ESC capture handler | accept | Handler is synchronous, O(1), no I/O; cannot be looped by attacker |
| T-fiq-02 | Tampering | isFullscreenRef | accept | Read-only ref updated only by the trusted Tauri API; no user-controlled path |
</threat_model>

<verification>
1. Enter macOS fullscreen via the green traffic-light button.
2. Press ESC with no overlays open — app stays in fullscreen.
3. Open peek panel (click an issue body), then press ESC — peek closes, app stays in fullscreen.
4. Open command palette (Cmd+K), then press ESC — palette closes, app stays in fullscreen.
5. Exit fullscreen normally (Cmd+Ctrl+F or green button) — still works.
6. In non-fullscreen mode, ESC with peek open closes the peek — unchanged.
</verification>

<success_criteria>
- ESC in fullscreen with no overlays open: fullscreen is preserved (no exit).
- ESC in fullscreen with peek/palette/shortcuts/about open: overlay closes, fullscreen preserved.
- ESC outside fullscreen: all existing behavior unchanged.
- `npm run check` green.
</success_criteria>

<output>
Create `.planning/quick/260609-fiq-when-the-app-is-in-fullscreen-mode-press/260609-fiq-SUMMARY.md` when done.
</output>
