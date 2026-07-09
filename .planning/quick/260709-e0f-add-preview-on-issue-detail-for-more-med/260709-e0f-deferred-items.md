# Deferred Items — 260709-e0f

Pre-existing, out-of-scope test failures discovered while running the full
`npx vitest run` suite during this quick task's verification. Confirmed
pre-existing by running the same test files against the pre-dispatch base
commit (fba060b4) in an isolated worktree — failures are identical there,
so they are NOT caused by this plan's changes. Not fixed per the scope
boundary rule (only auto-fix issues directly caused by the current task).

| File | Failing tests | Notes |
|------|---------------|-------|
| `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` | 10 | Timeout-pattern failures (~1000ms each) unrelated to AuthImage/AttachmentPreviewModal; reproduced on base commit fba060b4 |
| `taskflow/src/services/jira.test.ts` | 1 | `ISSUE-03: fetchIssueDetail` — dynamic custom field keys assertion, unrelated to attachments |
| `taskflow/src/components/app/CommandPalette.test.tsx` | 3 | Escape/Navigation-group assertions, unrelated to attachments |
