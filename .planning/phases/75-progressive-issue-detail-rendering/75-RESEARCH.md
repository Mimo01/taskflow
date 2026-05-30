# Phase 75: Progressive Issue Detail Rendering — Research

**Researched:** 2026-05-30
**Domain:** TanStack Query v5 progressive data fetching, React rendering patterns, Jira REST v2 query decomposition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split `fetchIssueDetail` into a slim base fetch + 3 independent follow-up queries. Base `/issue/{key}` carries header (title/key/status/assignee), description, custom fields, attachments, and issue links.
- **D-02:** Three independent follow-up queries:
  - **Comments** — `GET /rest/api/2/issue/{key}/comment`
  - **Subtasks (enriched)** — secondary JQL search for assignee enrichment (currently lines 1546-1574 of jira.ts)
  - **Changelog / activity** — separate request; remove `expand=changelog` from base
- **D-03:** Worklogs, epic stories, AIO test runs stay as-is (already independent).
- **D-04:** No over-splitting. Description / fields / attachments / links stay on the base fetch.
- **D-05:** Reserve layout space — each pending section shows a localized skeleton at roughly its final size. No content jump / layout shift.
- **D-06:** Every section skeleton gated through `useDelayedLoading(isPending, 200)`. Fast sections never flash a skeleton.
- **D-07:** Per-section inline error with retry affordance. One section failure does not blank the panel.
- **D-08:** Base issue fetch failure is the only exception — may blank the panel with a panel-level error.
- **D-09:** Apply to `IssueDetailPage` only. Epic branch benefits automatically via `IssueDetailContent`. Do not touch `IssueDetailSheet`.
- **Scope:** Stays entirely on Jira REST v2. No GreenHopper `details.json` migration.

### Claude's Discretion
- Exact query-key naming, hook structure (e.g. `use-issue-detail-sections` hook vs. inline queries), skeleton dimensions per section.
- Section render order in JSX is flexible as long as header paints first and each section is independently gated.
- Verification artifact (GH-CUT-02) should document which section gates "fully loaded."

### Deferred Ideas (OUT OF SCOPE)
- Delete dead `IssueDetailSheet` (legacy 75vw slide-out).
- Prefetch-on-hover for `/issue/:key` route.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-DETAIL-01 | Header (title, key, status, assignee) renders as soon as base issue fetch resolves, independently of comments/subtasks/changelog | Base query split + removal of global `isLoading` gate at line 377 |
| PERF-DETAIL-02 | Each section shows a localized skeleton while its own request is pending; no global blocking spinner | Push `isPending` down to section level; `useDelayedLoading` gates each skeleton |
| PERF-DETAIL-03 | All existing detail-panel features work unchanged on existing REST v2 paths | Full mutation/invalidation map below; each mutation must now invalidate both base key and relevant section key |
| GH-CUT-01 | Hard cutover per surface — detail panel stays on REST v2, not migrated | Locked by decision. No GreenHopper detail endpoint needed. |
| GH-CUT-02 | Perf verification artifact: before/after TTFMP and TTI, per-section latencies, which section gates "fully loaded" | Measurement approach documented below |
</phase_requirements>

---

## Summary

The phase dismantles a single global `isLoading || !issue` gate at `IssueDetailPage.tsx:377` that currently blocks the entire issue detail panel until all data — including the slow subtask-enrichment JQL and `expand=changelog` — resolves. The fix is a decomposition of `fetchIssueDetail` into four queries: one slim base fetch that carries the header and static fields, and three independent follow-ups (comments, enriched subtasks, changelog) that each show their own localized skeleton while pending.

The base REST v2 fetch already returns everything needed for the header, description, attachments, and issue links in a single round-trip — the only reason the panel blocks is that the current implementation appends a sequential subtask JQL search and embeds changelog via `expand=changelog` into the same call. Separating these three slow paths unlocks first paint of the entire top two-thirds of the issue detail immediately.

