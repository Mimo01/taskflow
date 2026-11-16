---
phase: 96-wiki-foundations-equivalence-harness
plan: 04
subsystem: wiki
tags: [equivalence, harness, rehype, testing]
requires: [96-02, 96-03]
provides:
  - isEquivalent / checkCorpus / formatCorpusFailures in src/lib/wiki
affects: [phase-97, phase-98]
key-files:
  created:
    - taskflow/src/lib/wiki/equivalence.ts
    - taskflow/src/lib/wiki/normalize.test.ts
    - taskflow/src/lib/wiki/equivalence.test.ts
  modified:
    - taskflow/src/lib/wiki/index.ts
requirements-completed: [SAFE-02]
duration: 15min
completed: 2026-11-16
---

# Phase 96 Plan 04: Equivalence harness Summary

Pure `isEquivalent` over the core pipeline with a two-rule normaliser (attribute order, ASCII whitespace outside `<pre>`), and a pluggable `checkCorpus` harness proven to bite by mutation self-tests.

## Tasks

1. equivalence.ts, normaliser, normalize.test.ts (14 tests) - 421f524b
2. equivalence.test.ts: identity over corpus, 3 named mutations with target guards, report format, 2 negative controls (CRLF to LF, emoji spelling, documented as SAFE-03) - 5505c42d

## D-08 evidence (identity swapped for the emoticon mutation locally, not committed)

```
FAIL ... identity round-trip is equivalent over the whole corpus
AssertionError: ✗ emoticons/all-emoticons.wiki
--- emoticons/all-emoticons.wiki (original)
+++ emoticons/all-emoticons.wiki (round-tripped)
@@ -1,1 +1,1 @@
-<p>✅ ❌ ⚠️ ...
+<p>OK ❌ ⚠️ ...

Emitted wiki:
"OK (x) (!) (+) (-) (?) (i)\n(*r) ..."
```

## Deviations from Plan

- [Rule 3] The base HEAD of the worktree was stale (1cc3524b); reset to the specified 619ff0ef per the branch check.
- [Rule 3] tsconfig lib lacks `String.replaceAll`, so test code uses `split().join()` for string replacement (the regex-literal mutations are unchanged).
- Added one extra test (throwing roundTrip becomes a failure).

## Known Stubs

None.

## Self-Check: PASSED

Files exist, commits 421f524b and 5505c42d present, full suite (5382 tests), tsc and biome green.
