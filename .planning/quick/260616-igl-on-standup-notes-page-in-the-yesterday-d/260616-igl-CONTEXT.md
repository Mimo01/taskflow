# Quick Task 260616-igl: Allow selecting "today" in the standup Yesterday-column day selector - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Task Boundary

On the standup notes page, the left "Yesterday" recap column has a day selector
(a dropdown radio group) that lists recent days starting from yesterday and going
backwards. Today is intentionally excluded. The user wants to also be able to
select **today** in that selector, so they can preview/recap the current day's
activity in the recap column.

Relevant code:
- `taskflow/src/lib/standup-date.ts` → `buildRecentDayOptions(count)` (loop starts at `i=1`, i.e. yesterday)
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` → `dayOptions` useMemo (~L573), `getColumnHeading` (~L115), the DropdownMenuRadioGroup (~L657)
- `StandupNotesPage.tsx` already keys all four data queries (tempo, jira, jira-created, commits/MR) on the selected `yesterdayDate`, so selecting today refetches automatically — no query changes needed.

</domain>

<decisions>
## Implementation Decisions

### Column heading for today
- When today is the selected date, the big `<h2>` column heading (via `getColumnHeading`)
  must read **"Today"** — mirroring the existing special-case that returns "Yesterday"
  for the calendar day before today. Falls back to weekday name only for older dates.

### Dropdown row for today
- Add **today** as the **first (top) row** of the dropdown, above yesterday.
- The today row is **tagged**: label format `"<Weekday, D Month YYYY> · Today"`,
  mirroring the existing default-row tag style (`"… · Yesterday"` / `"… · Last working day"`).

### Claude's Discretion
- Whether to extend `buildRecentDayOptions` to optionally include today vs. prepending
  today in the `dayOptions` useMemo — pick whichever is cleanest and keeps the
  timezone-safe local-date rule intact (never `toISOString()`).
- The selector's "revert to default" behavior (selecting `resolvedYesterday` clears the
  override) stays as-is; selecting today sets the override like any other non-default date.

</decisions>

<specifics>
## Specific Ideas

- Preserve the module's standing rule: all date math uses LOCAL calendar components
  via the existing `toLocalDateString` helper — never `toISOString()` (off-by-one for
  users east of UTC). See the header comment in `standup-date.ts`.
- The right-hand column is also titled "Today" (the plan/forecast column). Having the
  left recap column also read "Today" when today is selected is acceptable and expected —
  the two columns serve different purposes (recap vs. plan).

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
