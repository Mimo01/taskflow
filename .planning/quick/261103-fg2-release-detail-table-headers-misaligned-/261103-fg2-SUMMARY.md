---
quick_id: 261103-fg2
status: complete
commit: c503d80f
---

# 261103-fg2 Summary

Removed the `CALLOUT_FIX_ACTION_COL` spacer that 72460870 put at the end of the main task table's
`ColumnHeaderStrip`. Task rows have no action column, so the spacer pushed every heading ~5rem left of its column.
The secondary (not-covered) header keeps its spacer, because its rows do render the action cell.

- Regression test (`WR-05 … ending at MS`): failed before the fix (9 header cells vs 8 row cells), passes after it
- Release-detail suites: 733/733 passed; full suite passed in the pre-commit hook (4308 passed)
- Biome + tsc clean
- Executed inline (one-line fix, root cause found while scoping); no planner or executor agents
