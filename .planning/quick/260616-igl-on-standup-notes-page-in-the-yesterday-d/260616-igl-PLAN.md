---
phase: quick-260616-igl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
autonomous: true
requirements: [IGL-01]
must_haves:
  truths:
    - "User can select today as the first (top) row of the Yesterday-column day selector"
    - "The today row is tagged '<Weekday, D Month YYYY> · Today'"
    - "When today is the selected date, the column heading reads 'Today'"
    - "Selecting today sets the date override and refetches recap data (no query wiring changes)"
    - "All date math uses local calendar components — never toISOString()"
  artifacts:
    - path: "taskflow/src/lib/standup-date.ts"
      provides: "getTodayDate() local-date helper"
      contains: "export function getTodayDate"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "Today special-case heading + prepended tagged today row"
      contains: "Today"
  key_links:
    - from: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      to: "getTodayDate"
      via: "import from @/lib/standup-date"
      pattern: "getTodayDate"
    - from: "dayOptions useMemo"
      to: "today row"
      via: "prepend today before mapping with · Today tag"
      pattern: "· Today"
---

<objective>
Allow selecting **today** in the standup-notes Yesterday-column day selector. Today
becomes the first (top) row of the dropdown, tagged `"<Weekday, D Month YYYY> · Today"`,
and the column heading reads "Today" when today is selected.

Purpose: Let the user preview/recap the current day's activity in the recap column,
which is currently impossible because the option builder starts at yesterday.

Output: A `getTodayDate()` helper in `standup-date.ts`, a "Today" special-case in
`getColumnHeading`, and a prepended tagged today row in the `dayOptions` useMemo.
No query/data wiring changes — the selected date already flows through as an override.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260616-igl-on-standup-notes-page-in-the-yesterday-d/260616-igl-CONTEXT.md
@.planning/quick/260616-igl-on-standup-notes-page-in-the-yesterday-d/260616-igl-RESEARCH.md
@taskflow/src/lib/standup-date.ts
@taskflow/src/routes/standup-notes/YesterdayColumn.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add getTodayDate() local-date helper to standup-date.ts</name>
  <files>taskflow/src/lib/standup-date.ts</files>
  <action>
    Export a new `getTodayDate(): string` function that returns today's date as a
    YYYY-MM-DD string using the module's existing `toLocalDateString(new Date())`
    helper. Place it near `buildRecentDayOptions` (both are calendar-day builders).
    Add a doc comment mirroring the existing module style, restating the standing
    rule: uses LOCAL calendar components, NEVER toISOString() (off-by-one for users
    east of UTC — see file header). This keeps the timezone-safe local-date rule
    intact per CONTEXT locked decision. Do NOT modify `buildRecentDayOptions`
    (keep it as "recent past days starting at yesterday") — today is prepended at
    the consumer in Task 2.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "export function getTodayDate" src/lib/standup-date.ts && ! grep -n "getTodayDate" src/lib/standup-date.ts | grep -q "toISOString" && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>`getTodayDate()` is exported, returns a YYYY-MM-DD string via toLocalDateString(new Date()), contains no toISOString(), and the project typechecks.</done>
</task>

<task type="auto">
  <name>Task 2: Today heading special-case + prepend tagged today row in YesterdayColumn</name>
  <files>taskflow/src/routes/standup-notes/YesterdayColumn.tsx</files>
  <action>
    Two edits, both reusing `getTodayDate` (add it to the existing import from
    `@/lib/standup-date`).

    (a) In `getColumnHeading(dateStr)` (~L115): before the existing
    `calYesterdayLocal` comparison, add a `Today` special-case — if
    `dateStr === getTodayDate()` return `'Today'`. This mirrors the existing
    `if (dateStr === calYesterdayLocal) return 'Yesterday'` line and satisfies the
    CONTEXT locked decision that the h2 heading reads "Today" when today is selected.
    Keep the weekday-name fallback for older dates unchanged.

    (b) In the `dayOptions` useMemo (~L573): after building `dates` from
    `buildRecentDayOptions(14)` and the resolved-default guard, prepend today.
    Compute `const today = getTodayDate();` and, guarding against an (impossible but
    safe) duplicate with `if (!dates.includes(today)) dates.unshift(today);`, so
    today sits at index 0 (top, above yesterday). In the `.map`, give the today row
    the tag `"<dateLabel> · Today"` — i.e. when `date === today`, return
    `{ date, label: `${formatDayLabel(date)} · Today` }`, mirroring the existing
    `· Yesterday` / `· Last working day` default-row tag style. Leave the
    existing resolved-default tagging and regular-row branches intact. Add `getTodayDate`
    to the useMemo dependency array only if lint requires it (it is a pure module
    function, so referencing it directly is fine; do not add unstable deps).

    Do NOT touch the DropdownMenuRadioGroup `onValueChange` revert logic — today is
    never `resolvedYesterday`, so it behaves as a normal override (sets the date,
    refetches via StandupNotesPage's existing query keys). No StandupNotesPage edits.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "getTodayDate" src/routes/standup-notes/YesterdayColumn.tsx && grep -q "return 'Today'" src/routes/standup-notes/YesterdayColumn.tsx && grep -q "· Today" src/routes/standup-notes/YesterdayColumn.tsx && npm run check</automated>
  </verify>
  <done>getColumnHeading returns 'Today' for today's date; dayOptions prepends a today row labeled "<date> · Today" at index 0; `npm run check` (biome + tsc) is green; no StandupNotesPage or onValueChange changes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure client-side UI date computation; no new inputs cross a trust boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-igl-01 | Tampering | local date computation | accept | Off-by-one date risk mitigated by reusing toLocalDateString / local components per locked decision; no toISOString() — gated by Task 1 grep |
| T-igl-SC | Tampering | npm installs | accept | No new dependencies introduced by this plan |
</threat_model>

<verification>
- `npm run check` (biome check + tsc) is green.
- Manual sanity: open the standup notes page, open the Yesterday-column day selector
  dropdown — today is the first row, tagged "… · Today"; selecting it makes the
  heading read "Today" and refetches the recap.
- No `toISOString()` introduced in either file.
</verification>

<success_criteria>
- Today is selectable as the top dropdown row, tagged "<Weekday, D Month YYYY> · Today".
- Column heading reads "Today" when today is the selected date.
- Selecting today sets the override and refetches recap data with zero query-wiring changes.
- All date math uses local calendar components; no toISOString().
- `npm run check` passes.
</success_criteria>

<output>
Create `.planning/quick/260616-igl-on-standup-notes-page-in-the-yesterday-d/260616-igl-SUMMARY.md` when done.
</output>
