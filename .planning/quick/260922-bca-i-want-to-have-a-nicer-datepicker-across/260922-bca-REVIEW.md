---
phase: 260922-bca-i-want-to-have-a-nicer-datepicker-across
reviewed: 2026-09-22T00:00:00Z
depth: quick
files_reviewed: 13
files_reviewed_list:
  - taskflow/package.json
  - taskflow/package-lock.json
  - taskflow/src/components/ui/calendar.tsx
  - taskflow/src/components/ui/date-picker.test.tsx
  - taskflow/src/components/ui/date-picker.tsx
  - taskflow/src/lib/local-date.test.ts
  - taskflow/src/lib/local-date.ts
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  - taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
  - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
  - taskflow/src/routes/worklogs/EditWorklogForm.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 260922-bca: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** quick (pattern scan + targeted read of every listed file and its diff against the pre-dispatch commit)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The migration to a shared `react-day-picker`-based `DatePicker` (from raw `<input type="date">`) is clean, TZ-safe (`local-date.ts` correctly avoids UTC-shifting parse/format), and well tested for its own component boundary (`date-picker.test.tsx`, `local-date.test.ts`). However, the migration introduces a real behavioral regression that native date inputs never had: `react-day-picker`'s `mode="single"` deselects (returns `undefined`) when the user clicks the already-selected day, and none of the three "value must always be a valid date" call sites (`LogWorkPopover`, `EditWorklogForm`, `EditReleaseModal`) guard against the resulting empty string. This was explicitly flagged as a known API characteristic in the phase's own RESEARCH.md (line 294: "for `mode=\"single\"` (non-required) `selected` is `Date | undefined`") but the mitigation never made it into `DatePicker` or its required-field consumers.

## Critical Issues

### CR-01: Clicking the already-selected day empties `date` and crashes the submit-time `Date` parse in required-date forms

**File:** `taskflow/src/components/ui/date-picker.tsx:82-85`
**Issue:**
`react-day-picker`'s `mode="single"` toggles a day off when it is clicked while already selected — this is documented behavior of the underlying library, not a `clearable`-gated feature. `DatePicker` forwards that unconditionally:

```tsx
onSelect={(d) => {
  onChange(d ? toLocalDateString(d) : '');
  setOpen(false);
}}
```

No `required` prop is passed to `Calendar`/`DayPicker`, so this fires for *every* `DatePicker` instance, including ones the caller treats as always-populated. Concretely:

- `LogWorkPopover.tsx:99` — `const started = new Date(`${date}T12:00:00`).toISOString()...` — if the user opens the popover (date pre-filled to today) and clicks today's date again (a very natural "confirm today" click), `date` becomes `''`. `new Date('T12:00:00')` is an `Invalid Date`, and `.toISOString()` throws `RangeError: Invalid time value` synchronously inside `handleSubmit`, before `mutation.mutate()` is ever called. This is an uncaught exception in a click handler — it is not caught by the mutation's `onError`, since the throw happens before `mutate()` runs.
- `EditWorklogForm.tsx:87` — identical pattern in `handleSave`, same crash on save.
- `EditReleaseModal.tsx:93-98` — `editDate` is passed straight to `DatePicker` with no `clearable`; a self-deselect silently sets the release date to `''`. Whether this crashes depends on the (out-of-scope) parent's save handler, but at minimum it silently corrupts a "required" field with no warning to the user, since `EditReleaseModal` has no visible validation for `editDate`.

None of these call sites pass `clearable`, so the assumption baked into each component was "the value can never be cleared without an explicit UI affordance" — but the calendar grid itself provides an implicit, undocumented clear affordance that bypasses that assumption.

**Fix:** Make `DatePicker` require an explicit affirmative action to clear the date, decoupled from `clearable`'s already-selected-day toggle-off, e.g.:

```tsx
// date-picker.tsx
<Calendar
  mode="single"
  required={!clearable}   // only allow deselect-by-reclick when the caller opted into clearing
  selected={selected}
  ...
/>
```

And/or defensively guard the three consumers before doing date arithmetic:

```tsx
// LogWorkPopover.tsx / EditWorklogForm.tsx
function handleSubmit() {
  if (!date) {
    setSubmitError('Please pick a date.');
    return;
  }
  ...
}
```

Either fix (preferably both — belt-and-suspenders) prevents the uncaught `RangeError` and the silent field-clearing in `EditReleaseModal`.

## Warnings

### WR-01: Missing test coverage for the same-day-click deselect path

