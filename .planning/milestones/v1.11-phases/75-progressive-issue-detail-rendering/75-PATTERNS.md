# Phase 75: Progressive Issue Detail Rendering — Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/services/jira/changelog.ts` | service | request-response | `taskflow/src/services/jira/comments.ts` | exact |
| `taskflow/src/services/jira.ts` (modify `fetchIssueDetail`) | service | request-response | self (lines 1486-1577 — extract subtask JQL) | self-extraction |
| `taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` | exact |
| `taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx` | component | — | `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` | exact |
| `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (add 3 queries, remove global gate) | component/page | request-response | self lines 77-92, 247-256 (existing parallel queries) | self-extension |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (subtask skeleton + key fix) | component | request-response | `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` lines 628-683 | role-match |
| `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` (changelog prop path) | component | event-driven | self lines 122-131 (existing skeleton guard — make reachable) | self-extension |
| `taskflow/src/routes/dashboard/CommentComposer.tsx` (add invalidation key) | component | CRUD | self line 89 | self-extension |
| `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` (add changelog invalidation) | component | CRUD | self lines 260-271 | self-extension |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (fix wrong invalidation key at line 68) | component | CRUD | self line 68 + line 76-78 | self-extension |
| `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` | test | — | `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` | exact |

---

## Pattern Assignments

### `taskflow/src/services/jira/changelog.ts` (service, request-response)

**Analog:** `taskflow/src/services/jira/comments.ts`

**File header + imports pattern** (comments.ts lines 1-8):
```typescript
/**
 * Jira changelog operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { ChangelogHistory } from './types';   // <-- type name TBD, verify in jira.ts JiraIssueDetail shape
```

**Core fetch pattern** (comments.ts lines 9-36):
```typescript
export async function fetchIssueChangelog(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<ChangelogHistory[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}?expand=changelog&fields=summary`;
  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
      'Load Issue Detail',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch changelog for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch changelog for ${issueKey}: ${response.status}`);
  }
  const data = (await response.json()) as { changelog?: { histories: ChangelogHistory[] } };
  return data.changelog?.histories ?? [];
}
```

**Error handling pattern:** identical to comments.ts — `try/catch` around `apiFetch` for network errors, `if (!response.ok)` with 401/403 `ApiError` for HTTP errors. Non-auth errors throw plain `Error`.

**Key difference from worklogs.ts:** `fetchFullWorklogs` silently returns `[]` on any error (non-critical enrichment). `fetchIssueChangelog` should throw like `fetchComments` — it is a primary section, not optional enrichment.

---

### `taskflow/src/services/jira.ts` — `fetchEnrichedSubtasks` extraction (service, request-response)

**Source to extract:** `taskflow/src/services/jira.ts` lines 1545-1574 (the `if (issue.fields.subtasks?.length > 0)` block).

**Extraction shape** (modeled on comments.ts pattern, adapted from the existing inline block):
```typescript
// New standalone function — extract from jira.ts:1546-1574
export async function fetchEnrichedSubtasks(
  baseUrl: string,
  token: string,
  subtasks: Array<{
    key: string;
    fields: {
      summary: string;
      status: { name: string; statusCategory: unknown };
      assignee: JiraIssueDetail['fields']['assignee'];
    };
  }>,
): Promise<typeof subtasks> {
  const base = baseUrl.replace(/\/$/, '');
  const subtaskKeys = subtasks.map((s) => s.key).join(',');
  const enrichJql = encodeURIComponent(`key in (${subtaskKeys})`);
  const enrichUrl = `${base}/rest/api/2/search?jql=${enrichJql}&fields=assignee&maxResults=${subtasks.length}`;
  const enrichRes = await apiFetch(
    'jira',
    enrichUrl,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Issue Detail',
  );
  if (!enrichRes.ok) return subtasks;   // non-critical: return unenriched on failure
  const enrichData = (await enrichRes.json()) as {
    issues: Array<{ key: string; fields: { assignee: JiraIssueDetail['fields']['assignee'] } }>;
  };
  const assigneeMap = new Map(enrichData.issues.map((i) => [i.key, i.fields.assignee]));
  return subtasks.map((sub) => ({
    ...sub,
    fields: { ...sub.fields, assignee: assigneeMap.get(sub.key) ?? sub.fields.assignee },
  }));
}
```

**Placement:** The function can live in `services/jira/` as a new file (matching the `comments.ts` / `worklogs.ts` pattern) or be added inline to `jira.ts` near the existing `fetchIssueDetail`. Either is acceptable — the key is removing it from the body of `fetchIssueDetail`.

**`fetchIssueDetail` modification:** Remove `'comment'` from the fields array (line 1509) and remove `&expand=changelog` from the URL (line 1528). Remove the entire `if (issue.fields.subtasks?.length > 0)` block (lines 1545-1574). The function body shrinks to a single HTTP call + response parse.

---

### `taskflow/src/routes/dashboard/issue-detail/CommentsSkeleton.tsx` (component, skeleton)

**Analog:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx` (full file, 13 lines)

**Full analog** (AioTestRunsSkeleton.tsx lines 1-13):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function AioTestRunsSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" data-testid="aio-test-runs-skeleton">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

**CommentsSkeleton target shape** (per UI-SPEC skeleton dimensions table):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function CommentsSkeleton() {
  return (
    <div className="space-y-3" data-testid="comments-skeleton">
      <Skeleton className="h-6 w-32" />      {/* heading */}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
