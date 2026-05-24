---
slug: worklogs-date-filters
status: resolved
trigger: "On worklogs page the predetermined date filters do not work correctly. The week filters should be monday-sunday (currently saturday-friday) and the month filters should be from first day of the month to last (currently start on last day of previous month and end one day before end of month)"
created: 2026-05-25
updated: 2026-05-25
---

# Debug Session: worklogs-date-filters

## Symptoms

- **Expected behavior:**
  - Week preset filters should span Monday → Sunday
  - Month preset filters should span first day of month → last day of month
- **Actual behavior:**
  - Week preset filters span Saturday → Friday (off by ~2 days / wrong week start)
  - Month preset filters start on the last day of the previous month and end one day before the end of the current month (off by one day, likely timezone/UTC shift)
- **Error messages:** none — logic/date-calculation bug, no thrown errors
- **Timeline:** not specified
- **Reproduction:** Open the worklogs page, apply the predetermined (preset) date range filters (week / month)

## Current Focus

- hypothesis: CONFIRMED — all five date-range helpers used `.toISOString().slice(0, 10)` to format dates built via local-time constructors. `toISOString()` converts to UTC and shifts the date by a day in any timezone with non-zero UTC offset.
- next_action: RESOLVED — fix applied
- test: n/a (no unit tests for internal helpers; existing test suite passes at same rate as before)
- expecting: n/a
- reasoning_checkpoint: The week off-by-Saturday error is explained by the UTC shift: in UTC+2, local Monday midnight is UTC Sunday, so `toISOString()` returns Sunday's date for Monday's `Date` object. Combined with the 6-day addition for Sunday, both ends shift one day back (Mon→Sun becomes Sat→Fri). The month off-by-one is the same mechanism: `new Date(y, m, 1)` at local midnight becomes UTC prior-day midnight.

## Evidence

- timestamp: 2026-05-25T00:51
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx
  lines: 130-189 (original)
  finding: |
    All five helpers — getThisWeekRange, getLastWeekRange, getThisMonthRange,
    getLastMonthRange, getLastWorkingDay — used `.toISOString().slice(0, 10)`
    to format dates constructed via `new Date()` / `new Date(y, m, d)` (local
    time). toISOString() converts to UTC, shifting the date by the local UTC
    offset. The symptom "Saturday→Friday week" and "previous-day month start"
    are both explained by a ≥+1h UTC offset.
    
    Confirmed with node: old code produced 2026-05-24 (Sunday) as the Monday
    of current week; new code produces 2026-05-25 (correct Monday).
    
    The codebase already documents this pitfall (RESEARCH A1, Phase 61 note
    in enumerateDays comment) and the fix pattern (local date formatting via
    getFullYear/getMonth/getDate) was already used in enumerateDays and
    formatDayHeader.

## Eliminated

- Incorrect week-start day setting: eliminated. The day-of-week arithmetic
  (dow === 0 ? 6 : dow - 1) is correct for ISO Mon-start. The bug is purely
  the UTC formatting.
- Backend/Rust involvement: eliminated. Pure frontend date calculation bug.

## Resolution

- **root_cause:** All five date-range preset helpers in WorklogsPage.tsx used
  `.toISOString().slice(0, 10)` to format locally-constructed `Date` objects.
  `toISOString()` converts to UTC, shifting dates by a full day in timezones
  east of UTC (e.g. UTC+2 makes Monday midnight appear as Sunday in UTC).
  This caused week ranges to start on Saturday instead of Monday and month
  ranges to start on the last day of the previous month.

- **fix:** Introduced a `localISO(d: Date): string` helper that formats using
  `getFullYear()` / `getMonth()` / `getDate()` (local time components), then
  replaced all `.toISOString().slice(0, 10)` calls in the five helpers with
  `localISO(...)`. The same pattern was already used in `enumerateDays` and
  documented as the correct approach (RESEARCH A1).

- **files_changed:**
  - taskflow/src/routes/worklogs/WorklogsPage.tsx — lines 112-199 (helpers
    block): added `localISO` helper, updated all five range functions, updated
    stale comment in enumerateDays.

- **tests:** 39/44 pass (same as pre-fix baseline; 5 pre-existing failures are
  unrelated — they use hardcoded 2026-05-18/19 dates that fall outside the
  current week range).