The highest-risk area is mutation/invalidation correctness. There are currently 10 call sites that invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]`. After the split, each mutation must invalidate the correct subset of the new query keys — invalidating only the base key when comments are modified will leave the comment section stale.

**Primary recommendation:** Introduce three new service functions (`fetchIssueComments`, `fetchEnrichedSubtasks`, `fetchIssueChangelog`) alongside three new `useQuery` calls with dedicated query keys, each consuming `useDelayedLoading`. Remove `comment` from the base fields list and remove `expand=changelog` from the base URL. Update all 10 mutation call sites.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Header render (title/key/status/assignee) | Frontend (React) | API/Jira REST | Unblocked by base fetch; must paint first |
| Base issue data (description, fields, attachments, links) | Frontend (React) | API/Jira REST | Already cheap in one call; stays on base query |
| Comments | Frontend (React) | API `/issue/{key}/comment` | Separate endpoint; slow on large threads |
| Enriched subtasks | Frontend (React) | API `/search?jql=key in (...)` | Secondary JQL; slow and sequential today |
| Changelog / activity | Frontend (React) | API `/issue/{key}?expand=changelog` or `/issue/{key}/changelog` | Large payload; slow on active issues |
| Worklogs | Frontend (React) | API `/issue/{key}/worklog` | Already independent (`jira-worklogs` key) |
| Per-section error isolation | Frontend (React) | — | `ErrorState` component already exists |
| Mutation invalidation | Frontend (React) | API write paths | Must fan out to newly split keys |

---

## Standard Stack

No new packages are installed for this phase. Everything is already present. [VERIFIED: package.json]

### Core (already installed)

| Library | Resolved Version | Purpose | Relevant to Phase |
|---------|-----------------|---------|-------------------|
| `@tanstack/react-query` | 5.91.2 | Query lifecycle, caching, invalidation | New `useQuery` calls per section |
| `react` | 19.1.0 | Component rendering | Section components |
| `vitest` | 4.0.18 | Test runner | jsdom environment, existing setup |
| `@testing-library/react` | (in devDeps) | Component render tests | Section unit tests |

[VERIFIED: package-lock.json, package.json]

### No New Packages Required

> The UI-SPEC confirmed no new shadcn components are needed. `Skeleton`, `ErrorState`, `Button`, `Alert` are all pre-existing. `useDelayedLoading` is pre-existing.

---

## Package Legitimacy Audit

> No new packages are installed in this phase. Section is N/A.

---

## Architecture Patterns

### System Architecture Diagram

```
User navigates to /issue/:key
        |
        v
IssueDetailPage mounts
        |
    [base query fires]
        |
    base resolves (fast)          follow-up queries fire in parallel
        |                        /            |             \
   HEADER PAINTS         comments query  subtask JQL    changelog query
   description,          resolves        resolves        resolves
   fields, links,            |               |               |
   attachments           COMMENTS        SUBTASKS        ACTIVITY
   all unmask            UNMASKS         UNMASKS         UNMASKS
   immediately
        |
   each section: isPending → useDelayedLoading(200ms) → Skeleton or null
   each section: isError  → ErrorState with onRetry=refetch
```

### Recommended Project Structure

No new top-level directories are needed. New files fit within existing structure:

```
src/
├── routes/dashboard/
│   ├── IssueDetailPage.tsx         # MODIFY: remove global gate, add 3 useQuery calls
│   └── IssueDetailContent.tsx      # MODIFY: accept enrichedSubtasks prop; add subtask skeleton
│   └── issue-detail/
│       ├── ActivityTimeline.tsx    # MODIFY: receive changelog from own query, not issue prop
│       ├── CommentsSection.tsx     # NEW: section with own skeleton + error
│       ├── SubtasksList.tsx        # NEW or MODIFY IssueDetailContent subtask block
│       ├── CommentsSkeleton.tsx    # NEW: per-section skeleton
│       ├── SubtasksSkeleton.tsx    # NEW: per-section skeleton
│       └── (existing files unchanged)
├── services/jira/
│   └── changelog.ts               # NEW: fetchIssueChangelog function
│   (comments.ts already exists with fetchComments)
│   (jira.ts: remove comment field + expand=changelog from fetchIssueDetail)
```

### Pattern 1: Section Query with Delayed Skeleton (established in AioTestRunsSection)

**What:** Each independently-loaded section declares its own `useQuery`, gates its skeleton with `useDelayedLoading`, and renders inline error on failure.

**When to use:** Every section whose data no longer comes from the base `['jira-issue-detail']` query.

**Example** (from `AioTestRunsSection.tsx` — confirmed working pattern):
```typescript
// Source: taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx:624-668
const stepsQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
  queryFn: async () => { /* ... */ },
  enabled: !!jiraBaseUrl && !!issueKey && !!aioEnabled,
});
const showSkeleton = useDelayedLoading(stepsQuery.isLoading);

if (showSkeleton || stepsQuery.isLoading) return <AioTestRunsSkeleton />;

