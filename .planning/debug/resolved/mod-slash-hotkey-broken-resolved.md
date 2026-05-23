---
status: diagnosed
trigger: "Pressing Cmd+/ (macOS) in the Tauri app does nothing — the keyboard shortcuts panel never opens."
created: 2026-03-15T12:00:00Z
updated: 2026-03-15T12:00:00Z
---

## Current Focus

hypothesis: react-hotkeys-hook parses "mod+/" into key literal "/" but normalizes KeyboardEvent.code "Slash" to "slash" — they never match
test: Traced through minified library source to confirm matching logic
expecting: "/" !== "slash" causes early return false in matcher
next_action: Report root cause — do not fix

## Symptoms

expected: Pressing Cmd+/ opens the keyboard shortcuts panel
actual: Nothing happens — handler never fires
errors: None (silent failure — no console error)
reproduction: Press Cmd+/ anywhere in the Tauri app after onboarding
started: After commit 8e37ec6 changed hotkey from "?" to "mod+/"

## Eliminated

- hypothesis: Tauri intercepting Cmd+/ at native/webview level before JS receives it
  evidence: No global-shortcut plugin in Cargo.toml, no menu accelerators in lib.rs, no menu config in tauri.conf.json. The Rust backend has zero shortcut/menu registration.
  timestamp: 2026-03-15

- hypothesis: Tauri v2 default macOS menu consuming Cmd+/
  evidence: Tauri v2 only creates default Edit menu with Cmd+C/V/X/Z/A — no Cmd+/ accelerator in default menus. Issue #8676 relates to multi-webview focus, not single-window apps.
  timestamp: 2026-03-15

## Evidence

- timestamp: 2026-03-15
  checked: react-hotkeys-hook v5.2.4 source (node_modules/react-hotkeys-hook/dist/index.js)
  found: |
    The hotkey parser P() at line 30 splits "mod+/" by "+" into ["mod", "/"].
    After filtering modifiers, keys = ["/"] and mod = true.

    The key normalizer K() at line 21 takes e.code (e.g. "Slash") and applies:
      .toLowerCase().replace(/key|digit|numpad/, "") => "slash"

    The matcher re() at line 116-131 checks: !u?.includes(p)
    where u = ["/"] (parsed keys) and p = "slash" (normalized code).
    "/" !== "slash" => returns false at line 121.

    The handler is NEVER called because the key literal "/" from the hotkey
    string never matches the normalized code "slash" from the keyboard event.
  implication: This is a key-naming mismatch in react-hotkeys-hook. The library expects either the full code name "slash" or the useKey option to match against event.key instead of event.code.

- timestamp: 2026-03-15
  checked: GitHub issue JohannesKlauss/react-hotkeys-hook#1125
  found: Confirms slash/backslash/bracketright are not defined correctly in parseHotkeys.ts — known bug in the library's key mapping
  implication: Using "mod+slash" (full word) instead of "mod+/" would bypass the mismatch, as the parser would produce keys=["slash"] matching the normalized code "slash"

- timestamp: 2026-03-15
  checked: Tauri backend (lib.rs, main.rs, Cargo.toml, tauri.conf.json)
  found: No global-shortcut plugin, no menu items, no accelerators registered. Tauri is not intercepting any keyboard events.
  implication: Tauri is not the problem — this is purely a frontend JS issue

- timestamp: 2026-03-15
  checked: vitest tests pass
  found: Tests pass because jsdom likely fires synthetic events where code/key values are set by the test author, not by a real keyboard. The mismatch only manifests with real browser KeyboardEvents.
  implication: Test coverage does not catch this class of bug

## Resolution

root_cause: |
  react-hotkeys-hook v5.2.4 has a key-naming mismatch for the "/" character.

  When useHotkeys('mod+/') is called, the parser splits by "+" and gets the
  key literal "/". But when a real keyboard event fires, event.code is "Slash"
  which normalizes to "slash". The matcher compares "/" against "slash" and
  they never match, so the handler never fires.

  This is a known issue: github.com/JohannesKlauss/react-hotkeys-hook/issues/1125

  The bug does NOT exist in Tauri's native layer — no shortcuts or menus are
  registered in the Rust backend.

fix:
verification:
files_changed: []
