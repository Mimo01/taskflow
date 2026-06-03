---
phase: 78-drag-to-rank-on-backlog
plan: "02"
subsystem: services/jira
tags: [lexorank, bigint, tdd, pure-function]
dependency_graph:
  requires: []
  provides: [rank.ts-fixed, rank.test.ts-strengthened]
  affects: [Plan 03 (rank-api), Plan 04 (BacklogPage drag wiring)]
tech_stack:
  added: []
  patterns: [digit-by-digit BigInt base-36, cross-bucket LexoRank midpoint, TDD RED→GREEN]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira/rank.ts
    - taskflow/src/services/jira/rank.test.ts
decisions:
  - "CR-01: cross-bucket midpoint stays in lower bucket, extends before's value with midChar 'i'"
  - "CR-02: digit-by-digit BigInt parseBase36 replaces BigInt(parseInt(s,36)) to avoid float64 precision loss"
  - "rankLt in test file is bucket-aware: compare bucket int first, then val lexically"
metrics:
  duration: "3 minutes"
  completed: "2026-06-03"
  tasks: 2
  files_changed: 2
---

# Phase 78 Plan 02: Fix rank.ts LexoRank Calculator Summary

Fixed the known-broken `rank.ts` LexoRank midpoint calculator: cross-bucket midpoint now stays in the lower bucket and extends `before`'s value (CR-01), and base-36 parsing uses digit-by-digit BigInt arithmetic to avoid float64 precision loss for 12+ char value strings (CR-02). Strengthened `rank.test.ts` with a bucket-aware `rankLt` and three new tests (E10/E11/E12); all 12 tests are GREEN.

## What Was Built

- **`rank.ts` CR-01 fix:** When `before` and `after` are in different buckets, `rankIssue` now stays in `beforeBucket` and appends the alphabet midpoint character `'i'` to `beforeVal`. This produces a rank strictly greater than `before` (same bucket, longer value) and strictly less than `after` (higher bucket). The previous code averaged value portions in `before`'s bucket, returning a rank that sorted *before* `before`.

- **`rank.ts` CR-02 fix:** Replaced `BigInt(parseInt(pa || '0', 36))` with a new `parseBase36(s)` function that accumulates `result = result * 36n + BigInt(ALPHABET.indexOf(c))` digit-by-digit, and a matching `toBase36(n, minLen)` renderer. This eliminates the float64 round-trip that silently collapsed distinct 12+ char rank strings to the same integer.

- **`rank.ts` KNOWN-BROKEN header removed:** The entire 11-line `⚠️ KNOWN-BROKEN` JSDoc block listing CR-01/CR-02 and the "MUST fix" directive has been deleted. The remaining doc comments are accurate.

- **`rank.test.ts` bucket-aware `rankLt`:** The old value-only comparison has been replaced with `{ bucket: parseInt(bkt, 10), val }` parse + bucket-first comparison. Cross-bucket ranks now compare correctly: `0|zzzzzzg:` < `1|000000:`.

- **`rank.test.ts` E7 replacement:** The prefix-only `expect(result.startsWith('0|')).toBe(true)` assertion has been replaced with full strict-ordering assertions for `before='0|zzzzzz:'` / `after='1|000000:'`.

- **`rank.test.ts` E10/E11/E12 added:**
  - E10: 12-char same-bucket ranks — no precision collapse (CR-02 proof)
  - E11: cross-bucket `'0|zzzzzz:'` before `'1|000000:'` — strict ordering (CR-01 proof)
  - E12: insert 5 successive midpoints between `'0|aaaaaa:'` and `'0|bbbbbb:'` — all 5 strictly increasing

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (`test(78-02)`) | ec09d446 | ✓ — E7 and E11 failed, proving CR-01 bug |
| GREEN (`feat(78-02)`) | 403c3cd6 | ✓ — all 12 tests pass |
| REFACTOR | (none needed) | n/a |

## Verification

```
npm test -- --run src/services/jira/rank.test.ts
→ 12 passed (E1–E12) GREEN
```

- `grep -c "beforeBucket !== afterBucket" rank.ts` → 1 ✓
- `grep -c "parseBase36" rank.ts` → 3 ✓
- `grep -c "parseInt.*36" rank.ts` → 0 ✓
- `grep -c "KNOWN-BROKEN" rank.ts` → 0 ✓
- `grep -c "startsWith('0|')" rank.test.ts` → 0 ✓

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface. `rank.ts` remains a side-effect-free pure function with no I/O, no network, no secrets. No new endpoints, auth paths, or schema changes introduced.

## Known Stubs

None.

## Self-Check: PASSED

- `taskflow/src/services/jira/rank.ts` — FOUND ✓
- `taskflow/src/services/jira/rank.test.ts` — FOUND ✓
- Commit ec09d446 — FOUND ✓
- Commit 403c3cd6 — FOUND ✓
