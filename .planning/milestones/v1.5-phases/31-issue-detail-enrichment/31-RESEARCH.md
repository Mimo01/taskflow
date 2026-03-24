# Phase 31: Issue Detail Enrichment - Research

**Researched:** 2026-03-22
**Domain:** Jira REST API v2 (changelog, watchers), React UI (timeline, badges, clone)
**Confidence:** HIGH

## Summary

Phase 31 enriches the issue detail page with five capabilities: (1) a unified activity timeline merging changelog history and comments, (2) timeline filtering by type, (3) comment edit/delete (already implemented -- D-12), (4) watcher toggle with count, and (5) overdue badges + issue cloning. The existing codebase already uses the `expand=changelog` pattern in `notifications.ts`, providing a proven template for changelog fetching. Watchers use a straightforward REST endpoint. The clone feature leverages the existing `CreateEditIssueModal` with pre-filled `EditInitialValues`.

The main engineering challenge is the activity timeline: merging two different data shapes (changelog histories with nested items, and comment objects) into a single chronological stream, then rendering them with distinct visual treatments (compact for field changes, card-style for comments). The existing `CommentThread` and `CommentCard` components in `IssueDetailPage.tsx` provide the comment rendering -- these get absorbed into the new timeline component.

**Primary recommendation:** Build a new `changelog.ts` and `watchers.ts` service module following the existing 14-module Jira service pattern, create an `ActivityTimeline` component that replaces the existing `CommentThread` section, and add an `OverdueBadge` utility component reused across 3+ pages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Replace the existing Comments section with a unified Activity timeline that merges changelog entries (field changes, status transitions) and comments chronologically
- **D-02:** Comments render as full card-style entries (existing card design). Field changes render as compact single-line entries with muted text -- like GitHub's issue timeline pattern
- **D-03:** Default sort order is newest-first (consistent with existing commentSortOrder default)
- **D-04:** Comment composer remains sticky at bottom of the timeline area
- **D-05:** Filter controls are toggle chips (pill-shaped) in a row above the timeline: [All (24)] [Changes (16)] [Comments (8)]
- **D-06:** Each chip shows its count per type -- gives instant activity breakdown
- **D-07:** Active chip is highlighted (use Badge component with outline variant). Easy to extend with [Worklogs] chip in Phase 32
- **D-08:** Watch/unwatch toggle appears as a sidebar field row alongside Status, Assignee, Priority etc. -- eye icon + watcher count + click to toggle
- **D-09:** Overdue badge (red "Overdue" badge) appears everywhere due date is shown: issue detail sidebar, sprint board cards (TaskRow), backlog rows, and search results
- **D-10:** Clone button opens the existing CreateEditIssueModal pre-filled with source issue fields (summary prefixed "Clone - ", description, labels, priority, assignee). User can review/modify before saving.
- **D-11:** Clone button placed in the action bar alongside Pin, Edit, and Open in Jira buttons
- **D-12:** Comment edit/delete (DETAIL-03, DETAIL-04) are already fully implemented in IssueDetailPage.tsx -- no new work needed

### Claude's Discretion
- Loading states for changelog API fetch
- Changelog entry grouping (whether to group rapid consecutive field changes)
- Exact overdue badge styling and threshold behavior
- Icon choices for timeline entry types

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DETAIL-01 | User can view unified activity timeline on issue detail (changelog + comments merged chronologically) | Jira `expand=changelog` API pattern already used in `notifications.ts`; new `changelog.ts` service + `ActivityTimeline` component |
| DETAIL-02 | User can filter activity timeline by type (field changes / comments / worklogs) | Client-side filter on merged timeline array; toggle chip UI with Badge component |
| DETAIL-03 | User can edit own comments on issues | Already implemented (D-12) -- `CommentCard` in `IssueDetailPage.tsx` has edit inline with `updateComment` mutation |
| DETAIL-04 | User can delete own comments on issues | Already implemented (D-12) -- `CommentCard` has 3-dot menu with delete + confirmation |
| DETAIL-05 | User can watch/unwatch issues with eye icon toggle and watcher count | New `watchers.ts` service module + sidebar field row in `FieldsSection.tsx` |
| DETAIL-10 | User sees overdue badge on issues where due date has passed | New `OverdueBadge` component using `duedate` field; add to `FieldsSection`, `TaskRow`, `BacklogRow` |
| DETAIL-11 | User can clone an issue (copies summary, description, labels, priority, assignee) | Open `CreateEditIssueModal` in create mode with pre-filled `EditInitialValues` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | (already installed) | Data fetching, caching, mutations | Already used for all Jira/GitLab API calls |
| lucide-react | (already installed) | Icons (Eye, EyeOff, Copy, GitCommit etc.) | Already used throughout the app |
| shadcn/ui Badge | (already installed) | Filter chips and overdue badge | Already used in BacklogRow, IssueDetailContent |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns (none -- use native) | N/A | Date comparison for overdue | Native `Date` comparison is sufficient; app already uses `new Date()` comparisons |

