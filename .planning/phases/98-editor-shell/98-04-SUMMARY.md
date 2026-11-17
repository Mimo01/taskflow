---
phase: 98-editor-shell
plan: 04
subsystem: ui
tags: [keyboard, shortcuts, tooltip, editor]
requires: []
provides:
  - isTypingTarget helper (lib/typing-target.ts)
  - Editor shortcut category (14 display-only entries) shown in the Cmd+/ panel
  - Shared Keycap (components/ui/keycap.tsx)
  - ToolbarButton with label + keycap tooltip
affects: [98-editor-shell toolbar plans, Phase 100 host adoption]
tech-stack:
  added: []
  patterns: ["single isTypingTarget guard for raw keydown listeners"]
key-files:
  created:
    - taskflow/src/lib/typing-target.ts
    - taskflow/src/lib/typing-target.test.ts
    - taskflow/src/components/ui/keycap.tsx
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.tsx
    - taskflow/src/components/wiki-editor/toolbar/ToolbarButton.test.tsx
  modified:
    - taskflow/src/routes/dashboard/useImageViewer.ts
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.tsx
    - taskflow/src/routes/dashboard/issue-detail/AttachmentPreviewModal.test.tsx
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/components/app/KeyboardShortcutsPanel.tsx
    - taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx
key-decisions:
  - "Editor shortcut defaultKey is prefixed 'editor:' so the registry's unique-defaultKey test passes (Cmd+B and Cmd+Shift+B equal existing global chords)"
requirements-completed: [FLOW-04, EDIT-04]
duration: long (machine under heavy load)
completed: 2026-11-17
---

# Phase 98 Plan 04: Typing-target guards, Editor shortcuts, ToolbarButton Summary

Shared isTypingTarget guard on all raw key listeners, 14 editor shortcuts in the Cmd+/ panel, and a reusable tooltip+keycap ToolbarButton.

## Tasks

1. isTypingTarget helper and guards: replaced the three inline copies (useImageViewer, AttachmentPreviewModal, AioTestRunDetailPage). AttachmentPreviewModal now guards ArrowLeft/ArrowRight too, with a contenteditable regression test.
2. Editor category, Keycap, ToolbarButton: ShortcutCategory gains 'Editor' with 14 entries (never bound as hotkeys), panel gets an Editor section, Keycap moved to ui/keycap.tsx, ToolbarButton uses app Tooltip + TooltipBody + Keycap, `size="icon-sm"` (28px), accent when pressed, mousedown preventDefault.

## FLOW-04 listener audit

| Listener | Result |
|---|---|
| useImageViewer keydown | guarded (isTypingTarget) |
| AttachmentPreviewModal keydown | guarded before every branch (font zoom and arrows) |
| AioTestRunDetailPage arrows | guarded (shared helper) |
| main.tsx Cmd+F / Cmd+Shift+F capture | unchanged: modifier chords, intentionally global |
| Escape fullscreen guard / usePreviewEscape | unchanged: Esc-cancel is Phase 100 |
| React onKeyDown on host ancestors | deferred to Phase 100 host adoption (editor lives only in dev tools now) |

## Deviations from Plan

**1. [Rule 1 - Bug] Duplicate defaultKey in registry.** shortcuts.test.ts requires unique defaultKeys; editor Cmd+B / Cmd+Shift+B collide with toggle-sidebar / nav-backlog. Fix: `editor:` prefix on all 14 defaultKeys (display uses displayKeys). `grep "category: 'Editor'"` still returns 14.

**2. Env note.** At the time of commit the machine load average was above 100; the pre-commit full suite flaked on first-test 5s timeouts in EpicDetailSheet, IssueDetailSheet, WorklogsPage and FindBar (all pass in isolation with a longer timeout, none touch changed code). Commits were retried until the hook passed; no `--no-verify`.

Keyboard override check: no `keyboardOverrides` consumer iterates SHORTCUTS for registration, so Editor entries create no global hotkeys.

## Known Stubs

None.

## Self-Check: PASSED (files created; commits recorded by git log)
