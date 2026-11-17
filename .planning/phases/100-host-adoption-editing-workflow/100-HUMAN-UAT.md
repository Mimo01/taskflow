---
status: partial
phase: 100-host-adoption-editing-workflow
source: [100-VERIFICATION.md]
started: 2026-11-17T20:17:20Z
updated: 2026-11-17T20:17:20Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Esc in the peek (editor focused, popover open, composer focused)
expected: Esc closes the popover first; with no popover, the composer blurs (peek stays) and comment edit / Edit Issue show the discard dialog only when dirty
result: [pending]

### 2. Cmd+Enter in Create Epic, Create/Edit Issue, comment composer and comment edit (also with a popover open)
expected: Submits in each host; does nothing while a popover is open
result: [pending]

### 3. Create Epic (max-w-md) editor toolbar
expected: Toolbar fits or wraps/overflows cleanly with no clipping
result: [pending]

### 4. Drafts survive an app restart (unsent comment, Edit Issue description, comment edit)
expected: Each draft restored after quit + relaunch
result: [pending]

### 5. Drafts while navigating issue-to-issue inside the peek (CR-01 fix e40ba7e7)
expected: Each issue shows only its own draft
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
