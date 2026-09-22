---
phase: quick-260922-bca
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/package.json
  - taskflow/package-lock.json
  - taskflow/src/lib/local-date.ts
  - taskflow/src/lib/local-date.test.ts
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/components/ui/calendar.tsx
  - taskflow/src/components/ui/date-picker.tsx
  - taskflow/src/components/ui/date-picker.test.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
  - taskflow/src/routes/worklogs/EditWorklogForm.tsx
  - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
  - taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
autonomous: false
requirements: [QUICK-260922-BCA]

must_haves:
  truths:
    - "Every date field in the app opens a styled calendar popover instead of the browser's native date input"
    - "Picking a day in the calendar stores the same calendar day the user clicked (no off-by-one across timezones)"
    - "The trigger shows the currently selected date in a readable format, or a placeholder when empty"
    - "A subtask due date that was set can be cleared again (no regression vs the native input's clear affordance)"
    - "Disabled date fields (saving release, disabled subtask row) cannot be opened"
    - "The date pickers inside LogWorkPopover and the worklog cell popover work without dismissing their parent popover"
    - "No `<input type=\"date\">` remains in src/"
  artifacts:
    - path: "taskflow/src/lib/local-date.ts"
      provides: "parseLocalDate / toLocalDateString — YYYY-MM-DD <-> Date via local calendar components"
      exports: ["parseLocalDate", "toLocalDateString"]
    - path: "taskflow/src/components/ui/calendar.tsx"
      provides: "Tailwind-styled react-day-picker wrapper (vendored shadcn base-nova calendar)"
      contains: "DayPicker"
    - path: "taskflow/src/components/ui/date-picker.tsx"
      provides: "Shared DatePicker — Popover trigger + Calendar, YYYY-MM-DD string in/out API"
      exports: ["DatePicker"]
    - path: "taskflow/src/components/ui/date-picker.test.tsx"
      provides: "Unit coverage: render, open, select, clear, disabled, local-TZ round-trip"
  key_links:
    - from: "taskflow/src/components/ui/date-picker.tsx"
      to: "taskflow/src/components/ui/calendar.tsx"
      via: "import { Calendar }"
      pattern: "from '@/components/ui/calendar'"
    - from: "taskflow/src/components/ui/date-picker.tsx"
      to: "taskflow/src/lib/local-date.ts"
      via: "parseLocalDate / toLocalDateString"
      pattern: "parseLocalDate|toLocalDateString"
    - from: "taskflow/src/routes/worklogs/WorklogsPage.tsx"
      to: "taskflow/src/components/ui/date-picker.tsx"
      via: "import { DatePicker }"
      pattern: "DatePicker"
    - from: "taskflow/src/routes/worklogs/WorklogsPage.test.tsx"
      to: "date-picker trigger DOM"
      via: "data-slot query"
      pattern: "date-picker-trigger"
---

<objective>
Replace all six native `<input type="date">` fields with one shared, design-token-styled `DatePicker`
component built on `react-day-picker@^10.0.1` inside the app's existing Base UI Popover.

Purpose: the native date input is the app's current de-facto datepicker and looks nothing like the rest
of the UI. One shared component gives consistent styling everywhere and a single place to evolve it.

Output: `src/lib/local-date.ts`, `src/components/ui/calendar.tsx`, `src/components/ui/date-picker.tsx`,
unit tests, and all 6 call sites migrated with `WorklogsPage.test.tsx` updated to the new DOM shape.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260922-bca-i-want-to-have-a-nicer-datepicker-across/260922-bca-CONTEXT.md
@.planning/quick/260922-bca-i-want-to-have-a-nicer-datepicker-across/260922-bca-RESEARCH.md

@taskflow/src/components/ui/popover.tsx
@taskflow/src/components/ui/button.tsx
@taskflow/src/lib/standup-date.ts
@taskflow/components.json

