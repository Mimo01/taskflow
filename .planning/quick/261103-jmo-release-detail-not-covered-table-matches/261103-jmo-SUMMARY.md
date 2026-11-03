---
quick_id: 261103-jmo
status: complete
commit: e23e717d
---

# Quick 261103-jmo: Not-covered table column order

Secondary ("Not covered by tasks above") header and rows now run icon+Key, State, Author, Reviewers, Merge request, MR state, BR, MS, Fix, action. Primary task rows are unchanged. The summary cell is built once and placed by branch, so BR/MS logic is not duplicated.

Test added in UnifiedTaskTable.test.tsx: header label order, and the type icon is the first cell and precedes the state pill.

Verification: vitest release-detail 726 passed, biome and tsc clean, full suite passed in the pre-commit hook.

Commit: e23e717d