```

**Typography note:** No `font-semibold` on any new skeleton element (UI-SPEC typography contract — 2-weight rule governs net-new elements).

---

### `taskflow/src/routes/dashboard/issue-detail/SubtasksSkeleton.tsx` (component, skeleton)

**Analog:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSkeleton.tsx`

**SubtasksSkeleton target shape** (per UI-SPEC skeleton dimensions table — compact, 2 rows at h-8):
```typescript
import { Skeleton } from '@/components/ui/skeleton';

export function SubtasksSkeleton() {
  return (
    <div className="space-y-2" data-testid="subtasks-skeleton">
      <Skeleton className="h-6 w-40" />      {/* heading */}
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
```

---

### `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — 3 new queries + gate removal (component, request-response)

**Analogs:**
- Existing worklogs query (lines 247-256) — parallel `useQuery` shape
- Base issue query (lines 77-92) — auth pattern (token-outside-key)
- AioTestRunsSection.tsx lines 628-684 — per-section `isPending` + `useDelayedLoading` + `ErrorState`

**Existing parallel query shape to replicate** (IssueDetailPage.tsx lines 247-256):
```typescript
const { data: worklogs = [] } = useQuery({
  queryKey: ['jira-worklogs', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) return [];
    return fetchFullWorklogs(jiraBaseUrl, token, issueKey ?? '');
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
});
```

**Three new queries to add** (after the existing worklogs query):
```typescript
// Comments query — replaces issue?.fields.comment?.comments derivation at line 127
const commentsQuery = useQuery({
  queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) throw new Error('No credentials');
    return fetchComments(jiraBaseUrl, token, issueKey ?? '');
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
});

// Subtask enrichment query — enabled only when base data has subtasks
const subtaskEnrichmentQuery = useQuery({
  queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) return [];
    const subtasks = issue?.fields.subtasks ?? [];
    if (subtasks.length === 0) return [];
    return fetchEnrichedSubtasks(jiraBaseUrl, token, subtasks);
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected && (issue?.fields.subtasks?.length ?? 0) > 0,
});

// Changelog query — feeds ActivityTimeline instead of issue.changelog?.histories
const changelogQuery = useQuery({
  queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) throw new Error('No credentials');
    return fetchIssueChangelog(jiraBaseUrl, token, issueKey ?? '');
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
});
```

**Delayed loading gates** (add after the three query declarations):
```typescript
const showCommentsSkeleton = useDelayedLoading(commentsQuery.isPending);
const showSubtasksSkeleton = useDelayedLoading(subtaskEnrichmentQuery.isPending);
// Changelog skeleton is handled by ActivityTimeline's existing guard (changelog === undefined)
// but needs the delayed gate here to avoid passing undefined too early:
const showChangelogSkeleton = useDelayedLoading(changelogQuery.isPending);
```

**Global gate removal** (IssueDetailPage.tsx line 377):
```typescript
// BEFORE (line 377):
{isLoading || !issue ? (
  <IssueDetailSkeleton />
) : (
  <div ref={containerRef} ...>

// AFTER — gate only on base fetch; sections handle their own pending state:
{!issue ? (
  isLoading ? <IssueDetailSkeleton /> : <PanelLevelError ... />
) : (
  <div ref={containerRef} ...>
```

