---
slug: standup-yesterday-header
status: resolved
trigger: "On standup notes page, when last working day was yesterday, the left column header should be 'yesterday' instead of the day name as when there was weekend or holiday"
created: 2026-05-26
updated: 2026-05-26
---

# Debug Session: standup-yesterday-header

## Symptoms

- **Expected behavior:** On the standup notes page, when the last working day was yesterday, the left column header should display "yesterday".
- **Actual behavior:** The header shows the weekday name (e.g. "Monday") even when the last working day was literally yesterday. The "yesterday" special-case is not applied.
- **Error messages:** None reported.
- **Timeline:** Unknown whether this ever worked correctly (user: "Not sure").
- **Reproduction:** Open the standup notes page on a normal weekday where the previous day was a working day; observe the left column header shows the day name instead of "yesterday".
- **Additional context:** The weekend/holiday case is correct — when there is a weekend or holiday gap, the day name shows correctly. Only the "yesterday" (single-day-back) case is wrong. This points to a missing/incorrect special case for the 1-working-day-ago path, while the multi-day-gap path renders the day name as intended.

## Current Focus

- hypothesis: CONFIRMED — getColumnHeading() used toISOString().slice(0,10) to build the calendar-yesterday string, but toISOString() converts to UTC. For users east of UTC the UTC date can be one day behind the local date, so the comparison always fails and falls through to the day-name branch.
- test: Existing test `generateMarkdown — section header label / uses "Yesterday"` with vi.setSystemTime covering this case.
- expecting: "Yesterday" heading when yesterdayDate === local calendar day - 1
- next_action: DONE — fix applied and tests passing
- reasoning_checkpoint: The fix replaced toISOString().slice(0,10) with local-component formatting (getFullYear/getMonth+1/getDate with padStart) — the same pattern used throughout the codebase per the standing rule in standup-date.ts.
- tdd_checkpoint: (not applicable)

## Evidence

- timestamp: 2026-05-26T00:44:00Z
  file: taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  finding: >
    getColumnHeading() (line 82-90) computed calYesterdayIso via
    calYesterday.toISOString().slice(0,10). toISOString() converts to UTC.
    resolveYesterdayDate() in standup-date.ts produces a LOCAL date string
    (using toLocalDateString helper). For users east of UTC the UTC string
    lands one day behind the local string, so dateStr === calYesterdayIso
    is always false — "Yesterday" is never returned.

- timestamp: 2026-05-26T00:44:00Z
  file: taskflow/src/lib/standup-date.ts
  finding: >
    The file explicitly documents this anti-pattern at line 9:
    "format with toLocalDateString() below — NOT toISOString(), which
    converts to UTC and shifts the calendar day off-by-one for users east
    of UTC or at day boundaries." The ban was not respected in YesterdayColumn.

## Eliminated

- Suspect: logic in resolveYesterdayDate() — ELIMINATED. That function uses toLocalDateString correctly.
- Suspect: dateLabel prop mismatch — ELIMINATED. dateLabel is a display-only string; the heading uses getColumnHeading(yesterdayDate) directly.
- Suspect: wrong yesterdayDate being passed from StandupNotesPage — ELIMINATED. yesterdayDate is correctly resolved via resolveYesterdayDate().

## Resolution

- root_cause: getColumnHeading() in YesterdayColumn.tsx used toISOString().slice(0,10) to construct the calendar-yesterday comparison string. toISOString() outputs UTC, while yesterdayDate is a local-timezone string. For users in timezones east of UTC the UTC date is behind the local date, so the equality check always fails and the day name is returned instead of "Yesterday".
- fix: Replaced `calYesterday.toISOString().slice(0, 10)` with local-component formatting: `${calYesterday.getFullYear()}-${String(calYesterday.getMonth() + 1).padStart(2, '0')}-${String(calYesterday.getDate()).padStart(2, '0')}` — consistent with the project-wide rule in standup-date.ts.
- verification: All 8 existing unit tests pass (vitest run). The "uses Yesterday when date is calendar day before today" test explicitly covers this path with a fixed system time.
- files_changed: taskflow/src/routes/standup-notes/YesterdayColumn.tsx (line 86)
