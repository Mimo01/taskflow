---
phase: 74-backlog-on-data-json
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - taskflow/package.json
  - taskflow/scripts/check-legacy-backlog-keys.mjs
  - taskflow/src/components/app/RecentItemsPopover.tsx
  - taskflow/src/components/app/Sidebar.test.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/components/app/__tests__/Sidebar.prefetch.test.tsx
  - taskflow/src/main.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/__tests__/BacklogPage.network.test.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
  - taskflow/src/routes/worklogs/WorklogCellPopover.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/backlog.test.ts
  - taskflow/src/services/jira/backlog.ts
  - taskflow/src/services/jira/epics.ts
  - taskflow/src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts
  - taskflow/src/services/jira/greenhopper/__tests__/types-fixture.test.ts
  - taskflow/src/services/jira/greenhopper/__tests__/useGhBacklogData.test.tsx
  - taskflow/src/services/jira/greenhopper/index.ts
  - taskflow/src/services/jira/greenhopper/types.ts
  - taskflow/src/services/jira/greenhopper/useGhBacklogData.ts
  - taskflow/src/services/jira/types.ts
findings:
  blocker: 2
  warning: 6
  info: 3
  total: 11
status: fixed
fixed_at: 2026-05-29T00:00:00Z
fix_report: .planning/phases/74-backlog-on-data-json/74-REVIEW-FIX.md
---

# Phase 74: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 74 swaps the backlog from three legacy REST queries to a single
`useGhBacklogData(boardId)` call against the GreenHopper `plan/backlog/data.json`
envelope. The cutover is mostly clean: cache invalidation routes uniformly
through `invalidateGhBacklogData`, the prefetch path was correctly collapsed,
the static guard script (`check-legacy-backlog-keys.mjs`) is well-formed, and
the new fetcher/hook contracts are well-tested.

However, the new derivation logic in `BacklogPage.tsx` has two correctness
bugs around CLOSED sprints. The data envelope returns ACTIVE/CLOSED/FUTURE
sprints in `data.sprints[]`, but the page silently throws away CLOSED-sprint
membership. The reverse index is built from ALL sprints (including CLOSED),
yet the visible sprint sections and lookup helper only include ACTIVE/FUTURE.
The interaction produces issues that disappear from both the backlog list
and the rendered sprint sections, and produces a null "from sprint" name in
the move-confirmation dialog.

The Sidebar `/backlog` prefetch test also does not exercise the production
prefetch path — it tests a local helper duplicating the Sidebar branch shape
rather than the real component — which weakens the gate the file claims to
enforce.

## Blocker Issues

### BL-01: Issues in CLOSED sprints disappear from the backlog view

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:261-289`

**Issue:** The reverse index `issueIdToSprintId` is built from
`backlog?.sprints ?? []` *without filtering by state*, so an issue whose only
sprint membership is a CLOSED sprint gets a synthesized `fields.sprint.id`.
Then:

- `backlogIssuesAdapted` (line 286-289) filters out *any* issue with a
  `fields.sprint` set, so the issue is excluded from the backlog list.
- `sprintSections` (line 294-304) filters sprints to `state === 'ACTIVE'`
  or `'FUTURE'` only, so the issue is not rendered in any sprint section
  either.

Net result: an issue carried over from a recently-closed sprint silently
vanishes from the page. Real Jira backlog views surface such issues in
the unassigned backlog (or under the closed sprint, if shown). This is a
data-loss-style UX defect — the issue exists but the user cannot see or
operate on it.

**Fix:** Either include CLOSED sprints in the reverse index only when the
backlog filter actually wants to hide them, or — preferred — restrict the
reverse index to ACTIVE/FUTURE sprints so CLOSED-only issues fall through
to the backlog bucket:

```ts
const issueIdToSprintId = useMemo(() => {
  const m = new Map<number, number>();
  for (const s of backlog?.sprints ?? []) {
    if (s.state !== 'ACTIVE' && s.state !== 'FUTURE') continue;
    for (const id of s.issuesIds) m.set(id, s.id);
  }
  return m;
}, [backlog?.sprints]);
```

This keeps the page's "ACTIVE+FUTURE sections + backlog" partitioning
consistent.

### BL-02: `lookupSprintNameById` returns null for sprints currently holding the issue when CLOSED

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:562-566`

**Issue:** `lookupSprintNameById` searches only `sprintSections`, which has
already filtered out CLOSED sprints (line 297). If BL-01 is fixed by leaving
CLOSED sprints in the reverse index (rather than the alternative), an issue
whose synthesized `fields.sprint.id` points at a CLOSED sprint will report
`fromSprintName: null` in the confirmation dialog, even though the sprint
name is available in `backlog.sprints`. The user sees "Move from — to
Backlog" with a blank source.