**File:** `taskflow/src/components/ui/date-picker.test.tsx`
**Issue:** The test suite covers the explicit "Clear date" button (line 40-46) and clicking a *different* day (lines 22-32, 48-58), but never exercises clicking the day that is already `selected` — which is exactly the path that produces CR-01. Given this behavior is called out explicitly in the phase's own RESEARCH.md, a regression test would have caught it before merge.
**Fix:**
```tsx
it('deselects (calls onChange with empty string) when the already-selected day is clicked again', async () => {
  const onChange = vi.fn();
  render(<DatePicker value="2026-09-01" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /Sep 1, 2026/ }));
  await screen.findByRole('grid');
  const sameDay = await screen.findByRole('button', { name: /September 1st, 2026/i });
  fireEvent.click(sameDay);
  expect(onChange).toHaveBeenCalledWith('');
});
```

### WR-02: `EditReleaseModal` has no visible guard against an empty `editDate` before save

**File:** `taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx:93-98`
**Issue:** `Release Date` renders a plain (non-`clearable`) `DatePicker` bound directly to `editDate`/`setEditDate`, with no local validation message shown if the value becomes empty (via CR-01's deselect path or otherwise). `isSaveDisabled` is computed by the (out-of-scope) parent, so it's unverifiable here whether an empty date blocks Save, but nothing in this file itself signals the problem to the user — unlike `Name`/`Milestone Title`, which use the native `required` attribute for basic affordance.
**Fix:** Surface an inline validation message (mirroring the `jiraError`/`gitlabError` pattern already in this file) when `editDate` is empty, or disable Save from within this component as a safety net independent of the parent's state.

### WR-03: `WorklogsPage` custom date range silently produces an empty-looking table instead of a validation message when `customFrom > customTo` or when the range is only partially picked

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:343-381, 1027-1039`
**Issue:** Pre-existing behavior (not introduced by this migration — the raw `<input type="date">` had the same gap), but worth flagging since the `DatePicker` swap makes the "click a day twice to clear" path reachable in a filter context too. When `customFrom`/`customTo` are empty or inverted, the `useQuery` is `enabled: false`, so `data` stays `undefined`. Because `data?.length === 0` is `false` when `data` is `undefined` (not `0`), the code falls through to the full hierarchy-table branch and renders a table with 0 day columns and no rows — not the `EmptyState` that's rendered for a genuinely empty result set. There's no explicit "pick both dates" or "invalid range" message.
**Fix:**
```tsx
) : preset === 'custom' && (!customFrom || !customTo || customTo < customFrom) ? (
  <div className="px-6 py-4">
    <EmptyState icon={Clock} title="Select a valid date range" subtitle="Pick a From and To date where From is on or before To." />
  </div>
) : data?.length === 0 ? (
  ...
```

## Info

### IN-01: `LogWorkPopover`/`EditWorklogForm` duplicate a local `todayString`/date-construction helper that already exists in `@/lib/local-date`

**File:** `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx:36-39`
**Issue:** `todayString()` reimplements exactly what `getTodayDate()` (via `toLocalDateString(new Date())`) in `@/lib/standup-date.ts` / `@/lib/local-date.ts` already provides, and the inline `${date}T12:00:00` → `.toISOString()` → `.replace('Z','+0000')` dance is duplicated verbatim in both `LogWorkPopover.tsx:99` and `EditWorklogForm.tsx:87`.
**Fix:** Extract a shared `toJiraStartedTimestamp(date: string): string` helper (e.g. in `@/lib/local-date.ts`) and reuse `getTodayDate()` for the default value, reducing the surface area that would need CR-01's empty-string guard to one place instead of two.

### IN-02: `calendar.tsx` `formatMonthDropdown` calls `date.toLocaleString(locale?.code, ...)` with no fallback if `locale` lacks a `code` property

**File:** `taskflow/src/components/ui/calendar.tsx:35`
**Issue:** `Locale` (from `react-day-picker`/`date-fns`) does not guarantee a `code` field on all locale objects; if a caller ever passes a `locale` prop without `code`, this formatter silently falls back to the runtime default locale rather than the caller's intended one. Currently unused by any `DatePicker` call site in this phase (none pass `locale`), so it's inert today, but it's a latent trap for the next consumer of `Calendar` directly.
**Fix:** Guard with `date.toLocaleString(locale?.code ?? undefined, { month: 'short' })` (already effectively true since `undefined` is fine) — or, better, add a comment noting `code` may be absent so a future caller doesn't assume otherwise. Low priority; boilerplate carried over from the shadcn registry component.

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
