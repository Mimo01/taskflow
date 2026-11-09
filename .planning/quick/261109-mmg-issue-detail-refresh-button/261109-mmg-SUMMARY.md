# Quick 261109-mmg: Issue detail refresh button Summary

Refresh icon button in the issue-detail action row (left of Pin, full page and peek), matching the Release/Cycle detail button; it runs `refreshIssueDetail`, which invalidates the issue first and then all dependent sections.

## Commits
- 900e892e: refreshIssueDetail two-stage helper + test
- 16941d35: Refresh button in IssueDetailContent, wired from IssueDetailView, with tests

## Files
- taskflow/src/lib/issue-detail-refresh.ts, .test.ts (created)
- taskflow/src/routes/dashboard/IssueDetailContent.tsx, .test.tsx, IssueDetailView.tsx (modified)

## Deviations
None. Action row changed to `items-center` as planned.

## Self-Check: PASSED
Full vitest suite, biome and tsc passed via the pre-commit hook.
