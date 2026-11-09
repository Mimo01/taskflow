# Quick 261109-lg8: Issue unavailable panel Summary

One-liner: Issue detail now shows a centred "You can't view KEY" / "Couldn't load KEY" panel (Open in Jira, Copy key, Try again) backed by an ApiError that carries the real HTTP status and Jira errorMessages.

## Tasks

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1. Preserve status + errorMessages in fetchIssueDetail | 5f18711d | lib/api-error.ts, services/jira.ts, services/jira.test.ts |
| 2. IssueUnavailable panel + wiring | b5bce9f3 | issue-detail/IssueUnavailable.tsx (+test), issue-detail/unavailable-info.ts, IssueDetailView.tsx, PeekPanel.tsx |

## Deviations from Plan

- **[Rule 3 - Blocking] Helper file name.** The classifier is in `issue-detail/unavailable-info.ts` rather than `issueUnavailable.ts`. The latter collides by case with `IssueUnavailable.tsx` on case-insensitive filesystems (tsc TS1149). The helper is kept separate from the component, as the plan allowed, to satisfy react-refresh lint.
- Worktree HEAD was not on the required base, so it was reset to ccd5b6a8 per the branch check.
- `ErrorState` import in IssueDetailView is kept; it is still used elsewhere in the file.

## Notes

- All non-ok statuses from fetchIssueDetail now throw ApiError (404 was a plain Error before). The suffix `: <status>` is kept in the message.
- 401/403/404 are not retried (query `retry` in both IssueDetailView and PeekPanel); other errors retry once.
- `isAuthError` untouched.
- Full vitest suite, biome and tsc passed in the pre-commit hook on both commits.

## Known Stubs

None.

## Self-Check: PASSED

## Follow-ups (inline, after UAT)

- 352c77d3: shared readJiraErrorMessages helper in jira.ts; issue key shown once.
- 8a13e4b5 → bb6c6b09: panel polish rounds. Final: first-design generic explanation, Jira's errorMessages NOT shown, title text-base (matches EmptyState).
- Recent items: useRecentIssues reports keys the batch search omitted (`missing`); those rows render a lock icon, muted title and a plain "No access" label in the status column (SearchResultRow `unavailable`).
