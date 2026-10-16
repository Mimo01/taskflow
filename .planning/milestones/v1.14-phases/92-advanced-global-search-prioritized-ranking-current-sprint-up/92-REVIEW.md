---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
reviewed: 2026-10-16T17:45:00Z
depth: standard
iteration: 2
files_reviewed: 19
files_reviewed_list:
  - taskflow/src/components/app/CommandPalette.test.tsx
  - taskflow/src/components/app/CommandPalette.tsx
  - taskflow/src/components/app/HighlightedText.test.tsx
  - taskflow/src/components/app/HighlightedText.tsx
  - taskflow/src/components/app/RecentItemRow.test.tsx
  - taskflow/src/components/app/RecentItemRow.tsx
  - taskflow/src/components/app/RecentItemsPopover.tsx
  - taskflow/src/components/app/SearchResultRow.test.tsx
  - taskflow/src/components/app/SearchResultRow.tsx
  - taskflow/src/hooks/useGlobalSearchSources.test.tsx
  - taskflow/src/hooks/useGlobalSearchSources.ts
  - taskflow/src/hooks/useRecentIssues.ts
  - taskflow/src/lib/global-search.ts
  - taskflow/src/lib/search-text.ts
  - taskflow/src/routes/dashboard/IssueDetailView.tsx
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/useGhBacklogData.ts
  - taskflow/src/stores/recent-items.store.ts
findings:
  critical: 1
  warning: 6
  info: 9
  total: 16
status: issues_found
---

# Phase 92: Code Review Report (second pass)

**Reviewed:** 2026-10-16T17:45:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This is the second review pass. It runs after the fixes in c4331191 and f31af600..a4860dab. I re-checked each earlier Critical and Warning fix against the current code:

| Prior finding | Result |
|---|---|
| CR-01 (sanitiser merged tokens) | Fixed. It now splits on reserved characters, but this exposes WR-02 below. |
| CR-02 (orphaned subtasks) | Fixed, but the fix **introduced a regression** (CR-01 below). |
| WR-01 (AND/OR/NOT) | Fixed. |
| WR-02 (key regex) | Fixed. The wider regex makes WR-01 below slightly more common. |
| WR-03 (closed-search error) | Fixed. The matching body-search case is still open (WR-05 below). |
| WR-04 (untrimmed default state) | Fixed. |
| WR-05 (stale title ranges) | Fixed. Traced all branches of `consider()`, and every branch is consistent. |
| WR-06 (stale PAT) | Fixed. A related loading-state gap remains (WR-06 below). |
| WR-07 (parent never cleared) | Fixed. |
| WR-08 (MR iid collisions) | Fixed. |
| WR-09 (done subtask routing) | Fixed in `addSubtasks`. The same rule is missing in `entryFromJiraIssue` (WR-04 below). |

All 294 tests in the phase test files pass. XSS and JQL-injection handling are still sound.

The new blocker comes from the CR-02 fix. When the Direct-match issue heads a subtask group, `withoutDirectMatch` keeps it as a dimmed row. That row has the same cmdk `value` as the pinned Direct-match row. cmdk then marks both rows selected, and ArrowDown can no longer move past them. I confirmed this with a standalone cmdk 1.1.1 probe.

Of the earlier Info findings, IN-01 to IN-07 are still present and are carried forward. IN-08 has been raised to a Warning (WR-06), because it can now leave the palette stuck loading.

## Critical Issues

### CR-01: Kept Direct-match parent row duplicates the cmdk value, which traps keyboard navigation

**File:** `taskflow/src/components/app/CommandPalette.tsx:386, 524-537`; `taskflow/src/lib/global-search.ts:593-597`
**Issue:** `renderIssueRow` always sets `value={e.key}`. The pinned Direct-match row is rendered with `directEntry.key`. Since the CR-02 fix, `withoutDirectMatch` keeps that same key in the ranked sections, as a dimmed parent row, whenever the next row is indented. Two `CommandItem`s now share one value.

cmdk 1.1.1 works out selection as `state.value === item.value`, so both rows get `aria-selected="true"`. Its ArrowDown handler finds the *first* selected element and moves to the next one. When the next one is the duplicate, `setState('value', sameValue)` does nothing (`Object.is`), so the selection never moves.

