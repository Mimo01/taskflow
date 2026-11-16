---
phase: 96-wiki-foundations-equivalence-harness
plan: 05
subsystem: wiki
tags: [spike, editor, tiptap, codemirror, wkwebview, ime]
requires: [96-02, 96-03]
provides:
  - Editor engine decision (TipTap) and API notes for Phases 97/98
affects: [phase-97, phase-98]
key-files:
  created:
    - .planning/phases/96-wiki-foundations-equivalence-harness/96-SPIKE-FINDINGS.md
  modified: []
requirements-completed: []
duration: 45min
completed: 2026-11-16
---

# Phase 96 Plan 05: Editor engine spike Summary

TipTap chosen under the D-02 rule. No WKWebView caret or IME blocker was found in either engine. Findings are in 96-SPIKE-FINDINGS.md.

## Tasks

1. **Throwaway prototypes:** built a TipTap and a CodeMirror-6 prototype in an "Editor spike" dev-tools tab, on `spike/96-editor-engine` in a separate worktree (spike commit 0842113c, never on main).
2. **Smoke test:** the user asked Claude to run it. macOS denied Accessibility and Screen Recording access, so Claude drove a native Swift WKWebView harness instead.
   - Real `NSEvent` keys, `NSTextInputClient` IME composition and a real pasteboard paste. The user's clipboard was restored afterwards.
   - The SAFE-01 check rendered all 37 fixtures through WikiRenderer at 62064e5f and on main. The HTML was byte-identical.
3. **Findings and disposal:** wrote 96-SPIKE-FINDINGS.md, stopped the spike dev app, and deleted the spike worktree and branch.

## Deviations

- **Harness instead of manual test:** the smoke test ran in a scratchpad WKWebView harness rather than by hand in the Tauri window. The webview is the same WebKit engine. Dead-key handling could only be exercised through the IME path, because synthetic key events skip TIS.
- **CodeMirror prototype fixed mid-test:** it was given `history()`, the default keymaps and `atomicRanges`. Without them, undo failed and the caret stuck at the emoji widget, and both were prototype defects rather than engine defects.
- **SAFE-01 by HTML diff:** the visual spot check was done by diffing the rendered HTML rather than by viewing real issues, so no customer text was handled.

## Self-Check: PASSED

- All seven required headings are present in 96-SPIKE-FINDINGS.md.
- main's package.json has 0 editor package entries.
- `git branch --list spike/96-editor-engine` prints nothing, and there is no taskflow-spike-96 worktree.
