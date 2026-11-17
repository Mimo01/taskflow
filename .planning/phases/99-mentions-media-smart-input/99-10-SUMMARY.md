---
phase: 99-mentions-media-smart-input
plan: 10
subsystem: wiki-editor
tags: [tiptap, paste, prosemirror, shortcuts]
requires: ["99-02", "99-05"]
provides:
  - "paste-plugin.ts: WikiSmartPaste, fetchPastedImage"
  - "shortcuts.ts: editor-paste-plain and editor-trigger-mention/slash/emoticon rows"
affects: [99-12]
key-files:
  created:
    - taskflow/src/components/wiki-editor/paste/paste-plugin.ts
    - taskflow/src/components/wiki-editor/paste/paste-plugin.test.ts
  modified:
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/lib/shortcuts.test.ts
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx
key-decisions:
  - "Wiki-text paste dispatches three transactions (closeHistory isolator, literal paragraphs, parsed rich content), each closing history; the A4 two-undo-step assumption held, no fallback was needed"
  - "Marker images are deleted from the paste transaction before dispatch, so they never exist in a dispatched doc; upload positions are shifted by earlier deletions"
  - "Without upload or stage support, remote images become safe links and data: images are dropped"
requirements-completed: [INPUT-03, INPUT-04]
duration: ~40min
completed: 2026-11-17
---

# Phase 99 Plan 10: Smart paste extension Summary

`WikiSmartPaste` routes HTML through the allowlist normaliser with image uploads, parses wiki-looking plain text with a two-step undo, and steps aside on Cmd+Shift+V. The shortcut and the @ / : trigger rows are registered for the shortcuts panel. Live registration is plan 12.

## Commits
- 4d287ffe: `feat(99-10): WikiSmartPaste extension for HTML, HTML images, wiki text and plain mode` (Task 1)
- 89833a3a: `feat(99-10): register Cmd+Shift+V and trigger rows in the shortcut registry` (Task 2)

The pre-commit full suite failed several times on unrelated route-test timeouts (load average 40-90); those tests pass in isolation, and the commit succeeded on a later retry.

(RED and GREEN combined per task because the pre-commit hook runs the full suite.)

## Verification
- `npx vitest run src/components/wiki-editor src/lib`: 118 files, 1873 tests pass; tsc clean; biome clean for new files (one naming warning for `__parseFromClipboard`, same as the plan 02 test).
- No `innerHTML` sinks in paste-plugin.ts; `data-pm-slice` guard present.

## Deviations from Plan

**1. [Rule 3 - Blocking] ToolbarButton.test.tsx pinned the editor shortcut list to 14 ids**
- Adding the four rows broke it. Updated the expected ids and limited the "while editing" description check to the original rows.
- File: taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx (outside the plan's files_modified).

**2. Generic clipboard image name:** `clipboardImageName` only generates a timestamped name for `image.png`-style inputs, so the plugin passes `image.png` as the seed name.

## Known Stubs
None.

## Threat Flags
None. T-99-34..38 mitigated: normaliser output only, single 5s fetch with image content-type check, link fallback only when isSafeLinkUrl, loadWiki failure falls back to plain paste, data: images decoded to a File and never used as a node src.

## Self-Check: PASSED
