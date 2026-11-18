---
phase: 98
slug: editor-shell
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-17
audited: 2026-11-18
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1 + jsdom 29 + @testing-library (React Compiler NOT applied in tests) |
| **Config file** | `taskflow/vitest.config.ts`, setup `taskflow/src/test/setup.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/components/wiki-editor src/lib/wiki/editor` |
| **Full suite command** | `cd taskflow && npm test` (also the pre-commit gate) |
| **Estimated runtime** | ~15 s quick, ~120 s full |

---

## Sampling Rate

- **After every task commit:** Run the quick command (the pre-commit hook also runs the full suite)
- **After every plan wave:** `cd taskflow && npm test && npx tsc --noEmit && npx biome check <changed files>`
- **Before `/gsd-verify-work`:** Full suite green, `npm run build` produces an async editor chunk, manual WKWebView UAT done
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Rows are keyed by requirement. EDIT-07 marks live in `commands.test.ts` (planned `marks-commands.test.ts` was folded in); Settings row also covers the shortcut registry `Editor` category.

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| D-04 no-op | New Editor over `loadWiki` doc → `saveWiki` `unchanged`; no onChange before a user transaction | — | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` | ✅ | ✅ green |
| Schema parity | `getSchema(editorExtensions)` matches `wikiSchema` | — | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts` | ✅ | ✅ green |
| EDIT-01 | Rich view and WikiRenderer share prose classes | — | unit | `npx vitest run src/lib/wiki/prose.test.ts` | ✅ | ✅ green |
| EDIT-02/03 | Source textarea + live preview, preview toggle, narrow auto-hide | — | component | `npx vitest run src/components/wiki-editor/source` | ✅ | ✅ green |
| EDIT-04 | Keymap binds contract keys; registry entries exist | — | unit | `npx vitest run src/components/wiki-editor/keymap.test.ts` | ✅ | ✅ green |
| EDIT-05 | Heading/list/quote/rule/hardbreak commands + input rules emit canonical wiki | — | unit | `npx vitest run src/components/wiki-editor/input-rules.test.ts` | ✅ | ✅ green |
| EDIT-06 | Link set/edit/remove; scheme validation | T-98 link scheme | unit | `npx vitest run src/components/wiki-editor/link.test.ts` | ✅ | ✅ green |
| EDIT-07 | Marks incl. mono/sub/sup, canonical delimiters | — | unit | `npx vitest run src/components/wiki-editor/commands.test.ts src/components/wiki-editor/input-rules.test.ts` | ✅ | ✅ green |
| EDIT-08 | One undo reverts a source session; no history for same-text toggle | — | unit | `npx vitest run src/components/wiki-editor/editor-session.test.ts` | ✅ | ✅ green |
| EDIT-09 | Toolbar presets, overflow order, mode toggle never overflows | — | component | `npx vitest run src/components/wiki-editor/toolbar` | ✅ | ✅ green |
| SAFE-05 | Failed load opens source, Rich disabled, preference unchanged | T-98 lossy round-trip | unit+component | `npx vitest run src/components/wiki-editor/forced-source.test.tsx` | ✅ | ✅ green |
| D-08 | `saveWiki` failed keeps doc, no onChange, reason + Fix in source | T-98 lossy round-trip | component | `npx vitest run src/components/wiki-editor/save-failed.test.tsx` | ✅ | ✅ green |
| BLOCK-01 | Table insert, Tab nav, header toggle keeps `headerless` round-trip | — | unit | `npx vitest run src/components/wiki-editor/tables.test.ts` | ✅ | ✅ green |
| BLOCK-02 | Code languages parse; noformat has none | T-98 markup injection | unit | `npx vitest run src/components/wiki-editor/code-block.test.ts` | ✅ | ✅ green |
| BLOCK-03 | Panel title ↔ params, `}`/newline stripped, type switch, remove | T-98 markup injection | unit | `npx vitest run src/components/wiki-editor/panel.test.ts` | ✅ | ✅ green |
| BLOCK-04 | Palette passes `isSafeColor`; off-palette kept; remove colour | T-98 CSS injection | unit | `npx vitest run src/components/wiki-editor/colour.test.ts` | ✅ | ✅ green |
| FLOW-04 | contenteditable keydown doesn't trigger raw listeners/hotkeys | — | unit | `npx vitest run src/lib/typing-target.test.ts` | ✅ | ✅ green |
| Bundle | main/dev-tools static graphs reach no tiptap/prosemirror | — | unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | ✅ | ✅ green |
| Compiler | Editor files compile with `panicThreshold: all_errors` | — | unit | `npx vitest run src/components/wiki-editor/compiler-compat.test.ts` | ✅ | ✅ green |
| Settings | `wikiEditorMode` default + migration | — | unit | `npx vitest run src/stores/settings.store.test.ts src/lib/shortcuts.test.ts` | ✅ | ✅ green |
| Folded todos | WR-01, table-cell `{code}` escape, WR-02 even-run | — | unit | `npx vitest run src/lib/wiki/editor` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Engine schema-identity fix + test (blocks everything else)
- [x] `lib/wiki/prose.ts` extraction + WikiRenderer import
- [x] `components/wiki-editor/` test files above + headless `makeEditor(text)` helper
- [x] Extend `bundle-guard.test.ts`
- [x] Settings migration test; shortcut registry 'Editor' category
- [x] `npm install @tiptap/react@3.34.0 @tiptap/extensions@3.34.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IME composition, caret stability, input rules in WKWebView | EDIT-05, success criterion 5 | jsdom can't compose or lay out | Dev-tools Editor tab in the Tauri build: type Japanese/accents via IME, type `h1. `, `* `, `*bold*`, confirm caret never jumps and no editor rebuild (render counter) |
| Real build React Compiler behaviour | success criterion 5 | Compiler not applied in vitest | `npm run tauri dev`, type in Editor tab, watch rebuild counters stay flat |
| WR-01 Jira backslash behaviour | folded todo | Needs live Jira | 97-HUMAN-UAT test 1 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-18

---

## Validation Audit 2026-11-18

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 21 rows COVERED: 84 test files / 1214 tests green (`npx vitest run src/components/wiki-editor src/lib/wiki src/lib/typing-target.test.ts src/lib/shortcuts.test.ts src/stores/settings.store.test.ts`, 8.6 s). Manual-only rows done in 98-HUMAN-UAT.md (status complete, 2 WKWebView rounds).
