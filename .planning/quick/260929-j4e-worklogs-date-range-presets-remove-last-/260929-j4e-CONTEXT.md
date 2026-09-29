# Quick Task 260929-j4e: Worklogs date range presets — remove Last Working Day / Last Week / Last Month, add rolling Last 7 Days / Last Month - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Task Boundary

On the Worklogs page (`taskflow/src/routes/worklogs/WorklogsPage.tsx`) the date-range preset pills are:
This Week · Last Week · This Month · Last Month · Last Working Day · Custom.

Remove the calendar presets `last-week`, `last-month`, and `last-working-day`.
Add two rolling "to date" presets: last 7 days (to today) and last month (to today).

</domain>

<decisions>
## Implementation Decisions

### Rolling 7-day range
- Includes today: from = today − 6 days, to = today (7 calendar days inclusive).

### Rolling month range
- From = the same day-of-month one month ago, to = today (e.g. 2026-08-29 → 2026-09-29).
- If that day doesn't exist in the previous month (e.g. today = 31 Mar), clamp to the last day of the previous month (→ 28/29 Feb). Must not overflow into the current month (JS `setMonth` overflow pitfall).
- Uses local dates via existing `localISO()` helper, like the other presets.

### Pill order
- This Week · Last 7 Days · This Month · Last Month · Custom

### Saved filters (persisted `tempo-filters.store.ts`)
- Any saved filter whose `preset` is a removed id (`last-week`, `last-month`, `last-working-day`) falls back to `this-week`.
- Must be robust: loading such a filter must never leave `from/to` undefined (the `useMemo` switch has no default today → destructuring crash). Implement via persisted-store migration (zustand persist `version` + `migrate`) and/or a defensive normalize on load.

### Claude's Discretion
- Preset ids: `last-7-days` and `last-month-to-date` (new ids — do NOT reuse `last-month` so old persisted values are unambiguously migrated).
- Labels: "Last 7 Days" and "Last Month".
- Remove now-dead helpers (`getLastWeekRange`, `getLastMonthRange`, `getLastWorkingDay`) from WorklogsPage.tsx.
- Update `DatePreset` union in `src/services/tempo/types.ts`.
- Update WorklogsPage tests (currently assert 'Last Working Day' label at WorklogsPage.test.tsx:241) and add unit coverage for the new range functions including month-end clamp.

</decisions>

<specifics>
## Specific Ideas

- Datepicker week starts Monday (recent quick 260929-iwm) — unrelated but This Week stays Mon–Sun.
- Standup Notes' "last working day" logic (`src/lib/standup-date.ts`) is separate and must NOT be touched.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
