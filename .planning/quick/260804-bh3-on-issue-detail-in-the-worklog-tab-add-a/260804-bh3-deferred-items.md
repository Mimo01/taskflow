# Deferred Items — quick-260804-bh3

Out-of-scope pre-existing test failures discovered during verification (not caused by this plan's changes; left untouched per scope boundary):

1. **`src/services/jira.test.ts` > `ISSUE-03: fetchIssueDetail` > `includes dynamic custom field keys in the fields= query param`**
   Fails on the pre-change base commit (`3d65818d`) too — unrelated to `fetchEnrichedSubtasks` changes made in Task 1. `fetchIssueDetail` itself was not touched by this plan.

2. **`src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx`** (10 failing tests, e.g. traceability-scan related `waitFor` timeouts)
   Fails identically with no working-tree diff against `AioTestRunsSection.tsx`/`.test.tsx` at HEAD — pre-existing/flaky, unrelated to the Worklog progress bar work.
