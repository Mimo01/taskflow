---
phase: 99
slug: mentions-media-smart-input
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-17
---

# Phase 99 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (jsdom, globals, setup `src/test/setup.ts`) |
| **Config file** | `taskflow/taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/components/wiki-editor src/lib/wiki` |
| **Full suite command** | `cd taskflow && npm test` (also the pre-commit gate) |
| **Estimated runtime** | ~60 seconds quick / several minutes full |

---

## Sampling Rate

- **After every task commit:** Run the quick command plus `npx biome check` on touched files
- **After every plan wave:** Run `npm test` and `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green; manual WKWebView UAT recorded in `99-HUMAN-UAT.md`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled in by the planner per task; the requirement → test map from RESEARCH.md is the baseline:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| INPUT-01 | `@` trigger rules, insert mention, save emits `[~name]`, server-side per-query search | unit + component | `npx vitest run src/components/wiki-editor/suggestion/mention` | ❌ W0 | ⬜ pending |
| INPUT-02 | picker inserts `image`/`attachment` node, caret after, hazardous names | unit | `npx vitest run src/components/wiki-editor/media/embed.test.ts` | ❌ W0 | ⬜ pending |
| INPUT-03 | paste/drop upload placeholders (decorations, never saved), staged mode, removal notice, `posAtCoords` drop | unit | `npx vitest run src/components/wiki-editor/media` | ❌ W0 | ⬜ pending |
| INPUT-04 | HTML normaliser fixtures (web/Word/GDocs/Jira) → allowed nodes, `saveWiki` kind `saved`; wiki-text heuristic; plain paste shortcut | unit | `npx vitest run src/components/wiki-editor/paste src/lib/shortcuts` | ❌ W0 | ⬜ pending |
| INPUT-05 | issue-key decoration + `ABC-` autocomplete, no markup emitted | unit | `npx vitest run src/components/wiki-editor/issue-key.test.ts` | ❌ W0 | ⬜ pending |
| INPUT-06 | `:` emoticon trigger rules, emoticon node insert, token emit | unit | `npx vitest run src/components/wiki-editor/suggestion/emoticon.test.ts` | ❌ W0 | ⬜ pending |
| INPUT-07 | compact host: bubble menu instead of toolbar; Esc hides first | component | `npx vitest run src/components/wiki-editor/toolbar/compact.test.tsx` | ❌ W0 | ⬜ pending |
| BLOCK-05 | `/` slash menu trigger, filter, Recent, single-undo insert | unit | `npx vitest run src/components/wiki-editor/suggestion/slash.test.ts` | ❌ W0 | ⬜ pending |
| D-19/D-20 | popover lifecycle cleanup; Esc consumed before enclosing Dialog | component | `npx vitest run src/components/wiki-editor/suggestion/lifecycle.test.tsx` | ❌ W0 | ⬜ pending |
| Guards | schema parity, bundle guard, compiler compat stay green | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts src/lib/wiki/editor/bundle-guard.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/wiki-editor/suggestion/*.test.*` — mention, emoticon, slash, lifecycle, popover keyboard
- [ ] `src/components/wiki-editor/media/*.test.ts` — upload plugin, embed, removal
- [ ] `src/components/wiki-editor/paste/*.test.ts` + `__fixtures__/paste/*.html` — placeholder-only web, Word, Google Docs, Jira samples
- [ ] `src/components/wiki-editor/issue-key.test.ts`, `toolbar/compact.test.tsx`
- [ ] Test util: `ClipboardEvent` stub / fake clipboard events
- [ ] Dependency install: `@tiptap/suggestion@3.34.0` + declared peers (`@tiptap/extension-bubble-menu`, `@floating-ui/dom`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Finder drag/drop of files into editor | INPUT-03 | Tauri `dragDropEnabled` / WKWebView drop path not reproducible in jsdom | Drag image + PDF from Finder into description and comment editors; placeholders appear at drop point and resolve |
| Clipboard image paste | INPUT-03 | Real OS clipboard | Screenshot to clipboard, Cmd+V in editor; uploads and embeds |
| Caret after inserts | INPUT-01/02/06, BLOCK-05 | WKWebView focus/caret quirks | Insert mention, attachment, emoticon, slash block; caret lands after and typing continues |
| Cmd+Shift+V plain paste | INPUT-04 | WKWebView paste event firing unverified | Copy rich HTML, Cmd+Shift+V; arrives as plain text |
| Real Jira / Word paste samples | INPUT-04 | Synthetic fixtures only | Use dev-tools "Paste sample" harness to capture and verify |
| Popover inside modal dialog + Esc nesting | INPUT-07, D-20 | Real Base UI dialog in WKWebView | Open editor in a dialog, trigger `@`, press Esc once (popover closes) and again (dialog closes) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