**`comments` derivation replacement** (line 127 — currently `issue?.fields.comment?.comments ?? []`):
```typescript
// BEFORE:
const comments: JiraComment[] = issue?.fields.comment?.comments ?? [];

// AFTER:
const comments: JiraComment[] = commentsQuery.data ?? [];
```

**ActivityTimeline prop change** (line 412-413 — currently `changelog={issue.changelog?.histories ?? []}`):
```typescript
// BEFORE:
changelog={issue.changelog?.histories ?? []}

// AFTER — pass raw data (undefined while pending unlocks ActivityTimeline's built-in skeleton):
changelog={showChangelogSkeleton ? undefined : changelogQuery.data}
```

**Per-section inline error pattern** — copy from AioTestRunsSection.tsx lines 670-683 for comments and subtasks:
```typescript
// comments error inline in the ActivityTimeline wrapper area:
if (commentsQuery.isError) {
  return (
    <div className="p-4">
      <ErrorState
        error={commentsQuery.error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] })}
        viewName="comments"
      />
    </div>
  );
}
```

---

### `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — subtask skeleton + key fix (component, request-response)

**Subtask skeleton gate** — add before the existing subtask `<section>` block (lines 186-230). Analog: AioTestRunsSection.tsx lines 666-684:
```typescript
// NEW: Accept enrichedSubtasks as a prop from IssueDetailPage
// (undefined = pending, [] = empty/loaded, array = data)
// Add before the subtask section render:
{!isEpic && !isSubtask && enrichedSubtasks === undefined && showSubtasksSkeleton && (
  <SubtasksSkeleton />
)}
{!isEpic && !isSubtask && subtaskEnrichmentQuery?.isError && (
  <div className="p-4">
    <ErrorState
      error={subtaskEnrichmentQuery.error}
      onRetry={subtaskRefetch}
      viewName="subtasks"
    />
  </div>
)}
```

**Pre-existing key bug fix** (IssueDetailContent.tsx line 68):
```typescript
// BEFORE (wrong key — missing jiraBaseUrl, wrong prefix):
queryClient.invalidateQueries({ queryKey: ['issue-detail', issueKey] });

// AFTER (matches actual query key):
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrlFromStore] });
```
Note: `jiraBaseUrlFromStore` is already in scope at line 63 (`const jiraBaseUrlFromStore = useAuthStore((s) => s.jiraBaseUrl)`).

---

### `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` — changelog prop path (component, event-driven)

**Existing skeleton guard** (ActivityTimeline.tsx lines 122-131) — already correct, just needs to become reachable:
```typescript
// Currently unreachable because IssueDetailPage always passes a non-undefined array.
// After the split, changelog is undefined while changelogQuery is pending.
if (changelog === undefined) {
  return (
    <section className="mt-6 pb-4 space-y-3">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </section>
  );
}
```

**Prop type change:** Update the `changelog` prop from `ChangelogHistory[]` to `ChangelogHistory[] | undefined` in the component's props interface.

**No new skeleton needed** — the guard is already written. The only change is making it reachable by passing `changelogQuery.data` (possibly `undefined`) instead of `issue.changelog?.histories ?? []` from the parent.

**Changelog error state** — add before the `changelog === undefined` guard in ActivityTimeline, or wrap the section call in IssueDetailPage. The IssueDetailPage wrapper approach is simpler and matches how AioTestRunsSection handles its own error state independently.

---

### `taskflow/src/routes/dashboard/CommentComposer.tsx` — add invalidation key (component, CRUD)

**Current invalidation** (CommentComposer.tsx line 89):
```typescript
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
```

**Required change** — add the comments key alongside:
```typescript
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
```

---

### `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — comment mutation invalidation updates (CRUD)

**Comment edit mutation** (lines 170-179) — add comments key to `onSuccess`:
```typescript
// BEFORE (line 174):
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });

// AFTER:
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
```

**Comment delete mutation** (lines 188-190) — same pattern:
```typescript
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
```

---

### `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` — add changelog invalidation (CRUD)

**Status change mutation `onSettled`** (lines 260-271) — add changelog key:
```typescript
// Add after existing invalidations (line 261):
queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] });
```

**Existing invalidation block pattern to extend** (FieldsSection.tsx lines 260-271):
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
  queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
  queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
  // ... existing invalidations ...
  queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] }); // ADD
},
```

---

### `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` (test)

**Analog:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx`

