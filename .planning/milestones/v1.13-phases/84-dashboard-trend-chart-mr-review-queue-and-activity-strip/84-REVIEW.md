---
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/routes/dashboard/dashboardMetrics.ts
  - taskflow/src/routes/dashboard/dashboardMetrics.test.ts
  - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx
  - taskflow/src/routes/dashboard/WeeklyTrendChart.test.tsx
  - taskflow/src/routes/dashboard/ActivityStrip.tsx
  - taskflow/src/routes/dashboard/ActivityStrip.test.tsx
  - taskflow/src/routes/dashboard/index.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 84: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 84 dashboard additions: the weekly Tempo trend bar chart (`WeeklyTrendChart`), the merged Jira+commits activity strip (`ActivityStrip`), the pure derivation helpers (`dashboardMetrics.ts`), the dashboard root wiring (`index.tsx`), and their unit tests.

The core derivation logic is generally sound and the timezone discipline (string-based bucketing, `en-CA` / local-calendar formatting, no `toISOString()` on local Dates) is correctly applied in the production paths. The token-never-in-queryKey rule is honored everywhere. The cache-sharing keys for `ActivityStrip` are byte-identical to `StandupNotesPage` for the self-user case, which I verified against `StandupNotesPage.tsx` lines 308-403.

However there is one BLOCKER: `addDays` in `dashboardMetrics.ts` reintroduces the exact `toISOString()` UTC-shift bug the phase claims to avoid, and the bug is masked by tests that only exercise UTC-midnight inputs. There are also several WARNING-level robustness gaps, most notably a fully unused, untested-in-integration `groupMrsByRole` (the "MR review queue" deliverable appears to have no UI consumer), a misleading `formatRelative` that labels week-old activity "Yesterday", and a test that asserts a false claim about cache reuse.

## Critical Issues