Even with the BL-01 fix above, the helper is still fragile: any future
caller that passes an arbitrary `sprintId` from elsewhere (e.g. issue
detail) will fail to resolve a closed-sprint name.

**Fix:** Resolve names from the raw `backlog.sprints` array, which is the
full list, not the filtered visible sections:

```ts
function lookupSprintNameById(sprintId: number | null | undefined): string | null {
  if (sprintId == null || !backlog) return null;
  const s = backlog.sprints.find((x) => x.id === sprintId);
  return s ? s.name : null;
}
```

## Warnings

### WR-01: `Sidebar.prefetch.test.tsx` does not test the production prefetch path

**File:** `taskflow/src/components/app/__tests__/Sidebar.prefetch.test.tsx:38-74`

**Issue:** The file's docstring claims it gates the `/backlog` Sidebar prefetch
contract ("D-08 / D-08a"), but the test defines and exercises its own
`prefetchBacklog` helper that *mirrors* the Sidebar branch instead of importing
or rendering `Sidebar.tsx`. If `Sidebar.tsx`'s `/backlog` branch is later
edited (e.g. an extra fetch added, the boardId guard removed, the wrong cache
key used), the test will keep passing because it never observes the real
component. The docstring even acknowledges this trade-off, but the file's
name and asserted contract suggest a stronger gate than what's implemented.

This is exactly the failure mode the team has hit before (per
`feedback_release_changelogs.md` and the project's "verify adapters against
real probe results" lesson — `project_phase71_gh_migration_gaps.md`).

**Fix:** Either (a) render the real `Sidebar` component with the same mock
setup the existing `Sidebar.test.tsx` uses and assert on `getGhBacklogData`
call counts after firing `focus`/`mouseenter` on the Backlog NavLink, or
(b) rename the file and its describe blocks to reflect that this is a
helper-shape regression test, not a Sidebar contract test.

### WR-02: `RecentItemsPopover` and `main.tsx` cast partial GH objects to `JiraIssue`

**File:** `taskflow/src/components/app/RecentItemsPopover.tsx:60-68`
**File:** `taskflow/src/main.tsx:372-383`

**Issue:** Both call sites adapt the gh-backlog `{ key, summary }` shape into
a `JiraIssue` via `as JiraIssue` casts where only `key` and `fields.summary`
are populated. The full `JiraIssue` interface requires `id`, `fields.status`,
`fields.assignee`, `fields.customfield_10016`, `fields.issuetype`, etc.
Today's consumers read only `.fields.summary`, but any future caller (or any
shared helper that touches `.fields.status.name` or `.fields.issuetype`) will
throw a TypeError on a GH-sourced recent item.

The unsafe cast bypasses the type system silently, defeating the protection
the type was meant to provide.

**Fix:** Either return a narrow `{ key: string; summary: string }` shape and
make callers consume `.summary` directly, or extend `findJiraIssueInCache`
to return `JiraIssue | { key: string; summary: string }` (a discriminated
union) so callers can branch safely.

### WR-03: `Sidebar.tsx` prefetch timer can be silently overwritten

**File:** `taskflow/src/components/app/Sidebar.tsx:193-198`

**Issue:** `handleNavMouseEnter` writes to `prefetchTimerRef.current` without
first clearing any prior timer:

```ts
function handleNavMouseEnter(path: string) {
  if (!PREFETCH_ROUTES.has(path)) return;
  prefetchTimerRef.current = setTimeout(() => { prefetchForPath(path); }, 100);
}
```

If the user moves the cursor between two PREFETCH_ROUTES navlinks faster
than the 100ms debounce (no mouseleave reliably fired in between, e.g.
keyboard focus interleaved with hover), the previous timer fires anyway
and the second prefetch fires too — costing two redundant boardId resolves
plus two GH envelope fetches. The unmount-cleanup useEffect at line 109-115
only clears the last assignment.

**Fix:**

```ts
function handleNavMouseEnter(path: string) {
  if (!PREFETCH_ROUTES.has(path)) return;
  if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
  prefetchTimerRef.current = setTimeout(() => { prefetchForPath(path); }, 100);
}
```

