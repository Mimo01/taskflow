---
phase: 98-editor-shell
plan: 16
subsystem: wiki-editor toolbar
tags: [gap-closure, toolbar, overflow, layout]
requirements: [EDIT-02, EDIT-04]
key-files:
  modified:
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.ts
    - taskflow/src/components/wiki-editor/toolbar/toolbar-config.test.ts
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.tsx
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx
    - taskflow/src/components/wiki-editor/toolbar/InsertMenu.tsx
    - taskflow/src/components/wiki-editor/toolbar/OverflowMenu.tsx
metrics:
  completed: 2026-11-17
---

# Phase 98 Plan 16: Narrow Full toolbar fix Summary

At narrow widths the Full toolbar now keeps only text style, Bold, Italic, Insert, More and Rich|Source, and the last three can never be clipped because they sit outside the shrinking items region.

## Changes

- Task 1 (commit 62cdd889): Full overflow order gains `numbered`, `bullet`, `underline` (breakpoints 420/420/400 with matching INLINE_CLASS literals). At 360px the inline set is exactly `text-style, bold, italic, insert`.
- Task 2: Toolbar split into `data-toolbar-items` (`flex min-w-0 shrink items-center gap-1 overflow-hidden`) plus flex-none Insert, link-overflow anchor, More, spacer, preview toggle (`hidden @[35rem]:inline-flex`) and ModeToggle. The list Divider only renders when a list/quote/link item is inline. Insert label is `hidden @[25rem]:inline` (aria-label kept). More trigger is flex-none.
- Tests: config split cases at 360/410/430/800; Toolbar structural tests (items region, pinned controls, 360 inline set, More contents, Insert label, preview toggle).

## Deviations from Plan

None in production code. Test-only note: `Array.prototype.at` is not in the TS lib target, so the 430px assertion uses `wide[wide.length - 1]`.

## Execution notes

The worktree base was behind the expected commit and was reset to 303499fa as the branch check prescribes. `node_modules` was symlinked from the main checkout (ignored by git). The pre-commit full-suite run timed out repeatedly in unrelated tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage, FindBar) while machine load average was above 40 from parallel agents. Those files pass in isolation and with the changes applied, so they are load-induced flakes, not regressions.

## Required follow-up

A real-WebKit re-check of UAT test 7 is required after execution (Full and Compact at Narrow 360px: one 40px row; text style, Bold, Italic, Insert icon, More, Rich|Source all visible; More lists Underline, Strikethrough, Monospace, Superscript, Subscript, Text colour, Bullet list, Numbered list, Quote, Link; source mode shows no preview toggle; Compact unchanged). The orchestrator runs it. If an always-visible item is still clipped in WebKit, tune the breakpoints in toolbar-config.ts, not the layout.

## Self-Check: PASSED (wiki-editor suite 42/42 toolbar tests pass; tsc and biome clean on touched files via pre-commit)