### CR-01: `addDays` calls `toISOString()` on a UTC-constructed Date — the very UTC-shift bug the phase set out to avoid

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:154-159`
**Issue:**
The function is documented as "Never calls toLocaleDateString or toISOString on a locally-constructed Date" and claims `Date.UTC` arithmetic is "safe." It then does exactly the forbidden thing:

```ts
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d + n);
  return new Date(utcMs).toISOString().slice(0, 10);
}
```

This specific code is actually *correct* only because both the construction (`Date.UTC`) and the read-back (`toISOString`) operate in UTC — they cancel out. The danger is that this is a fragile, self-contradicting idiom that violates the codebase's stated rule ("never `toISOString()` for local calendar dates") and directly contradicts its own doc comment. The reason it currently produces correct output is subtle and unguarded by any test.

The real correctness risk: `weekStart` is produced by `getMondayOfCurrentWeek()` via `toLocaleDateString('en-CA')` (local calendar), then fed into `addDays`, which round-trips through UTC. Because `addDays` only ever does integer day arithmetic on a date-only string and reads it back in the same UTC frame, the *values* are correct — but the test suite never proves this across a DST boundary or a non-UTC test runner TZ. `Date.UTC` has no DST, so the arithmetic is safe, but the pattern is exactly what the project memory flags as a recurring source of off-by-one bugs, and any future refactor that swaps `toISOString()` for `toLocaleDateString()` (the "approved" helper elsewhere) would silently break it.

Classifying as BLOCKER because: (a) it violates an explicit, repeatedly-bitten project invariant, (b) the contradiction between the doc comment and the code guarantees a future maintainer will "fix" one or the other and introduce a real shift bug, and (c) no test pins the behavior — `buildWeekBuckets` tests pass `'2026-06-10'` and assert bucket `.day` values, but they never assert that `addDays('2026-03-08', n)` (a DST-transition week in many locales) yields the expected calendar string.

**Fix:** Replace the UTC round-trip with pure string/component arithmetic that never touches `toISOString()`, mirroring the project's `toLocalDateString` discipline:

```ts
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct in local time, mutate by calendar days, read back local components.
  const dt = new Date(y, m - 1, d + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
```

Then add a `buildWeekBuckets` test whose `weekStart` straddles a DST boundary (e.g. `'2026-03-08'`) and assert the Friday bucket `.day` is the expected calendar string, so the invariant is pinned.

## Warnings

### WR-01: `groupMrsByRole` (the "MR review queue" deliverable) has no UI consumer — dead export

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:207-217`
**Issue:**
The phase title is "...MR Review Queue and Activity Strip," and `groupMrsByRole` is implemented and unit-tested, but a repo-wide search finds zero `.tsx` consumers — no component imports or calls it. The MR review queue is either not wired up or was dropped. A tested-but-unrendered function gives false confidence that DASH-06 shipped.
**Fix:** Either wire `groupMrsByRole` into the dashboard MR queue component (and add a render test), or remove the export and its unit tests and update the phase docs to reflect that DASH-06 was deferred. Do not leave a "completed" deliverable that no user can see.

### WR-02: `formatRelative` labels anything older than 24h as "Yesterday" — including activity from days ago

**File:** `taskflow/src/routes/dashboard/ActivityStrip.tsx:61-67`
**Issue:**
```ts
if (diffH < 24) return `${diffH}h ago`;
return 'Yesterday';
```
Because `resolveYesterdayDate` skips weekends and Tempo holidays, on a Monday the "yesterday" activity is from Friday — 3 days (72h) ago — yet every such row renders "Yesterday." After a holiday it could be 4+ days. The label is factually wrong and misleads the user about recency. It also reports negative-ish small values incorrectly if clock skew makes `diffMs` slightly negative (`diffH` would be `-1`, falling through to `'Just now'` only if `< 1`, which it is — so that case is fine, but the >24h case is the real defect).
**Fix:** Compute the actual day delta and label accordingly, or show the real date for anything not within ~24h:

```ts
if (diffH < 1) return 'Just now';
if (diffH < 24) return `${diffH}h ago`;
const days = Math.floor(diffH / 24);
return days === 1 ? 'Yesterday' : `${days}d ago`;
```

### WR-03: Test asserts "cache reuse proves keys are byte-identical to StandupNotesPage" but never compares against StandupNotesPage keys

**File:** `taskflow/src/routes/dashboard/ActivityStrip.test.tsx:64-85, 195-213`
**Issue:**
The test seeds `JIRA_ACTIVITY_KEY` / `COMMITS_KEY` that are *redefined locally in the test file* and then asserts the queryFn spies were not called. That only proves `ActivityStrip` reads the same keys the test itself wrote — it cannot detect drift from the real `StandupNotesPage` keys, which is the whole stated point of criterion 2. If `StandupNotesPage` changed its key shape (e.g. added a 7th element), this test would stay green while cache sharing silently broke. The comment "This proves the ActivityStrip key arrays are byte-identical to StandupNotesPage" (line 206-207) is false.
**Fix:** Export the key-builder helpers from a shared module consumed by both `StandupNotesPage` and `ActivityStrip`, and assert on that shared helper in the test — or, at minimum, import the actual key construction from `StandupNotesPage` rather than re-declaring constants. Otherwise downgrade the comment to state the test only guards local consistency.

### WR-04: `BarChart ... responsive` — non-standard Recharts prop with no width/height context

**File:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx:147`
**Issue:**
`<BarChart data={buckets} responsive margin={{ top: 20 }}>` passes a `responsive` prop. Recharts' `BarChart` does not have a documented `responsive` boolean; responsiveness normally comes from wrapping in `<ResponsiveContainer>`. `SprintHealthSection.tsx:165` uses the same `<PieChart responsive>` idiom, so this may be a project wrapper convention (`ChartContainer`) that injects sizing — but if it is not, the chart can render at Recharts' default fixed width and clip inside the 240px box. This depends on whether `ChartContainer` provides a `ResponsiveContainer`; the prop being silently ignored is the risk.
**Fix:** Confirm `ChartContainer` wraps children in `ResponsiveContainer` (it appears to, given the PieChart precedent). If so, remove the meaningless `responsive` prop to avoid an unknown-prop React warning and reader confusion. If not, wrap the `BarChart` in `<ResponsiveContainer width="100%" height="100%">`.

### WR-05: `YAxis domain={[0, 12]}` hard-caps the chart; days over 12h are visually clipped

**File:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx:149`
**Issue:**
The Y axis is fixed to `[0, 12]`. A worklog day exceeding 12h (long crunch day, or duplicated/imported worklogs) produces a bar that overflows the axis and the `LabelList` value can render outside the plot area or be clipped. The magic number `12` is also undocumented relative to `DAILY_TARGET_HOURS` (8) and `WEEKLY_GOAL_HOURS`.
**Fix:** Make the domain adaptive, e.g. `domain={[0, (max) => Math.max(12, Math.ceil(max))]}` (Recharts supports a function for the max), or compute `Math.max(12, ...buckets.map(b => b.hours))`. At minimum, extract `12` into a named constant with a comment.

### WR-06: Skeleton/empty-state race — `ActivityStrip` can briefly flash empty state during the delayed-loading window

**File:** `taskflow/src/routes/dashboard/ActivityStrip.tsx:208-217`
**Issue:**
`showSkeleton` comes from `useDelayedLoading`, which suppresses the skeleton for a short delay to avoid flicker. During that delay, both queries can be `isLoading=true` with `data` undefined → `entries.length === 0`. `isEmpty` guards on `!showSkeleton && !isLoading...` for both queries, so it is technically protected — but `isEmpty` checks `!jiraActivityQuery.isLoading && !commitsQuery.isLoading`, while the skeleton checks `isLoading || isLoading`. If one query resolves fast and the other is still loading within the delay window, `showSkeleton` is false (delay not elapsed), `entries` is empty (other query pending), and `isEmpty` is false (the pending query's `isLoading` is true) — so nothing renders: the section shows only its `<h2>` header with no body for up to the delay duration. Functionally a momentary blank, not a crash, but it is a visible inconsistency the loading state was meant to prevent.
**Fix:** Drive the empty-state and skeleton decisions from a single derived loading flag (`const loading = jiraActivityQuery.isLoading || commitsQuery.isLoading`) and render the skeleton whenever `loading` is true regardless of the delay, or render nothing (not the bare header) until a terminal state is reached.

## Info

### IN-01: `jiraToken` prop is required by `ActivityStrip` but only used in `enabled` gating and the schedule queryFn

**File:** `taskflow/src/routes/dashboard/ActivityStrip.tsx:70, 98, 100, 139`
**Issue:** `jiraToken` is passed and used in the `enabled` predicate and the schedule `queryFn`, but the jira-activity and commits queryFns deliberately re-`readSecret` instead of using the prop. This is intentional (matches Standup), but the prop's dual role (gate vs. actual fetch token) is easy to misread. A non-empty-but-stale `jiraToken` prop could enable a query whose `readSecret` returns a different/None token.
**Fix:** Add a one-line comment that `jiraToken`/`gitlabToken` props are presence-gates only and the authoritative token is read inside the queryFn via `readSecret`.

### IN-02: `totalCount` recomputes the full merge with `Number.MAX_SAFE_INTEGER` cap purely to count overflow

**File:** `taskflow/src/routes/dashboard/ActivityStrip.tsx:197-206`
**Issue:** A second `mergeActivityEntries` call (with an effectively-infinite cap) runs only to get `.length` for the "+N more" badge. It re-sorts the whole list redundantly. Correctness is fine; it is wasted work and duplicated intent.
**Fix:** Return the untruncated count from a single merge, or compute the total as `jiraEntries.length + commitEntries.length` without sorting — overflow only needs a count, not ordering.

### IN-03: `mergeActivityEntries` relies on lexicographic ISO sort but inputs mix offset/Z and naive timestamps

**File:** `taskflow/src/routes/dashboard/dashboardMetrics.ts:262`
**Issue:** `b.at.localeCompare(a.at)` is correct only when all `at` strings share the same format/zone. Tests use `...T10:00:00` (naive) for Jira and `...T12:00:00` (naive) for commits, but production `authored_date` is typically `...Z` (UTC) while Jira transition `at` may carry an offset like `+02:00`. Lexicographic comparison of `2026-06-14T12:00:00+02:00` vs `2026-06-14T11:00:00Z` is wrong (the offset form sorts after by string but is earlier in absolute time). Ordering could be subtly off across sources.
**Fix:** If sources can carry differing zones, normalize to epoch (`Date.parse`) for the sort comparator, or document/guarantee both upstream fetchers emit UTC `Z` timestamps.

### IN-04: Unused `jiraToken` in `WeeklyTrendChart` enabled-gate vs. queryFn duplication; `totalLabel` regex only strips a single `.0`

**File:** `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx:103`
**Issue:** `weekTotal.toFixed(1).replace(/\.0$/, '')` yields e.g. `"38.5h"` / `"40h"` correctly, but for a value like `40.0` → `"40"`, while `WEEKLY_GOAL_HOURS` is interpolated raw as `40`. Minor: the format of the two halves of `"x / y"` is inconsistent (computed-and-trimmed vs. raw number). Cosmetic only.
**Fix:** Format both sides through the same helper for consistent presentation, or leave as-is (purely cosmetic).

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
