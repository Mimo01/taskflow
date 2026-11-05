---
quick_id: 261105-jhg
type: quick
---
# Quick 261105-jhg: Epic detail By person ordered on every tab

**Problem:** Time tab sorts By person rows by bar length (`deriveTimePeople`: total desc, name).
Count/SP use `deriveAssigneeBuckets`, sorted by remaining (in progress + to do) desc — a mostly-done
person with the longest bar sorts below shorter bars, so the graph looks unordered.

## Task 1: Sort assignee buckets by total
- files: taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts
- action: sort by done + inProgress + todo desc, then name; update the ordering test so a done-only person with the longest bar leads.
- verify: vitest epic-progress + issue-detail + release-detail (release rows re-sort themselves, unaffected)
- done: all three tabs order people longest bar first
