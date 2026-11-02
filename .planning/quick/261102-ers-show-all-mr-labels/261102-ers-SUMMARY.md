---
status: complete
---
# Quick 261102-ers: show all MR labels on release detail

Removed the 4-pill / 5-row cap and the "+N more" overflow entry from `MrLabels` (release detail MR donut). Every label renders as a pill; the "unlabelled N" line is unchanged. Dropped `labelRowPlan`; replaced its tests with one asserting all pills render. Ran inline (no planner/executor agents) given the size.
