---
phase: 98-editor-shell
plan: 13
subsystem: wiki-editor
tags: [uat, wkwebview, manual]
requires: [98-12, 98-02]
provides:
  - "98-HUMAN-UAT.md: manual macOS WKWebView acceptance results (13/13 pass)"
affects: [98-14, 98-15, 98-16]
key-files:
  created:
    - .planning/phases/98-editor-shell/98-HUMAN-UAT.md
  modified: []
metrics:
  completed: 2026-11-17
  tasks: 1
  files: 1
requirements: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, SAFE-05, BLOCK-01, BLOCK-02, BLOCK-03, BLOCK-04, FLOW-04]
---

# Phase 98 Plan 13: Manual WKWebView UAT Summary

The manual acceptance check ran in a real macOS WKWebView (the Tauri engine), not jsdom. A throwaway page mounted the dev-tools EditorTab from the running Vite server with the React Compiler active. A compiled Swift driver sent native NSEvent keys and clicks, used `setMarkedText`/`insertText` for IME and dead keys, and took snapshots. The harness was deleted afterwards.

This SUMMARY was written at the v1.15 milestone close (2026-11-18). The plan's only output is 98-HUMAN-UAT.md, which was complete, but no SUMMARY had been committed.

## Results

- Round 1 (459c1927): 7 pass, 5 issues, 1 pending. The issues became gap-closure plans 98-14, 98-15 and 98-16.
- Round 2 (3ebf8374): re-test of the 98-14..16 fixes, 11 pass, 2 issues. Both were fixed inline in 226a92ce.
- Final (df06e7c4): 13/13 pass, 0 issues. This covers caret stability, IME, input rules during composition, wiki rules, app shortcuts while typing (FLOW-04), toolbar, blocks, links, source mode, forced source and failed save (SAFE-05), raw atoms and visual parity (EDIT-01).

## Limits

Hover tooltips, sticky scroll, Base UI popovers that need real pointer events, and Tauri-only behaviour (system browser) could not be driven this way. Tooltips were checked through keyboard focus instead.

## Deviations

None. The plan was a checklist, and the results are recorded in 98-HUMAN-UAT.md.
