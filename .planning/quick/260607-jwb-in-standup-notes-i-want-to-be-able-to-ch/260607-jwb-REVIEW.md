---
phase: 260607-jwb
reviewed: 2026-06-07T00:00:00Z
depth: quick
files_reviewed: 5
files_reviewed_list:
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/lib/standup-date.test.ts
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# 260607-jwb: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** quick (extended with targeted reads per reviewer judgement)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The feature adds a TZ-safe day-picker dropdown to the Yesterday column, a session-only override state, and the `standup-date.ts` utility library that backs it. The TZ-safety goals are met — `toISOString` and `toLocaleDateString` are absent from all production paths and the date formatting uses local component extraction throughout. The session-only override is correctly modelled as `useState` with no persistence. The schedule query key correctly excludes `yesterdayDate` so changing the override does not re-fetch the Tempo schedule.

Three correctness/quality issues were found that are worth fixing before or shortly after ship.

---

## Warnings

### WR-01: `resolvedYesterday` can fall outside the 14-day dropdown window, producing a "Yesterday" label on a date that is not in the list

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:557-563`

**Issue:** `buildRecentDayOptions(14)` always covers the last 14 calendar days (yesterday through today-14). `resolvedYesterdayDate` skips weekends and Tempo holidays, so after a long holiday stretch it can resolve to a date older than 14 calendar days ago. When that happens the resolved default is not in the list rendered by the dropdown, but the `DropdownMenuRadioGroup value={yesterdayDate}` still points to it, so the selected radio item matches nothing visible in the menu and the "Yesterday" label is never rendered — instead the dropdown shows an unselected list. The `getColumnHeading()` call will still show the correct heading text, but the dropdown is silently broken.

**Fix:** Either increase the cap to match the holiday-skip cap (e.g. 20 days), or guarantee the resolved default is always prepended to the list when it falls outside the window:

```ts
const dayOptions = useMemo(() => {
  const options = buildRecentDayOptions(20).map((date) => ({
    date,
    label: date === resolvedYesterday ? 'Yesterday' : formatDayLabel(date),
  }));
  // Ensure the resolved default is always present even after a long holiday run.
  if (!options.some((o) => o.date === resolvedYesterday)) {
    options.unshift({ date: resolvedYesterday, label: 'Yesterday' });
  }
  return options;
}, [resolvedYesterday]);
```

---

### WR-02: `getScheduleLookbackRange()` is called twice inside the `queryFn` dependency object, creating two `Date` objects at different instants

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:169-170`

**Issue:** `getScheduleLookbackRange()` is called separately for `.from` and `.to` on lines 169–170, each constructing `new Date()` independently. Under normal circumstances the two calls complete within the same millisecond, but they straddle a midnight boundary in adversarial conditions (or a slow device). More concretely this is a code quality problem: the function is documented as returning a paired range, and calling it twice throws that guarantee away. The calls are also inside the `queryFn` body (not the `queryKey`), so they run at fetch time, not at render — the range passed to `fetchUserSchedule` could in theory differ from the range implied by the `staleTime` key.

**Fix:** Call `getScheduleLookbackRange()` once and destructure:

```ts
queryFn: () => {
  const { from, to } = getScheduleLookbackRange();
  return fetchUserSchedule(
    jiraBaseUrl ?? '',
    jiraToken ?? '',
    from,
    to,
    jiraUserKey ?? '',
  );
},
```

---

### WR-03: `resolveYesterdayDate` tests use ISO-string `setSystemTime` which fixes the clock in UTC, making weekend-skip assertions timezone-dependent

**File:** `taskflow/src/lib/standup-date.test.ts:27,33,40,47,54,68,79,86,104,112`

**Issue:** Most `resolveYesterdayDate` and `getScheduleLookbackRange` tests pin the clock with strings like `new Date('2026-05-25T10:00:00Z')`. This is an ISO UTC timestamp. The production code under test calls `new Date()` and then uses `getDay()` / `getDate()` (local calendar). If the test runner's `TZ` env variable is set to a timezone ahead of UTC (e.g. `Asia/Tokyo`, UTC+9) then `2026-05-25T10:00:00Z` is `2026-05-25 19:00:00 JST` — local Monday — which is what the test expects. But if `TZ=America/Los_Angeles` (UTC-7) then `2026-05-25T10:00:00Z` is `2026-05-25 03:00:00 PDT` — still local Monday, so this particular test accidentally passes. However, the `getScheduleLookbackRange` test at line 104 (`to` should be `2026-05-26`) would return `2026-05-25` in `TZ=UTC-13` because the UTC instant `2026-05-26T10:00:00Z` is still `2026-05-25` locally. The `buildRecentDayOptions` tests (lines 128, 135, 143, 151) avoid this by correctly using `new Date(year, month, day, ...)` (local constructor) — but the `resolveYesterdayDate` suite does not.

**Fix:** Use the local Date constructor form in all tests that rely on local calendar day assertions:

```ts
// Replace:
vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
// With:
vi.setSystemTime(new Date(2026, 4, 25, 10, 0, 0)); // May 25 2026, local 10:00
```

Apply this to all `resolveYesterdayDate` and `getScheduleLookbackRange` test cases.

---

## Info

### IN-01: `formatDateLabel` / `formatDayLabel` and their `DAY_NAMES` / `MONTH_NAMES` constants are duplicated verbatim across two files

**File:** `taskflow/src/routes/standup-notes/StandupNotesPage.tsx:35-66` and `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:96-150`

**Issue:** Both files define the same `DAY_NAMES` and `MONTH_NAMES` arrays and implement functionally identical formatting functions (`formatDateLabel` in the page, `formatDayLabel` in the column). The comment in YesterdayColumn even acknowledges "Mirrors StandupNotesPage.formatDateLabel". This is not a bug but it is a future maintenance trap — a change to the format must be made in two places.

**Fix:** Export a single `formatDayLabel(dateStr: string): string` from `standup-date.ts` (or a dedicated `standup-format.ts`), import it in both files, and delete the local copies.

---

### IN-02: `NON_WORKING_DAY` schedule entries are silently ignored in `resolveYesterdayDate` — not a bug today but an undocumented assumption

**File:** `taskflow/src/lib/standup-date.ts:63`

**Issue:** Tempo `ScheduleDayType` includes `'NON_WORKING_DAY'` (e.g. a personal day off or a company non-working day that is not a public holiday). `resolveYesterdayDate` only skips `'HOLIDAY'` entries. `NON_WORKING_DAY` days are treated as working days. The test file at line 57-58 notes this explicitly ("already skipped by weekend rule") for the Saturday/Sunday case, but non-weekend `NON_WORKING_DAY` (e.g. a Friday company shutdown that Tempo marks as non-working but not a public holiday) will not be skipped. Whether this is intentional is not documented in the function's JSDoc.

**Fix:** Add a line to the JSDoc explicitly stating the intent, e.g. "Note: `NON_WORKING_DAY` entries are intentionally NOT skipped — only public holidays (type `'HOLIDAY'`) are excluded." If the intent is to skip them too, add the check:

```ts
if (tempoSchedule?.get(dateStr) === 'HOLIDAY' ||
    tempoSchedule?.get(dateStr) === 'NON_WORKING_DAY') {
  candidate.setDate(candidate.getDate() - 1);
  continue;
}
```

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick (with targeted reads)_
