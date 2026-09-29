# Quick Task 260929-h2q: Order subtasks by parent's Jira subtask order - Research

**Researched:** 2026-09-29
**Domain:** Client-side ordering of Jira subtasks across 7 views (no new packages)
**Confidence:** HIGH (all findings from codebase reads, file:line cited)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- PRIMARY: subtasks under a parent follow the parent's `fields.subtasks` array order (Jira's subtask sequence,
  which is manually reorderable in Jira). "Use the fields.subtasks order anywhere possible."
- FALLBACK: where the parent's `fields.subtasks` is not available and fetching it is not reasonably cheap,
  order by numeric key ascending (issue number part, e.g. X-99 before X-100 — NEVER lexical string compare).
  Subtask keys not found in the parent's `fields.subtasks` list go after the listed ones, by numeric key.
- Status (done vs open) does NOT affect subtask order — pure subtask order.
- Story/parent ordering stays exactly as is (rank). Band grouping on My Tasks stays as is.
- Scope — ALL 7 surfaces: My Tasks (My Day + by-sprint), Standup Today (+ copy text), Sprint Board swimlanes,
  Issue Detail subtask list, Standup Yesterday sub-task groups, Worklogs hierarchy, Dashboard "My Subtasks" panel
  (group-stable: keep relative parent order, reorder subtasks within same parent).

### Claude's Discretion
- ONE shared pure helper (e.g. `src/lib/subtask-order.ts`), reused everywhere; do not re-inline per view.
- Per surface: add `subtasks` to a `fields=` list vs numeric fallback, based on cost; prefer adding the field when
  the parent is already fetched in that query. Beware shared fetcher cache keys.
- Unit tests for the helper plus a regression test for My Tasks ordering.

### Deferred Ideas (OUT OF SCOPE)
None listed.
</user_constraints>

## Project Constraints

- No CLAUDE.md exists (repo root or `taskflow/`). [VERIFIED: ls]
- Pre-commit hook (`.husky/pre-commit`): `biome check --staged ./src && tsc --noEmit && npm run test` (full vitest suite). Combine RED/GREEN per task into one commit. [VERIFIED: .husky/pre-commit]
- All surfaces import fetchers from `@/services/jira` (legacy `taskflow/src/services/jira.ts`), confirmed for `fetchMyTasksHierarchy`, `fetchAllAssignedHierarchy`, `fetchSprintIssues`, `fetchEnrichedSubtasks`, `fetchIssueMeta`. Edit `jira.ts`, not `services/jira/*`. [VERIFIED: grep]
- Biome baseline drifts; gate on "no NEW files flagged", not a count.

## Summary

In 5 of 7 surfaces the parent issue with `fields.subtasks` is **already in hand at zero extra cost** (My Tasks both paths, Standup Today, Dashboard My Subtasks panel, Issue Detail). Worklogs needs `subtasks` appended to two page-local `fields=` lists (no shared key). Yesterday needs `subtasks` in `fetchIssueMeta` plus one conditional follow-up batch for parents not already in the key set (single consumer). The Sprint Board is the only surface where the data source (GreenHopper `allData`) carries **no** subtask sequence at all; it needs a new lightweight REST query or the numeric fallback.

Existing tests mostly assert with `toContain`, so nothing breaks from reordering; one URL assertion uses `toContain('fields=issuetype,summary,parent')`, which survives appending `,subtasks`.

**Primary recommendation:** Build `taskflow/src/lib/subtask-order.ts` with 3 pure functions, then apply per surface as tabled below. Use the fallback-safe comparator because test fixtures use non-numeric keys like `ESHOP-10-S1`.

## Per-Surface Findings

