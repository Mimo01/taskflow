---
type: todo
status: pending
created: 2026-06-03
origin: phase-76 (76-REVIEW.md code review)
priority: high
resolves_phase: 78
blocks: phase-78
---

# rank.ts is known-broken — fix before Phase 78 consumes it

Phase 76 code review (`.planning/phases/76-visual-polish-and-shared-primitives/76-REVIEW.md`)
found 2 BLOCKER bugs in `taskflow/src/services/jira/rank.ts`. The function is unused
in Phase 76, so the visual phase shipped, but Phase 78 (drag-to-rank) MUST fix these
before calling `rankIssue`:

- **CR-01 — cross-bucket midpoint is wrong.** `rankIssue` keeps `before`'s bucket and
  averages only the value portions. `rankIssue('0|zzzzzz:', '1|000000:')` returns
  `0|hzzzzz:`, which sorts *before* `before`. Different-bucket neighbours are unhandled.

- **CR-02 — precision loss.** `BigInt(parseInt(s, 36))` rounds through float64 before
  the BigInt cast, so value portions ≳11 base-36 chars collapse distinct ranks to the
  same number. The "precise BigInt arithmetic" comment is false.

**Required fix:**
- Correct cross-bucket handling (rebalance, or pick a midpoint that respects both
  buckets — see LexoRank bucket semantics).
- True arbitrary-precision base-36 arithmetic (parse digit-by-digit into BigInt; never
  go through `parseInt`/Number).
- Strengthen `rank.test.ts`: assert `rankLt(before, result) && rankLt(result, after)`
  on EVERY case (current E7 only checks the `0|` prefix, which is why CI stayed green).

`rank.ts` carries a ⚠️ KNOWN-BROKEN header pointing here. Remove it once fixed.
