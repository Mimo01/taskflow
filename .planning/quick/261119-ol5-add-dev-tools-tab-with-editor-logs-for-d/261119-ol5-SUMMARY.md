---
phase: quick-261119-ol5
plan: 01
subsystem: dev-tools / wiki-editor
tags: [dev-tools, wiki-editor, logging]
key-files:
  created:
    - taskflow/src/stores/wiki-editor-log.store.ts
    - taskflow/src/lib/wiki-editor-log.ts
    - taskflow/src/routes/dev-tools/EditorTab.tsx
    - taskflow/src/components/wiki-editor/editor-log.test.tsx
  modified:
    - taskflow/src/routes/dev-tools/DevToolsPage.tsx
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/WikiEditorLazy.tsx
metrics:
  completed: 2026-11-19
---

# Quick 261119-ol5: Editor tab in Developer Tools

An "Editor" tab in Developer Tools lists wiki editor events (open, close, mode switch, save-failed, save-recovered, submit, submit-blocked, external-reset, load-failed, crash) as expandable cards, backed by an in-memory capped store and a gated, never-throwing logger. Observation only: editor behaviour is unchanged.

## Commits
- 568762e6: store, logger, EditorTab, DevToolsPage wiring (Clear Logs also clears editor log) + tests
- 5fa0aa15: instrumentation of WikiEditor / WikiEditorLazy + editor-log.test.tsx

## Decisions
- Capture is gated on devToolsEnabled at call time; the build thunk is not run when off.
- Failure events carry original/produced markup (truncated at 20k chars); routine events are metadata only.
- Save-failed is logged on transition (previous reason differs). The reason string embeds block text, so each distinct failing text logs a new entry; same-reason repeats do not.

## Deviations
- Test adjusted: the plan expected repeated failing keystrokes to stay at one entry, but the failure reason contains the document text so it changes per keystroke; the test asserts a single entry for the first failure only. Implementation follows the plan's "different reason" transition rule.
- node_modules was symlinked from the main checkout for running tools (ignored by git).

## Verification
- vitest (wiki-editor, bundle-guard, dev-tools, stores): 81 files, 936 tests pass.
- tsc clean; biome clean on touched files.

## Self-Check: PASSED