No new packages are required for this phase. Everything needed is already installed.

## Architecture Patterns

### New Files
```
taskflow/src/services/jira/
  changelog.ts          # fetchChangelog(baseUrl, token, issueKey) -> ChangelogHistory[]
  changelog.test.ts     # Unit tests following comments.test.ts pattern
  watchers.ts           # fetchWatchers, addWatcher, removeWatcher
  watchers.test.ts      # Unit tests

taskflow/src/routes/dashboard/issue-detail/
  ActivityTimeline.tsx   # Main timeline component (replaces CommentThread)
  TimelineFilterChips.tsx # [All] [Changes] [Comments] toggle chips
  ChangelogEntry.tsx     # Compact single-line field change entry
  OverdueBadge.tsx       # Shared overdue badge component
```

### Pattern 1: Jira Service Module
**What:** Each Jira domain gets its own focused file in `services/jira/` with barrel re-export via `index.ts`
**When to use:** Any new Jira API endpoint
**Example:**
```typescript
// Source: existing pattern in services/jira/comments.ts
import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';

export async function fetchWatchers(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<{ isWatching: boolean; watchCount: number }> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/watchers`;
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}` },
  }, 'Load Issue Detail');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch watchers for ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch watchers: ${response.status}`);
  }
  const data = await response.json();
  return { isWatching: data.isWatching, watchCount: data.watchCount };
}
```

### Pattern 2: Changelog Expand on Existing Issue Fetch
**What:** Add `expand=changelog` to the existing `fetchIssueDetail` call in `issues.ts` rather than making a separate API call
**When to use:** When changelog data is always needed on the detail page
**Why:** One HTTP request instead of two. The existing `fetchIssueDetail` already fetches 18+ fields; adding `expand=changelog` adds the changelog to the same response. The notifications service already uses this exact pattern (`&expand=changelog`).
**Example:**
```typescript
// In issues.ts fetchIssueDetail, change:
const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}`;
// To:
const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}&expand=changelog`;
```
**Note:** The `JiraIssueDetail` type needs a `changelog` property added. Keep the changelog service module for type definitions and any helper functions (parsing, merging with comments).

### Pattern 3: Timeline Entry Union Type
**What:** Normalize changelog histories and comments into a discriminated union sorted by timestamp
**When to use:** Merging heterogeneous timeline data
**Example:**
```typescript
type TimelineEntry =
  | { type: 'comment'; timestamp: string; data: JiraComment }
  | { type: 'change'; timestamp: string; data: ChangelogHistory };