| # | Surface | Where list is built | Current order source | Parent `fields.subtasks` in hand? | Recommendation |
|---|---------|--------------------|----------------------|-----------------------------------|----------------|
| 1a | My Tasks, My Day | `lib/my-tasks-sort.ts:162-172` (`subtasksByParent` in `groupByMyDay`) → `parents[].subtasks` | Insertion order of step-4 subtask JQL (`services/jira.ts:680`, no ORDER BY, so Jira default order) | YES. `fetchMyTasksHierarchy` parent `fields` includes `subtasks` (`jira.ts:590`); used for both myStories and extraParents | In Pass 3 (`:190`) replace `subtasks` with `orderSubtasks(subtasks, parent.fields.subtasks)`. The band calc is order-independent (min), so it's safe. |
| 1b | My Tasks, by sprint (All Assigned/Reported) | `MyTasksPage.tsx:636-642` | Insertion order | YES. `fetchAllAssignedHierarchy`/`fetchAllReportedHierarchy` fields arrays include `'subtasks'` (`jira.ts:751, 821`) | Order the per-parent arrays with the helper using the parent from `parentsOnly`. (These scopes are parent-only; this is defensive.) |
| 2 | Standup Today (InProgress/UpNext + copy text) | `routes/standup-notes/filterSprintItems.ts:84-96` (`mySubtasksForParent`) | Insertion order from `fetchSprintIssues` 2nd query (`jira.ts:544`, no ORDER BY) | YES. `fetchSprintIssues` parent fields include `subtasks` (`jira.ts:499`); query key `['jira-issues','sprint-board-today-full',…]` (`TodayColumn.tsx:214`) | Set `subtasks: orderSubtasks(mySubtasksForParent, parent.fields.subtasks)`. **Keep `_placementStatusKey` computed from the UNSORTED `mySubtasksForParent[0]`** so bucket placement doesn't change (see Pitfall 2). Copy text (`TodayColumn.tsx:102`) iterates `row.subtasks`, so it follows automatically. |
| 3 | Sprint Board swimlanes | `routes/dashboard/SprintBoardTab.tsx:1464-1474` (`swimlanes` useMemo); columns/filters (`:1581`, `:473`, `:647`) preserve array order | GH `allData.issuesData.issues` order (board rank incl. subtasks) | NO. `GhIssue` has only `parentId`/`parentKey` (`greenhopper/types.ts:42-43`); the envelope's `orderData` only has rank-field metadata (checked in the real fixture); `swimlanesData.parentSwimlanesData.parentIssueIds` is parent ids only | **Add a new lightweight fetcher** `fetchSubtaskOrder(baseUrl, token, parentKeys): Promise<Record<string,string[]>>` in `jira.ts`: `key in (…)&fields=subtasks`, chunked by the existing `SUBTASK_CHUNK_SIZE=50` (`jira.ts:280`), with graceful `{}` on failure. Use a NEW query key, e.g. `['jira-subtask-order', sortedParentKeysStr]`, `staleTime: STALE_TIME_MS`, `enabled` when story keys are non-empty. In the `swimlanes` memo: `orderSubtasks(subs, orderMap[story.key])`. The helper falls back to numeric while the query is loading or failed. Cost: 1 request per ≤50 stories, and the payload is only the subtasks arrays. No shared-key impact. Optional: also invalidate it in the "Reload board" handler. |
| 4 | Issue Detail subtask list | `IssueDetailView.tsx:167-172` → `fetchEnrichedSubtasks` (`jira.ts:1780`) → `IssueDetailContent.tsx:99-112` | `issue.fields.subtasks` order | YES (source) | **Already correct.** `fetchEnrichedSubtasks` returns `subtasks.map(...)` over the input array (`jira.ts:1825`), which preserves order; the failure path returns the input as-is. No change. Optionally add one test that asserts order is preserved when the enrich response is shuffled. |
| 5 | Standup Yesterday sub-task groups | `routes/standup-notes/YesterdayColumn.tsx:555-562` (`.sort((a,b)=>a.issueKey.localeCompare(b.issueKey))`, a lexical bug) | Lexical key | PARTIAL. `issueMeta` from `fetchIssueMeta` (`jira.ts:1124-1161`, `fields=issuetype,summary,parent`), keyed by referenced activity keys (`StandupNotesPage.tsx:427-457`). The parent story is often NOT in the key set, and the embedded `parent` object never carries `subtasks` | Extend `fetchIssueMeta` (single consumer: `StandupNotesPage.tsx:454`): (a) append `,subtasks` to fields; (b) collect `parentKey`s not in `keys` and, if there are any, make ONE follow-up `key in (…)&fields=subtasks` call in a try/catch; (c) add `subtaskKeys?: string[]` to `StandupIssueMeta` for each parent. In YesterdayColumn replace the `.sort` with helper ordering by `issueMeta?.[group.issueKey]?.subtaskKeys`, using numeric fallback when missing. The query key is page-local (`['standup','issue-meta',…]`), with no sharing. |
| 6 | Worklogs hierarchy | `routes/worklogs/WorklogsPage.tsx:618-624` (`storyNode.subtasks` Map insertion = worklog iteration order); rendered at `:1225` `Array.from(storyNode.subtasks.entries())` | Worklog iteration order | NO, but cheap. The parent story is always in `enrichMap` (via `enrichQuery` if the story has its own worklogs, else via `parentEnrichQuery`) | Append `,subtasks` to the `fields=` of `enrichQuery` (`:402`) and `parentEnrichQuery` (`:442`). Both keys are page-local (`['jira','worklog-enrich',…]`, `['jira','worklog-enrich-parents',…]`). Add `subtasks?: Array<{key:string}>` to `EnrichedIssue` (~`:55-63`). Order at render (or at the end of the memo) with `orderSubtaskKeys([...storyNode.subtasks.keys()], enrichMap.get(storyKey)?.fields.subtasks)`. |
| 7 | Dashboard My Subtasks panel | `routes/dashboard/SubtasksPanel.tsx:68-75` (flat filter, then `.slice(0,5)`) | Insertion order of `fetchMyTasksHierarchy` issues | YES. The same `taskData.issues` contains the parents with `subtasks` (the query key `['jira-issues','my-tasks',project,sp]` is shared with MyTasks, but it's read-only here, so there's no fetcher change) | Build a parent lookup `Map(parentKey → parent.fields.subtasks)` from `taskData.issues` (non-subtask entries), then `orderSubtasksWithinParents(mySubtasks, lookup)` **before** `.slice(0,5)`. |

