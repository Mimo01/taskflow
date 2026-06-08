# Quick Task 260608-dhp: Add Created Issues to Yesterday Column - Research

**Researched:** 2026-06-08
**Domain:** Standup Notes – Jira search, `buildGroups()` merge pattern, `SubItemKind` rendering
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

The Yesterday column aggregates data from four independent query sources, merges them in
`buildGroups()` (YesterdayColumn.tsx), and renders each group via `IssueActivityGroup`. Adding
"created issues" is a fifth source following the exact same pattern as the existing Jira activity
source: one new `useQuery` in StandupNotesPage, one new fetch function in `jira.ts`, one new
`SubItemKind` value, and a new pass inside `buildGroups()`.

The JQL for "issues I created yesterday" is simple and well-supported: `reporter = "<username>"
AND created >= "<date>" AND created < "<nextDay>"`. No `expand=changelog` is needed (no changelog
to expand), and no per-issue fan-out is needed either — the search result itself contains all the
data required (issue key + summary + type). This makes it cheaper than the existing
`fetchYesterdayJiraActivity` call.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Created issues appear **merged into existing issue groups** — if a created issue also had other
  activity that day, the "Created" sub-item appears inside that existing group. Issues that were
  only created get their own group containing just the Created sub-item.
- Display format: a single sub-item row with just the label "Created". Same compact style as
  existing 'transition' sub-item rows.
- Watched users included — same `effectiveIdentity` resolution already in place for other sources.

### Claude's Discretion
- JQL query exact form for fetching created issues
- Ordering of the "Created" sub-item within a group (probably first, before worklogs/transitions)
- Whether to deduplicate if the same issue key appears in both created and worked-on lists

### Deferred Ideas (OUT OF SCOPE)
- (none listed)
</user_constraints>

---

## 1. JQL Query for "Issues Created Yesterday"

**Pattern to follow:** `fetchYesterdayJiraActivity` in `jira.ts` (line 680) computes `nextDay`
from local date components (never `toLocaleDateString()` — Phase 62 rule) and uses a DURING-style
date range.

**Recommended JQL:**
```
reporter = "<jiraUsername>" AND created >= "<date>" AND created < "<nextDay>"
ORDER BY created ASC
```

- `reporter` is the Jira DC field for the issue creator. [ASSUMED — standard Jira DC field name;
  matches the existing `reporter` field reference in jira.ts line 1407]
- Date scoping uses `>=` / `<` on the ISO date strings, same as the DURING approach elsewhere.
- `ORDER BY created ASC` is not strictly required but produces a natural ordering.
- `maxResults=50` is sufficient (same cap as `fetchYesterdayJiraActivity`). 
- `fields=summary,issuetype` is all that is needed — no `expand=changelog`.

**No per-issue fan-out needed.** The search result rows already contain `key`, `fields.summary`,
and `fields.issuetype.name`. No secondary comment or changelog fetch is required.

**`nextDay` computation** — copy the exact pattern from `fetchYesterdayJiraActivity` lines 699-701:
```ts
const [y, m, d] = date.split('-').map(Number);
const next = new Date(y, m - 1, d + 1);
const nextDay = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
```

**Endpoint:** `GET /rest/api/2/search?jql=<encoded>&maxResults=50&fields=summary,issuetype`
— same endpoint as all other standup JQL calls. [VERIFIED from codebase inspection]

---

## 2. New Fetch Function in `jira.ts`

Add alongside `fetchYesterdayJiraActivity`:

```ts
export interface JiraCreatedIssue {
  issueKey: string;
  summary: string;
  issueType?: string;
}

export async function fetchYesterdayCreatedIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  date: string,
  jiraUsername: string,
): Promise<JiraCreatedIssue[]>
```

Return type is simpler than `JiraActivityItem` — no transitions array, no comments array.

**Scope:** include `project = ${projectKey} AND` in the JQL so results are scoped to the active
project, matching the scope of `fetchYesterdayJiraActivity`. This prevents returning issues from
every project when a user creates issues in multiple projects.

