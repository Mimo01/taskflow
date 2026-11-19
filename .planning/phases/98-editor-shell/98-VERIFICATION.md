---
phase: 98-editor-shell
verified: 2026-11-18T15:38:36Z
status: passed
score: 5/5 success criteria verified; 15/15 requirements satisfied
overrides_applied: 0
---

# Phase 98: Editor Shell Verification Report

**Phase Goal:** Users can edit wiki text in a rich view or in source with every core construct available, shown in a dev-tools preview tab before any host adopts it
**Verified:** 2026-11-18T15:38:36Z (against current main, after 226a92ce and 5d570d5f)
**Status:** passed
**Re-verification:** No (initial verification)

Human evidence: 98-13 (manual WKWebView UAT) is recorded in `98-HUMAN-UAT.md`, status complete, 13/13 pass, with the round-2 gaps fixed in 226a92ce and re-checked in WebKit.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rich view styled like WikiRenderer; toolbar + keyboard formatting; headings, mixed lists, quotes, rules, links | VERIFIED | `lib/wiki/prose.ts` `WIKI_PROSE_CLASSES` used by both `WikiRenderer.tsx:504` and `extensions.ts:197`. `keymap.ts` binds strike, mono, sup/sub and quote; StarterKit covers bold/italic/underline/undo. Toolbar.tsx, BubbleToolbar.tsx and InsertMenu are wired into `WikiEditor.tsx`. UAT 4 and 13 pass. |
| 2 | Tables, code/noformat blocks, panels with titles, palette-validated colour | VERIFIED | `table-commands.ts` `TABLE_ACTIONS` (rows/cols above/below/left/right, delete, header row/column, delete table) rendered by `TableToolbar`. `CodeBlockView` + `setCodeLanguage` + `CODE_LANGUAGES`, plus a noformat insert item and input rule. `panel-commands.ts` set title/type/remove. `ColourPopover` uses `TEXT_PALETTE` + `isSafeColor`; `inline-commands.ts:7` rejects unsafe values. UAT 8 pass. |
| 3 | Rich/source toggle without losing content or undo; side-by-side preview | VERIFIED | `editor-session.ts` `replaceDoc` is one closed-history step; `resetDoc` is not undoable. `toSource`/`toRich` in `WikiEditor.tsx`. `SourceView.tsx:178` renders `<WikiRenderer>`, hides under 35rem, and has a preview toggle. Tests: editor-session "is one undo step…", WikiEditor "keeps undo". UAT 10 pass. |
| 4 | Text that fails the round-trip check opens in source with a quiet notice | VERIFIED | `initialMode` forces source on `load.kind === 'failed'`; `FORCED_NOTICE` is set; Rich is disabled through `richDisabled`; the preference is untouched (`useSettingsStore.getState()` is read only). External value changes also force source. The test `forced-source.test.tsx` passes. Failed saves show "Couldn't save safely" + Fix in source, and since 5d570d5f they also block submit (`onSaveBlockedChange`, Cmd+Enter swallowed). |
| 5 | No caret loss/rebuild; wiki/markdown shortcuts + IME on WKWebView; app shortcuts suppressed while typing | VERIFIED | Module-scope `richExtensions`, `shouldRerenderOnTransaction: false`, created counter. `compiler-compat.test.ts` compiles the editor files under React Compiler. Input rules are TipTap `InputRule`s, which skip during composition. `isTypingTarget` covers contenteditable in all three raw window listeners; react-hotkeys-hook stays off in contenteditable (no `enableOnContentEditable` anywhere). The editor captures ⌘⇧M/⌘K. UAT 1, 2, 3, 5, 6 pass in a real WKWebView. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/components/wiki-editor/WikiEditor.tsx` | VERIFIED | 561 lines; value binding, modes, notices, shortcuts, toolbar/table/bubble/source composition |
| `src/components/wiki-editor/WikiEditorLazy.tsx` | VERIFIED | `lazy(preloadWikiEditor)` → `import('./WikiEditor')`, skeleton, load-error boundary. The 98-11 literal pattern `lazy(() => import('./WikiEditor'))` was refactored into `preloadWikiEditor`; the intent is the same. |
| `src/components/wiki-editor/editor-session.ts` | VERIFIED | undo-safe replace, forced source, failed-save carry-over |
| `src/components/wiki-editor/{extensions,rich-extensions,keymap,input-rules,link-url,link-paste,palette,table-commands,panel-commands,languages,insert-items}.ts` | VERIFIED | substantive and imported by the shell/toolbar |
| `src/components/wiki-editor/source/SourceView.tsx`, `toolbar/*` | VERIFIED | wired from WikiEditor |
| `src/lib/typing-target.ts` | VERIFIED | used in useImageViewer, AttachmentPreviewModal, AioTestRunDetailPage |
| `src/lib/shortcuts.ts` 'Editor' category + `KeyboardShortcutsPanel` | VERIFIED | documentation-only entries; `key: 'Editor'` in CATEGORIES |
| `src/routes/dev-tools/EditorTab.tsx` | VERIFIED | lazy tab "Editor" in DevToolsPage; fixtures, paste samples, preset/width, verdicts |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| WikiEditor.tsx | richExtensions (`extensions: richExtensions`) | WIRED |
| WikiEditor.tsx | `evaluateSave(` in onUpdate; richToSource/sourceToRich in toggles | WIRED |
| WikiEditor.tsx | `setWikiEditorMode` on user toggle only | WIRED |
| WikiEditorLazy.tsx | `./WikiEditor` dynamic import | WIRED |
| AttachmentPreviewModal / useImageViewer / AioTestRunDetailPage | `isTypingTarget(e.target)` | WIRED |
| Hosts (CommentComposer, IssueDetailView, CreateEpicDialog, CreateEditIssueModal) | WikiEditorLazy + onSaveBlockedChange | WIRED (later phases, consuming the phase 98 contract) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Status |
|----------|------|--------|--------|
| WikiEditor rich view | doc | `loadWiki(value)` → `useEditor content`; edits → `saveWiki` → `onChange` | FLOWING |
| SourceView preview | `sourceText` | textarea onChange → `WikiRenderer wikiText` | FLOWING |
| EditorTab verdict panel | `onVerdict` | WikiEditor `report()` from refs | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Editor, engine, dev-tools tab, UI primitives | `npx vitest run src/components/wiki-editor src/routes/dev-tools/EditorTab.test.tsx src/lib/wiki/editor src/lib/typing-target.test.ts src/components/ui` | 95 files, 1111 tests passed | PASS |
| Shortcuts registry/panel, typing target, stores | `npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx src/lib/shortcuts.test.ts src/lib/typing-target.test.ts src/stores` | 21 files, 259 tests passed | PASS |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0 | PASS |
| Lint | `npx biome check src/components/wiki-editor src/routes/dev-tools/EditorTab.tsx` | 0 errors, 2 warnings (naming in paste-plugin.ts:19, a11y in TableGridPicker.tsx:32) | PASS |
| Link popover reopen state | throwaway test (deleted) | reopen shows stale `javascript:alert(1)` + error; opening on a link shows the stale text, not the link URL | WARNING (see below) |

### Probe Execution

Not applicable: no probes declared for this phase.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SAFE-05 | Failed round-trip opens in source with quiet notice | SATISFIED | `initialMode`, `FORCED_NOTICE`, `richDisabled`; forced-source.test.tsx; UAT 11 |
| EDIT-01 | Rich view looks like WikiRenderer output | SATISFIED | shared `WIKI_PROSE_CLASSES`; UAT 13 (light + dark) |
| EDIT-02 | Toggle rich ↔ source without losing content | SATISFIED | toSource/toRich, `richToSource` carry-over with note; ModeToggle tests; UAT 10 |
| EDIT-03 | Side-by-side WikiRenderer preview in source | SATISFIED | SourceView.tsx:178, preview toggle, narrow auto-hide |
| EDIT-04 | Inline formatting from toolbar + shortcuts | SATISFIED | keymap.ts + StarterKit; Toolbar items; ToolbarButton keycap tooltips |
| EDIT-05 | Headings, mixed lists, quotes, rules, line breaks | SATISFIED | StarterKit + input rules + insert items; enter-split/empty-list tests; UAT 4 |
| EDIT-06 | Insert/edit links; paste URL onto selection | SATISFIED (with warning) | `applyLink` (normalised, extendMarkRange), `link-paste.ts` with `isSafeLinkUrl`; UAT 9. Defect: LinkPopover field state is stale between opens (see warning) |
| EDIT-07 | Wiki/markdown input rules, IME respected | SATISFIED | input-rules.ts (TipTap InputRule), `EDITOR_RULE_OPTIONS`; input-rules tests; UAT 2–4 in WKWebView |
| EDIT-08 | Undo/redo across edits incl. toggles | SATISFIED | `replaceDoc` closeHistory isolation; editor-session tests; UAT 10 (single ⌘Z reverts source session) |
| EDIT-09 | Lazy load with skeleton; never rebuilds/loses caret | SATISFIED | WikiEditorLazy + tests; created counter; compiler-compat test; UAT 1 |
| BLOCK-01 | Tables: insert, add/remove rows/cols/header cells | SATISFIED | TableGridPicker, `TABLE_ACTIONS`, TableToolbar tests, tables.test.ts; UAT 8 |
| BLOCK-02 | `{code}` with language, `{noformat}` | SATISFIED | CodeBlockView, `setCodeLanguage`, `CODE_LANGUAGES`, noformat insert/rule; code-block.test.ts; UAT 8 |
| BLOCK-03 | Panels incl. titles | SATISFIED | PanelView, panel-commands (title/type/remove); panel.test.ts; UAT 8 (+ removePanel gap fix in 226a92ce) |
| BLOCK-04 | `{color}` from validated palette | SATISFIED | TEXT_PALETTE + `isSafeColor` in popover and command; "Custom (kept)" for off-palette; colour.test.ts |
| FLOW-04 | Global shortcuts suppressed while typing | SATISFIED | `isTypingTarget` guards; react-hotkeys-hook default ignores contenteditable; editor captures ⌘⇧M; host-keys tests; UAT 6 |

No orphaned requirements: all 15 IDs mapped to Phase 98 in REQUIREMENTS.md are claimed by phase 98 plans. Bookkeeping: REQUIREMENTS.md still shows BLOCK-01..03 as Pending/unchecked. The code and UAT satisfy them, so update the bookkeeping.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/wiki-editor/toolbar/LinkPopover.tsx` | 28-29 | `useState(currentUrl ?? '')` / `error` never reset on open; component stays mounted between opens | Warning | After a rejected URL + Esc, the next ⌘K reopens with the bad text and the error still showing, so typing appends to it. Opening on an existing link doesn't prefill its URL; the Open/Remove row is correct. Likely explains the "Unconfirmed: second ⌘K did not apply" note in UAT test 9. Editing still works by clearing the field, so this is not a blocker. |
| `src/components/wiki-editor/WikiEditorLazy.tsx` | 40-44 | Skeleton always draws an `h-10` top bar | Info | The compact preset's real layout is content + an `h-8` footer, so its skeleton is about 8px taller. Full preset matches. Mostly hidden because hosts call `preloadWikiEditor`. |
| `src/components/wiki-editor/WikiEditor.tsx` | userToggle | Rich click from non-forced source on unloadable text writes `wikiEditorMode='rich'` while staying in source | Info | The user's own toggle intent; does not violate SAFE-05 (load-forced source never writes the preference). |

No TBD/FIXME/XXX/TODO/HACK markers in phase files.

### Human Verification Required

None outstanding. 98-HUMAN-UAT.md covers the manual items (IME, caret, input rules, toolbar, blocks, links, source mode, forced source, raw atoms, visual parity) at 13/13 pass. Known harness limits it records: hover tooltips were checked via keyboard focus, and the system-browser Open was not checked inside Tauri.

### Gaps Summary

No blocking gaps. All five success criteria and all 15 requirements are implemented, wired and tested in the current code. The full editor test surface (1111 tests) passes, tsc is clean, and real-WebKit UAT passed.

One non-blocking defect is worth a quick fix: LinkPopover keeps its input/error state across opens. The fix is to reset `value` to `currentUrl ?? ''` and `error` to false when `open` becomes true, or to key the popover content on open. Add a test that reopens it and that opens it on an existing link.

---

_Verified: 2026-11-18T15:38:36Z_
_Verifier: Claude (gsd-verifier)_
