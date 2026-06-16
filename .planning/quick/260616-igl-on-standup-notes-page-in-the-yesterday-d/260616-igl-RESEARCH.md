# Research — Allow selecting "today" in the standup Yesterday-column day selector

**Mode:** quick-task
**Date:** 2026-06-16

## Summary

This is a small, self-contained UI change. The day selector is already fully
generic and data-driven; the only reason today is absent is that the option-list
builder starts at `i = 1` (yesterday). All four downstream queries already key on
the selected date, so no data/query wiring is needed.

## Key files & current behavior

1. **`taskflow/src/lib/standup-date.ts`**
   - `buildRecentDayOptions(count)` (L87-95): loops `for (let i = 1; i <= count; i++)`,
     producing yesterday … today−count. **Excludes today by design.**
   - `toLocalDateString(d)` (L24-29): the timezone-safe local formatter to reuse.
   - Standing rule (file header): never `toISOString()` — off-by-one east of UTC.

2. **`taskflow/src/routes/standup-notes/YesterdayColumn.tsx`**
   - `getColumnHeading(dateStr)` (L115-125): returns `"Yesterday"` for calendar-yesterday,
     else the weekday name. Needs a `"Today"` special-case for the current date.
   - `dayOptions` useMemo (L573-588): maps the date list to `{date, label}`; the
     resolved-default row gets a `· Yesterday` / `· Last working day` tag.
   - DropdownMenuRadioGroup (L657-667): `value={yesterdayDate}`, `onValueChange` reverts
     to default when the resolved-yesterday row is chosen. Renders `dayOptions` rows.

3. **`StandupNotesPage.tsx`** — `yesterdayDate = dateOverride ?? resolvedYesterday`;
   all four queries (tempo, jira, jira-created, commits/MR) are keyed on `yesterdayDate`.
   Selecting today flows through as a normal override. **No changes required here.**

## Approach (recommended)

- Add today to the option list. Cleanest: prepend today inside the `dayOptions`
  useMemo (so `buildRecentDayOptions` stays "recent past days"), OR add a dedicated
  `getTodayDate()` helper in `standup-date.ts` using `toLocalDateString(new Date())`.
  Prefer a tiny helper for clarity and reuse, keeping local-date safety.
- Special-case `getColumnHeading` to return `"Today"` when `dateStr` equals today's
  local date (compute the same way it computes `calYesterdayLocal`).
- Tag the today row `"<date> · Today"` and place it at the top of `dayOptions`.

## Pitfalls

- **Timezone:** compute "today" with local components, never `toISOString()`.
- **Tag ordering:** today must sit above yesterday; `buildRecentDayOptions` returns
  most-recent-first, so prepend today before mapping.
- **Default-revert logic:** unaffected — today is never `resolvedYesterday`, so it
  behaves as a normal override (no accidental clearing).
- **Duplicate-row guard:** ensure today isn't already in the list (it won't be, since
  the builder starts at yesterday) before prepending.

## Output

Targeted ~5-15 line change across two files. No new dependencies.