---

## 3. How `buildGroups()` Merges a New Source

The merge pattern is consistent across all four existing sources:

1. Call `ensureGroup(issueKey, fallbackSummary, fallbackType)` — this handles:
   - Sub-task rollup to parent (via `resolveRollup`)
   - Get-or-create of the group in `issueMap`
   - Summary/type upgrade if better data becomes available
2. Push a `SubItem` onto `group.subItems`.

**New pass (5th, after MR events):**
```ts
// 5. Seed created-issue markers
for (const created of createdData ?? []) {
  const group = ensureGroup(created.issueKey, created.summary, created.issueType);
  group.subItems.push({
    kind: 'issue-created',
    label: 'Created',
    originKey: created.issueKey,
  });
}
```

**Ordering within a group:** The task calls for "Created" to appear first in the sub-item list.
The partition pass (lines 487-511) runs after all five source passes and rewrites `group.subItems`
into `storyLevel` + `bySubtask`. Ordering within `storyLevel` is determined by insertion order.
To guarantee "Created" appears first, either:

- Option A: Insert the created-source pass **before** all other passes (before worklogs). Cleanest
  — the created sub-item is literally inserted first.
- Option B: Post-sort `storyLevel` after the partition pass to put `issue-created` first.

**Recommendation: Option A** — run the created pass first (before step 1 / Tempo worklogs). This
is the simplest and most readable approach. The CONTEXT says "Created happened at creation time,
before any subsequent activity" which aligns with it being the first item in insertion order.

**`buildGroups` signature change:** Add `createdData?: JiraCreatedIssue[]` as the 5th parameter
(before `issueMeta` which stays last since it's used across all passes). All callers:
- `generateMarkdown` (exported, used in StandupNotesPage)
- `useMemo` in the component body
- Both need the new parameter forwarded.

---

## 4. `SubItemKind` and Rendering

**Add to the union in `IssueActivityGroup.tsx`:**
```ts
export type SubItemKind =
  | 'worklog'
  | 'commit'
  | 'transition'
  | 'mr-comment'
  | 'approval'
  | 'jira-comment'
  | 'mr-open'
  | 'issue-created';   // ← new
```

**Icon for `subItemIcon()`:** The `'transition'` row uses `ArrowRight`. A good icon for "issue
was created" is `PlusCircle` (from lucide-react, same icon set). [ASSUMED — reasonable
UX choice, but any unused lucide icon works]

**Render path:** `'issue-created'` has no MR click affordance and no clickable `issueKey`, so it
takes the plain `<div>` branch in `SubItemList` (the `else` branch, lines 159-183). The label
is just `"Created"` — no special structured render like `transition` uses. The plain branch
renders: icon + `<span className="flex-1 min-w-0 truncate text-sm text-foreground">{item.label}</span>`.
No new branch logic needed.

---

## 5. Query Wire-Up in StandupNotesPage

**New query** (follows `jiraActivityQuery` pattern exactly):
```ts
const jiraCreatedQuery = useQuery({
  queryKey: [
    'standup',
    'jira-created',
    jiraBaseUrl,
    activeJiraProject,
    yesterdayDate,
    id.jiraUsername ?? '',
  ],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No Jira token');
    return fetchYesterdayCreatedIssues(
      jiraBaseUrl ?? '',
      token,
      activeJiraProject ?? '',
      yesterdayDate,
      id.jiraUsername ?? '',
    );
  },
  enabled:
    !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!id.jiraUsername && !!yesterdayDate,
  staleTime: 5 * 60 * 1000,
});
```

**`referencedKeys` memo:** Add `for (const c of jiraCreatedQuery.data ?? []) keys.add(c.issueKey);`
so that created-only issues get their type/parent resolved via `fetchIssueMeta`.

**`issueMetaQuery` dependencies:** Add `jiraCreatedQuery.data` to the `useMemo` deps array.