Key constraints from RESEARCH.md (read the file — do not re-derive):
- Every one of the 6 call sites stores a plain `YYYY-MM-DD` **string**. Keep the public API
  `value: string | null | undefined` / `onChange: (value: string) => void` so no call-site state shape changes.
- Do **NOT** install `date-fns` — `react-day-picker@10.0.1` bundles it as a direct dependency. Use
  `Intl.DateTimeFormat` for display formatting.
- Do **NOT** run `npx shadcn add calendar` (it installs date-fns and rewrites components.json).
  Vendor the registry file manually — RESEARCH.md "Code Examples" section 1 has the exact `curl` and the
  three required edits (A: import paths, B: lucide Chevron, C: strip dead `cn-*` / rtl classes).
- react-day-picker v10 API: `startMonth`/`endMonth` (not `fromDate`/`toDate`), `autoFocus`
  (not `initialFocus`), `captionLayout="label"`.
- Pre-commit hook runs the FULL vitest suite, so a call-site swap and its test update must land in the
  same commit. `npm run check` (biome + tsc) must also pass.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Install react-day-picker and build the shared DatePicker</name>
  <files>
    taskflow/package.json,
    taskflow/package-lock.json,
    taskflow/src/lib/local-date.ts,
    taskflow/src/lib/local-date.test.ts,
    taskflow/src/lib/standup-date.ts,
    taskflow/src/components/ui/calendar.tsx,
    taskflow/src/components/ui/date-picker.tsx,
    taskflow/src/components/ui/date-picker.test.tsx
  </files>
  <behavior>
    local-date.test.ts:
    - `parseLocalDate('2026-09-22')` returns a Date whose `getFullYear/getMonth/getDate` are 2026/8/22
    - `toLocalDateString(parseLocalDate('2026-09-22'))` round-trips to `'2026-09-22'`
    - `parseLocalDate('')`, `parseLocalDate(null)`, `parseLocalDate('nonsense')`, `parseLocalDate('2026-9-2')`
      all return `undefined`
    date-picker.test.tsx:
    - empty `value` renders the placeholder text on the trigger; a set `value` renders the formatted date
    - clicking the trigger opens a calendar grid (`findByRole('grid')` or the day button by accessible name)
    - clicking a day button calls `onChange` with that day's `YYYY-MM-DD` string and closes the popover
    - `disabled` trigger: clicking it does not reveal a grid
    - `clearable` + a set value renders a clear control; activating it calls `onChange('')`
    - TZ regression: the select round-trip asserts the clicked day equals the emitted string
      (the suite is also run once under `TZ=America/Los_Angeles` in verify)
  </behavior>
  <action>
Step 1 — verify then install the dependency (threat T-BCA-SC). slopcheck was unavailable during
research, so the package is treated as verify-before-install; the package choice itself is a locked user
decision in CONTEXT.md, so no approval gate is needed, but the registry check is mandatory:
`cd taskflow && npm view react-day-picker version repository.url` — confirm version `10.x` and repo
`github.com/gpbl/react-day-picker`, then `npm view react-day-picker scripts.postinstall` must be empty.
Only then `npm install react-day-picker@^10.0.1`. Do NOT install `date-fns` or `@daypicker/react`.
If the registry checks do not match, stop and report instead of installing.

Step 2 — create `src/lib/local-date.ts` exporting `parseLocalDate(value: string | null | undefined): Date | undefined`
and `toLocalDateString(d: Date): string`, using the local-calendar-component implementation given verbatim in
RESEARCH.md "Code Examples" section 2 (including the doc comment explaining why `new Date('YYYY-MM-DD')` and
`toISOString().slice(0,10)` are wrong here). Then de-duplicate: `src/lib/standup-date.ts` has a private
`toLocalDateString` — delete it and import from `@/lib/local-date` instead. Leave the other 14 pre-existing
`toISOString().slice(0,10)` sites alone; they operate on UTC/API strings and are correct.