### WR-04: `BacklogPage.tsx` invalidates `['jira-sprint-stories']` from optimistic move handlers, but Phase 74 plan declares sprint-stories should also be a cut surface for some paths

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:627-628, 659-660`

**Issue:** The two confirmMove handlers invalidate both `['jira-sprint-stories']`
*and* call `invalidateGhBacklogData`. This is intentional cross-surface
freshness (the comment says so), but on a Phase 73 sprint-board that has
itself migrated to `getGhAllData`, `['jira-sprint-stories']` is dead — the
invalidation is a no-op against a key that is never populated by the active
codepath. Worse, it makes it harder for a future reader to know which keys
are live and which are vestigial.

**Fix:** Either delete the dead invalidation lines, or add an explicit
comment naming the legacy consumer still reading `['jira-sprint-stories']`
(if there genuinely is one) so future cleanup phases can audit the
dependency.

### WR-05: `confirmMoveToSprint` calls `void sprintName` after the API call

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:633`

**Issue:** The third parameter `sprintName` is read into the function but
never used, and the trailing `void sprintName;` is a dead noop tagging an
unused parameter to suppress a lint warning. This indicates the parameter
should either be removed from the signature or actually used (e.g. for an
optimistic toast). Carrying it forward as a `void` makes the call site
misleading — readers expect a confirmation dialog that shows the
destination sprint name to pass it through to the API layer.

**Fix:** Remove `sprintName` from the function signature and from the
call site at line 826-828, or replace `void sprintName;` with a real use
(toast, telemetry, etc).

### WR-06: `useFieldMutation.ts` invalidates *all* backlog boards on every issue-detail field edit

**File:** `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts:46-47`

**Issue:** `onSettled` calls `invalidateGhBacklogData(queryClient)` with no
`boardId` argument, so every field edit on every issue triggers a refetch
of every cached backlog board envelope. This is over-broad: a description
edit, a label add, a priority change — none of those affect backlog
membership or any field the backlog row displays *except* status (which
itself has dedicated invalidations elsewhere). On a user that has visited
multiple projects' backlogs in a session, this causes N redundant refetches
per edit.

The comment explicitly acknowledges "No boardId is available in this shared
hook, so invalidate all boards" — but the hook is called from the active
issue's detail view, so the issue's project key (and therefore its board
id) IS available via `useBoardId(jiraBaseUrl, token, activeJiraProject)`
the same way `FieldsSection.tsx` resolves it (FieldsSection.tsx:149).

**Fix:** Thread `boardId` (or the auth-store project key) into
`useFieldMutation` and call `invalidateGhBacklogData(queryClient, boardId)`.
Falling back to the all-boards invalidation only when boardId is genuinely
unavailable.

## Info

### IN-01: `Sidebar.tsx` `prefetchForPath` silently swallows errors

**File:** `taskflow/src/components/app/Sidebar.tsx:134, 188`

**Issue:** Both fetchQuery chains end with `.catch(() => {})`. Prefetch
errors are now invisible to telemetry or to the dev tools. A persistently
failing `fetchBoardId` will silently never warm the cache and the user
will hit cold loads on every backlog visit — but no one notices.

**Fix:** At minimum log the error in dev (`if (import.meta.env.DEV)
console.warn('backlog prefetch failed', e);`). Production telemetry is
out of scope but should be considered when the team adopts an error
reporter.

### IN-02: `check-legacy-backlog-keys.mjs` excludes `__tests__` AND any path with `.test.` — double exclusion

**File:** `taskflow/scripts/check-legacy-backlog-keys.mjs:46-53`

**Issue:** `isExcluded` returns true for both `__tests__/` paths and any
file whose basename contains `.test.`. The latter is the broader rule and
makes the former redundant. Not a bug, but the redundancy invites future
drift (e.g. someone removes the `__tests__` check thinking it's covered,
then a non-test file in a `__tests__` directory leaks through).

**Fix:** Pick one convention and document it. The repo uses both `*.test.ts`
co-located *and* `__tests__/` directories, so keeping both checks is fine —
just add a one-line comment explaining the dual rationale.

### IN-03: `BacklogPage.tsx` `useEffect` to reset stale-data banner has empty deps despite needing to react to retries

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:388-390`

**Issue:**

```ts
const [bannerDismissed, setBannerDismissed] = useState(false);
useEffect(() => {
  setBannerDismissed(false);
}, []);
```

The effect runs once on mount and never again. If the user dismisses the
stale-data banner, then triggers a manual reload, then hits another
transient error, the banner stays dismissed. Either the effect should
depend on `isError` or `dataUpdatedAt` (to re-show the banner on a fresh
error after a successful refetch), or it should be deleted entirely
(setting initial state to `false` is what `useState(false)` already does).

**Fix:** Delete the effect, or add `[dataUpdatedAt]` so that a successful
refetch re-arms the banner for the next error.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
