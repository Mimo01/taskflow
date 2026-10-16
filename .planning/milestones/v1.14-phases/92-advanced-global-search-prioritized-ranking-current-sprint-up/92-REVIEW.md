---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - taskflow/src/components/app/CommandPalette.tsx
  - taskflow/src/components/app/HighlightedText.tsx
  - taskflow/src/components/app/RecentItemRow.tsx
  - taskflow/src/components/app/RecentItemsPopover.tsx
  - taskflow/src/components/app/SearchResultRow.tsx
  - taskflow/src/hooks/useGlobalSearchSources.ts
  - taskflow/src/hooks/useRecentIssues.ts
  - taskflow/src/lib/global-search.ts
  - taskflow/src/lib/search-text.ts
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/useGhBacklogData.ts
  - taskflow/src/stores/recent-items.store.ts
findings:
  critical: 2
  warning: 9
  info: 8
  total: 19
status: issues_found
---

# Phase 92: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the Phase 92 palette, ranking model, text matcher, Recent Items enrichment and the jira.ts additions (`buildBodySearchJql`, `searchJiraBody`, `fetchIssuesByKeys`). The XSS approach holds up. All highlighting goes through React `<mark>` nodes, and `HighlightedText` clamps and merges ranges. JQL injection is also prevented, because quotes and backslashes are stripped and the project key is escaped.

There are two correctness problems:

1. The JQL sanitiser joins the pieces of a token together instead of splitting it. Any hyphenated or slashed term then produces zero body hits.
2. The Direct-match de-duplication runs after grouping. This can leave subtasks indented under the wrong story.

Most warnings are about mismatched validation between the client and Jira (key regexes, reserved words), errors that are silently dropped, and stale-token or stale-highlight races.

## Critical Issues

### CR-01: Body-search sanitiser joins the pieces of hyphenated, slashed or @ terms, so Jira finds nothing

**File:** `taskflow/src/services/jira.ts:1632`
**Issue:** Reserved characters are deleted (`replace(..., '')`) instead of being treated as separators. Jira's analyser indexes `sign-in` as `sign` + `in`, but the JQL sends a token that matches nothing. Simulated output:
- `sign-in flow` → `text ~ "signin" AND text ~ "flow*"`
- `e-mail` → `text ~ "email*"`
- `api/v2 error` → `text ~ "apiv2" AND ...`
- `user@example.com` → `text ~ "userexample.com*"`

All clauses are ANDed, so one damaged token wipes out every description and comment hit for the query. The UI gives no sign of this. It just shows title matches only, which looks like "no body matches". Hyphenated words are common in issue text (sign-in, e-mail, re-open, version numbers, paths), so this breaks D-02 for a large class of queries.
**Fix:** Turn reserved characters into whitespace before splitting into tokens:
```ts
const tokens = query
  .replace(/[+\-&|!(){}[\]^~*?:\\/#@"']/g, ' ')
  .split(/\s+/)
  .filter((t) => t.length > 0);
```
Add a test asserting `sign-in` → `text ~ "sign" AND text ~ "in*"`.

### CR-02: Removing the Direct-match row after grouping orphans its subtasks under the previous story

**File:** `taskflow/src/components/app/CommandPalette.tsx:266-272`
**Issue:** `buildResultModel` has already grouped subtasks under their parent and set `indent` (and with it `startsGroup`). The palette then filters out every row whose key equals `directEntry.key`. If the direct match is a story that heads a group, the story row is removed but its `indent: true` children stay. Take section rows `[A, P, P-1(indent), P-2(indent), Q]` with direct key `P`. They become `[A, P-1, P-2, Q]`. `startsGroup` returns false for indented rows, so P-1 and P-2 show up nested under story A with no divider. That misattributes subtasks to the wrong story, which is the D-07 grouping this phase exists to provide. The filter also runs after the per-tier cap, so the section shows fewer rows than `PER_TIER_CAP` while `hiddenCount` stays the same.
**Fix:** Pass the direct key into `buildResultModel` and handle it before grouping and capping. If the excluded entry is a group parent with children, render it as a dimmed parent row (or keep it). Do not delete it outright:
```ts
// in buildResultModel, when emitting a group whose parent is excludeKey:
if (g.parent.key === excludeKey) {
  if (children.length === 0) continue;           // drop the whole group
  groupRows[0] = { ...groupRows[0], dimmed: true, titleRanges: [], snippet: null, tag: null };
}
```

## Warnings

### WR-01: Uppercase boolean words in the query break the whole body search

**File:** `taskflow/src/services/jira.ts:1630-1635`
**Issue:** Tokens are not case-normalised. The sanitiser does not handle Lucene operators, so `foo OR bar` produces `text ~ "OR"`. Jira passes the inner string to its Lucene query parser, where a bare `AND`/`OR`/`NOT` is an operator with no operand. That typically gives a 400 "text query is not valid" error. `searchJiraBody` throws on this, and the user only sees "Couldn't search descriptions and comments" for a reasonable query.
**Fix:** Lower-case tokens, or drop tokens matching `/^(AND|OR|NOT)$/`, before building clauses. Add a test case for this.