if (stepsQuery.isError) {
  return (
    <div className="p-4">
      <ErrorState
        error={stepsQuery.error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: [...] })}
        viewName="AIO test runs"
      />
    </div>
  );
}
```
[VERIFIED: taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx lines 624-683]

### Pattern 2: Token-Outside-Query-Key Convention

**What:** `readSecret('jira-pat')` is called inside `queryFn`, never placed in `queryKey`.

**When to use:** All Jira queries in this codebase.

**Example:**
```typescript
// Correct — token read inside queryFn, key is [prefix, issueKey, jiraBaseUrl]
queryFn: async () => {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token || !jiraBaseUrl) throw new Error('No credentials');
  return fetchComments(jiraBaseUrl, token, issueKey ?? '');
},
```
[VERIFIED: IssueDetailPage.tsx lines 79-88 — established pattern]

### Pattern 3: gcTime Infinity (global default)

The `QueryClient` in `main.tsx` sets `gcTime: Infinity` globally. This means re-opening a recently-viewed issue will immediately show cached data for all sections without a skeleton. The `staleTime: 30_000` on individual queries controls background revalidation. New section queries should use `staleTime: 30_000` to match existing queries in the panel.

[VERIFIED: taskflow/src/main.tsx lines 55-63]

### Pattern 4: Optimistic Update in useFieldMutation

`useFieldMutation.ts` performs optimistic updates against `['jira-issue-detail', issueKey, jiraBaseUrl]` via `cancelQueries` + `setQueryData`. After the split, this pattern still targets the base query key because field values live in the base response. No change needed to the optimistic update target. [VERIFIED: useFieldMutation.ts lines 27-41]

### Anti-Patterns to Avoid

- **Removing `comment` from the base fields list without also moving the `comments` variable:** `IssueDetailPage.tsx` currently derives `comments` from `issue?.fields.comment?.comments ?? []` at line 127 and passes it to `ActivityTimeline`. After the split, `comments` must come from the new comments query result, not from `issue.fields`.
- **Passing changelog as `issue.changelog?.histories ?? []` after removing expand=changelog:** The base query will no longer return `changelog.histories`. `ActivityTimeline` receives `changelog` as a prop at line 413; the prop source must switch to the new changelog query data.
- **Double-invalidation cascade:** After the split, invalidating `['jira-issue-detail', issueKey, jiraBaseUrl]` no longer refreshes comments or changelog. Each mutation must also invalidate its relevant section key. Missing one key causes stale data.
- **Using `isLoading` instead of `isPending` for TanStack Query v5:** In TanStack Query v5, the semantically correct flag for "has no data yet" is `isPending` (not `isLoading` for new queries). `isLoading` = `isPending && fetchStatus === 'fetching'`. The AioTestRunsSection uses `stepsQuery.isLoading` which is fine for the first-load skeleton since `gcTime: Infinity` means cache hits are instant. Either works; `isPending` is preferred in v5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flash-prevention for quick cache hits | Custom delay logic | `useDelayedLoading(isPending, 200)` | Already in codebase and battle-tested |
| Skeleton shape | Ad-hoc CSS | `<Skeleton>` primitive with explicit `h-*` and `w-*` | Design system conformance |
| Section error with retry | Custom error div | `<ErrorState error={e} onRetry={fn} viewName="..." />` | Consistent error UX; already used by AIO section |
| Parallel queries | Promise.all in a single query | Multiple `useQuery` hooks | TanStack Query handles deduplication, caching, stale tracking per key |
| Changelog endpoint | New GreenHopper call | `GET /rest/api/2/issue/{key}?expand=changelog&fields=` (with minimal fields) or `GET /rest/api/2/issue/{key}/changelog` | Phase is locked to REST v2 (D-01/PERF-DETAIL-03) |

---

## Query Decomposition — Precise Specification

### Current `fetchIssueDetail` (jira.ts:1486-1577)

**What the single call does today:**

1. `GET /rest/api/2/issue/{key}?fields=summary,status,assignee,reporter,priority,customfield_13415,issuetype,project,description,comment,attachment,issuelinks,subtasks,labels,fixVersions,parent,timetracking,created,updated,duedate,{epicLink},{epicName},{sprint},{storyPoints},{epicColor}&expand=changelog`
2. If `issue.fields.subtasks.length > 0`: sequential `GET /rest/api/2/search?jql=key in ({subtaskKeys})&fields=assignee&maxResults={N}` to enrich subtask assignees (lines 1546-1574).

The `comment` field embeds the full comments array. The `expand=changelog` adds the full changelog history to the response body. These three additions (comments embedding, subtask JQL, expand=changelog) are the only slow paths.

[VERIFIED: taskflow/src/services/jira.ts lines 1486-1577]

### After Split — Four Queries

**Query 1 — Base** (replaces the existing `jira-issue-detail` key):
```
GET /rest/api/2/issue/{key}?fields=summary,status,assignee,reporter,priority,customfield_13415,
  issuetype,project,description,attachment,issuelinks,subtasks,labels,fixVersions,parent,
  timetracking,created,updated,duedate,{epicLink},{epicName},{sprint},{storyPoints},{epicColor}
