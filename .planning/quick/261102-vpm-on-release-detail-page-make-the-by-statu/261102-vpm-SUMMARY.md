---
quick_id: 261102-vpm
status: complete
commit: 66e515f4
---
# Quick 261102-vpm summary

Release detail **By status** compact rows shrunk 24px → 22px (`COMPACT_ROW_HEIGHT` in ReleaseStatusRows.tsx). With 5 rows the list is 10px shorter. It no longer shares By assignee's 24px rhythm; assignee rows need the height for 20px avatars, and status rows have no avatar.

Unchanged: 5-row cap, 640px max width, "+N more statuses" line, empty/loading min-height (120px).

Executed inline (one-line change), no planner/executor agents or worktree.
Tests: full vitest suite green via pre-commit (4230 passed); biome clean.

UAT: first pass at 20px was too tight; settled at 22px (66e515f4). Approved 2026-11-02.