**No shared fetcher is modified** except `fetchIssueMeta` (1 consumer) and a new `fetchSubtaskOrder`. `fetchMyTasksHierarchy`/`fetchSprintIssues` already request `subtasks`, so there's no cache-key ripple.

## Helper API (`taskflow/src/lib/subtask-order.ts`)

```ts
type KeyLike = { key: string };

/** Numeric-aware issue key compare: project prefix (before last '-') lexically, then integer suffix.
 *  Non-integer suffix (fixtures like 'ESHOP-10-S1') → fall back to
 *  a.localeCompare(b, undefined, { numeric: true }). Never plain lexical. */
export function compareIssueKeysNumeric(a: string, b: string): number;

/** Order keys by parent sequence; keys not in the sequence go after, by compareIssueKeysNumeric.
 *  parentSequence undefined/empty → pure numeric fallback. Pure; returns new array. */
export function orderSubtaskKeys(keys: string[], parentSequence?: ReadonlyArray<KeyLike | string>): string[];

/** Same as orderSubtaskKeys but for issue objects (generic T extends KeyLike). */
export function orderSubtasks<T extends KeyLike>(subtasks: T[], parentSequence?: ReadonlyArray<KeyLike | string>): T[];

/** Flat cross-parent list: group-stable. Parent groups keep first-appearance order;
 *  within each parent, apply orderSubtasks. getParentKey default: s.fields.parent?.key. */
export function orderSubtasksWithinParents<T extends KeyLike>(
  flat: T[],
  parentSequenceFor: (parentKey: string) => ReadonlyArray<KeyLike | string> | undefined,
  getParentKey: (s: T) => string | undefined,
): T[];
```

Implementation note: build `Map<key, index>` from the sequence. Sort with a comparator of the form (inSeq a vs b → index diff; one in seq → it goes first; neither → numeric). Items with no parent key (in the Within-Parents variant) keep their original position relative to groups.

## Common Pitfalls