I reproduced this with cmdk 1.1.1 in jsdom. The probe used items `[direct P-1] [P-1 dup, P-2, Q-3]` and pressed ArrowDown three times. The selection stayed on `["direct","dup parent"]` every time. When the duplicate is not adjacent, the cursor jumps back to the top each time it reaches the duplicate. A typical trigger is a numeric query such as `412` (resolved to `SHOP-412`) where subtasks of SHOP-412 match. Before the fix, the row was simply removed, so this regression came from the CR-02 fix.
**Fix:** Give the pinned row its own value, so a key appears only once among the cmdk values:
```tsx
function renderIssueRow(row: ResultRow, itemKey: string, divider = false, value = row.entry.key) {
  ...
  <CommandItem key={itemKey} value={value} onSelect={() => handleIssueSelect(e.key)} ...>
}
// Direct match:
renderIssueRow({ ...directRow }, `direct-${directEntry.key}`, false, `direct:${directEntry.key}`)
```
Add a palette test: direct key `P` heading matched subtask `P-1`, then ArrowDown from the first row must reach `P-1`.

## Warnings

### WR-01: Key-shaped search terms turn off description and comment search

**File:** `taskflow/src/components/app/CommandPalette.tsx:173-178`; `taskflow/src/lib/global-search.ts:252-254`
**Issue:** `searchEnabled` requires `!isKeyLikeQuery(debouncedQuery)`. Since WR-02, `isKeyLikeQuery` accepts anything of the form `<letter><alnum_>*-<digits>`. That includes ordinary terms such as `utf-8`, `covid-19`, `windows-10`, `sha-256`, `ie-11`, `mp3-128` and `iso-8601`. For these queries the body search never runs. The key lookup returns `null` (404), so the user sees only local title matches, or "No results found", even when many descriptions and comments contain the term.
**Fix:** Run the body search once the key lookup has missed, or only treat the query as a key when its prefix is a known project:
```ts
const keyMiss = isKeyLikeQuery(debouncedQuery) && !localDirect && keyQuery.isFetched && !keyQuery.data;
const searchEnabled = open && debouncedQuery.length >= 2 &&
  (!isKeyLikeQuery(debouncedQuery) || keyMiss) && !!jiraBaseUrl && !!activeJiraProject;
```

### WR-02: Tokens that Jira drops (stopwords, punctuation-only) each get their own ANDed clause

**File:** `taskflow/src/services/jira.ts:1633-1637`; `taskflow/src/services/jira.test.ts:2641, 2650`
**Issue:** Each whitespace token becomes its own `text ~ "<token>"` clause, and the clauses are ANDed. Jira's analyser removes English stopwords (`a, an, and, in, is, it, of, on, or, the, to, ...`) and punctuation-only input. A clause made only of such a token matches nothing, or is rejected as an invalid text query. Either way the AND removes every body hit, or `searchJiraBody` throws.

The CR-01 fix makes this more common: `sign-in` now produces `text ~ "in"`. The tests lock in `text ~ "in"` (2650) and `text ~ "="` (2641). Natural queries such as `fix the login` or `move to backlog` hit the same problem. Only the last token is safe, because the `*` wildcard skips analysis. This needs checking against the live instance, but either outcome is wrong.
**Fix:** Drop tokens that have no letter or digit, and drop known stopwords from the non-final tokens. Alternatively, send one analysed clause and let Lucene drop the stopwords:
```ts
const words = tokens.filter((t) => /[\p{L}\p{N}]/u.test(t));
const STOP = new Set(['a','an','and','are','as','at','be','but','by','for','if','in','into','is','it','no','not','of','on','or','such','that','the','their','then','there','these','they','this','to','was','will','with']);
const kept = words.filter((t, i) => i === words.length - 1 || !STOP.has(t.toLowerCase()));
```
Update the two tests to match.

### WR-03: "No results found" flashes during the 300 ms debounce

