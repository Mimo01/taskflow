---
phase: 260607-mhc-standup-watched-person-picker
reviewed: 2026-06-07T00:00:00Z
depth: quick
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.test.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.tsx
  - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  - taskflow/src/routes/standup-notes/effectiveIdentity.test.ts
  - taskflow/src/routes/standup-notes/effectiveIdentity.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 260607-mhc: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** quick
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the standup "watched person" picker feature: identity resolution
(`effectiveIdentity.ts`), the picker dropdown, the page shell, and the Today column.

**Load-bearing guard verdict — HOLDS.** The critical requirement (a watched
non-me person must NEVER fall back to the logged-in user's GitLab identity for the
GitLab-ID-dependent MR sections) is satisfied and not bypassed downstream:

- `resolveEffectiveIdentity` forces `gitlabUserId`/`gitlabUsername`/`gitlabEmail`
  to `null` for any watched user (effectiveIdentity.ts:68-70) and never references
  the auth GitLab fields in the watched branch.
- All three MR sections gate on the forced-null id:
  - `mrEventsQuery` — `enabled: ... && !!id.gitlabUserId` (StandupNotesPage.tsx:293), keyed on `id.gitlabUserId` (:285).
  - `reviewerMrsQuery` — `enabled: ... && !!watchedGitlabUserId` (TodayColumn.tsx:236), keyed on `watchedGitlabUserId` (:229).
  - `participatingMrsQuery` — `enabled: ... && !!watchedGitlabUserId` (TodayColumn.tsx:250), keyed on `watchedGitlabUserId` (:243).
- The Copy-markdown cache reads use `id.gitlabUserId` (StandupNotesPage.tsx:389,392),
  so a watched person reads the `null`-keyed (empty) cache entry — no stale "me" MRs leak.
- The only non-`id.` GitLab field references are the `gitlabName`/`gitlabEmail`
  backfill effect, which operates on the logged-in user's auth store and is
  independent of `watchedUser`.

The remaining findings are correctness robustness and quality issues; none defeat
the guard.

## Warnings

### WR-01: `id` recomputed every render without memoization can re-trigger queries

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:113-124`
**Issue:** `resolveEffectiveIdentity` returns a brand-new object literal on every
render. While query keys are value-compared (so this does not itself cause refetch
loops), `id` is also passed as props (`watchedDisplayName`, etc.) and used in
several `useMemo`/dependency positions indirectly. More importantly, any future
consumer that depends on `id` by reference (effect deps, memo deps) would re-run on
every render. Wrap in `useMemo` keyed on the underlying auth fields + `watchedUser`
to make the identity stable.
**Fix:**
```ts
const id = useMemo(
  () => resolveEffectiveIdentity(
    { jiraUsername, jiraUserKey, jiraUserDisplayName, gitlabUserId, gitlabUsername, gitlabName, gitlabEmail },
    watchedUser,
  ),
  [jiraUsername, jiraUserKey, jiraUserDisplayName, gitlabUserId, gitlabUsername, gitlabName, gitlabEmail, watchedUser],
);
```

### WR-02: Commits query still runs for a watched person using the logged-in user's commit window — potential mismatched data

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:251-282`
**Issue:** For a watched person, `id.gitlabUsername`/`id.gitlabEmail` are null but
`id.gitlabName` is the watched display name, so `enabled` (`!!id.gitlabUsername || !!id.gitlabName`)
stays true and the commits query fires. This is intended ("best-effort name match"),
but unlike the MR sections there is **no "not matched" hint** for commits and no
explicit confirmation in the Yesterday column that these commits belong to the
watched person rather than the logged-in user. If two people share a display name,
or the watched person's git `author_name` differs from their Jira display name,
this silently shows wrong-or-empty commit data with no user-facing signal. Confirm
this is the locked decision; if so, add a parallel "matched by name only" hint for
the commits section so it does not read as authoritative.
**Fix:** Either disable commits for watched persons (treat like MRs), or surface a
hint analogous to `showNotMatchedHint` in the Yesterday column when `isWatched && !id.gitlabUserId`.

### WR-03: `formatDateLabel` does not validate parsed date parts (NaN propagation)

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:60-69`
**Issue:** If `dateStr` is malformed or empty (e.g. `yesterdayDate` resolves to `''`
before schedule data loads), `parseInt` yields `NaN`, `new Date(NaN, NaN, NaN)`
produces an Invalid Date, and `DAY_NAMES[d.getDay()]` is `DAY_NAMES[NaN]` →
`undefined`, rendering "undefined, NaN undefined NaN". There is no guard. The
`yesterdayDate` value flows from `resolveYesterdayDate` and a transient override,
so robustness here matters.
**Fix:**
```ts
function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return dateStr;
  const d = new Date(year, month, day);
  return `${DAY_NAMES[d.getDay()]}, ${day} ${MONTH_NAMES[month]} ${year}`;
}
```

### WR-04: Picker keyed on `user.name` — collides for users sharing the same Jira name

**File:** `taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx:123,127`
**Issue:** The list `key={user.name}` and the selected-state comparison
`value?.name === user.name` both assume `name` is unique. On Jira instances where
`name` is a non-unique username (or where the assignable-user endpoint returns the
same `name` for renamed accounts), React key collisions cause render warnings and
the wrong row can highlight as selected. The Jira `key` (account key) is the stable
identifier when present.
**Fix:** Use `user.key ?? user.name` for both the React key and the selected
comparison, falling back to `name` only when `key` is absent.

## Info

### IN-01: `gitlabName` passed to commits query is the only "watched" signal — undocumented coupling

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:271-272`
**Issue:** `fetchUserCommits` receives `id.gitlabName`/`id.gitlabEmail`, which carry
the watched person's display name / `null` email. This implicit "name-only matching
for watched persons" behavior is load-bearing but only documented in
`effectiveIdentity.ts`, not at the call site. A future edit to the `enabled`
predicate could silently change behavior.
**Fix:** Add a one-line comment at the commits query `enabled` clause noting the
watched-person name-only matching path.

### IN-02: `navigator.clipboard.writeText` failure is fully silent

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:399-401`
**Issue:** On clipboard failure the `.catch` swallows the error and the UI still
shows "Copied!" (set unconditionally at :402). The user gets a false success signal.
**Fix:** Only set `copied` inside the success path (`.then`), or surface a brief
error state on rejection.

### IN-03: Schedule lookback comment references double-call that no longer exists

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:188-190`
**Issue:** The comment warns about "calling getScheduleLookbackRange() twice" but
the code calls it once. The comment is stale/aspirational and may confuse future
readers into thinking a second call was removed nearby.
**Fix:** Trim the comment to state the single-call intent without the historical caveat.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
