---
phase: 96-wiki-foundations-equivalence-harness
fixed_at: 2026-11-16T14:20:00Z
review_path: .planning/phases/96-wiki-foundations-equivalence-harness/96-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 96: Code Review Fix Report

**Fixed at:** 2026-11-16T14:20:00Z
**Source review:** .planning/phases/96-wiki-foundations-equivalence-harness/96-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01 to WR-06; Info findings out of scope)
- Fixed: 6 (5 in this run, plus WR-03, which was already fixed in 0ef2462d)
- Skipped: 0

Every fix commit went through the full pre-commit hook (biome, tsc and the full vitest suite). The final run had 5387 tests passing. The first commit (WR-01) went in before the husky hooks were installed in the worktree. I then ran the same checks on it by hand, and they were green.

## Fixed Issues

### WR-01: `checkCorpus` / `isEquivalent` throw when the oracle fails on the emitted wiki

**Files modified:** `taskflow/src/lib/wiki/equivalence.ts`, `taskflow/src/lib/wiki/normalize.test.ts`
**Commit:** f6c84894
**Applied fix:** In `checkCorpus`, both `wikiToNormalizedHtml` calls are now wrapped in try/catch. A throw is reported as a per-fixture `CorpusFailure` (`oracle threw: …`), and the loop moves on to the next fixture. `isEquivalent` now fails closed and returns `false` on a throw.
**Pre-fix check:** The new tests use a round trip that returns a non-string, which makes preprocess throw `TypeError: wiki.replace is not a function`. Run without the fix, both tests failed with that TypeError: `checkCorpus` aborted the whole run and `isEquivalent` threw. Both pass with the fix.

### WR-02: `normalizeHastForCompare` crashes on comment, doctype or raw nodes

**Files modified:** `taskflow/src/lib/wiki/equivalence.ts`, `taskflow/src/lib/wiki/normalize.test.ts`
**Commit:** 8407c993
**Applied fix:** `walk` now returns early for nodes without a `children` array. The local `HastNode` type now includes a `HastLeaf` (comment, doctype, raw), so tsc sees these node types.
**Pre-fix check:** The new test runs a root containing doctype, comment and raw nodes plus a `<p>`. Without the fix it failed with `TypeError: node.children is not iterable`. With the fix it passes, and the text in the `<p>` is still normalised.

### WR-03: In CI, the version comes from the highest reachable tag, not the tag being released

**Files modified:** `taskflow/scripts/inject-version.cjs`
**Commit:** 0ef2462d (already on main before this run; not touched here)
**Applied fix:** That commit already prefers an exact vX.Y.Z release tag on HEAD, as the review suggested.

### WR-04: The purity guard misses `.tsx` files, subdirectories and some import forms

**Files modified:** `taskflow/src/lib/wiki/pipeline.test.tsx`, `taskflow/src/lib/wiki/corpus.fixtures.ts`
**Commit:** 0d570141
**Applied fix:** The guard now walks `lib/wiki` recursively over `.ts`/`.tsx` (test files excluded). It matches `from '…'`, side-effect `import '…'`, dynamic `import('…')` and `require('…')`. It no longer excludes `corpus.fixtures.ts`, and asserts that the file is scanned. For that, `corpus.fixtures.ts` now imports `AttachmentMap`/`UserMap` from `./preprocess` instead of the WikiRenderer route. That also resolves Info finding IN-02.
**Check:** I added two temporary probe files: `probe/x.tsx` with `import 'react'`, and a `.ts` file with `require('zustand')`. The new guard failed on both. The old guard skipped both (one is a `.tsx` file in a subdirectory, the other uses a non-`from` import). The probes were deleted before the commit.

### WR-05: The exported `wikiSanitizeSchema` is a mutable XSS allowlist reachable through the barrel

**Files modified:** `taskflow/src/lib/wiki/pipeline.ts`
**Commit:** 8500fb7e
**Applied fix:** Removed the `export` keyword, so the barrel no longer exposes the schema. Before removing it I ran `git grep` across the whole repo (excluding `.planning`). The only code reference is inside `pipeline.ts`. The other hits are comments in `preprocess.ts` and `WikiRenderer.tsx`.

### WR-06: `[text|^attachment]` renders a broken link, and the corpus now treats it as correct (pre-existing)

**Files modified:** `taskflow/src/lib/wiki/preprocess.ts`, `taskflow/src/routes/dashboard/WikiRenderer.test.tsx`
**Commit:** f559f726
**Applied fix:** Added 10 lines to `preprocessJiraMarkup`, just before the existing `[^filename]` replacement and limited to attachment links. `[label|^filename]` now resolves against the attachment map into the same `wiki-attachment-chip` anchor, with the label as its text. If the attachment isn't in the map, only the label is shown, so there's no broken link. The class is still the constant literal (T-sak-01). Sanitize still runs afterwards.
**Pre-fix check:** I added two WikiRenderer tests, one for a known attachment and one for an unknown one. Without the fix both failed: the known case had no chip anchor, and the unknown case rendered `<a href="%5Emissing.pdf">`. Both pass with the fix.
**Rendering impact:** I rendered every corpus fixture through `wikiToHtml` before and after the fix and compared the output. Only `attachments/file-link.wiki` changed, and it improved:
- Before: `<a href="%5Espec.pdf">Spec</a>`
- After: `<a href="https://jira.example.com/secure/attachment/10003/spec.pdf" class="wiki-attachment-chip">Spec</a>`

`WikiRenderer.test.tsx`, the pipeline parity test and the corpus equivalence test all stay green.
**Note:** The chip picks its icon from its text. A labelled chip such as `Spec` has no file extension, so it shows the generic file icon. I left this alone to keep the fix inside preprocess.

---

_Fixed: 2026-11-16T14:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