**File:** `taskflow/src/components/app/CommandPalette.tsx:362-378`
**Issue:** `showEmpty` treats "body search not started yet" as finished. Take a new query with no local title hits. While `debouncedQuery !== trimmed`, `bodyQuery` is either disabled or showing the previous key, and `bodyFresh` is false, so `anyFetching` is false. The empty state appears for about 300 ms. Then the request starts and the empty state disappears, and finally the results arrive. This goes against the "render once, complete" goal the phase relies on, and it shows a false "No results found".
**Fix:** Treat the debounce gap as pending:
```ts
const bodyPending = trimmed.length >= 2 && !isKeyLikeQuery(trimmed) && !!jiraBaseUrl &&
  !!activeJiraProject && debouncedQuery !== trimmed;
const showEmpty = ... && !anyFetching && !bodyPending && ...;
```

### WR-04: `entryFromJiraIssue` skips the done→Closed routing that WR-09 added for sprint-board subtasks

**File:** `taskflow/src/lib/global-search.ts:277-282`
**Issue:** If a Jira hit is not in the index but its parent is, the hit takes the parent's tier unconditionally. A closed-scope hit (`statusCategory = Done`) on a subtask whose story is in Backlog or a future sprint therefore lands in that open section instead of Closed. The backlog path (line 201) and `addSubtasks` (line 220, the WR-09 fix) both route done items outside the current sprint to `CLOSED_ID`. The same issue would be in Closed from the index but in Backlog from Jira, which breaks D-15.
**Fix:** After the tier is chosen:
```ts
if (catKey === 'done' && tierId !== CURRENT_ID) tierId = CLOSED_ID;
```
(Move `catKey` above the tier block.)

### WR-05: A failed body search still shows "No results found"

**File:** `taskflow/src/components/app/CommandPalette.tsx:367-378, 589-593`
**Issue:** The WR-03 fix added `!closedError` to the `showEmpty` guard but did not add `bodyQuery.isError`. If the open body search fails and there are no title hits, the palette shows "No results found ... Try a different term" along with "Couldn't search descriptions and comments". The first message says nothing matched, which is unknown. In addition, `bodyQuery.isError` belongs to the last *debounced* query, so the error notice stays on screen while the user types a new query, until that query's request settles.
**Fix:** Add `const bodyError = bodyQuery.isError && debouncedQuery === trimmed;`. Use `bodyError` for the notice and add `!bodyError` to `showEmpty`.

### WR-06: Index loading state can be wrong in either direction while the PAT is unread or missing

**File:** `taskflow/src/hooks/useGlobalSearchSources.ts:49-51, 72-75`
**Issue:** This was IN-08, raised to a Warning. `token` is `null` both before the PAT has been read and after reading it failed, and the two cases are not told apart:
- **Stuck loading:** suppose there is a stored board id (`jiraBoardIds[project]`) and `readSecret` rejects, or the secret has not been read for the current `jiraBaseUrl`. Then `boardId` is non-null, `useGhBacklogData` is disabled because `!token`, and a disabled TanStack v5 query stays `isPending` forever. `isIndexLoading` stays `true` indefinitely. As a result the palette's Recent Items and the popover show skeletons forever, "Loading issues…" never clears, and the Direct-match `keyQuery` stays disabled (`!isIndexLoading`).
- **Falsely loaded:** with no stored board id, `useBoardId` is disabled and reports `isLoading: false` while the PAT is being read, so `isIndexLoading` is `false` for that tick. Unenriched recents, or "No results found", then flash before the skeleton appears.
**Fix:** Keep the read status next to the token, and gate on it:
```ts
const secretRead = secret.baseUrl === jiraBaseUrl && secret.read; // set read: true in both then/catch
const isIndexLoading = open && !backlogQuery.data &&
  (!secretRead || (!!token && (boardIdLoading || (boardId !== null && backlogQuery.isPending))));
```
Report `secretRead && !token` as `isIndexError`, so the user sees the "Couldn't load issues" notice.

## Info

### IN-01: `onOpenIssue` prop is accepted but never used, and the click comments contradict each other (carried forward)

**File:** `taskflow/src/components/app/CommandPalette.tsx:69-72, 78-85, 281-291`
**Issue:** `onOpenIssue` is declared but not destructured. `main.tsx:696` still passes it. `onIssueClick` is optional, so without it, selecting an issue only closes the palette. The comment at 281 says IssueDetailView owns the recent-item push. The comment at 290 says `handleIssueClick in main.tsx` owns it.
**Fix:** Remove the prop and its wiring, make `onIssueClick` required, and make the two comments agree.

