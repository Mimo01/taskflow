---
phase: quick-260607-jwb
plan: "01"
subsystem: standup-notes
tags: [standup, date-picker, dropdown, tz-safe]
dependency_graph:
  requires: []
  provides: [standup-yesterday-day-picker]
  affects: [StandupNotesPage, YesterdayColumn, standup-date]
tech_stack:
  added: []
  patterns: [base-ui DropdownMenuRadioGroup, local-calendar-arithmetic]
key_files:
  created: []
  modified:
    - taskflow/src/lib/standup-date.ts
    - taskflow/src/lib/standup-date.test.ts
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx
decisions:
  - resolvedYesterday/onSelectDate props are optional with no-op defaults so tempo-disabled fixture needs no extra wiring beyond BASE_PROPS update
  - MONTH_NAMES added locally to YesterdayColumn to avoid importing page-private formatDateLabel from StandupNotesPage
metrics:
  duration: ~15 minutes
  completed: 2026-06-07
---

# Quick Task 260607-jwb: Standup Yesterday Day-Picker Summary

**One-liner:** Caret-on-hover DropdownMenuRadioGroup on the Yesterday heading lets users pick any of the last 14 calendar days; override is React useState only with no persistence path.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add TZ-safe buildRecentDayOptions helper + unit test | 6d0b08bc | standup-date.ts, standup-date.test.ts |
| 2 | Hold dateOverride state in StandupNotesPage and thread new props | 882aae3f | StandupNotesPage.tsx |
| 3 | Add caret-on-hover dropdown day picker to YesterdayColumn heading | 652dc504 | YesterdayColumn.tsx, YesterdayColumn.tempo-disabled.test.tsx |

## What Was Built

### Task 1 — buildRecentDayOptions
Exported buildRecentDayOptions(count) from standup-date.ts. Uses new Date(y, m, d - i) local-component arithmetic (no toISOString/toLocaleDateString) returning most-recent-first YYYY-MM-DD strings. 4 new tests cover: exact count, index ordering, Jan-1 year/month boundary crossing, and late-evening (23:30) TZ-safety. All 28 tests pass.

### Task 2 — dateOverride state
Replaced the single yesterdayDate useMemo in StandupNotesPage with:
- const [dateOverride, setDateOverride] = useState<string | null>(null)
- const resolvedYesterday = useMemo(...) — unchanged memo on scheduleData
- const yesterdayDate = dateOverride ?? resolvedYesterday

The schedule query (['standup','schedule',...]) is untouched and independent of the override. Two new props (resolvedYesterday, onSelectDate) threaded into <YesterdayColumn>.

### Task 3 — Dropdown heading
YesterdayColumnProps extended with optional resolvedYesterday + onSelectDate (defaults keep the fixture backward-compatible). YesterdayColumn now:
- Builds a memoised dayOptions array via buildRecentDayOptions(14) — resolved-default row labelled 'Yesterday', others via local formatDayLabel (weekday + D Month YYYY)
- Wraps the h2 in DropdownMenuTrigger with class "group/yhead flex items-baseline gap-1 cursor-pointer text-left"
- ChevronDown is opacity-0 by default, opacity-60 on group-hover/yhead
- DropdownMenuRadioGroup value={yesterdayDate} — selecting the resolved-default row passes null to onSelectDate to revert; all other selections pass the date string
- p date label remains outside the trigger so layout is unchanged

BASE_PROPS in YesterdayColumn.tempo-disabled.test.tsx updated with resolvedYesterday and onSelectDate: vi.fn().

## Verification

- npm run check (biome + tsc): green
- npx vitest run src/lib/standup-date.test.ts src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx: 30/30 pass
- grep toISOString|toLocaleDateString on modified files: comments only, no actual calls

## Deviations from Plan

None — plan executed exactly as written. The only auto-fix was a Biome formatting error: MONTH_NAMES was written as a two-line compact array literal; Biome required one-per-line. Fixed inline before the final commit (no behavior change).

## Known Stubs

None — all data sources wire through the existing yesterdayDate queryKey discriminator.

## Threat Flags

No new network surface introduced. Override values come from buildRecentDayOptions (closed 14-item set), not free user text. No persistence path touched (T-jwb-02 mitigated).

## Self-Check: PASSED

All three commits exist (6d0b08bc, 882aae3f, 652dc504). All five modified files confirmed present and type-clean.
