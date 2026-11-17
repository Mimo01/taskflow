---
status: partial
phase: 100-host-adoption-editing-workflow
source: [100-VERIFICATION.md]
started: 2026-11-17T20:17:20Z
updated: 2026-11-17T21:35:27Z
---

## Current Test

Driven by Claude in the running tauri dev app (Swift CGEvent driver), 2026-11-17. Mutating checks (real submit, app restart) left for the user.

## Tests

### 1. Esc in the peek (editor focused, popover open, composer focused)
expected: Esc closes the popover first; with no popover, the composer blurs (peek stays) and comment edit / Edit Issue show the discard dialog only when dirty
result: pass (after fix 92433ba3) — popover Esc closes popover only; next Esc blurs composer (peek stays); next Esc closes peek. Edit Issue: Esc dirty -> Discard changes?, clean -> closes; X keeps draft, Discard clears it. Before the fix Esc never reached onCancel in rich mode (ProseMirror preventDefaults Escape). Comment-edit Esc not exercised in-app (no own comment on a test issue); same code path, covered by tests.

### 2. Cmd+Enter in Create Epic, Create/Edit Issue, comment composer and comment edit (also with a popover open)
expected: Submits in each host; does nothing while a popover is open
result: partial (after fix 92433ba3) — Create Epic: Cmd+Enter with empty name focuses the name, nothing created; with a mention popover open it now does nothing (before the fix it picked the mention AND submitted the form). Real submits in the 4 hosts NOT run (would write to Jira).

### 3. Create Epic (max-w-md) editor toolbar
expected: Toolbar fits or wraps/overflows cleanly with no clipping
result: pass — toolbar fits max-w-md (Paragraph, B, I, +, ⋯ overflow, Rich/Source), no clipping.

### 4. Drafts survive an app restart (unsent comment, Edit Issue description, comment edit)
expected: Each draft restored after quit + relaunch
result: partial — drafts persisted to ~/Library/Application Support/com.taskflow.app/drafts.json and restored after a full webview reload; Edit Issue draft restored after close/reopen. Actual quit + relaunch NOT run.

### 5. Drafts while navigating issue-to-issue inside the peek (CR-01 fix e40ba7e7)
expected: Each issue shows only its own draft
result: pass — ESHOP-22710 'draft for a' / ESHOP-22709 'draft for b': each issue shows only its own draft across in-peek swaps both ways.

## Summary

total: 5
passed: 3
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

- Fixed during UAT (92433ba3): rich-mode Esc cancel/blur broken in WKWebView; Cmd+Enter with popover open submitted host forms; editor placeholders invisible (no CSS).
