---
status: fixed
reviewed: 00ca9a78..ab7d4074
depth: quick
---

# 261002-enj Code Review (recorded by orchestrator — reviewer returned findings inline)

Critical 0 · Warning 3 · Info 2. Biome clean on all changed files.

| ID | Finding | Disposition |
|----|---------|-------------|
| WR-01 | "+N" aria-label "1 more risks" | Fixed — singular/plural (test proven to fail pre-fix) |
| WR-02 | Overflow popover focuses only hidden[0]'s rows | Fixed — first hidden risk with rows; not unit-tested (needs forecast-dependent issue-less risks ahead in order) |
| WR-03 | Tooltip flashes back after popover closes (focus return); tiny tap target | Fixed — tooltip opens suppressed until pointer leave / blur (test proven to fail pre-fix); px-1 on triggers |
| IN-01 | short label can exceed 16 chars | Comment corrected (CSS truncates) |
| IN-02 | Stale CHIP_TEXT name | Renamed SMALL_TEXT |
