---
phase: 99-mentions-media-smart-input
plan: 14
subsystem: wiki-editor
tags: [uat, wkwebview, gates]
requires: [99-11, 99-12, 99-13]
provides: [99-HUMAN-UAT.md results]
key-files:
  created: [.planning/phases/99-mentions-media-smart-input/99-HUMAN-UAT.md]
  modified: []
completed: 2026-11-17
---

# Phase 99 Plan 14: Gates and WKWebView UAT Summary

The full suite (420 files, 6422 tests) and tsc passed. The 12-test UAT ran with 9 passing and 3 gaps recorded (1 major, 1 minor, 1 cosmetic).

## Tasks

1. Gate run and UAT checklist: commit 108f1c51.
2. Manual WKWebView UAT: commit 59f9317c. The user asked Claude to run it. Claude used Playwright WebKit for all 12 tests, plus a Swift-hosted real WKWebView with the app's Edit menu for tests 1, 4, 5 and 7 (native drag-destination, a real clipboard screenshot, native key-equivalent dispatch). The throwaway harness was deleted afterwards.

## Gaps (see 99-HUMAN-UAT.md)

- **Major, test 7:** Cmd+Shift+V does nothing in WKWebView. The app has no menu item for it, and WebKit binds nothing to it. Native `pasteAsPlainText:` works, so the fix is a menu item that sends it to the webview.
- **Minor, test 9:** a programmatic doc reset (shared value) opens a suggestion popover in an unfocused editor, and Esc doesn't close it.
- **Cosmetic, test 8:** Google Docs headings save as `h2. *text*`.

## Not covered

- A physical Finder drag source. WebKit's drag-destination API was driven natively, and `dragDropEnabled: false` is confirmed in config.
- Real Jira and Word clipboard captures. Only the synthetic fixtures were used, so no customer data was handled.

## Deviations

UAT was run by Claude instead of the user, at the user's request.

## Self-Check: PASSED
