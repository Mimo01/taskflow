---
phase: 260606-spj-on-issue-peek-component-show-both-key-an
reviewed: 2026-06-06T00:00:00Z
depth: quick
files_reviewed: 5
files_reviewed_list:
  - taskflow/src/components/app/PeekPanel.tsx
  - taskflow/src/components/app/PeekPanel.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
  - taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Issue Peek Header Redesign: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** quick
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed covering: the new PeekPanel header (icon + key + title), the `useLinkedMRs` extraction, the `omitMergeRequests` sidebar prop, and corresponding tests.

The two-column page is correctly unchanged — `omitMergeRequests` is false by default and `useLinkedMRs` is called unconditionally in `IssueDetailView` but the `MergeRequestsSection` bottom slot is rendered only inside the `single-column` branch (lines 669-676), so no MR duplication in two-column.

The dedup for the Jira issue query works correctly: both `PeekPanel` and `IssueDetailView` use the identical three-part key `['jira-issue-detail', issueKey, jiraBaseUrl]` with matching `staleTime` and `enabled` guards, so TanStack Query will serve the second call from cache. The GitLab MR dedup also works correctly for the same reason.

Three real defects found.

---

## Warnings

### WR-01: `useLinkedMRs` fetches only 20 MRs with no `state` filter — linked MR may be silently absent

**File:** `taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts:26`

**Issue:** The GitLab query fetches `per_page=20` (most-recently-updated) with no `state=` filter. Merged or closed MRs that were updated more than 20 MRs ago will not appear in `projectMRs`, so the subsequent client-side `issueKey` filter will silently return an empty list. The comment on line 15 calls this a "client-side filter" as if it is equivalent to a server-side query, but it is only correct when all relevant MRs appear in that first page. This was an existing limitation before this diff, but the extraction into a shared hook now makes the limitation load-bearing for both the sidebar and the new bottom slot — widening the blast radius. Additionally, the absence of `state=opened` means closed MRs show up as "linked" in the header redesign context, which is likely undesirable.

**Fix:**
```typescript
// Add state filter and bump page size, or switch to a server-side search:
const url = `${base}/api/v4/projects/${activeGitlabProject}/merge_requests?state=opened&per_page=100&order_by=updated_at&sort=desc`;
```
Or, if closed MRs should also show: remove the page cap by paginating, or accept the limitation with a code comment explaining the trade-off.

---

### WR-02: `useLinkedMRs` is called unconditionally in `IssueDetailView` even when `layout === 'two-column'` — unnecessary hook invocation

**File:** `taskflow/src/routes/dashboard/IssueDetailView.tsx:106`

**Issue:** `const mr = useLinkedMRs(issueKey)` is called at component mount regardless of `layout`. In the `two-column` path the result is never consumed — `MergeRequestsSection` at the bottom is inside the `single-column` branch only (line 669). The hook call itself is cheap when the query is already cached, but it fires `useAuthStore` and `useQuery` subscriptions unconditionally. More importantly, the GitLab query is now triggered on every `IssueDetailView` mount (both peek and full-page), even though in two-column the sidebar's own `useLinkedMRs` call already handles it. The queries will deduplicate over the network, but two subscriber subscriptions are created unnecessarily.

While this does not produce a runtime bug today, it is a maintenance hazard: if the hook ever gains side-effects or becomes conditionally `enabled`, the silent two-column call becomes a correctness problem.

**Fix:**
```tsx
// Only call in single-column; sidebar handles it for two-column:
const mr = layout === 'single-column' ? useLinkedMRs(issueKey) : null;
```
Note: hooks cannot be called conditionally per the Rules of Hooks. Instead, pass `enabled` down or split into a wrapper:
```tsx
// Option A — add an enabled param to the hook:
const mr = useLinkedMRs(issueKey, layout === 'single-column');

// In useLinkedMRs:
export function useLinkedMRs(issueKey: string, enabled = true) {
  const { data: projectMRs, isLoading: mrsLoading } = useQuery({
    ...
    enabled: enabled && !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject,
  });
  ...
}
```

---

### WR-03: `PeekPanel` `queryFn` closes over stale field-key values — dedup is fragile if field keys change

**File:** `taskflow/src/components/app/PeekPanel.tsx:79-89`

**Issue:** The `queryFn` in `PeekPanel` captures `epicLinkFieldKey`, `epicNameFieldKey`, `sprintFieldKey`, `storyPointsFieldKey`, and `epicColorFieldKey` from the settings store. These field keys are NOT part of the TanStack Query `queryKey`, matching `IssueDetailView` exactly. This is correct for deduplication purposes. However, if settings change while the panel is open, the `PeekPanel` queryFn would be re-created with new field key values but the query key would remain the same — so TanStack Query would not refetch and the stale cached data (fetched with old field keys) would continue to be served.

This exact problem also exists in `IssueDetailView`, so this is not a regression introduced by this diff — but the duplication of the queryFn (now in two places) doubles the maintenance surface. If `IssueDetailView` ever adds a field key to the query key, `PeekPanel` will silently diverge.

**Fix:** Extract the queryFn into a shared factory to remove the duplication:
```typescript
// services/jira/issueDetailQuery.ts
export function makeIssueDetailQuery(issueKey, jiraBaseUrl, jiraConnected, fieldKeys) {
  return {
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => { ... },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  };
}
```
This ensures both callers stay in sync automatically and removes the comment burden ("same query key as IssueDetailView.tsx:103-118").

---

## Info

### IN-01: `issue.fields.issuetype` is typed non-nullable but runtime data from partial fetches may omit it

**File:** `taskflow/src/components/app/PeekPanel.tsx:124`

**Issue:** The header renders `issue.fields.issuetype.name` (via `<IssueTypeIcon typeName={issue.fields.issuetype.name} />`) guarded only by `issue &&`. The `JiraIssueDetail` type at `types.ts:175` declares `issuetype` as `{ id?: string; name: string; subtask: boolean }` (non-optional). However, some Jira API calls in the codebase (e.g. the epic-stories search at `jira.ts:705`) use `issuetype?: { name: string }` on partial response shapes. If the cache ever contains a partial issue object (e.g. from a search result promoted to the detail cache key), `issue.fields.issuetype` could be undefined and this line would throw.

**Fix:** Use optional chaining as a safety net:
```tsx
{issue?.fields?.issuetype && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
```

---

### IN-02: Test PEEK-07a and PEEK-07b use duplicate `it` description strings

**File:** `taskflow/src/components/app/PeekPanel.test.tsx:115,123`

**Issue:** Both tests are labeled `'PEEK-07: ...'` — one for Escape keydown and one for X button click. Duplicate test names make it harder to identify which test failed in CI output. The comment above line 114 labels them `PEEK-07a` and `PEEK-07b` but the `it()` strings both say `PEEK-07`.

**Fix:**
```typescript
it('PEEK-07a: Escape keydown calls onClose', () => { ... });
it('PEEK-07b: "Close preview" X button calls onClose', () => { ... });
```

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
