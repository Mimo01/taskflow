# Quick 261105-nly: Responsive issue-detail relationship rows

Shared `RelatedIssueRow` with container-query staging (time bar hidden below 42rem, assignee name hidden below 36rem, avatar always shown) now drives the Epic Stories, Story Subtasks and Subtask Parent rows.

## Commits
- 77fbb932: add RelatedIssueRow + test (7 tests)
- ae3af774: rewire IssueDetailContent at 3 sites, remove RowTimeBar and unused imports

## Files
- Created: taskflow/src/routes/dashboard/issue-detail/RelatedIssueRow.tsx, RelatedIssueRow.test.tsx
- Modified: taskflow/src/routes/dashboard/IssueDetailContent.tsx

## Deviations
None. The worktree was reset to the specified base e5300b08 at start (HEAD was one commit behind). Test and implementation were committed together per the pre-commit hook.

## Verification
Full vitest suite (4508 passed), tsc and biome on touched files clean. Visual check in the peek panel not performed (human-check).

## Self-Check: PASSED
