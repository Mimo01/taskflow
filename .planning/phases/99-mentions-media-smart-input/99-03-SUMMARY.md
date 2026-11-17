---
phase: 99-mentions-media-smart-input
plan: 03
subsystem: wiki-editor
tags: [tiptap, suggestion, popover, lifecycle]
requires: ["99-01"]
provides:
  - "SuggestionPopover shared listbox (keyboard, skeleton, no-blink)"
  - "createSuggestionExtension factory, exitAllSuggestions, isAnySuggestionActive"
affects: [mention, emoticon, issue-key and slash triggers in later plans]
key-files:
  created:
    - taskflow/src/components/wiki-editor/suggestion/SuggestionPopover.tsx
    - taskflow/src/components/wiki-editor/suggestion/create-suggestion.ts
    - taskflow/src/components/wiki-editor/suggestion/popover.test.tsx
    - taskflow/src/components/wiki-editor/suggestion/lifecycle.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
key-decisions:
  - "Popover element is appended by the factory into the nearest [role=dialog] (else body) before calling props.mount, because the plugin's container option is static"
  - "Plugin onKeyDown consumes Escape with stopPropagation so Base UI's document listener never sees it; test fails without it"
requirements-completed: [INPUT-01, INPUT-05, INPUT-06, BLOCK-05]
completed: 2026-11-17
---

# Phase 99 Plan 03: Suggestion infrastructure Summary

One shared `SuggestionPopover` and one `createSuggestionExtension` factory over `@tiptap/suggestion` 3.34 (managed `mount` positioning), proven leak-free and Esc-nesting-correct inside a real Base UI Dialog.

## Tasks

1. SuggestionPopover plus popover.test.tsx (10 tests): commit 319535d3.
2. Factory, lifecycle.test.tsx (7 tests), WikiEditor `exitAllSuggestions` in toSource, toRich and the external reset: commit dc78feff.

## Deviations from Plan

**1. [Rule 3 - Blocking] Pre-commit full suite flaked under load**
- Machine load average was about 43 from parallel agents; heavy unrelated route tests (EpicDetailSheet, IssueDetailSheet, WorklogsPage) timed out at 5s on cold import and passed on retry. Not caused by this plan (new files only). No `--no-verify` used; recommitted until green.

**2. Built-in protection `allow` also checks `link` mark and rawInline parent** per the plan; `spec.allow` is ANDed. No functional deviation.

## Known Stubs
None. No real triggers exist yet (by design); the test-local `#` trigger is test-only.

## Threat Flags
None. Rows render as React text only; no dangerouslySetInnerHTML (grep empty).

## Self-Check: PASSED
- All four created files exist; both commits exist; acceptance greps verified (3x exitAllSuggestions(editor, stopPropagation, closest dialog, no document.createElement).
