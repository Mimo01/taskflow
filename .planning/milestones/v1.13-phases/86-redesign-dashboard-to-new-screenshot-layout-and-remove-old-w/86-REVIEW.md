---
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - taskflow/src/lib/clickable-card.ts
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/MyIssuesCard.tsx
  - taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx
  - taskflow/src/routes/dashboard/HoursCommitsChart.tsx
  - taskflow/src/routes/dashboard/dashboardMetrics.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 86: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The Phase 86 dashboard redesign is architecturally sound: the three-region layout, shared-cache
query keys, prop-drilling auth pattern (D-16), and independent per-section degradation are all
correctly implemented. No security vulnerabilities or data-loss risks were found.

Three correctness issues need addressing before ship:

1. The sprint-day counter is off-by-one (shows "Sprint day 3 of 9" instead of "4 of 10") due to
   an incorrect `-1` applied to both the elapsed and total working-day counts.
2. `getReleaseTimingLabel` in `UpcomingReleasesTimeline.tsx` uses `toISOString()` for the
   "today" comparison — the documented UTC-shift bug class that the project explicitly forbids.
3. The D-03 segment-bar invariant (`toDo + inProgress + done === total`) can be silently
   violated if a Jira instance returns an unusual `statusCategory.key`, leaving an invisible
   gap in the bar and a wrong "N of M done" headline.

---

## Warnings

### WR-01: Sprint-day counter off-by-one — shows "day 3 of 9" instead of "day 4 of 10"

**File:** `taskflow/src/routes/dashboard/index.tsx:198-199`

**Issue:** Both `elapsed` and `total` subtract 1 from `countWorkingDays(...)`. The intent is
1-indexed ("Sprint day 1" on the first working day, "Sprint day 10 of 10" on the last). With
both subtracted, a 10-working-day sprint displays as "Sprint day 0 of 9" on day 1 and
"Sprint day 9 of 9" on day 10 — one less than the screenshot contract ("Sprint day 4 of 10").

Concrete example — sprint Mon 2026-06-09 → Fri 2026-06-20 (10 working days), today = Thursday
2026-06-12 (working day 4):

| | Current (buggy) | Correct |
|---|---|---|
| elapsed | `countWorkingDays("06-09","06-12") - 1 = 3` | `countWorkingDays(...) = 4` |
| total | `countWorkingDays("06-09","06-20") - 1 = 9` | `countWorkingDays(...) = 10` |
| display | "Sprint day 3 of 9" | "Sprint day 4 of 10" |

**Fix:** Remove both `-1` adjustments:

```typescript
// index.tsx lines 198-199
const elapsed = countWorkingDays(start, today);   // was: - 1
const total   = countWorkingDays(start, end);      // was: - 1
return ` · Sprint day ${elapsed} of ${total}`;
```

---

### WR-02: `getReleaseTimingLabel` uses `toISOString()` for "today" — UTC-shift bug

**File:** `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx:37`

**Issue:** The function derives `today` via `new Date().toISOString().slice(0,10)`, which returns
the UTC date. For users west of UTC (e.g., UTC-5), after 7 pm local time the UTC date has
already rolled to tomorrow — making a release due "today" appear "overdue" and a release due
"tomorrow" appear "in 1 day" instead. The project has a standing rule (D-11, `standup-date.ts`,
project memory `project_fetch_once_pagecap_pitfall`) to use `toLocaleDateString('en-CA')` for
local-calendar "today" comparisons. The comment "T-60-10 timezone-safe" was inherited verbatim
from `DashboardReleaseCard` and is incorrect.

**Fix:**
```typescript
// UpcomingReleasesTimeline.tsx — getReleaseTimingLabel, line 37
- const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
+ const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local calendar (never toISOString)
```

The `daysUntil` calculation at line 41 uses `new Date(today)` and `new Date(releaseDate)`, both
date-only strings (parsed as UTC midnight), so the diff math is self-consistent and does not need
a separate fix — only the initial `today` derivation needs to change.

---

### WR-03: D-03 invariant can silently break: unknown `statusCategory.key` causes bar-gap and wrong headline

**File:** `taskflow/src/routes/dashboard/MyIssuesCard.tsx:67-72`

