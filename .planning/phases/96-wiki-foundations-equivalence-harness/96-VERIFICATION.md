---
phase: 96-wiki-foundations-equivalence-harness
verified: 2026-11-16T14:10:00Z
status: human_needed
score: 4/4 must-haves verified (SC4 verified with a caveat on where "CI" runs)
overrides_applied: 0
human_verification:
  - test: "Decide whether the pre-commit hook (husky: biome, tsc, full `npm run test`) satisfies 'CI runs an equivalence assertion'"
    expected: "Either accept the hook as the CI gate, or add a test job to GitHub Actions. The only workflow is release-cross-platform.yml, which has no vitest step."
    why_human: "Product and process decision. The assertion exists and bites, but nothing server-side runs it on push or PR."
  - test: "Open a few real issue descriptions and comments in the app and compare against the previous build"
    expected: "Rendering is unchanged."
    why_human: "The visual check was done by byte-diffing the rendered HTML of 37 placeholder fixtures at 62064e5f vs HEAD. That is strong evidence for SAFE-01. It does not cover real-world text, and the spec's original check was on real issues. Optional, low risk."
---

# Phase 96: Wiki Foundations and Equivalence Harness Verification Report

**Phase Goal:** The existing wiki rendering pipeline is reusable outside WikiRenderer and a corpus can prove, in CI, that any text round-trips with the same rendering.
**Status:** human_needed (no code gaps)
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wiki text renders as before; the existing WikiRenderer tests pass unmodified | VERIFIED | `git diff 62064e5f HEAD -- src/routes/dashboard/WikiRenderer.test.tsx` is empty. I ran it: 184/184 pass. `WikiRenderer.tsx` imports preprocess and pipeline from `@/lib/wiki` and re-exports `AttachmentMap` and `UserMap`. Corpus HTML is byte-identical before and after extraction (SPIKE-FINDINGS). 96-REVIEW.md independently confirms the move kept the plugin order raw, presentation, decode, sanitize. |
| 2 | `lib/wiki/` exposes preprocess, wiki-to-markdown, the shared plugin pipeline and `wikiToHtml`; presentation-only plugins stay out of the core list | VERIFIED | `index.ts` re-exports equivalence, pipeline and preprocess. `pipeline.ts` exports `wikiToMarkdown`, `wikiRemarkPlugins`, `wikiRehypePlugins(presentation=[])`, `wikiMarkdownToHtml` and `wikiToHtml`. `rehypeIssueKeys` is defined in WikiRenderer.tsx and passed in through the `presentation` argument. The `wikiToHtml` path uses `[]`. |
| 3 | A placeholder-only corpus covers the grammar, including hard cases | VERIFIED | 37 `.wiki` fixtures in 12 category dirs (the listing shows 49 files including the other directory entries). `corpus-coverage.test.ts` is a coverage gate. The fixtures were written as placeholders. A TBD/FIXME scan of `src/lib/wiki` hit one line in `preprocess.ts`, which is a pre-existing moved body and not a phase marker. |
| 4 | An equivalence assertion over the corpus fails when a fixture renders differently after load and save | VERIFIED (caveat) | `equivalence.test.ts` runs the identity round-trip over the whole corpus. Mutation self-tests (emoticon dropped, nesting flattened, panel title dropped) must be reported as failures. Negative controls (CRLF to LF, emoji spelling) must not be flagged. All 72 tests in `src/lib/wiki` pass. `tsc --noEmit` is clean. The caveat: it runs via the husky pre-commit hook, not a CI workflow. See human item 1. |

**Score:** 4/4

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/wiki/{pipeline,preprocess,equivalence,index}.ts` | VERIFIED | Substantive: 252, 1081, 113 and 3 lines. Wired into WikiRenderer and the tests. |
| `src/lib/wiki/__fixtures__/**` and `corpus.fixtures.ts` | VERIFIED | Loader and fixtures present. `.gitattributes` has `-text` so CRLF is kept. |
| `normalize.test.ts`, `pipeline.test.tsx`, `corpus-coverage.test.ts` | VERIFIED | Pass. |

### Key Links

| From | To | Status |
|------|----|--------|
| WikiRenderer.tsx | `@/lib/wiki` (preprocess, `wikiToMarkdown`, `wikiRehypePlugins`) | WIRED (line 552 passes `[rehypeIssueKeys(...)]`) |
| `equivalence.ts` | `wikiToHtml` pipeline (the oracle) | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result |
|----------|---------|--------|
| lib/wiki tests | `npx vitest run src/lib/wiki` | 4 files, 72 pass |
| WikiRenderer tests | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | 184 pass |
| Types | `npx tsc --noEmit` | clean |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| SAFE-01 | 96-01, 96-02, 96-05 | SATISFIED | Truths 1 and 2. |
| SAFE-02 | 96-03, 96-04, 96-06 | SATISFIED | Truths 3 and 4. |

No orphaned requirements. REQUIREMENTS.md maps only SAFE-01 and SAFE-02 to Phase 96. The checkboxes and traceability table there still read "Pending", so update them.

### Plans 05 and 06 human checkpoints

- **96-05 (editor spike):** The evidence is acceptable. A native WKWebView harness used real NSEvent keys, `NSTextInputClient` IME calls and the real pasteboard. It covered caret, Japanese and Pinyin IME, undo/redo, paste and selection. The result was no blockers, so TipTap is chosen under the D-02 rule. Residual risk: the dead-key path was only tested through the IME route. That is a Phase 98 concern, not a Phase 96 criterion. The spike branch and worktree were deleted, and main has no `@tiptap` or `@codemirror` dependency.
- **SAFE-01 visual check:** The HTML byte-diff of 37 fixtures is equivalent to, and stricter than, an eyeball check on those fixtures. It is limited to the corpus. See human item 2.
- **96-06 (Jira probe):** The user ran the live probe, with 9 placeholder snippets. No Jira HTML is stored in the repo (D-11). The findings are recorded and are follow-ups for Phase 97, not Phase 96 failures:
  - Mixed `*#` list nesting renders flat. This is an existing bug and is locked in by a fixture.
  - Headerless tables get an empty header row.
  - Mentions render as chips even for unknown users.

### Anti-Patterns

The advisory review has 0 critical, 6 warnings and 6 info items. WR-03 was fixed in 0ef2462d. None blocks the phase criteria. Two are worth tracking before Phase 98, because `isEquivalent` is meant to be the runtime guard:
- WR-01: `isEquivalent` and `checkCorpus` throw instead of failing closed when the oracle throws on the emitted text.
- WR-02: `normalizeHastForCompare` crashes on comment, doctype or raw nodes. It is safe today only because sanitize strips them.

### Gaps Summary

No code gaps. All 4 roadmap success criteria are met in the codebase and the tests pass. Status is `human_needed` only because the "CI" part of criterion 4 is currently enforced by the pre-commit hook. There is no GitHub Actions test job. Please decide whether that is acceptable.

---

_Verified: 2026-11-16T14:10:00Z_
_Verifier: Claude (gsd-verifier)_