Step 3 — vendor the calendar. Fetch the shadcn base-nova registry source into
`src/components/ui/calendar.tsx` with the `curl` pipeline in RESEARCH.md, then apply edits A, B and C
exactly as specified. Keep every `classNames` mapping otherwise unchanged. Keep `captionLayout="label"`.
Do not import `react-day-picker/style.css`.

Step 4 — create `src/components/ui/date-picker.tsx` from the skeleton in RESEARCH.md section 3 with the
`DatePickerProps` shape from the "Recommended public API" block: `value`, `onChange`, `id`, `disabled`,
`placeholder` (default `'Pick a date'`), `className`, `size` (`'sm' | 'default'`), `clearable`, `minDate`,
`maxDate`, `aria-label`. Requirements:
- Apply `buttonVariants({ variant: 'outline', size })` directly to `PopoverTrigger` — never nest a `<Button>`
  inside it (button-in-button a11y bug).
- Put `data-slot="date-picker-trigger"` on the trigger — WorklogsPage.test.tsx queries it in Task 2.
- `PopoverContent` gets `className="w-auto p-0"` (tailwind-merge strips the shared `p-4`) and
  `initialFocus={false}` (needed so the two nested-popover call sites in Task 3 don't lose outer focus).
  Leave `modal` unset.
- `onChange` always emits a `YYYY-MM-DD` string or `''` — never `null`, never a `Date`.
- Display formatting via a module-level `Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })`.
- `clearable`: when true and a value is set, render a small lucide `X` control that calls `onChange('')`
  without opening the calendar. Implement it as a sibling of the trigger (not nested inside the trigger
  button) — see the project pattern for overlay/nested interactive controls; a `<button>` inside a
  `<button>` is invalid.
- `minDate`/`maxDate` map to `startMonth`/`endMonth` plus a `{ before, after }` disabled matcher. Thin
  pass-through only; no call site uses them today.

Step 5 — write `src/lib/local-date.test.ts` and `src/components/ui/date-picker.test.tsx` covering the
behaviors above. For opening the popover in jsdom, follow the proven pattern in
`src/routes/dashboard/StatusPopover.test.tsx` (`fireEvent.click` on the trigger, then `await screen.findBy…`).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx && TZ=America/Los_Angeles npx vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx && TZ=Asia/Tokyo npx vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx && npm run check</automated>
  </verify>
  <done>
    `react-day-picker` is in package.json dependencies (and `date-fns` is NOT). `calendar.tsx`,
    `date-picker.tsx`, `local-date.ts` exist; `standup-date.ts` imports `toLocalDateString` instead of
    defining it. All new unit tests pass under UTC, a negative-offset TZ, and a positive-offset TZ.
    `npm run check` is clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate the WorklogsPage filter bar and rewrite its tests</name>
  <files>
    taskflow/src/routes/worklogs/WorklogsPage.tsx,
    taskflow/src/routes/worklogs/WorklogsPage.test.tsx
  </files>
  <action>
Replace the two raw `<input type="date">` elements at `WorklogsPage.tsx:898` and `:905` with `DatePicker`,
keeping `customFrom`/`customTo` as `YYYY-MM-DD` strings and the existing setters — the from/to pair stays
two independent single-date pickers side by side per the locked decision (no range picker, no state-shape change).
Size them to the surrounding `h-7 text-xs` preset pills: `size="sm"` plus `className="min-w-32 text-xs"`.
These fields have no visible label, so pass `aria-label="From date"` / `aria-label="To date"`.

Then fix `WorklogsPage.test.tsx`, which breaks at lines 226, 231, 245, 253 because no `<input>` exists anymore:
- Lines 226/231 count assertions → query `[data-slot="date-picker-trigger"]` instead of `input[type="date"]`
  (expect 0 before clicking Custom, 2 after).
- Lines 245/253 `fireEvent.change(...)` value-driving cannot survive. Rewrite them to drive the real
  component: click the from/to trigger, then `fireEvent.click` the day cell by its accessible name
  (pattern proven in `src/routes/dashboard/StatusPopover.test.tsx:88`). The TEMPO-02 fetch-gating intent
  must stay intact: from-only set → no fetch; to < from → no fetch; valid range → fetch fires. Choose
  fixed dates in a fixed month so the day buttons are deterministic; navigate months via the prev/next
  buttons if the target month is not the default.
- Update the file header comment that says "Custom reveals date inputs" to reflect the new trigger DOM.

This file's source change and test change MUST be one commit — the pre-commit hook runs the full suite.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/worklogs/WorklogsPage.test.tsx && grep -rn 'input\[type="date"\]' src/routes/worklogs/WorklogsPage.test.tsx | wc -l | grep -qx 0 && npm run check</automated>
  </verify>
  <done>
    WorklogsPage renders two `DatePicker` triggers for the Custom preset; no `<input type="date">` and no
    `input[type="date"]` query remains in either file; all WorklogsPage tests pass including the three
    fetch-gating cases; `npm run check` clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Migrate the remaining four call sites</name>
  <files>
    taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx,
    taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx,
    taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx,
    taskflow/src/routes/worklogs/EditWorklogForm.tsx
  </files>
  <action>
Swap each remaining native date input for `DatePicker`, preserving the existing state type at every site:

1. `SubtaskTemplateRow.tsx:383` — pass `id={`${row.id}-duedate`}` (a sibling `<label htmlFor>` targets it),
   `disabled={isDisabled}`, `size="sm"`, `className="w-40 text-sm"`, `value={row.duedate ?? ''}`,
   `onChange={v => onChange({ duedate: v || null })}`, and **`clearable`** — the native input had a built-in
   clear affordance, so without this a set due date could never be unset (a real regression).
2. `EditReleaseModal.tsx:94` — `id="release-date"`, `disabled={isSaving}`, `value={editDate}`,
   `onChange={setEditDate}`. Confirm the disabled styling lands (`buttonVariants` base already has
   `disabled:pointer-events-none disabled:opacity-50`).
3. `LogWorkPopover.tsx:136` — `size="sm"`, `className="h-8 w-full text-xs"`, `value={date}`, `onChange={setDate}`.
   This renders inside an already-open `PopoverContent` (`w-72 p-4`) → nested popover.
4. `EditWorklogForm.tsx:114` — same shape as #3; rendered inside `WorklogCellPopover` → also nested.

For the two nested sites (#3, #4): rely on the DatePicker defaults set in Task 1 (`modal` unset so there is
no focus trap, `initialFocus={false}` on the inner PopoverContent). Per RESEARCH.md Pitfall 3 / assumption A1
this cannot be verified in jsdom — Task 4 verifies it in the running app. If the human check shows the outer
popover dismissing on day-click, the documented fallback is to render `<Calendar>` inline in those two narrow
panels instead of behind a trigger; do not apply that fallback pre-emptively.

Finally confirm no native date input survives anywhere in `src/`.
  </action>
  <verify>
    <automated>cd taskflow && grep -rn 'type="date"' src/ | wc -l | grep -qx 0 && npm run check && npm test</automated>
  </verify>
  <done>
    All four sites use `DatePicker`; zero `type="date"` occurrences in `src/`; SubtaskTemplateRow still maps
    empty → `null` and is clearable; `npm run check` and the full `npm test` suite pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    All six date fields now use the shared styled `DatePicker` (react-day-picker inside the app's Popover,
    styled with the existing design tokens). Unit tests cover render/open/select/clear/disabled and the
    timezone round-trip under three timezones; the full suite and `npm run check` pass.
  </what-built>
  <how-to-verify>
    Run the app (`cd taskflow && npm run tauri dev`, or `npm run dev` in the browser) and check each site:

    1. **Styling** — open any date field. The calendar should match the app's theme (neutral surface, app
       border radius, no white browser-chrome calendar, no double padding around the grid).
    2. **Worklogs filter bar** (`/worklogs` → Custom preset) — the two triggers sit in line with the
       surrounding `h-7` preset pills and are not visibly taller. Pick a from and a to date; the worklog
       list refetches for that range.
    3. **NESTED POPOVER — highest risk** (research assumption A1): open an issue detail → Log Work popover,
       click the date trigger, click a day. The Log Work popover must stay open with the new date shown.
       Repeat on the Worklogs page by opening a worklog cell popover → Edit form → date. If either outer
       popover closes when you click a day, report it — the fallback is an inline calendar in those two panels.
    4. **Clearable due date** — create/edit an issue with subtasks, set a subtask due date, then clear it
       with the X. It must go back to empty (and stay empty after save).
    5. **Disabled** — in the Release edit modal, click Save and confirm the date trigger cannot be opened
       while saving; same for a disabled subtask row.
    6. **Off-by-one check** — pick today's date anywhere and confirm the trigger shows today, not yesterday.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what looked wrong (per numbered item)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → local `node_modules` | New third-party dependency executes at build time and ships in the bundle |