**Test file structure** (AioTestRunsSection.test.tsx lines 1-129):
```typescript
// 1. vi.mock declarations FIRST (before any imports that use them)
vi.mock('@/stores/settings.store', ...);
vi.mock('@/stores/auth.store', ...);
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn().mockReturnValue(false),
}));
vi.mock('@/services/jira', () => ({
  fetchIssueDetail: vi.fn(),
  fetchEpicStories: vi.fn(),
  // ...
}));
vi.mock('@/services/jira/comments', () => ({
  fetchComments: vi.fn(),
}));
// ... other service mocks

// 2. Imports AFTER mocks
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 3. QueryClient factory
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// 4. Render helper wrapping with QueryClientProvider + MemoryRouter
function renderPage(props = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/issue/PROJ-123']}>
        {/* ... */}
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

**Test coverage targets** (from RESEARCH.md validation architecture):
- PERF-DETAIL-01: header renders when base query resolves before comments query
- PERF-DETAIL-02: `CommentsSection` / `SubtasksSkeleton` shown when query `isPending`; hidden when `useDelayedLoading` returns false
- PERF-DETAIL-02: `ActivityTimeline` receives `undefined` changelog and shows built-in skeleton
- PERF-DETAIL-03: comment edit/delete mutations invalidate both `jira-issue-detail` and `jira-issue-comments`
- PERF-DETAIL-03: `postComment` (CommentComposer) invalidates `jira-issue-comments`

---

## Shared Patterns

### Token-Outside-Query-Key Convention
**Source:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 79-91
**Apply to:** All three new `useQuery` calls in IssueDetailPage, and any new service function
```typescript
queryFn: async () => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token || !jiraBaseUrl) throw new Error('No credentials');
  return fetchXxx(jiraBaseUrl, token, issueKey ?? '');
},
```
Token is read inside `queryFn` — never placed in `queryKey`.

### `useDelayedLoading` Flash-Prevention Gate
**Source:** `taskflow/src/hooks/useDelayedLoading.ts` (full file, 28 lines)
**Apply to:** Every new section query's skeleton gate
```typescript
// useDelayedLoading returns true only after 200ms of continuous pending state.
// Use isPending (TanStack Query v5 canonical) as input, not isLoading.
const showSkeleton = useDelayedLoading(query.isPending);

// Gate pattern from AioTestRunsSection.tsx line 628 + 668:
const showSkeleton = useDelayedLoading(stepsQuery.isLoading);  // isLoading also fine per RESEARCH note
if (showSkeleton || stepsQuery.isLoading) return <SectionSkeleton />;
```

### Per-Section ErrorState Pattern
**Source:** `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` lines 670-683
**Apply to:** Comments section, subtasks section, changelog/activity section
```typescript
if (query.isError) {
  return (
    <div className="p-4">
      <ErrorState
        error={query.error}
        onRetry={() =>
          void queryClient.invalidateQueries({ queryKey: [KEY, issueKey, jiraBaseUrl] })
        }
        viewName="comments"  // or "subtasks" / "activity"
      />
    </div>
  );
}
```

### staleTime Convention
**Source:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` line 90; worklogs query line 254
**Apply to:** All three new section queries
```typescript
staleTime: 30_000,   // matches base query and worklogs query
```

### apiFetch Service Function Pattern
**Source:** `taskflow/src/services/jira/comments.ts` lines 9-36
**Apply to:** New `fetchIssueChangelog` in `services/jira/changelog.ts`
```typescript
// Structure: try/catch around apiFetch for network errors
//            if (!response.ok) check with 401/403 → ApiError, else plain Error
import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

// apiFetch signature: apiFetch(provider, url, requestInit, operationName)
response = await apiFetch(
  'jira',
  url,
  { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  'Load Issue Detail',   // match existing operation name for consistency
);
```

### Mutation Invalidation Fan-Out
**Source:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 288-302 (worklog mutations invalidate 2 keys)
**Apply to:** All comment mutations (edit, delete, post)
```typescript
// Pattern: when a mutation affects data now split across multiple query keys,
// invalidate ALL affected keys in onSuccess / onSettled
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
  queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
},
```

---

## No Analog Found

All files have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/services/jira/`, `taskflow/src/hooks/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-30