### WR-02: `isKeyLikeQuery` rejects valid Jira keys that contain digits or underscores

**File:** `taskflow/src/lib/global-search.ts:248-250`
**Issue:** `/^[A-Za-z]+-\d+$/` rejects `AB2-12` and `MY_PROJ-3`. Jira allows project keys like these, and the app's own `ISSUE_KEY_RE` (`/^[A-Z][A-Z0-9_]+-\d+$/`, `lib/deployment-package.ts:72`) accepts them. For such keys there is no Direct-match lookup (`resolveKeyLookup` returns `''`), and the body search fires with the CR-01-damaged token `AB212*`. The `/i` flag is also redundant next to `[A-Za-z]`.
**Fix:** `return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(trimmed);`. Better still, share one key regex with `ISSUE_KEY_RE` after upper-casing.

### WR-03: Failed closed-issues search is silent

**File:** `taskflow/src/components/app/CommandPalette.tsx:592-611`
**Issue:** Only `bodyQuery.isError` is shown. If `closedQuery` fails, nothing tells the user. `retry: false`, `searchJiraBody` throws, and once `includeClosed` is true the "Include closed issues" row disappears. The user sees no Closed section and may see "No results found", which suggests no closed issues match. The error is never reported.
**Fix:** Render a matching notice for `includeClosed && closedQuery.isError`, e.g. "Couldn't search closed issues." Count it in the `showEmpty` guard as well.

### WR-04: `isDefaultState` uses the untrimmed query while the model uses `trimmed`

**File:** `taskflow/src/components/app/CommandPalette.tsx:338`
**Issue:** `query.length < 2` against `trimmed` elsewhere. Typing two spaces, or `"a "`, leaves Recent Items while `buildResultModel` returns `[]` (it requires `trimmed.length >= 2`). With whitespace only, `matchesSecondary` hides every nav and action item, so the palette shows "No results found" and an "Include closed issues" row that does nothing.
**Fix:** `const isDefaultState = trimmed.length < 2;`

### WR-05: Stale title highlight ranges when a Jira hit replaces the local entry

**File:** `taskflow/src/lib/global-search.ts:405-409`
**Issue:** If a later hit is not better, `consider` keeps `prev`'s `titleRanges` (computed against the *local, up-to-5-min-stale* summary) but swaps in `hit.entry` from Jira, whose `summary` may have been edited since. `HighlightedText` then marks character offsets from the old title on the new title, which highlights the wrong text. Clamping prevents a crash but not the wrong highlight.
**Fix:** If `prev.entry.summary !== hit.entry.summary`, recompute: `titleRanges: prev.field === 0 ? runsFromIndexes(matchText(query, hit.entry.summary)?.indexes ?? []) : prev.titleRanges`. Or keep the entry that the ranges were computed from.

### WR-06: Recent-issues fetch can send the previous instance's PAT, and a token change never refetches

**File:** `taskflow/src/hooks/useRecentIssues.ts:35-75`
**Issue:** `token` is component state that is re-read asynchronously when `jiraBaseUrl` changes. On the render where `jiraBaseUrl` has switched, `token` (and `tokenRead === true`) still hold the old value. The query key changes because it includes `jiraBaseUrl`, so the query is enabled and immediately sends the **old PAT to the new host**. The token is not part of the query key either. Once the correct token arrives, the failed or 401 result for that key is not refetched (`refetchOnWindowFocus: false`, `retry: false`), so enrichment stays missing until the next mount. `useGlobalSearchSources` and `useGhBacklogData` follow the same pattern.
**Fix:** Clear `token`/`tokenRead` synchronously when `jiraBaseUrl` changes (reset at the start of the effect and gate `enabled` on it). Alternatively, read the secret inside `queryFn`, as the palette's body and key queries already do, so no stale token can be captured.

### WR-07: Recent-item parent info can never be cleared

**File:** `taskflow/src/stores/recent-items.store.ts:34-37`, `taskflow/src/routes/dashboard/IssueDetailView.tsx:221-229`
**Issue:** `parentKey = item.parentKey ?? existing?.parentKey`. `IssueDetailView` leaves the parent fields out when the issue has no parent. Suppose a subtask is converted to a story (or moved to another parent and the push omits it). The old `parentKey`/`parentTitle` then persist forever. On a cold cache, `buildRecentRows` keeps showing the issue indented under a story it no longer belongs to, and `recentKeysToFetch` keeps fetching the stale parent.
**Fix:** In `IssueDetailView`, always send the fields: `parentKey: parent?.key ?? undefined`. In the store, check whether the field is present (`'parentKey' in item ? item.parentKey : existing?.parentKey`) rather than using `??`, so an authoritative push can clear it.

### WR-08: MR de-duplication and title lookup use `iid` only, so MRs from different projects collide