| user keyboard/click → date string → Jira API | Date values flow into issue due dates, worklog dates and release dates |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-BCA-SC | Tampering | `npm install react-day-picker` | mitigate | slopcheck unavailable in research sandbox; Task 1 Step 1 requires `npm view react-day-picker version repository.url` (must be 10.x / `github.com/gpbl/react-day-picker`, 33.8M weekly downloads, first published 2014) and an empty `scripts.postinstall` before installing. The package is a locked user decision in CONTEXT.md and the documented dependency of the shadcn `calendar` registry entry, so it is not an LLM-suggested name. Abort install on any mismatch. |
| T-BCA-01 | Tampering | vendored `calendar.tsx` fetched via `curl` from ui.shadcn.com | mitigate | The fetched file is TypeScript source committed to the repo and reviewed in the diff; no script is executed at fetch time. Task 1 requires reading and editing it (edits A/B/C), which forces review. |
| T-BCA-02 | Information disclosure | date values | accept | Dates are non-sensitive project metadata already visible in Jira; no PII introduced. |
| T-BCA-03 | Tampering (data integrity) | `YYYY-MM-DD` ↔ `Date` conversion | mitigate | UTC day-shift would silently write the wrong date to Jira. Mitigated by `parseLocalDate`/`toLocalDateString` using local calendar components only, plus unit tests executed under `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo` in Task 1 verify, plus human check item 6. |
</threat_model>

