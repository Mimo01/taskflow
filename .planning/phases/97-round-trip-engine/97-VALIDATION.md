---
phase: 97
slug: round-trip-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-16
---

# Phase 97 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1 (jsdom default, Testing Library for WikiRenderer) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/lib/wiki src/routes/dashboard/WikiRenderer.test.tsx` |
| **Full suite command** | `cd taskflow && npm run test` (pre-commit also runs tsc + biome) |
| **Estimated runtime** | ~60 seconds (quick) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `npm run test`, `npx tsc --noEmit`, and biome on touched files
- **Before `/gsd-verify-work`:** Full suite must be green; `git diff` of `WikiRenderer.test.tsx` limited to D-03's allowed behaviours (and D-12 panel-family additions)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in by the planner and executor. Requirement-to-test map from research:

| Req / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------------|----------|-----------|-------------------|-------------|--------|
| SAFE-03 | Unedited load/save returns original byte-for-byte (CRLF, trailing ws, every fixture) | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` | ❌ W0 | ⬜ pending |
| SAFE-03 | Token-fuzz `emit(parse(x)) === x`, `parse` never throws | property | `npx vitest run src/lib/wiki/editor/lossless.fuzz.test.ts` | ❌ W0 | ⬜ pending |
| SAFE-04 | Unknown/unclosed/mismatched macros are raw atoms emitted verbatim | unit | `npx vitest run src/lib/wiki/editor/raw.test.ts` | ❌ W0 | ⬜ pending |
| SAFE-04 | D-11 ladder: rich / rich-demoted / failed; slices tile input | unit (mutation-style) | `npx vitest run src/lib/wiki/editor/ladder.test.ts` | ❌ W0 | ⬜ pending |
| SAFE-06 | Emoticons, mentions, escapes, `\\` breaks keep spelling | unit | `npx vitest run src/lib/wiki/editor/spelling.test.ts` | ❌ W0 | ⬜ pending |
| Success 1 | Whole corpus `checkCorpus(…, s => emit(parse(s)))` empty + idempotence + schema `check()` | corpus | `npx vitest run src/lib/wiki/editor/roundtrip.test.ts` | ❌ W0 | ⬜ pending |
| D-01 | Mixed `*#`/`#*` renders nested lists | render | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx src/lib/wiki/pipeline.test.tsx` | extend | ⬜ pending |
| D-02 | Header-less table renders tbody only; sanitize schema unchanged | render | same | extend | ⬜ pending |
| D-12 | `{tip}`, `{info:title=}`, `{warning:title=}`, lists in panels render as panels | render | same | extend | ⬜ pending |
| Isolation | WikiRenderer import graph has no `@tiptap`/`prosemirror`/`lib/wiki/editor` | node unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | ❌ W0 | ⬜ pending |
| Edits | Scripted edits re-emit untouched blocks byte-identical | unit | `npx vitest run src/lib/wiki/editor/edit.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/wiki/editor/*.test.ts` files listed above
- [ ] New placeholder-only fixtures (see 97-RESEARCH.md §Wave 0 Gaps), added to `REQUIRED_FIXTURES` with the count bumped deliberately
- [ ] Install `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table` at `^3.34.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Renderer fixes look like Jira in the app | D-01, D-02, D-12 | Visual parity with real Jira | Open an issue with mixed nesting, a header-less table and `{tip}`/`{info:title=}` panels; compare against Jira |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