function mergeTimeline(
  comments: JiraComment[],
  histories: ChangelogHistory[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...comments.map(c => ({ type: 'comment' as const, timestamp: c.created, data: c })),
    ...histories.map(h => ({ type: 'change' as const, timestamp: h.created, data: h })),
  ];
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
```

### Pattern 4: Optimistic Watcher Toggle
**What:** Use the existing `useFieldMutation` pattern for watcher toggle -- optimistic update on click, rollback on error
**When to use:** Toggle actions that should feel instant
**Note:** Watchers use a different endpoint (`/watchers`) than field updates (`PUT /issue/{key}`), so this needs a dedicated mutation hook, but following the same optimistic pattern from `useFieldMutation.ts`.

### Pattern 5: Clone via Existing Modal
**What:** Open `CreateEditIssueModal` in `create` mode with `initialValues` pre-filled from source issue
**When to use:** Clone button click
**Example:**
```typescript
// In IssueDetailContent action bar:
const handleClone = () => {
  openEdit({  // Note: despite the name, this opens the modal
    issueKey: '',  // Empty = create mode
    summary: `Clone - ${issue.fields.summary}`,
    description: issue.fields.description ?? '',
    assigneeName: issue.fields.assignee?.name ?? null,
    priority: issue.fields.priority?.name ?? null,
    storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
    epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
  });
};
```
**Important:** The `EditInitialValues` interface currently has `issueKey` as required. For clone, pass the values but open modal in `create` mode. The modal's `mode` prop already supports `'create' | 'edit'`. A new `openClone` callback may be needed alongside `openEdit` to pass `mode: 'create'` with initial values. Labels are NOT currently in `EditInitialValues` and may need adding.

### Anti-Patterns to Avoid
- **Separate changelog API call:** Do NOT fetch changelog in a separate request. Use `expand=changelog` on the existing issue detail fetch.
- **Re-implementing comment edit/delete:** DETAIL-03 and DETAIL-04 are already done. Do not rebuild them.
- **Sorting changelog server-side assumption:** Jira does NOT guarantee changelog history order. Always sort client-side by `created` timestamp.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Issue creation form | Custom clone form | Existing `CreateEditIssueModal` with pre-fill | Already handles createmeta discovery, field validation, issue types |
| Date comparison for overdue | Complex timezone-aware date math | Simple `new Date(duedate) < new Date()` | Due dates are "YYYY-MM-DD" strings; app already uses this pattern in `ReleasesTab.tsx` |
| Comment CRUD | New comment service | Existing `comments.ts` functions | Already complete with error handling, ApiError |
| Field mutation pattern | Custom optimistic update logic | Follow `useFieldMutation.ts` pattern | Handles optimistic update + rollback + cache invalidation |

## Common Pitfalls

### Pitfall 1: Changelog History Sort Order
**What goes wrong:** Displaying timeline entries in wrong order because Jira returns unsorted histories
**Why it happens:** Jira REST API does not guarantee sort order of changelog histories across versions
**How to avoid:** Always sort merged timeline entries by timestamp client-side
**Warning signs:** Timeline entries appear out of chronological order

### Pitfall 2: Changelog Items Grouped in History
**What goes wrong:** Treating each `history.items[]` entry as having its own timestamp
**Why it happens:** A single changelog history entry can contain multiple items (e.g., status + assignee changed at once)
**How to avoid:** Group by `history.created` -- multiple items within one history share the same timestamp and author
**Warning signs:** Duplicate timestamps or scattered entries that should be grouped

### Pitfall 3: Clone Modal Mode vs. Initial Values
**What goes wrong:** Modal opens in edit mode instead of create mode when cloning
**Why it happens:** The existing `openEdit` callback implies edit mode. Clone needs create mode with pre-filled values.
**How to avoid:** Add a separate callback or parameter to distinguish clone (create mode + initial values) from edit
**Warning signs:** Clone attempts to PUT update the source issue instead of POST creating a new one

### Pitfall 4: Watcher API Body Format
**What goes wrong:** POST/DELETE watcher calls fail with 400
**Why it happens:** Jira DC watchers POST body is a plain JSON string (the username), not an object. `POST /watchers` expects `"username"` as the raw body.
**How to avoid:** Send `JSON.stringify(username)` as body, not `JSON.stringify({ name: username })`
**Warning signs:** 400 Bad Request on watcher add/remove

### Pitfall 5: Overdue Badge on Done Issues
**What goes wrong:** Completed issues show "Overdue" badge even though they're done
**Why it happens:** Only checking `duedate < now()` without considering status
**How to avoid:** Only show overdue badge when `duedate < now() AND statusCategory !== 'done'`
**Warning signs:** Resolved/closed issues showing red overdue badges

### Pitfall 6: Missing Labels in EditInitialValues
**What goes wrong:** Clone loses labels because `EditInitialValues` doesn't include them
**Why it happens:** The current interface was designed for edit (where labels are already on the issue), not clone
**How to avoid:** Either extend `EditInitialValues` to include `labels` or handle label pre-fill separately
**Warning signs:** Cloned issues missing labels from source

## Code Examples

### Changelog API Response Shape
```typescript
// Source: existing usage in notifications.ts lines 159-169
// Response from GET /rest/api/2/issue/{key}?expand=changelog
interface ChangelogResponse {
  changelog: {
    histories: Array<{
      id: string;
      created: string;  // ISO 8601
      author: {
        displayName: string;
        avatarUrls?: { '48x48'?: string };
      };
      items: Array<{
        field: string;          // e.g., "status", "assignee", "priority"
        fieldtype: string;      // "jira" or "custom"
        from: string | null;    // ID value
        fromString: string | null;  // Display value
        to: string | null;
        toString: string | null;
      }>;
    }>;
  };
}
```

### Watchers API Endpoints
```typescript
// GET /rest/api/2/issue/{key}/watchers
// Response: { self, isWatching: boolean, watchCount: number, watchers: JiraUser[] }

// POST /rest/api/2/issue/{key}/watchers
// Body: "username" (raw JSON string)
// Response: 204 No Content

// DELETE /rest/api/2/issue/{key}/watchers?username=bob
// Response: 204 No Content
```

### Overdue Check Pattern
```typescript
// Source: pattern from ReleasesTab.tsx lines 76-81
function isOverdue(duedate: string | null, statusCategoryKey?: string): boolean {
  if (!duedate) return false;
  if (statusCategoryKey === 'done') return false;
  const due = new Date(duedate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
```

### Existing Integration Points
```typescript
// IssueDetailPage.tsx line 210-222 -- THIS is what gets replaced by ActivityTimeline:
// <CommentThread ... />
// <div className="sticky bottom-0 ..."><CommentComposer /></div>

// IssueDetailContent.tsx line 179-221 -- Action bar where Clone button goes:
// <Button>Pin</Button> <Button>Edit</Button> <Button>Open in Jira</Button>

// FieldsSection.tsx line 405 -- Due date row where overdue badge goes:
// {f.duedate && <MetaRow label="Due">{new Date(f.duedate).toLocaleDateString()}</MetaRow>}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate comments section | Unified activity timeline | This phase | Comments + changes in one chronological view |
| No changelog exposure | `expand=changelog` on issue fetch | This phase | One API call gets everything |
| Manual Jira navigation for watchers | In-app watcher toggle | This phase | Watch/unwatch without leaving Taskflow |

## Open Questions

1. **Labels in clone pre-fill**
   - What we know: `EditInitialValues` does not include `labels`. The `CreateEditIssueModal` does not currently support pre-filling labels.
   - What's unclear: Whether extending `EditInitialValues` with a `labels?: string[]` field will work cleanly with the form reducer in `useCreateEditForm.ts`
   - Recommendation: Extend the interface and form state. The form already supports labels in creation; just need to wire the initial value.

2. **Changelog grouping threshold**
   - What we know: A single Jira history entry groups items changed at the same instant. But rapid successive changes (e.g., 3 changes within 10 seconds) appear as separate history entries.
   - What's unclear: Whether to visually group rapid consecutive changes by the same author
   - Recommendation: Start without grouping (each history entry is one timeline row). Grouping is a refinement if the timeline feels noisy.

3. **Watcher count on JiraIssue (list views)**
   - What we know: The watchers endpoint requires a separate call per issue. Sprint board and backlog list many issues.
   - What's unclear: Whether watcher count should show on list views or only on the detail page
   - Recommendation: Only fetch watchers on the detail page (D-08 specifies sidebar). Do not add watcher counts to list views -- it would be N+1 API calls.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETAIL-01 | Changelog fetched and merged with comments chronologically | unit | `cd taskflow && npx vitest run src/services/jira/changelog.test.ts -x` | Wave 0 |
| DETAIL-02 | Timeline filter returns correct subset by type | unit | `cd taskflow && npx vitest run src/services/jira/changelog.test.ts -x` | Wave 0 |
| DETAIL-03 | Comment edit (already implemented) | unit | `cd taskflow && npx vitest run src/services/jira/comments.test.ts -x` | Exists |
| DETAIL-04 | Comment delete (already implemented) | unit | `cd taskflow && npx vitest run src/services/jira/comments.test.ts -x` | Exists |
| DETAIL-05 | Watcher fetch, add, remove | unit | `cd taskflow && npx vitest run src/services/jira/watchers.test.ts -x` | Wave 0 |
| DETAIL-10 | Overdue badge logic (past due + not done = overdue) | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/OverdueBadge.test.ts -x` | Wave 0 |
| DETAIL-11 | Clone pre-fills modal with source issue values | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/clone.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/services/jira/changelog.test.ts` -- covers DETAIL-01, DETAIL-02
- [ ] `taskflow/src/services/jira/watchers.test.ts` -- covers DETAIL-05
- [ ] `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.test.ts` -- covers DETAIL-10

## Sources

### Primary (HIGH confidence)
- Existing codebase: `notifications.ts` lines 133, 159-176 -- proven `expand=changelog` pattern with exact response shape
- Existing codebase: `comments.ts` -- CRUD pattern for service modules
- Existing codebase: `useFieldMutation.ts` -- optimistic mutation pattern
- Existing codebase: `IssueDetailPage.tsx` lines 244-515 -- CommentThread/CommentCard to be refactored
- Existing codebase: `ReleasesTab.tsx` lines 76-81 -- overdue date comparison pattern

### Secondary (MEDIUM confidence)
- [Atlassian Jira REST API v2 - Issue Watchers](https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issue-watchers/) -- Watchers endpoint docs (Cloud docs; DC is compatible for basic operations)
- [Atlassian Support - Changelog Analysis](https://support.atlassian.com/jira/kb/how-to-analyze-the-history-or-changelog-of-an-issue-in-jira/) -- Changelog structure and expand parameter

### Tertiary (LOW confidence)
- Watcher POST body format (raw JSON string) -- verified from multiple community posts but not from official DC docs directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - all patterns already established in codebase (service modules, mutations, component structure)
- Pitfalls: HIGH - changelog pattern already used in notifications.ts; watcher API format verified from multiple sources
- API surface: MEDIUM - watchers POST body format needs validation against actual Jira DC instance

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- Jira REST API v2 is mature)