<verification>
- `cd taskflow && npm run check` (biome + `tsc --noEmit`) clean
- `cd taskflow && npm test` full suite green
- `cd taskflow && TZ=America/Los_Angeles npx vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx` green
- `grep -rn 'type="date"' taskflow/src/` returns nothing
- `grep -rn "date-fns" taskflow/package.json` returns nothing
- Human checkpoint approved (styling + nested popovers + clear + disabled + off-by-one)
</verification>

<success_criteria>
- One shared `DatePicker` in `src/components/ui/` is the only date-entry component in the app; all 6 former
  native date inputs import it.
- Public API is `YYYY-MM-DD` string in / string out; no call site's state shape changed.
- Calendar visuals come from the app's design tokens (vendored shadcn base-nova calendar), not the
  react-day-picker default stylesheet, and no `react-day-picker/style.css` import exists.
- `date-fns` was not added as a direct dependency.
- Timezone round-trip is proven by tests under at least one negative- and one positive-offset TZ.
- Subtask due date remains clearable; disabled fields remain unopenable.
- `WorklogsPage.test.tsx` still asserts the TEMPO-02 fetch-gating behaviour, driven through the new component.
</success_criteria>

<output>
Create `.planning/quick/260922-bca-i-want-to-have-a-nicer-datepicker-across/260922-bca-SUMMARY.md` when done
</output>
