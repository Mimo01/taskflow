---
status: resolved
reviewed: 2026-10-02
depth: quick
range: c9c001ce..ac8a33fd
---
# Code Review: 261002-h9e

Critical 0 · Warning 3 · Info 3. Focus areas passed: filter parity with removed `filterTimeline`, grouping on the unfiltered list, React key uniqueness, `maxEditLength` fallback, no `dangerouslySetInnerHTML`.

| ID | Finding | Outcome |
|----|---------|---------|
| WR-01 | Burst window slid against the last edit → unbounded chains | Fixed 1fe95769 — anchored to the group's first edit |
| WR-02 | Header time/author depended on sort order (`histories[0]`) | Fixed 1fe95769 — `latestHistory()` |
| WR-03 | `author.displayName` unguarded; anonymous histories merged on `''` | Fixed 1fe95769 — "Unknown", never merges (pre-existing risk, not a regression) |
| IN-01 | A → B → A within a burst rendered "A → A" | Fixed 1fe95769 — reverted fields dropped (single no-op items kept) |
| IN-02 | `useMemo([histories])` never hits since groups are rebuilt every render | Skipped — cheap; perf only |
| IN-03 | Multi-token merge block dense | Skipped — covered by tests |

All 6 regression tests verified to fail against pre-fix code.
