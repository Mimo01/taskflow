---
phase: quick-260929-iwm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/calendar.tsx
  - taskflow/src/components/ui/date-picker.test.tsx
autonomous: true
requirements: [QUICK-260929-iwm]

must_haves:
  truths:
    - "Every date picker in the app (SubtaskTemplateRow, LogWorkPopover, EditReleaseModal, EditWorklogForm, WorklogsPage) shows Monday as the first weekday column and Sunday as the last"
    - "Callers can still override the week start by passing weekStartsOn explicitly"
    - "Existing DatePicker and WorklogsPage tests (data-day selectors) still pass"
  artifacts:
    - path: "taskflow/src/components/ui/calendar.tsx"
      provides: "Shared Calendar defaulting weekStartsOn to 1 (Monday)"
      contains: "weekStartsOn"
    - path: "taskflow/src/components/ui/date-picker.test.tsx"
      provides: "Regression test asserting Monday is the first weekday header"
  key_links:
    - from: "taskflow/src/components/ui/date-picker.tsx"
      to: "taskflow/src/components/ui/calendar.tsx"
      via: "<Calendar> wraps react-day-picker DayPicker"
      pattern: "weekStartsOn"
---

<objective>
Make the app-wide date picker start its week on Monday instead of Sunday.

Purpose: The shared shadcn Calendar (the only react-day-picker DayPicker in the app) uses the library default (Sunday). All DatePicker consumers inherit from it, so one default change fixes every picker.
Output: Calendar defaults `weekStartsOn` to 1; a test locks Monday as the first column.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/components/ui/calendar.tsx
@taskflow/src/components/ui/date-picker.tsx
@taskflow/src/components/ui/date-picker.test.tsx

Scouting facts (verified by planner):
- `Calendar` in calendar.tsx destructures `className, classNames, showOutsideDays = true, captionLayout = 'label', buttonVariant = 'ghost', locale, formatters, components, ...props` and renders `<DayPicker showOutsideDays=... captionLayout=... locale={locale} formatters=... classNames=... components=... {...props} />` — `{...props}` is spread LAST.
- No file in taskflow/src passes `weekStartsOn`. The `<Calendar` hits in ReleaseDetailSidebar.tsx and StandupPageHeader.tsx are the lucide `Calendar` icon, not this component — do not touch them.
- No consumer passes a `locale` to Calendar/DatePicker, so no locale-derived weekStartsOn conflicts.
- WorklogsPage.test.tsx selects days via `[role="gridcell"][data-day="YYYY-MM-DD"]` — position-independent, unaffected by column order.
- Existing date-picker tests find days by accessible name (e.g. "September 22nd, 2026") — also position-independent.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Default shared Calendar week start to Monday + regression test</name>
  <files>taskflow/src/components/ui/calendar.tsx, taskflow/src/components/ui/date-picker.test.tsx</files>
  <behavior>
    - Opening DatePicker (value "2026-09-01") renders a grid whose first weekday column header (`th` inside the grid's weekdays row, react-day-picker v10 renders them with `aria-label` = full weekday name, e.g. "Monday") is Monday and the last is Sunday.
    - Optionally also assert: in September 2026 (Sept 1 is a Tuesday), the first gridcell of the first week has `data-day="2026-08-31"` (a Monday, shown as outside day since showOutsideDays=true).
  </behavior>
  <action>
In calendar.tsx, add a destructured prop `weekStartsOn = 1` to the Calendar function parameters (alongside the other defaulted props like `showOutsideDays = true`) and pass `weekStartsOn={weekStartsOn}` to `<DayPicker>` before the trailing `{...props}` spread. This makes Monday the default for every consumer while an explicit `weekStartsOn` prop still overrides it. Do not pass a date-fns locale and do not change any consumer file — the shared default is the single fix point.

In date-picker.test.tsx, add a test "starts the week on Monday": render `<DatePicker value="2026-09-01" onChange={vi.fn()} />`, click the trigger (name /Sep 1, 2026/), await `findByRole('grid')`, then query the weekday header cells inside the grid (e.g. `grid.querySelectorAll('thead th')` or the `columnheader` role — inspect the rendered DOM once if unsure which react-day-picker v10 emits) and assert the first header's `aria-label` (or text fallback) matches /monday/i and the last matches /sunday/i. Also assert the first `[role="gridcell"]` in the grid has `data-day="2026-08-31"`. Confirm this test fails without the calendar.tsx change (run once before editing calendar.tsx, or temporarily revert), then passes with it.

Per project memory: the pre-commit hook runs the full vitest suite, so commit test + implementation together in ONE commit (no separate RED commit).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/components/ui/date-picker.test.tsx src/routes/worklogs/WorklogsPage.test.tsx</automated>
  </verify>
  <done>New Monday-first test passes (and was shown to fail before the change); all existing DatePicker and WorklogsPage tests pass; `grep -n "weekStartsOn" taskflow/src/components/ui/calendar.tsx` shows the default of 1 and the prop passed before `{...props}`; full vitest suite passes via the pre-commit hook on a single commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | Pure presentational default change; no input, network, or storage involved |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260929-iwm-01 | Tampering | calendar.tsx week start | accept | Display-only; selected dates still serialized via toLocalDateString, unaffected by column order |
</threat_model>

<verification>
- `cd taskflow && npx vitest run src/components/ui` passes
- `cd taskflow && npx vitest run src/routes/worklogs` passes
- No consumer files modified (git diff limited to the two listed files)
</verification>

<success_criteria>
All app date pickers show Mon..Sun weekday columns; override remains possible via weekStartsOn prop; tests green.
</success_criteria>

<output>
Create `.planning/quick/260929-iwm-datepicker-week-starts-on-monday/260929-iwm-SUMMARY.md` when done
</output>
