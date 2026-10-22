---
status: complete
---
# Quick 261014-nkt Summary

Executed inline (single ~10-line change; no planner/executor subagents).

- `FieldsSection.tsx`: Fix Versions + Deployment package rows and the package warning now render only when `isStory` (non-Epic, non-subtask). `DeploymentPackageWarning` was already Story-only.
- Added parametrised test (Story/Epic/Sub-task); verified it fails on the pre-fix component for Epic and Sub-task.
- Full suite green (3590 passed), biome + tsc clean. Commit 6830f704.

Audit of other epic/subtask rows: Story Points, Epic, Sprint were already story-only. Candidates left unchanged: Flagged (epics aren't on the board), Time tracking (epic aggregate is meaningful).
