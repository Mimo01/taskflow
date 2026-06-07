# Quick Task 260607-jwb: Standup "Yesterday" → pick any day - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Task Boundary

In the Standup Notes page, allow the user to change the "Yesterday" recap day to any
day from the last two weeks. The default behavior (most recent working day) must stay
unchanged and be the no-interaction path. The override is subtle (clicking the column
title opens a dropdown), and it is **window-session only** — never persisted. Reloading
the page/app returns to the default resolved "Yesterday".

No date-picker widget — a plain dropdown/menu of recent days.
</domain>

<decisions>
## Implementation Decisions

### Date list contents
- The dropdown lists **all calendar days** from the last 14 days (including weekends),
  not just working days. Maximum flexibility — user can pick a Saturday.
- Most-recent-first ordering (today − 1 down to today − 14, or similar recent-first range).

### Affordance (subtlety)
- **Caret on hover.** The title looks exactly as it does today by default. On hover, a
  small chevron/caret appears next to the heading and the cursor becomes a pointer.
  Default (no-hover) appearance is unchanged — preserves the "subtle / default works as
  it currently does" requirement.

### Reset to default
- The dropdown's **first row is the resolved default day, labelled "Yesterday"**, and is
  shown as the currently-selected row when no override is active. Selecting it reverts to
  default. Because nothing is persisted, a reload also returns to default.

### Persistence
- **No persistence.** Override lives in React state on the page (or column) only. Not
  written to the settings store, localStorage, or stronghold.

### Claude's Discretion
- Exact dropdown component (existing `src/components/ui/dropdown-menu.tsx` Radix wrapper
  is the natural fit) and the precise label format for each day row (e.g. "Yesterday",
  weekday name + date) are left to the planner/executor, following existing
  `formatDateLabel` / `getColumnHeading` conventions in the standup module.
- Whether the override state lives in `StandupNotesPage` (recommended — it owns
  `yesterdayDate` and all the queries keyed on it) vs `YesterdayColumn`.

</decisions>

<specifics>
## Specific Ideas

- The clickable title is the **"Yesterday" `<h2>` heading in `YesterdayColumn.tsx`**
  (left column heading), not the page-level header.
- `yesterdayDate` in `StandupNotesPage.tsx` is currently a `useMemo` over
  `resolveYesterdayDate(scheduleData)`. It is threaded into all four data-query
  `queryKey`s plus `issueMeta`, so overriding it will naturally re-fetch all sources for
  the chosen day — no extra wiring needed.
- Date handling MUST follow the module's standing rule: never `toISOString()` /
  `toLocaleDateString()`; build YYYY-MM-DD from **local** calendar components
  (see `toLocalDateString` in `standup-date.ts`).
- `getColumnHeading(dateStr)` already returns "Yesterday" for calendar-yesterday and the
  weekday name otherwise — reuse for row labels / heading display.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Follow the existing
Phase 62 standup module conventions (TZ-safe date formatting, `src/components/ui`
primitives).

</canonical_refs>
