---
phase: 97
slug: round-trip-engine
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| SAFE-03 | Unedited load/save returns original byte-for-byte (CRLF, trailing ws, every fixture) | unit | `npx vitest run src/lib/wiki/editor/engine.test.ts` | ✅ | ✅ green |
| SAFE-03 | Token-fuzz `emit(parse(x)) === x`, `parse` never throws | property | `npx vitest run src/lib/wiki/editor/lossless.fuzz.test.ts` | ✅ | ✅ green |
| SAFE-04 | Unknown/unclosed/mismatched macros are raw atoms emitted verbatim | unit | `npx vitest run src/lib/wiki/editor/raw.test.ts` | ✅ | ✅ green |
| SAFE-04 | D-11 ladder: rich / rich-demoted / failed; slices tile input | unit (mutation-style) | `npx vitest run src/lib/wiki/editor/ladder.test.ts` | ✅ | ✅ green |
| SAFE-06 | Emoticons, mentions, escapes, `\\` breaks keep spelling | unit | `npx vitest run src/lib/wiki/editor/spelling.test.ts` | ✅ | ✅ green |
| Success 1 | Whole corpus `checkCorpus(…, s => emit(parse(s)))` empty + idempotence + schema `check()` | corpus | `npx vitest run src/lib/wiki/editor/roundtrip.test.ts src/lib/wiki/equivalence.test.ts` | ✅ | ✅ green |
| D-01 | Mixed `*#`/`#*` renders nested lists | render | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx src/lib/wiki/pipeline.test.tsx` | ✅ extended | ✅ green |
| D-02 | Header-less table renders tbody only; sanitize schema unchanged | render | same | ✅ extended | ✅ green |
| D-12 | `{tip}`, `{info:title=}`, `{warning:title=}`, lists in panels render as panels | render | same | ✅ extended | ✅ green |
| Isolation | WikiRenderer import graph has no `@tiptap`/`prosemirror`/`lib/wiki/editor` | node unit | `npx vitest run src/lib/wiki/editor/bundle-guard.test.ts` | ✅ | ✅ green |
| Edits | Scripted edits re-emit untouched blocks byte-identical | unit | `npx vitest run src/lib/wiki/editor/edit.test.ts` | ✅ | ✅ green |
| CR-01 | Mid-line panel openers keep the surrounding list/paragraph | render | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx -t "mid-line"` | ✅ | ✅ green |
| CR-02 | Attribute injection through panel params / links is neutralised | render | `npx vitest run src/lib/wiki/pipeline.test.tsx -t "CR-02"` | ✅ | ✅ green |
| CR-03 / CR-04 / WR-02 | Container children, cell paragraphs/breaks and edited attrs emit or throw `WikiEmitError` | unit | `npx vitest run src/lib/wiki/editor/emit-edited.test.ts` | ✅ | ✅ green |
| CR-05 | Typed atom look-alikes escape; unspellable tokens are reported; tightened oracle | unit | `npx vitest run src/lib/wiki/editor/escape.test.ts` | ✅ | ✅ green |
| WR-01 | `saveWiki` re-parses what it would write; `failed` for unwritable edits; legitimate edits save | unit | `npx vitest run src/lib/wiki/editor/save-check.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/wiki/editor/*.test.ts` files listed above
- [x] New placeholder-only fixtures (see 97-RESEARCH.md §Wave 0 Gaps), added to `REQUIRED_FIXTURES` with the count bumped deliberately
- [x] Install `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table` at `^3.34.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Renderer fixes look like Jira in the app | D-01, D-02, D-12 | Visual parity with real Jira | Open an issue with mixed nesting, a header-less table and `{tip}`/`{info:title=}` panels; compare against Jira. Deferred 97-03 Task 3 check; must be re-run after the CR-01/CR-02 renderer fixes. Owned by `/gsd-verify-work 97`. |

---

## Deferred to Phase 98

- `saveWiki` returns `{ kind: 'failed', reason }` for typed tokens that have no wiki spelling: an `hN. ` / `bq. ` prefix at a paragraph start, and the emoticon tokens `(/)`, `(x)`, `(i)`, `(on)`, `(off)`, `(flag)`, `(flagoff)`. The reason names the token. Phase 98 must handle this failure kind, not only switch to source mode. Options: offer to wrap a heading/quote prefix in monospace (verified to stay literal); convert an emoticon token to an emoticon atom (monospace does not keep emoticons literal in the current renderer or parser); or check with real Jira whether `{{(x)}}` stays literal and, if it does, align the renderer.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-16