1. **Non-numeric key suffixes in fixtures.** `filterSprintItems.test.ts` uses `ESHOP-10-S1`. `parseInt` yields NaN, and NaN compares make an unstable sort. Guard with `Number.isInteger` and fall back to `localeCompare(…, {numeric:true})`.
2. **Standup placement drift.** `_placementStatusKey` uses `mySubtasksForParent[0]` (`filterSprintItems.ts:94`). Sorting that array first would silently change which subtask decides the inProgress/upNext bucket. Compute placement from the unsorted array and sort only the `subtasks` output. (The current `[0]` is arbitrary JQL order; changing that is out of scope.)
3. **Don't touch parent/story order.** In `groupByMyDay`, order only the per-parent arrays. The stable band sort (`:204`) relies on the parents' input rank order. Regression tests must assert parent order is unchanged.
4. **SubtasksPanel slice.** Order before `.slice(0, 5)`, or the "first 5" set changes arbitrarily.
5. **Sprint Board memo deps.** Add the order-query data to the `swimlanes` useMemo deps. The `allDoneFingerprint` depends on `swimlanes` but is order-insensitive per lane key, so it's fine. Expect a one-time reorder when the order query resolves after `allData` (numeric → sequence). This is acceptable; do not block the board render on it.
6. **Mock-once fetch tests.** `jira-standup.test.ts:~570-600` mocks one fetch per `fetchIssueMeta` call. The follow-up parent call must be skipped when all parents are already in `keys` (true in that test) and must be try/caught so an unmocked call can't throw. Keep `fields=issuetype,summary,parent` as the prefix (`,subtasks` appended) so `:587` passes.
7. **Worklogs `EnrichedIssue` type** has `[key: string]: unknown`, so `fields.subtasks` compiles as `unknown` unless it's added explicitly. Add a typed optional field.

## Existing Tests Affected

| File | Asserts subtask order? | Impact |
|------|-----------------------|--------|
| `lib/my-tasks-sort.test.ts` | Parent/band order only (`:464, :582, :591`) | None; add subtask-order cases |
| `routes/standup-notes/filterSprintItems.test.ts` | `toContain` only (`:131-360`) | None; add an order case |
| `routes/my-tasks/MyTasksPage.test.tsx` | Band row order (`:485`) | None; add a regression case (subtasks by parent seq, parents in rank) |
| `services/jira-standup.test.ts:587` | URL `toContain('fields=issuetype,summary,parent')` | Passes if `,subtasks` is appended; add a subtaskKeys test |
| `routes/dashboard/SubtasksPanel.test.tsx`, `SprintBoardTab.test.tsx`, `IssueDetailContent.test.tsx`, `WorklogsPage.test.tsx`, `YesterdayColumn*.test.*` | No order assertions on subtasks found (grep) | SprintBoardTab tests mock fetches, so the new query needs a mock or must degrade gracefully when unmocked |

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (`taskflow/package.json`) |
| Quick run | `cd taskflow && npx vitest run src/lib/subtask-order.test.ts src/lib/my-tasks-sort.test.ts src/routes/standup-notes` |
| Full suite | `cd taskflow && npm run test` (also run by the pre-commit hook) |
| Type/lint | `cd taskflow && npx tsc --noEmit && npx biome check ./src` |

Wave 0 gaps: `src/lib/subtask-order.test.ts` (new). It covers X-99 < X-100, cross-project prefix, non-numeric suffix, sequence order, unlisted keys appended numerically, empty/undefined sequence, and group-stable within-parents.

## Security Domain

No new trust boundaries. New/extended JQL `key in (…)` uses keys sourced from Jira responses, the same pattern as the existing fetchers. Tokens must stay out of query keys (T-62-06 convention).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | Jira DC REST `fields.subtasks` is returned in the manual subtask sequence (the user's locked premise) [ASSUMED] | Order would be wrong everywhere the primary path is used; the helper is still correct |
| A2 | JQL without ORDER BY returns Jira's default order, which is arbitrary for our purposes [ASSUMED] | None; we reorder regardless |

## Open Questions

1. Sprint Board: extra REST query (recommended) vs. numeric-only. If the planner/user wants zero new requests on a polled board, use the numeric fallback only. The helper supports both with no code-shape change.
