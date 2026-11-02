---
quick_id: 261102-vpm
status: complete
commit: d761d451
---
# Quick 261102-vpm summary

Release detail **By status** compact rows shrunk 24px → 20px (`COMPACT_ROW_HEIGHT` in ReleaseStatusRows.tsx). With 5 rows the list is 20px shorter. It no longer shares By assignee's 24px rhythm; assignee rows need the height for 20px avatars, and status rows have no avatar.

Unchanged: 5-row cap, 640px max width, "+N more statuses" line, empty/loading min-height (120px).

Executed inline (one-line change), no planner/executor agents or worktree.
Tests: full vitest suite green via pre-commit (4230 passed); biome clean.