**Issue:** `total = myNonSubtasks.length` counts all personal non-subtask issues, but the three
segment counts (`toDo`, `inProgress`, `done`) only match keys `'new'`, `'indeterminate'`, and
`'done'`. Any issue whose `statusCategory.key` is absent or non-standard (e.g., `null`,
`undefined`, or a custom category on some Jira on-prem instances) is counted in `total` but not
in any segment. The headline reads "X of M done" with a wrong M, and the segmented bar's three
`<div>` widths sum to less than 100% — producing a visible transparent gap at the right end of
the rounded track.

The comment at line 73 acknowledges this ("T-86-03") but the test only catches the invariant in
isolation; the rendering does not defend against it at runtime.

**Fix — option A** (safest, zero rendered gap): exclude unmapped issues from `total`:

```typescript
// MyIssuesCard.tsx
const toDo       = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'new').length;
const inProgress = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length;
const done       = myNonSubtasks.filter(i => i.fields.status.statusCategory?.key === 'done').length;
const total = toDo + inProgress + done; // invariant holds by construction
```

**Fix — option B** (keeps total, fills bar gap): add a fourth "unknown" catch segment:

```typescript
const unknown = total - toDo - inProgress - done;
// Then add a fourth segment after the 'done' div:
<div className="bg-muted-foreground/30" style={{ width: `${(unknown / total) * 100}%` }} />
```

Option A is preferred for consistency with D-02 (the "8 of 13" example implies only mapped
statuses count).

---

## Info

### IN-01: `jira-release-issues` cache key is unique to this component — warm-cache sharing claim is inaccurate

**File:** `taskflow/src/routes/dashboard/UpcomingReleasesTimeline.tsx:88`

**Issue:** The header comment claims "Cache keys MUST MATCH ReleasesTab.tsx / DashboardReleaseCard.tsx
exactly — shared cache entries." The key `['jira-release-issues', activeJiraProject, v.name]` does
not exist anywhere else in the codebase (`grep` confirms it is used only in this file). The
`fetchReleaseIssues` function has no other callsite. This means the 1–3 per-version issue queries
are always cold calls, not warm-cache reads. The "no new API" constraint (D-07) refers to not
adding a new endpoint, which is satisfied — but the "zero extra network calls" implication in the
comment is wrong. This is not a functional bug but the comment misleads future maintainers.

**Fix:** Update the comment to reflect reality:

```typescript
// queryKey: new per-version query — not shared with other pages.
// fetchReleaseIssues is called 1–3 times (one per upcoming version).
queryKey: ['jira-release-issues', activeJiraProject, v.name],
```

---

### IN-02: `HoursCommitsChart` skeleton only gates Tempo; commit loading state ignored

**File:** `taskflow/src/routes/dashboard/HoursCommitsChart.tsx:310`

**Issue:** `showSkeleton = useDelayedLoading(worklogsLoading)` only tracks the Tempo worklog query.
If worklogs resolve in 50 ms but the 7 per-day GitLab commit queries take 500 ms, the chart
renders immediately with all commit bars at "0" (via the `?? 0` fallback), then re-renders 7 times
as each day's commits arrive. On a cold cache this produces visible bar animation. The pattern is
functionally correct (graceful zero-fill) but the comment in D-12 says "all-zero connected week
renders flat bars" — this could be misread to mean commits are stable, not just temporarily zero.

**Fix** (low priority — cache is typically warm): combine loading states or document the
intentional progressive render:

```typescript
const anyCommitsLoading = commitsResults.some(r => r.isLoading);
const showSkeleton = useDelayedLoading(worklogsLoading || anyCommitsLoading);
```

---

### IN-03: `nextWorkingDay` fallback shows hardcoded string "Monday" instead of a formatted date

**File:** `taskflow/src/routes/dashboard/index.tsx:193`

**Issue:** When a non-working day falls after the sprint's end date, the sprint clause reads
"sprint resumes Monday" with a hardcoded literal rather than the formatted next-Monday date.
This means on a Sunday that is past the sprint end, the display could say "sprint resumes Monday"
without specifying *which* Monday. The path is extremely unlikely in practice (sprint ending on a
Saturday/Sunday is unusual), but the formatted path (`formatResumeLabel(resume)`) is already
available and would be more informative.

**Fix:**
```typescript
// index.tsx line 193
- const resumeLabel = resume <= end ? formatResumeLabel(resume) : 'Monday';
+ const resumeLabel = formatResumeLabel(resume); // always use the computed date label
```

(The outer guard `if (today < start || today > end)` already hides the clause when today is
outside the sprint window, so the only case this fallback fires is a non-working day where the
next working day overshoots the sprint end — extremely rare, but hardcoding "Monday" is still
incorrect.)

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