**File:** `taskflow/src/components/app/CommandPalette.tsx:159-169, 510-514`; `taskflow/src/components/app/RecentItemsPopover.tsx:37-52`
**Issue:** GitLab `iid` is unique only per project. `mrsMap` is keyed by `iid`, so `!12` in project B is dropped when project A also has `!12`. The React key `mr.iid` (line 618) can also collide. Recent MR titles are looked up by bare `iid` and preferred over the persisted correct title (`mrTitle ?? item.title`), so they can show another project's MR title. This existed before, but Phase 92 rewrote these lines and now uses composite `mr:${project_id}/${iid}` values. The two keys are inconsistent.
**Fix:** Key the map and the React key by `${mr.project_id}/${mr.iid}`. Match recent items on the full composite `item.id`.

### WR-09: Closed sprint-board subtasks skip the done→Closed routing

**File:** `taskflow/src/lib/global-search.ts:231`
**Issue:** The backlog subtask path sends `done` subtasks outside the current sprint to `CLOSED_ID` (line 201). `addSubtasks` always inherits the parent tier, or falls back to `CURRENT_ID`. So a done subtask from `gh-all-data` whose parent is in Backlog or a future sprint appears in an open tier, even when "Include closed" is off. That is inconsistent with the backlog path and with D-15.
**Fix:** Apply the same rule: `let tierId = parentTier ?? CURRENT_ID; if (gh.done && tierId !== CURRENT_ID) tierId = CLOSED_ID;`

## Info

### IN-01: `onOpenIssue` prop is accepted but never used; header comments describe a peek flow that does not exist

**File:** `taskflow/src/components/app/CommandPalette.tsx:68-71, 77-84`
**Issue:** `onOpenIssue` is not destructured. Selecting a row navigates full-page through `onIssueClick`, which is optional, so if it is omitted, selecting an issue just closes the palette. The comment at lines 293-297 refers to `handleIssueClick in main.tsx`, which contradicts the comment at 287-288.
**Fix:** Remove the prop (and its wiring in `main.tsx:696`) or use it, make `onIssueClick` required, and fix the comments.

### IN-02: `KIND_RANK` is defined twice

**File:** `taskflow/src/lib/global-search.ts:354`, `taskflow/src/lib/search-text.ts:105`
**Fix:** Export it from `search-text.ts` and import it.

### IN-03: `epicLinkFieldKey` is put into the request URL unencoded

**File:** `taskflow/src/services/jira.ts:1656` (and the `extraFields` join in `fetchIssuesByKeys`)
**Issue:** This is a settings value. A malformed value (containing `&`, `#` or spaces) changes the query string. An empty value leaves a trailing comma.
**Fix:** `encodeURIComponent` each field name and filter out empty ones.

### IN-04: Dead `!token` checks

**File:** `taskflow/src/components/app/CommandPalette.tsx:184, 202`
**Issue:** `readSecret` returns `Promise<string>` and throws when the secret is missing, so `!token` can never be true. A missing PAT shows up as the generic "Couldn't search descriptions" error.
**Fix:** Drop the dead branch, or catch and return `[]` deliberately.

### IN-05: Network Direct match has no parent or epic data

**File:** `taskflow/src/components/app/CommandPalette.tsx:249`
**Issue:** `fetchJiraIssueByKey` requests `summary,status,assignee,reporter,priority,...,issuetype` but not `parent` or the epic-link field. So `entryFromJiraIssue` always produces `parentKey: null` and `epic: null` for network direct hits, and the epic pill is missing for stories that are not in the index.
**Fix:** Reuse `fetchIssuesByKeys([key], [epicLinkFieldKey])` for the key lookup.

### IN-06: Lower-case and original strings can differ in length, which misaligns highlights

**File:** `taskflow/src/lib/search-text.ts:53-58, 134-168`
**Issue:** Indexes are computed on `toLowerCase()` and applied to the original string. For characters whose lower-case form is longer (e.g. `İ` → `i̇`), the offsets drift. Fuzzysort indexes refer to the original string, but phrase and plain indexes refer to the lower-cased one, so a single match mixes both bases.
**Fix:** Use `toLocaleLowerCase` with an equal-length check, or map indexes back. This is low priority.

### IN-07: The total cap can hide a higher-ranked tier's group while a lower-ranked tier still shows rows

**File:** `taskflow/src/lib/global-search.ts:545-554`
**Issue:** `overflowed` resets for each tier. A large group hidden by `TOTAL_CAP` in tier N does not stop smaller groups in tier N+1 from being shown, so the lower tier gets screen space ahead of a better-ranked group.
**Fix:** Once `TOTAL_CAP` is reached, stop emitting rows in all later tiers (count them as hidden only).

### IN-08: `isIndexLoading` is briefly false before the PAT is read

**File:** `taskflow/src/hooks/useGlobalSearchSources.ts:46, 67-70`
**Issue:** While `token` is still `null`, `useBoardId` is disabled and reports `isLoading: false`, and `boardId` is `null`. So on a cold start `isIndexLoading` is false. The palette and popover can show unenriched recents, or "No results found", for one tick before the skeleton appears. This works against the "render once, complete" goal.
**Fix:** Track `tokenRead`, as `useRecentIssues` does, and treat `!tokenRead` as loading.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
