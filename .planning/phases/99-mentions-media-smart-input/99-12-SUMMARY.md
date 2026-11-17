---
phase: 99-mentions-media-smart-input
plan: 12
subsystem: wiki-editor
tags: [tiptap, suggestion, paste, dev-tools]
requires: [99-06, 99-07, 99-08, 99-09, 99-10]
provides:
  - "WIKI_INPUT_EXTENSIONS registered in richExtensions"
  - "Dev-tools Editor tab: Host context, Paste sample, capture harness, Open in dialog"
affects: [wiki-editor, dev-tools]
key-files:
  created:
    - taskflow/src/components/wiki-editor/input-extensions.ts
    - taskflow/src/components/wiki-editor/input-integration.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/rich-extensions.ts
    - taskflow/src/routes/dev-tools/EditorTab.tsx
    - taskflow/src/routes/dev-tools/EditorTab.test.tsx
decisions:
  - "Host outcome lives in the useMemo deps (not a ref) because the React Compiler rejects ref writes during render"
metrics:
  completed: 2026-11-17
---

# Phase 99 Plan 12: Input registration and dev-tools UAT surface Summary

All Phase 99 input extensions (mention, emoticon, issue key, slash, smart paste, key decoration) are live in the rich editor, proven end-to-end through WikiEditor, and the dev-tools Editor tab now drives a stub host for UAT.

## Tasks

1. Register input extensions + integration tests - cfcb508. `WIKI_INPUT_EXTENSIONS` (frozen, module scope) is spread into `richExtensions` after the media extensions, so WikiSmartPaste runs after WikiLinkPaste. `extensions.ts` is untouched (no suggestion code). 8 integration tests cover @, :, /, KEY-, decoration, HTML paste, URL-over-selection, single popover and unmount cleanup.
2. Dev-tools Editor tab - 7b42ecdc. Host context row (project key, Staged mode switch, Succeed/Fail/Slow 3s), stub host with uploadFile/stageFile/deleteAttachment/onOpenIssue, placeholder attachments, Paste sample select over `__fixtures__/paste/*.html`, Capture next paste (read-only textareas, Copy, placeholder reminder), Open in dialog. State is local only; no persistence.

## Deviations from Plan

**1. [Rule 1 - Test bug] Single-popover assertion** - the suggestion renderer wrapper and the popover both carry `data-suggestion`, so `[data-suggestion]` counted one popover as two. The test counts `[role="listbox"]` instead. No production change; `create-suggestion.ts` untouched.

**2. [Rule 3 - Compiler] Ref write in render** - the first EditorTab draft synced `outcomeRef.current` during render and failed compiler-compat. Replaced with `outcome` in the host memo deps.

The pre-commit hook failed once on each commit run for the known load-dependent route tests / the compiler guard (fixed above); retried.

## Known Stubs

None. The stub host in EditorTab is intentional dev-tooling; Phase 100 wires real hosts.

## Threat Flags

None. Captured paste stays in component state, never persisted (T-99-42).

## Self-Check: PASSED