### IN-02: `KIND_RANK` is defined twice (carried forward)

**File:** `taskflow/src/lib/global-search.ts:358`, `taskflow/src/lib/search-text.ts:105`
**Fix:** Export it from `search-text.ts` and import it in `global-search.ts`.

### IN-03: Field names are put into request URLs unencoded (carried forward)

**File:** `taskflow/src/services/jira.ts:1659, 1693`
**Issue:** `epicLinkFieldKey` (a user setting) and `extraFields` go into `fields=` raw. A value containing `&`, `#` or spaces changes the query string. An empty setting leaves a trailing comma.
**Fix:** `[...base, ...extra].filter(Boolean).map(encodeURIComponent).join(',')`.

### IN-04: Dead `!token` checks (carried forward)

**File:** `taskflow/src/components/app/CommandPalette.tsx:184, 202`
**Issue:** `readSecret` returns `Promise<string>` and throws when the secret is missing (`stronghold.ts:81`), so `!token` can never be true. A missing PAT shows up as the generic body-search error.
**Fix:** Drop the branch, or catch deliberately: `readSecret('jira-pat').catch(() => null)`.

### IN-05: Network Direct match has no parent or epic data (carried forward)

**File:** `taskflow/src/components/app/CommandPalette.tsx:230-252`; `taskflow/src/services/jira.ts:2130`
**Issue:** `fetchJiraIssueByKey` does not request `parent` or the epic-link field. So for an issue that is not in the index, `entryFromJiraIssue` always produces `parentKey: null` and `epic: null`, and the epic pill is missing.
**Fix:** Use `fetchIssuesByKeys(base, token, [key], [epicLinkFieldKey])` for the lookup.

### IN-06: Indexes from lower-cased text and from the original text are mixed, so highlights can misalign (carried forward)

**File:** `taskflow/src/lib/search-text.ts:53-58, 93-96, 134-135`
**Issue:** Phrase, word-start and plain indexes come from `toLowerCase()`. Fuzzysort indexes come from the original string, and one match can mix both. For characters whose lower-case form is longer (e.g. `İ`), the offsets drift.
**Fix:** Skip highlighting when `lower.length !== target.length`, or map indexes back to the original. Low priority.

### IN-07: The total cap can hide a higher-ranked tier's group while a lower-ranked tier still shows rows (carried forward)

**File:** `taskflow/src/lib/global-search.ts:536-574`
**Issue:** `overflowed` resets for each tier, while `totalShown` is shared across tiers. A large group hidden by `TOTAL_CAP` in tier N does not stop smaller groups in tier N+1 from rendering.
**Fix:** Once `TOTAL_CAP` is reached, count every later group as hidden.

### IN-08: Key lookup query is not scoped to the instance and retries on credential errors

**File:** `taskflow/src/components/app/CommandPalette.tsx:230-245`
**Issue:** `['search', 'key', resolvedKeyLookup]` does not include `jiraBaseUrl`. After switching instance, a cached issue from the old host can appear as the Direct match until `gcTime` expires. Unlike the body and closed queries, the query has no `retry: false`. A `readSecret` rejection is retried three times, with the Direct-match skeleton showing for several seconds, and the error is never surfaced.
**Fix:** Use `queryKey: ['search', 'key', jiraBaseUrl, resolvedKeyLookup]` and `retry: false`.

### IN-09: Legacy bare-iid recent MRs navigate to a broken route and do not de-duplicate

**File:** `taskflow/src/components/app/CommandPalette.tsx:496-499`; `taskflow/src/components/app/RecentItemsPopover.tsx:151-153`; `taskflow/src/stores/recent-items.store.ts:63`
**Issue:** WR-08 added `recentMrMatches` because persisted ids without a project (`"12"`) still exist. Selecting such a row navigates to `/mr/12`, which is missing the project segment. A later push of `"5/12"` does not replace the legacy entry, so the same MR is listed twice. The store has `version: 0` and an identity `migrate`.
**Fix:** Resolve the composite id through `findGitLabMRInCache` before navigating, or drop or upgrade bare ids in a `version: 1` migration.

---

_Reviewed: 2026-10-16T17:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