**Pass through to `YesterdayColumn`:** Add `jiraCreatedQuery` to `YesterdayColumnProps` (like
the other four query props), or alternatively pass only the data (`createdData`). Given all four
existing queries pass their full `UseQueryResult`, pass `jiraCreatedQuery` for consistency — this
also enables a per-source loading/error display block at the bottom of the column if desired.

**`MarkdownSources` / `generateMarkdown`:** Add `createdData?: JiraCreatedIssue[]` to the
`MarkdownSources` interface and thread it through `buildGroups`.

**`syncedMinutesAgo`:** Add `jiraCreatedQuery.dataUpdatedAt` to the timestamps array.

---

## 6. Deduplication

The CONTEXT marks this as Claude's discretion. If an issue appears in both `createdData` and
`jiraData` (i.e. user created AND transitioned/commented on the same issue that day), with Option A
(created pass runs first), the group will contain a "Created" sub-item followed by the
transition/comment sub-items. This is the correct behavior per the CONTEXT decision ("the Created
sub-item appears inside that existing group"). No explicit deduplication is needed at the key
level — `ensureGroup` already handles the single-group merge.

---

## 7. Pitfalls

**Pitfall 1: `reporter` vs `creator` field**
Jira DC has both a `reporter` (editable, defaults to creator) and a `creator` (immutable) field.
The JQL field `reporter` is the standard field shown in the UI. `creator` is also valid JQL but
less expected. Use `reporter` to match what Jira displays. [ASSUMED — standard Jira DC behavior]

**Pitfall 2: `jiraUsername` is `author.name` not `accountId`**
All existing Jira DC calls use `jiraUsername` (the `name` field, e.g. `mmozolak`) for JQL
filtering — not `accountId`. The JQL `reporter = "<username>"` works on Jira DC with the
`name` field. [VERIFIED from codebase — `fetchYesterdayJiraActivity` uses `jiraUsername` param
for `status CHANGED BY "<jiraUsername>"`]

**Pitfall 3: `nextDay` boundary**
The `created < "<nextDay>"` bound must use the local-calendar nextDay (not UTC), using the same
pattern from `fetchYesterdayJiraActivity`. Do not use `created <= "<date>"` — Jira date
comparisons on a `datetime` field without time component are unreliable at day boundaries.

**Pitfall 4: `buildGroups` parameter count**
`buildGroups` is called in two places: the `useMemo` in the component body (line 578) and
`generateMarkdown` (line 185). Both must receive the new `createdData` parameter. The TypeScript
compiler will catch this but it's easy to miss during refactoring.

**Pitfall 5: `MarkdownSources` propagation**
`generateMarkdown` is exported and called from `StandupNotesPage.handleCopyMarkdown`. The
`MarkdownSources` interface must be extended and the new data forwarded at the call site
(`jiraCreatedQuery.data` or read from the query cache) or the markdown export will silently omit
created issues.

---

## 8. Files to Touch (summary)

| File | Change |
|------|--------|
| `taskflow/src/services/jira.ts` | Add `JiraCreatedIssue` interface + `fetchYesterdayCreatedIssues()` |
| `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` | Add `'issue-created'` to `SubItemKind`; add icon case in `subItemIcon()` |
| `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` | Add `createdData` param to `buildGroups()`; add pass 0 (created); extend `MarkdownSources`; extend `YesterdayColumnProps`; add error/loading display block |
| `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` | Add `jiraCreatedQuery`; extend `referencedKeys` memo; extend `issueMetaQuery` deps; pass new query to `YesterdayColumn`; extend `generateMarkdown` call |

---

## Sources

- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — full file read [VERIFIED]
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — full file read [VERIFIED]
- `taskflow/src/routes/standup-notes/effectiveIdentity.ts` — full file read [VERIFIED]
- `taskflow/src/services/jira.ts` — lines 631-804, 1407 read [VERIFIED]
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — lines 228-473 read [VERIFIED]
