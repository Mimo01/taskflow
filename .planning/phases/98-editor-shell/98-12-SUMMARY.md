---
phase: 98-editor-shell
plan: 12
subsystem: wiki-editor
tags: [dev-tools, react-compiler, bundle-guard, uat-surface]
requires: [98-11]
provides:
  - Dev-tools "Editor" tab (EditorTab.tsx) with fixture picker, preset/width switchers, paste box, verdict panel
  - compiler-compat.test.ts (React Compiler acceptance, panicThreshold all_errors)
  - scripts/check-editor-chunk.mjs (post-build async chunk assertion)
affects: [98-13]
key-files:
  created:
    - taskflow/src/routes/dev-tools/EditorTab.tsx
    - taskflow/src/routes/dev-tools/EditorTab.test.tsx
    - taskflow/src/components/wiki-editor/compiler-compat.test.ts
    - taskflow/scripts/check-editor-chunk.mjs
  modified:
    - taskflow/src/routes/dev-tools/DevToolsPage.tsx
decisions:
  - "Render-commit counter writes to a DOM node via ref from the Profiler callback; setState there loops (each commit schedules another)"
  - "Fixtures use a lazy import.meta.glob with ?raw; corpus.fixtures.ts (eager) is not imported"
requirements-completed: [EDIT-09, SAFE-05, EDIT-01, EDIT-02, EDIT-03]
completed: 2026-11-17
---

# Phase 98 Plan 12: Dev-tools Editor tab and compiler/bundle checks Summary

Dev Tools gets a lazy fifth "Editor" tab as the phase UAT surface, plus an automated React Compiler acceptance test and a post-build check that ProseMirror/TipTap live only in an async chunk.

## Commits
- 70474a65: Editor tab, DevToolsPage wiring, tab tests
- 1b153d32: compiler-compat test and check-editor-chunk script

## Build check result
`npm run build && node scripts/check-editor-chunk.mjs`: editor in async chunk `WikiEditor-BKQuWpzU.js` (537.3 KB, 175 KB gzip); entry `index-BsjZ4ZCv.js` clean.

## Deviations from Plan
1. [Rule 1] First Profiler onRender used setState, causing an infinite update loop; replaced by ref + direct DOM text write.
2. [Rule 3] EditorTab tests wrap in MemoryRouter (WikiRenderer uses router hooks) and mock WikiEditorLazy.
3. [Rule 3] `@babel/core` has no types installed; the compat test uses a `@ts-expect-error` import rather than adding a dependency.
4. Compiler test uses `@babel/preset-typescript` (installed) with default compiler target.

## Known Stubs
None.

## Threat mitigations
T-98-06 (grep gate: no storage/persist in EditorTab, test asserts no Storage.setItem), T-98-05 (WikiRenderer only), T-98-10 (lazy EditorTab + chunk script).

## Self-Check: PASSED
Full vitest suite (6105 tests), tsc, biome clean; build + chunk script exit 0. Manual WKWebView check remains for 98-13.
