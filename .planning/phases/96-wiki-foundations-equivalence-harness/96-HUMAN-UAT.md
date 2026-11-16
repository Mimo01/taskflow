---
status: complete
phase: 96-wiki-foundations-equivalence-harness
source: [96-VERIFICATION.md]
started: 2026-11-16T12:58:40Z
updated: 2026-11-16T12:59:48Z
---

## Current Test

[complete]

## Tests

### 1. CI scope for the equivalence assertion
expected: The user decides whether the husky pre-commit hook, which runs the full vitest suite including the corpus equivalence test, counts as "CI". The alternative is a GitHub test job, which doesn't exist yet. Today the only workflow is release-cross-platform.yml, and it has no test step.
result: passed (user: the pre-commit hook counts as CI)

### 2. Real issue text renders as before (optional)
expected: A few real descriptions and comments look the same as in the previous build. The automated check only byte-diffed the 37 placeholder fixtures.
result: skipped (optional; the corpus byte-diff before and after extraction was identical)

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
