---
phase: 98
slug: editor-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-17
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

Task IDs are filled in once plans exist; rows are keyed by requirement.

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------|-------------------|-------------|--------|
| D-04 no-op | New Editor over `loadWiki` doc → `saveWiki` `unchanged`; no onChange before a user transaction | — | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` | extend | ⬜ pending |
| Schema parity | `getSchema(editorExtensions)` matches `wikiSchema` | — | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-01 | Rich view and WikiRenderer share prose classes | — | unit | `npx vitest run src/lib/wiki/prose.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-02/03 | Source textarea + live preview, preview toggle, narrow auto-hide | — | component | `npx vitest run src/components/wiki-editor/source` | ❌ W0 | ⬜ pending |
| EDIT-04 | Keymap binds contract keys; registry entries exist | — | unit | `npx vitest run src/components/wiki-editor/keymap.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-05 | Heading/list/quote/rule/hardbreak commands + input rules emit canonical wiki | — | unit | `npx vitest run src/components/wiki-editor/input-rules.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-06 | Link set/edit/remove; scheme validation | T-98 link scheme | unit | `npx vitest run src/components/wiki-editor/link.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-07 | Marks incl. mono/sub/sup, canonical delimiters | — | unit | `npx vitest run src/components/wiki-editor/marks-commands.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-08 | One undo reverts a source session; no history for same-text toggle | — | unit | `npx vitest run src/components/wiki-editor/editor-session.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-09 | Toolbar presets, overflow order, mode toggle never overflows | — | component | `npx vitest run src/components/wiki-editor/toolbar` | ❌ W0 | ⬜ pending |
| SAFE-05 | Failed load opens source, Rich disabled, preference unchanged | T-98 lossy round-trip | unit+component | `npx vitest run src/components/wiki-editor/forced-source.test.tsx` | ❌ W0 | ⬜ pending |
| D-08 | `saveWiki` failed keeps doc, no onChange, reason + Fix in source | T-98 lossy round-trip | component | `npx vitest run src/components/wiki-editor/save-failed.test.tsx` | ❌ W0 | ⬜ pending |
| BLOCK-01 | Table insert, Tab nav, header toggle keeps `headerless` round-trip | — | unit | `npx vitest run src/components/wiki-editor/tables.test.ts` | ❌ W0 | ⬜ pending |
| BLOCK-02 | Code languages parse; noformat has none | T-98 markup injection | unit | `npx vitest run src/components/wiki-editor/code-block.test.ts` | ❌ W0 | ⬜ pending |
| BLOCK-03 | Panel title ↔ params, `}`/newline stripped, type switch, remove | T-98 markup injection | unit | `npx vitest run src/components/wiki-editor/panel.test.ts` | ❌ W0 | ⬜ pending |
| BLOCK-04 | Palette passes `isSafeColor`; off-palette kept; remove colour | T-98 CSS injection | unit | `npx vitest run src/components/wiki-editor/colour.test.ts` | ❌ W0 | ⬜ pending |
| FLOW-04 | contenteditable keydown doesn't trigger raw listeners/hotkeys | — | unit | `npx vitest run src/lib/typing-target.test.ts` | ❌ W0 | ⬜ pending |
| Bundle | main/dev-tools static graphs reach no tiptap/prosemirror | — | unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | extend | ⬜ pending |
| Compiler | Editor files compile with `panicThreshold: all_errors` | — | unit | `npx vitest run src/components/wiki-editor/compiler-compat.test.ts` | ❌ W0 | ⬜ pending |
| Settings | `wikiEditorMode` default + migration | — | unit | `npx vitest run src/stores/settings.store.test.ts` | extend | ⬜ pending |
| Folded todos | WR-01, table-cell `{code}` escape, WR-02 even-run | — | unit | `npx vitest run src/lib/wiki/editor` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Engine schema-identity fix + test (blocks everything else)
- [ ] `lib/wiki/prose.ts` extraction + WikiRenderer import
- [ ] `components/wiki-editor/` test files above + headless `makeEditor(text)` helper
- [ ] Extend `bundle-guard.test.ts`
- [ ] Settings migration test; shortcut registry 'Editor' category
- [ ] `npm install @tiptap/react@3.34.0 @tiptap/extensions@3.34.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IME composition, caret stability, input rules in WKWebView | EDIT-05, success criterion 5 | jsdom can't compose or lay out | Dev-tools Editor tab in the Tauri build: type Japanese/accents via IME, type `h1. `, `* `, `*bold*`, confirm caret never jumps and no editor rebuild (render counter) |
| Real build React Compiler behaviour | success criterion 5 | Compiler not applied in vitest | `npm run tauri dev`, type in Editor tab, watch rebuild counters stay flat |
| WR-01 Jira backslash behaviour | folded todo | Needs live Jira | 97-HUMAN-UAT test 1 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
