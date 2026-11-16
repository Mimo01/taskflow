---
phase: 96-wiki-foundations-equivalence-harness
plan: 03
subsystem: wiki
tags: [fixtures, corpus, vitest, gitattributes]
requires: []
provides:
  - placeholder-only wiki fixture corpus (37 .wiki files)
  - WIKI_CORPUS / HARNESS_USERS / HARNESS_ATTACHMENTS test-support exports
  - corpus-coverage gate
affects: [96-02, 96-04, 96-05, 97]
tech-stack:
  added: []
  patterns: [import.meta.glob ?raw eager corpus loader]
key-files:
  created:
    - .gitattributes
    - taskflow/src/lib/wiki/corpus.fixtures.ts
    - taskflow/src/lib/wiki/corpus-coverage.test.ts
    - taskflow/src/lib/wiki/__fixtures__/ (37 .wiki files)
key-decisions:
  - "Account-id mention uses the exact casing preprocess matches: [~accountId:placeholder-0001], HARNESS_USERS key is 'placeholder-0001'"
requirements-completed: [SAFE-02]
duration: 10min
completed: 2026-11-16
---

# Phase 96 Plan 03: Placeholder wiki fixture corpus Summary

37 placeholder-only `.wiki` fixtures grouped by construct, kept byte-exact by `.gitattributes -text`, loaded via `import.meta.glob` `?raw`, and guarded by a coverage test.

## Commits
- 7903e346: .gitattributes and block-construct fixtures (21)
- 2afee46a: inline-construct fixtures (13)
- f7d4f586: byte-exact whitespace/nbsp fixtures, loader, coverage test

## Notes
- `?raw` preserved CRLF under vitest, so the D-12 glob loader stays; no fs fallback needed.
- The coverage test has 6 tests: required list (37), presence/sorted/non-empty, CRLF, trailing space/tab, nbsp, placeholder guard (hosts, emails, mentions).
- Mention allowlist uses `accountId:placeholder-0001` (matches preprocessJiraMarkup casing, not the lowercase in the plan text).
- Worktree needed a symlink to the main checkout's node_modules (untracked/ignored).

## Deviations from Plan
None of substance. The worktree base was reset to 62064e5f as instructed by the branch check.

## Known Stubs
None.

## Self-Check: PASSED
