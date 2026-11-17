---
phase: 98-editor-shell
plan: 15
subsystem: wiki-editor
tags: [focus, keymap, gap-closure, wkwebview]
requirements: [EDIT-02, EDIT-09, FLOW-04]
key-files:
  created:
    - taskflow/src/components/wiki-editor/caret-commands.ts
    - taskflow/src/components/wiki-editor/caret.test.ts
    - taskflow/src/components/wiki-editor/mode-focus.test.tsx
  modified:
    - taskflow/src/components/wiki-editor/WikiEditor.tsx
    - taskflow/src/components/wiki-editor/source/SourceView.tsx
    - taskflow/src/components/wiki-editor/keymap.ts
    - taskflow/src/components/wiki-editor/toolbar/Toolbar.test.tsx
metrics:
  completed: 2026-11-17
---

# Phase 98 Plan 15: Mode-toggle focus and Cmd+Arrow line boundaries Summary

Mode toggle now moves focus in a post-commit effect (textarea via `focusAt(0)`, or `view.focus()` on the visible ProseMirror), the hidden rich editor is non-editable, and Cmd+Left/Right (plus Shift) are bound explicitly to a line-boundary command.

## Commits
- c68e6355: fix(98-15): mode toggle moves focus; hidden rich editor non-editable
- c3833932: feat(98-15): Cmd+Left/Right line-boundary keymap

## What changed
- WikiEditor: `pendingFocusRef` plus a `[mode]` effect that syncs `setEditable(mode === 'rich', false)` and then focuses. `editor.commands.focus()` removed. `editable` passed to `useEditor`. `onUpdate` returns early when not editable (T-98-15-01). Reset-to-doc-start via selection-only transaction when the doc was reloaded.
- SourceView: `SourceHandle.focusAt(offset)`.
- caret-commands.ts `moveToLineBoundary`: measured visual line (coordsAtPos/posAtCoords), logical hardBreak fallback, clamped to textblock, false for non-text selections. keymap.ts binds explicit `Meta-` keys (not `Mod`) and exports `WIKI_CARET_KEYS`; Ctrl+Arrow stays native (T-98-15-03).

## Deviations from Plan
- [Rule 3 - Blocking] Toolbar.test.tsx builds a `SourceHandle` mock; added `focusAt: vi.fn()` so tsc passes the pre-commit hook. Test-only; no production code was bent to satisfy a mock.
- Biome's naming rule renamed `$head` locals; I used `resolvedHead` in caret-commands.ts.
- Environment: the worktree base was corrected with `git reset --hard 303499fa` as the startup check requires; node_modules is a symlink to the main checkout's inner app dir (untracked/ignored).
- The pre-commit full vitest suite timed out (5s, cold imports) in EpicDetailSheet/IssueDetailSheet/WorklogsPage tests while sibling executors loaded the machine. They pass with `--testTimeout=30000` and the third commit retry passed. Unrelated to this plan.

## Known Stubs
None.

## Real-WebKit re-check REQUIRED
jsdom cannot prove these; the orchestrator must re-run them in real WebKit after execution:
- UAT test 5: Source then Rich; activeElement is the ProseMirror (not BODY), and the first Cmd+Left/Right move the caret.
- UAT test 6: Cmd+Shift+M in the editor goes to source with the textarea focused; Cmd+Shift+M again goes to rich with no Merge Requests navigation.
- UAT test 10: after the toggle, typing 'QQ' appears in the textarea and the emitted value equals the textarea text.

## Self-Check: PASSED
Files and commits c68e6355, c3833932 exist; `npx vitest run src/components/wiki-editor` 351/351, tsc and biome clean on touched files.
