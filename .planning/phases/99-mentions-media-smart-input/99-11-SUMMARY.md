---
phase: 99-mentions-media-smart-input
plan: 11
subsystem: wiki-editor
tags: [tiptap, bubble-menu, compact-preset, attachment-picker]
requires: [99-03, 99-05, 99-06, 99-08, 99-09]
provides:
  - BubbleToolbar and shouldShowBubble
  - CompactFooter
  - Attachment picker mounted in WikiEditor (WIKI_OPEN_ATTACH_EVENT listener)
affects: [WikiEditor compact hosts]
key-files:
  created:
    - taskflow/src/components/wiki-editor/toolbar/BubbleToolbar.tsx
    - taskflow/src/components/wiki-editor/toolbar/CompactFooter.tsx
    - taskflow/src/components/wiki-editor/toolbar/compact.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPickerModal.tsx
key-decisions:
  - "Bubble uses its own PluginKey (BUBBLE_KEY) so Esc can dispatch the 'hide' meta"
  - "Footer sits after the overflow-auto div so it never scrolls away"
metrics:
  tasks: 2
  completed: 2026-11-17
---

# Phase 99 Plan 11: Compact bubble + footer, attachment picker Summary

Compact preset now uses a floating selection bubble (B/I/U/S/Mono | Link | Colour) plus a slim footer (Attach, Mention, Emoticon, Rich|Source); the full preset keeps its toolbar. The existing AttachmentPickerModal is mounted for both presets and opens from the footer or WIKI_OPEN_ATTACH_EVENT.

## Deviations from Plan

**1. [Rule 1 - Bug] Code-block detection**: the plan implied checking the selection parent; for select-all the parent is the doc, so shouldShowBubble walks `nodesBetween(from, to)` for a codeBlock instead.

**2. Tasks 1 and 2 committed together** (single commit 262fecc3) because the pre-commit hook runs the full suite and WikiEditor/test files are interdependent.

Tests: focus-return asserted via a spy on `editor.view.focus` (tiptap focuses in a rAF and the makeEditor editor is unmounted). Bubble shown in tests via the plugin's 'show' meta since jsdom has no focus/layout.

LinkPopover has no finalFocus prop (not in this plan's files); focus returns via applyLink's own chain.

## Commits
- 262fecc3: feat(99-11): compact bubble toolbar, footer row and attachment picker mount

## Verification
compact.test.tsx 12/12; wiki-editor and routes/dashboard suites green; full hook suite green; tsc clean; biome clean on touched files.

## Self-Check: PASSED