```
Changes from today: **remove `comment` from fields list, remove `&expand=changelog`**.
The `subtasks` field stays on the base (it returns summary + status, which is enough to know how many subtasks exist for the skeleton placeholder count).

Query key: `['jira-issue-detail', issueKey, jiraBaseUrl]` — **same key as today**. All existing mutations that invalidate this key continue to work.

**Query 2 — Comments**:
```
GET /rest/api/2/issue/{key}/comment
```
`fetchComments` already exists in both `services/jira.ts:703` and `services/jira/comments.ts:9`. Use the existing function. [VERIFIED: services/jira/comments.ts lines 9-36]

Query key: `['jira-issue-comments', issueKey, jiraBaseUrl]`

**Query 3 — Enriched Subtasks**:
```
GET /rest/api/2/search?jql=key in ({subtaskKeys})&fields=assignee&maxResults={N}
```
This is the sequential call currently embedded at jira.ts:1546-1574. Extract to a new `fetchEnrichedSubtasks(baseUrl, token, subtaskKeys)` function in `services/jira/` (or `services/jira.ts`). The base query's `fields.subtasks` provides the keys to enrich; the enriched result merges assignees back.

Query key: `['jira-subtask-enrichment', issueKey, jiraBaseUrl]`

Enable condition: `enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected && (issue?.fields.subtasks?.length ?? 0) > 0`

**Query 4 — Changelog**:
Option A (minimal change): Use `GET /rest/api/2/issue/{key}?expand=changelog&fields=` (empty fields, or `fields=summary` to minimize payload, just to get the `changelog` in the response body).
Option B (cleaner): Use `GET /rest/api/2/issue/{key}/changelog` — the dedicated pagination endpoint introduced in Jira REST v2 that returns `{ values: ChangelogHistory[], ... }`. [ASSUMED — this endpoint exists on Jira Server 8+ but exact availability on older on-prem versions should be confirmed.]

Recommendation: **Option A is safer for on-prem compatibility**. The `expand=changelog` approach is already proven to work in this codebase. Add a thin `fetchIssueChangelog(baseUrl, token, issueKey)` function.

Query key: `['jira-issue-changelog', issueKey, jiraBaseUrl]`

---

## Mutation / Invalidation Impact (PERF-DETAIL-03) — Complete Map

This is the highest-risk area. After the query split, mutating comments or changelog-affecting operations must invalidate the correct new keys.

### Current State — All 10 Call Sites

| File | Line(s) | Operation | Current key invalidated |
|------|---------|-----------|------------------------|
| `IssueDetailPage.tsx` | 174 | Comment edit (`updateComment`) | `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `IssueDetailPage.tsx` | 189 | Comment delete (`deleteComment`) | `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `IssueDetailPage.tsx` | 288-289 | Worklog edit (`updateWorklog`) | `['jira-issue-detail', ...]` + `['jira-worklogs', ...]` |
| `IssueDetailPage.tsx` | 301-302 | Worklog delete (`deleteWorklog`) | `['jira-issue-detail', ...]` + `['jira-worklogs', ...]` |
| `CommentComposer.tsx` | 89 | Post comment (`postComment`) | `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `useFieldMutation.ts` | 48 | Field edit (`updateIssueField`) — optimistic | `['jira-issue-detail', ...]` + board/backlog keys |
| `FieldsSection.tsx` | 261, 288 | Status change / sprint move | `['jira-issue-detail', ...]` + board/sprint/epics/version keys |
| `AttachmentsSection.tsx` | 54 | Attachment drop upload | `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `AttachmentUpload.tsx` | 33 | Attachment file input upload | `['jira-issue-detail', issueKey, jiraBaseUrl]` |
| `IssueDetailContent.tsx` | 68 | Attachment delete | `['issue-detail', issueKey]` ← **note: different key format** |
| `BacklogPage.tsx` | 698, 732 | Sprint move / backlog move | `['jira-issue-detail']` (prefix-only invalidation) |
| `WatcherToggle.tsx` | 66 | Watch / unwatch | `['jira-watchers', issueKey]` only — no issue-detail invalidation |

[VERIFIED: grep results across all files listed]

### Required State After Split

| Operation | Must Also Invalidate After Split | Reason |
|-----------|----------------------------------|--------|
| Comment edit | + `['jira-issue-comments', issueKey, jiraBaseUrl]` | Comments now in separate cache key |
| Comment delete | + `['jira-issue-comments', issueKey, jiraBaseUrl]` | Same |
| Post comment (CommentComposer) | + `['jira-issue-comments', issueKey, jiraBaseUrl]` | Same |
| Attachment upload / delete | `['jira-issue-detail', ...]` base only — attachments stay on base | No change needed |
| Field edit / optimistic | `['jira-issue-detail', ...]` base only | Field values on base |
| Status change (FieldsSection) | `['jira-issue-detail', ...]` base; also `['jira-issue-changelog', ...]` because a status transition creates a changelog entry | |
| Worklog edit/delete | `['jira-worklogs', ...]` only; `['jira-issue-changelog', ...]` if worklogs appear in changelog | Worklogs are in the independent worklogs query already; changelog should refresh |
| `IssueDetailContent.tsx:68` (attachment delete) | Fix the `['issue-detail', issueKey]` (wrong format — missing `jiraBaseUrl`) to `['jira-issue-detail', issueKey, jiraBaseUrl]` | Pre-existing key mismatch; fix as part of this phase |
| BacklogPage sprint move | `['jira-issue-detail']` prefix invalidation already covers all sub-keys — no change needed | Prefix match invalidates all keys starting with `'jira-issue-detail'` |

**Key insight on BacklogPage:** `queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] })` uses prefix matching — it invalidates ANY cached query whose key starts with `'jira-issue-detail'`. After the split the new keys (`jira-issue-comments`, `jira-subtask-enrichment`, `jira-issue-changelog`) do NOT start with `'jira-issue-detail'`, so BacklogPage's sprint/backlog moves will NOT automatically refresh comments or changelog. However, this is acceptable: moving an issue to a sprint does not change its comments or changelog — those sections don't need to refresh.

**WatcherToggle:** Already isolated to `['jira-watchers', issueKey]` — no changes needed.

---

## Skeleton/Error Pattern — Precise Implementation Guide

### ActivityTimeline — Already Has a Skeleton (Unreachable Today)

`ActivityTimeline.tsx` checks `if (changelog === undefined)` at line 123 and renders a 3-row skeleton. Currently unreachable because `IssueDetailPage` passes `issue.changelog?.histories ?? []` (never undefined). After the split, the changelog query starts as `undefined` data, so the `changelog === undefined` path becomes reachable. No new skeleton needed — just pass `changelogQuery.data` (which is `undefined` while pending) instead of `issue.changelog?.histories ?? []`.

However: the `useDelayedLoading` gate is missing from `ActivityTimeline`'s current skeleton. The 200ms gate must be applied before passing `changelog` down: if `changelogDelayed` (from `useDelayedLoading`) is false, pass an empty array `[]` to suppress the skeleton; once `changelogDelayed` is true, pass `undefined` to trigger the skeleton. Alternatively, move the skeleton rendering out of `ActivityTimeline` and into `IssueDetailPage` wrapper, consistent with other sections.

[VERIFIED: ActivityTimeline.tsx lines 122-131]

### New Skeletons Required

Per UI-SPEC and D-05:

**CommentsSkeleton** (new file):
```typescript
// Pattern: match AioTestRunsSkeleton shape
export function CommentsSkeleton() {
  return (
    <div className="space-y-3" data-testid="comments-skeleton">
      <Skeleton className="h-6 w-32" />   {/* heading */}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
```

**SubtasksSkeleton** (new file or inline):
```typescript
export function SubtasksSkeleton() {
  return (
    <div className="space-y-2" data-testid="subtasks-skeleton">
      <Skeleton className="h-6 w-40" />   {/* heading */}
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
```

[CITED: 75-UI-SPEC.md Skeleton Dimensions Per Section table]

### ErrorState Usage

All section errors use the pre-existing `ErrorState` component with `viewName` set to the section name string:
```typescript
<ErrorState error={query.error} onRetry={refetch} viewName="comments" />
<ErrorState error={query.error} onRetry={refetch} viewName="subtasks" />
<ErrorState error={query.error} onRetry={refetch} viewName="activity" />
```

Copy strings from the Copywriting Contract in UI-SPEC: "Couldn't load {viewName}" is the `ErrorState` format. [VERIFIED: error-state.tsx referenced in UI-SPEC.md:98]

---

## Verification / Measurement (GH-CUT-02)

### What to Measure

The verification artifact must record:
1. **Time-to-first-meaningful-paint** — wall clock from navigation start to header visible in DOM
2. **Time-to-fully-interactive** — wall clock from navigation start to slowest section (comments or changelog) resolved
3. **Per-section latencies** — individual query resolution times
4. **Which section gates "fully loaded"** — document in the artifact

### Measurement Approach for This Codebase

The app is a Tauri desktop app (not a browser URL navigation pattern with navigation timing). The `performance.now()` API is available in the WebView. The simplest fit-for-purpose approach:

**Inline `performance.mark` / `performance.measure` calls:**
```typescript
// At the start of the component mount
performance.mark('issue-detail-start');

// When base query resolves (in useEffect watching !issue)
useEffect(() => {
  if (issue && !baseResolved.current) {
    performance.mark('issue-detail-header-paint');
    performance.measure('TTFMP', 'issue-detail-start', 'issue-detail-header-paint');
    baseResolved.current = true;
  }
}, [issue]);

// When all sections are resolved
useEffect(() => {
  if (issue && commentsResolved && changelogResolved && subtasksResolved) {
    performance.mark('issue-detail-fully-loaded');
    performance.measure('TTI', 'issue-detail-start', 'issue-detail-fully-loaded');
  }
}, [issue, commentsResolved, changelogResolved, subtasksResolved]);
```

Log the measures via `console.table(performance.getEntriesByType('measure'))`.

**For the verification artifact:** Capture before/after screenshots of the DevTools network timeline + the console table output. Record the measures at two points in the development cycle (before the split and after). The verification artifact is a `.md` file documenting the numbers.

**Which section gates "fully loaded":** In practice, changelog (the heaviest expand payload) was the last to arrive before the split. After the split it will still be the last independent query to resolve. Document this in the artifact.

[ASSUMED — specific latency numbers will vary by Jira instance and network conditions; the pattern is proven standard]

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update the `comments` Derivation

**What goes wrong:** `IssueDetailPage.tsx:127` derives `const comments: JiraComment[] = issue?.fields.comment?.comments ?? []`. This derivation is used by `useMentionUserMap` (line 155), `commentTexts` memo (line 154), and passed to `ActivityTimeline` (line 412). After removing `comment` from the base fields, `issue.fields.comment` will be undefined and `comments` will always be `[]`.

**How to avoid:** Replace the derivation with `commentsQuery.data ?? []`. Update all three downstream usages.

**Warning signs:** Existing comments not appearing after the split.

### Pitfall 2: ActivityTimeline `changelog` Prop Type Mismatch

**What goes wrong:** `ActivityTimeline` currently receives `changelog={issue.changelog?.histories ?? []}` — always a non-null array. The existing skeleton only fires when `changelog === undefined`. If you pass `changelogQuery.data ?? []` instead of `changelogQuery.data` (undefined while pending), the skeleton never shows.

**How to avoid:** Pass `changelogQuery.data` (raw, possibly `undefined`) to `ActivityTimeline`. Update the prop type from `ChangelogHistory[]` to `ChangelogHistory[] | undefined`. The existing skeleton guard handles it.

**Warning signs:** Activity section shows no skeleton while changelog loads, then content pops in.

### Pitfall 3: `IssueDetailContent.tsx:68` Wrong Key Format

**What goes wrong:** The attachment delete handler invalidates `['issue-detail', issueKey]` (line 68) — missing `jiraBaseUrl` and using a different prefix. This is a pre-existing bug (it invalidates nothing because no query uses that key). This phase should fix it as part of the touch to `IssueDetailContent`.

**How to avoid:** Change to `['jira-issue-detail', issueKey, jiraBaseUrlFromStore]`.

### Pitfall 4: Subtask Enrichment Query Racing the Base Query

**What goes wrong:** The subtask enrichment query uses `enabled: ... && (issue?.fields.subtasks?.length ?? 0) > 0`. If the base query data is not yet resolved, `issue` is undefined, and the enrichment query never fires. This is correct — but the enrichment query must use `issueKey` in its query key, not a derived subtask key list, because TanStack Query keys must be stable at hook-call time.

**How to avoid:** Keep the subtask enrichment query enabled on `issue !== undefined && issue.fields.subtasks.length > 0`. The JQL with subtask keys is constructed inside the `queryFn`, not in the key. Query key stays `['jira-subtask-enrichment', issueKey, jiraBaseUrl]`.

### Pitfall 5: Double Render on Base Query Cache Hit

**What goes wrong:** With `gcTime: Infinity`, re-opening a recently-viewed issue returns base data synchronously (status `success`, no `isPending`). If the 200ms delayed skeleton is not gated properly, sections that are also cached will flash briefly before the `useDelayedLoading` timer fires.

**How to avoid:** `useDelayedLoading(isPending, 200)` already handles this correctly — it only starts the timer when `isPending` is true. If data is cached, `isPending` is false immediately and the skeleton is never shown. The critical correctness point is using `isPending` (not `isLoading`) for the delayed loading input.

### Pitfall 6: Base Query `staleTime` vs Section Query `staleTime`

**What goes wrong:** Current base query has `staleTime: 30_000`. If new section queries use a different `staleTime`, they may refetch at different intervals, causing one section to refresh while others stay stale.

**How to avoid:** All new section queries should use `staleTime: 30_000` to match the base query pattern for this panel.

---

## Code Examples

### Verified Pattern: Independent Section with Delayed Skeleton

```typescript
// Source: AioTestRunsSection.tsx lines 624-683
const stepsQuery = useQuery({
  queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
  queryFn: async () => { ... },
  staleTime: 30_000,
  enabled: !!jiraBaseUrl && !!issueKey && !!aioEnabled,
});
const showSkeleton = useDelayedLoading(stepsQuery.isLoading);

if (showSkeleton || stepsQuery.isLoading) return <AioTestRunsSkeleton />;
if (stepsQuery.isError) return <ErrorState ... />;
```

### New Comments Query (recommended shape)

```typescript
// IssueDetailPage.tsx — new query alongside existing base query
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
const showCommentsSkeleton = useDelayedLoading(commentsQuery.isPending);
```

### New Changelog Query (recommended shape)

```typescript
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

### New Subtask Enrichment Query (recommended shape)

```typescript
const subtaskEnrichmentQuery = useQuery({
  queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) return [];
    const subtasks = issue?.fields.subtasks ?? [];  // read from base query cache
    if (subtasks.length === 0) return [];
    return fetchEnrichedSubtasks(jiraBaseUrl, token, subtasks);
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected && (issue?.fields.subtasks?.length ?? 0) > 0,
});
```

### New `fetchIssueChangelog` function

```typescript
// src/services/jira/changelog.ts (new file)
export async function fetchIssueChangelog(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<ChangelogHistory[]> {
  const base = baseUrl.replace(/\/$/, '');
  // Use expand=changelog with minimal fields to get just the changelog payload
  const url = `${base}/rest/api/2/issue/${issueKey}?expand=changelog&fields=summary`;
  const response = await apiFetch('jira', url,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    'Load Issue Changelog',
  );
  if (!response.ok) throw new Error(`Failed to fetch changelog for ${issueKey}: ${response.status}`);
  const data = await response.json() as { changelog?: { histories: ChangelogHistory[] } };
  return data.changelog?.histories ?? [];
}
```

[ASSUMED — API shape confirmed in existing codebase; function signature is new]

### New `fetchEnrichedSubtasks` function

```typescript
// Extract from jira.ts:1546-1574 into standalone function
export async function fetchEnrichedSubtasks(
  baseUrl: string,
  token: string,
  subtasks: Array<{ key: string; fields: { summary: string; status: { name: string; statusCategory: unknown }; assignee: unknown } }>,
): Promise<typeof subtasks> {
  const base = baseUrl.replace(/\/$/, '');
  const subtaskKeys = subtasks.map((s) => s.key).join(',');
  const enrichJql = encodeURIComponent(`key in (${subtaskKeys})`);
  const url = `${base}/rest/api/2/search?jql=${enrichJql}&fields=assignee&maxResults=${subtasks.length}`;
  const enrichRes = await apiFetch('jira', url,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    'Load Issue Detail',
  );
  if (!enrichRes.ok) return subtasks;  // non-critical: return unenriched
  const enrichData = (await enrichRes.json()) as { issues: Array<{ key: string; fields: { assignee: unknown } }> };
  const assigneeMap = new Map(enrichData.issues.map((i) => [i.key, i.fields.assignee]));
  return subtasks.map((sub) => ({
    ...sub,
    fields: { ...sub.fields, assignee: assigneeMap.get(sub.key) ?? sub.fields.assignee },
  }));
}
```

[VERIFIED: extracted from jira.ts:1546-1574]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cacheTime` option | `gcTime` option | TanStack Query v5 | Rename only; semantics unchanged |
| `isLoading` for first-load guard | `isPending` preferred in v5 | TanStack Query v5 | `isLoading` still works but `isPending` is canonical |
| `useQuery({ onSuccess })` callbacks | Moved to `useEffect` watching data | TanStack Query v5 | Callbacks removed from query options in v5 |

**Deprecated/outdated:**
- `onSuccess` / `onError` callbacks in `useQuery`: Removed in TanStack Query v5. Use `useEffect` to react to query state changes. (Not used in this codebase for issue detail; this note is for awareness if new effects are needed.)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /rest/api/2/issue/{key}/changelog` dedicated endpoint exists on the on-prem Jira Server version in use | Query Decomposition — changelog option B | If not available, must use option A (expand=changelog with minimal fields) — low impact, option A works already |
| A2 | `fetchIssueChangelog` using `expand=changelog&fields=summary` returns the full changelog without including unnecessary fields in the payload | Code Examples | If Jira ignores `fields=` when `expand=changelog` is set, the payload is slightly larger — no correctness impact |
| A3 | Specific before/after latency numbers for the verification artifact | Verification section | Numbers will vary by Jira instance; the measurement mechanism is sound |

---

## Open Questions

1. **Changelog endpoint compatibility**
   - What we know: `GET /rest/api/2/issue/{key}?expand=changelog` works today (proven in the current codebase)
   - What's unclear: Whether the `/changelog` sub-resource endpoint is available on this specific on-prem Jira Server version
   - Recommendation: Use option A (expand=changelog with minimal fields) — proven, zero risk

2. **`useMentionUserMap` dependency on comments**
   - What we know: `IssueDetailPage.tsx:155` calls `useMentionUserMap(initialUserMap, commentTexts, jiraBaseUrl)`. `commentTexts` is derived from `comments`. After the split, `comments` comes from `commentsQuery.data ?? []`.
   - What's unclear: Whether `useMentionUserMap` is called unconditionally or conditionally. It must be called unconditionally (Rules of Hooks). Passing `[]` on initial load is fine — the mention map builds up as comments load.
   - Recommendation: No change needed; `commentsQuery.data ?? []` works as input to the memo.

3. **`initialUserMap` memo includes comment authors**
   - What we know: `IssueDetailPage.tsx:137-152` builds `initialUserMap` from `Assignee`, `Reporter`, and `comments` authors. On initial load, `comments` will be `[]`.
   - What's unclear: Whether losing comment authors from the initial mention map causes any visible regression in the wiki renderer.
   - Recommendation: The mention map is progressively populated; any @mentions in description will resolve once comments load and the memo re-runs. Acceptable behavior.

---

## Environment Availability

> Step 2.6: SKIPPED — this phase is purely code changes to existing service/component files. No new external dependencies, CLIs, databases, or runtimes beyond the project's existing Tauri + Vite + Node.js stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm run test` (from `taskflow/`) |
| Full suite command | `npm run test` (from `taskflow/`) |
| Environment | jsdom |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-DETAIL-01 | Header section renders when base query resolves, before comments query resolves | unit | `npm run test -- --reporter=verbose` targeting new test | ❌ Wave 0 |
| PERF-DETAIL-02 | Comments section shows skeleton when commentsQuery isPending; subtasks section shows skeleton when enrichmentQuery isPending | unit | same | ❌ Wave 0 |
| PERF-DETAIL-02 | ActivityTimeline receives `undefined` changelog and shows its built-in skeleton | unit | same | ❌ Wave 0 |
| PERF-DETAIL-02 | `useDelayedLoading` gates skeleton — skeleton not shown if query resolves within 200ms | existing test in `useDelayedLoading` | `npm run test` | ✅ (hook tested) |
| PERF-DETAIL-03 | Comment edit mutation invalidates both `jira-issue-detail` and `jira-issue-comments` | unit | `npm run test` | ❌ Wave 0 |
| PERF-DETAIL-03 | Post comment mutation invalidates `jira-issue-comments` | unit | `npm run test` | ❌ Wave 0 |
| PERF-DETAIL-03 | Field edit (useFieldMutation) still performs optimistic update against base query key | existing FieldsSection.test.tsx | `npm run test` | ✅ (check passes) |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` — covers PERF-DETAIL-01, 02, 03 with mocked query responses

*(The AioTestRunsSection.test.tsx serves as a shape reference for how to test a section with delayed skeleton and error state.)*

---

## Security Domain

> PERF-DETAIL-03 locks all writes on existing REST v2 paths. No new auth flows, no new credential handling, no new input validation beyond what already exists. The new `fetchComments`, `fetchEnrichedSubtasks`, and `fetchIssueChangelog` functions follow the exact same `apiFetch` + Bearer token pattern as all other service functions. No new ASVS categories are introduced.

ASVS categories not applicable to this phase: V2, V3, V4, V6. V5 (input validation): the new fetch functions receive `issueKey` and `jiraBaseUrl` from the same validated sources as all existing queries.

---

## Sources

### Primary (HIGH confidence)
- `taskflow/src/services/jira.ts` lines 1486-1577 — exact `fetchIssueDetail` implementation, field list, JQL enrichment block
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 77-92, 127, 154-155, 170-194, 247-302, 377-379, 412-413 — query structure, all mutation/invalidation call sites, global gate
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` lines 624-683 — canonical per-section loading pattern
- `taskflow/src/hooks/useDelayedLoading.ts` — complete implementation
- `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` — optimistic update pattern
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.tsx` lines 122-131 — existing changelog skeleton
- `taskflow/src/routes/dashboard/CommentComposer.tsx` line 89 — comment post invalidation
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` lines 237-293 — field mutation and status change invalidations
- `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx` line 54, `AttachmentUpload.tsx` line 33 — attachment upload invalidations
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` line 68 — pre-existing wrong key format
- `taskflow/src/routes/dashboard/BacklogPage.tsx` lines 698, 732 — prefix invalidation
- `taskflow/src/main.tsx` lines 55-63 — global `gcTime: Infinity` default
- `taskflow/package-lock.json` — TanStack Query v5.91.2 resolved version
- `taskflow/vitest.config.ts` — test configuration

### Secondary (MEDIUM confidence)
- `75-CONTEXT.md` decisions D-01 through D-09 — locked user decisions
- `75-UI-SPEC.md` — skeleton dimensions, error copy, component inventory

### Tertiary (LOW confidence)
- A3: Specific latency numbers — will be measured during execution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package-lock.json
- Architecture/decomposition: HIGH — verified against actual source code
- Mutation/invalidation map: HIGH — grepped all call sites exhaustively
- Pitfalls: HIGH — discovered from reading actual code, not assumptions
- Measurement approach: MEDIUM — Performance API availability in Tauri WebView assumed standard; no specific test run

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable stack, no fast-moving dependencies)
