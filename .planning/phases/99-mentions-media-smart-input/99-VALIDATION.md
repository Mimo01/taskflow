---
phase: 99
slug: mentions-media-smart-input
status: draft
nyquist_compliant: true
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

Commands run from `taskflow/` (inner app dir). Each tdd task writes its test first and commits RED+GREEN together (pre-commit runs the full suite).

| Task | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|----------|-----------|-------------------|-------------|--------|
| 99-01-1 | 01 | 1 | INPUT-01..05 | package legitimacy gate | manual (blocking) | n/a (checkpoint) | n/a | ⬜ pending |
| 99-01-2 | 01 | 1 | — | deps installed, chunk stays lazy | unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts src/components/wiki-editor` | ✅ | ⬜ pending |
| 99-01-3 | 01 | 1 | INPUT-01/02/03/05 | host contract + storage bridge | unit | `npx vitest run src/components/wiki-editor/host.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 99-02-1 | 02 | 1 | INPUT-04 | HTML normaliser fixtures save 'saved'; hostile input inert | unit | `npx vitest run src/components/wiki-editor/paste/html-normalise.test.ts` | ❌ W0 | ⬜ pending |
| 99-02-2 | 02 | 1 | INPUT-04 | looksLikeWiki true/false tables | unit | `npx vitest run src/components/wiki-editor/paste/wiki-text.test.ts` | ❌ W0 | ⬜ pending |
| 99-03-1 | 03 | 2 | D-19 | popover keyboard/loading/empty | component | `npx vitest run src/components/wiki-editor/suggestion/popover.test.tsx` | ❌ W0 | ⬜ pending |
| 99-03-2 | 03 | 2 | D-19/D-20 | no leak; Esc inside Base UI Dialog | component | `npx vitest run src/components/wiki-editor/suggestion/lifecycle.test.tsx` | ❌ W0 | ⬜ pending |
| 99-04-1 | 04 | 2 | INPUT-06 | emoticon table | unit | `npx vitest run src/components/wiki-editor/suggestion/emoticon-data.test.ts` | ❌ W0 | ⬜ pending |
| 99-04-2 | 04 | 2 | INPUT-01/02 | mention pill, image parity, emoticon glyph, schema parity | component | `npx vitest run src/components/wiki-editor/nodeviews src/components/wiki-editor/schema-parity.test.ts` | ❌ W0 | ⬜ pending |
| 99-05-1 | 05 | 2 | INPUT-02 | naming, classification, picker embed | unit | `npx vitest run src/components/wiki-editor/media/upload-state.test.ts src/components/wiki-editor/media/embed.test.ts` | ❌ W0 | ⬜ pending |
| 99-05-2 | 05 | 2 | INPUT-03 | placeholders, ordering, failure, staged, drop | unit | `npx vitest run src/components/wiki-editor/media/upload-plugin.test.ts` | ❌ W0 | ⬜ pending |
| 99-06-1 | 06 | 3 | INPUT-01 | @ trigger, server search key, [~name] save | unit | `npx vitest run src/components/wiki-editor/suggestion/mention.test.ts src/components/wiki-editor/suggestion/mention-search.test.ts` | ❌ W0 | ⬜ pending |
| 99-06-2 | 06 | 3 | INPUT-06 | : trigger rules, token input rule | unit | `npx vitest run src/components/wiki-editor/suggestion/emoticon.test.ts src/components/wiki-editor/input-rules.test.ts` | partial | ⬜ pending |
| 99-07-1 | 07 | 3 | INPUT-05 | shared issue-key module, WikiRenderer unchanged | unit | `npx vitest run src/lib/issue-key.test.ts src/routes/dashboard` | ❌ W0 | ⬜ pending |
| 99-07-2 | 07 | 3 | INPUT-05 | decoration only, KEY- autocomplete | unit | `npx vitest run src/components/wiki-editor/issue-key.test.ts` | ❌ W0 | ⬜ pending |
| 99-08-1 | 08 | 4 | BLOCK-05 | recent items + v39 migration | unit | `npx vitest run src/stores/settings.store.test.ts` | partial | ⬜ pending |
| 99-08-2 | 08 | 4 | BLOCK-05 | / trigger, groups, filter, one undo | unit | `npx vitest run src/components/wiki-editor/suggestion/slash.test.ts` | ❌ W0 | ⬜ pending |
| 99-09-1 | 09 | 3 | INPUT-03 | D-10 removal detection guards | unit | `npx vitest run src/components/wiki-editor/media/embed-removal.test.ts` | ❌ W0 | ⬜ pending |
| 99-09-2 | 09 | 3 | INPUT-03 | error line + notice in live editor | component | `npx vitest run src/components/wiki-editor/media` | ❌ W0 | ⬜ pending |
| 99-10-1 | 10 | 3 | INPUT-04 | HTML/HTML-image/wiki-text/plain paste, double undo | unit | `npx vitest run src/components/wiki-editor/paste` | ❌ W0 | ⬜ pending |
| 99-10-2 | 10 | 3 | INPUT-04 | Cmd+Shift+V + trigger rows registered | unit | `npx vitest run src/lib/shortcuts` | partial | ⬜ pending |
| 99-11-1 | 11 | 5 | INPUT-07 | bubble show rules, Esc first, footer | component | `npx vitest run src/components/wiki-editor/toolbar/compact.test.tsx` | ❌ W0 | ⬜ pending |
| 99-11-2 | 11 | 5 | INPUT-07/02 | preset branch, picker mount | component | `npx vitest run src/components/wiki-editor src/routes/dashboard/issue-detail` | ❌ W0 | ⬜ pending |
| 99-12-1 | 12 | 5 | all | end-to-end through WikiEditor | component | `npx vitest run src/components/wiki-editor/input-integration.test.tsx` | ❌ W0 | ⬜ pending |
| 99-12-2 | 12 | 5 | all | dev-tools host row, dialog, paste sample/capture | component | `npx vitest run src/routes/dev-tools` | ❌ W0 | ⬜ pending |
| 99-13-1 | 13 | 6 | INPUT-03 | caret util, source uploads | unit | `npx vitest run src/lib/textarea-caret.test.ts src/components/wiki-editor/source/source-uploads.test.ts` | ❌ W0 | ⬜ pending |
| 99-13-2 | 13 | 6 | INPUT-01/06 | source-mode @ and : popover, file paste/drop | component | `npx vitest run src/components/wiki-editor/source` | ❌ W0 | ⬜ pending |
| 99-14-1 | 14 | 7 | all | full suite + tsc, UAT checklist | gate | `npm test && npx tsc --noEmit` | ✅ | ⬜ pending |
| 99-14-2 | 14 | 7 | all | WKWebView manual UAT | manual | n/a (checkpoint) | n/a | ⬜ pending |
| Guards | all | — | — | schema parity, bundle guard, compiler compat | unit | `npx vitest run src/components/wiki-editor/schema-parity.test.ts src/lib/wiki/editor/bundle-guard.test.ts src/components/wiki-editor/compiler-compat.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Every test file marked ❌ W0 is created by the same task that implements the behaviour (tdd="true", test first), so no separate Wave 0 plan is needed. No three consecutive tasks lack an automated command.

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
