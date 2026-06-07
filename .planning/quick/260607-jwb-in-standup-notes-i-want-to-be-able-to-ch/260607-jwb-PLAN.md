---
phase: quick-260607-jwb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/lib/standup-date.test.ts
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx
autonomous: true
requirements: [QUICK-260607-jwb]
must_haves:
  truths:
    - "By default (no interaction) the Yesterday column shows the resolved last-working-day recap exactly as it does today."
    - "Hovering the 'Yesterday' heading reveals a caret and a pointer cursor; the non-hover appearance is unchanged."
    - "Clicking the heading opens a dropdown listing all 14 calendar days before today, most-recent-first."
    - "The resolved-default row is the first row, labelled 'Yesterday', and shown selected when no override is active."
    - "Selecting a non-default day re-fetches all four data sources for that day; selecting the default row reverts to follow-the-schedule mode."
    - "Reloading the page returns to the resolved default (override is React state only, never persisted)."
    - "All day strings are built from local calendar components (no toISOString / toLocaleDateString)."
  artifacts:
    - path: "taskflow/src/lib/standup-date.ts"
      provides: "buildRecentDayOptions(count) TZ-safe recent-day list builder"
      contains: "export function buildRecentDayOptions"
    - path: "taskflow/src/lib/standup-date.test.ts"
      provides: "Unit test for buildRecentDayOptions (count, ordering, TZ-safety)"
      contains: "buildRecentDayOptions"
    - path: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      provides: "dateOverride state + yesterdayDate = override ?? resolved wiring"
      contains: "dateOverride"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "Dropdown heading with caret-on-hover + radio day picker"
      contains: "DropdownMenuRadioGroup"
  key_links:
    - from: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      to: "YesterdayColumn"
      via: "resolvedYesterday + onSelectDate props"
      pattern: "onSelectDate"
    - from: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      to: "buildRecentDayOptions"
      via: "import from @/lib/standup-date"
      pattern: "buildRecentDayOptions"
    - from: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      to: "all four data queries"
      via: "yesterdayDate queryKey discriminator"
      pattern: "yesterdayDate"
---

<objective>
In the Standup Notes page, let the user click the "Yesterday" column heading to open a
dropdown and choose any of the last 14 calendar days (weekends included) as the recap day.
The default ("most recent working day") stays the zero-interaction path. The override is
window-session only — held in React state, never persisted — so a reload returns to default.

Purpose: Lets the user recap a day other than the resolved default (e.g. after returning
from leave) without changing the default behaviour or adding a date-picker widget.

Output:
- A TZ-safe `buildRecentDayOptions` helper (+ unit test) in `standup-date.ts`.
- `dateOverride` state in `StandupNotesPage` driving `yesterdayDate = override ?? resolved`.
- A caret-on-hover dropdown on the `YesterdayColumn` `<h2>` heading using the existing
  `DropdownMenuRadioGroup` primitive.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260607-jwb-in-standup-notes-i-want-to-be-able-to-ch/260607-jwb-CONTEXT.md
@.planning/quick/260607-jwb-in-standup-notes-i-want-to-be-able-to-ch/260607-jwb-RESEARCH.md
@taskflow/src/lib/standup-date.ts
@taskflow/src/routes/standup-notes/StandupNotesPage.tsx
@taskflow/src/routes/standup-notes/YesterdayColumn.tsx
@taskflow/src/components/ui/dropdown-menu.tsx
@taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add TZ-safe buildRecentDayOptions helper + unit test</name>
  <files>taskflow/src/lib/standup-date.ts, taskflow/src/lib/standup-date.test.ts</files>
  <behavior>
    - buildRecentDayOptions(14) returns exactly 14 entries.
    - Entries are local YYYY-MM-DD strings for today-1 .. today-14, most-recent-first
      (index 0 = today-1, last = today-14).
    - With vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0)) (Jan 1 2026, local), index 0 is
      '2025-12-31' and the last entry is '2025-12-18' — verifies local-component arithmetic
      crosses month/year boundaries without UTC shift.
    - With a late-evening local time (e.g. new Date(2026, 5, 7, 23, 30, 0)) the first entry is
      still the previous local calendar day ('2026-06-06'), proving no toISOString() drift.
  </behavior>
  <action>
    Add `export function buildRecentDayOptions(count: number): string[]` to standup-date.ts.
    Build the list by cloning `new Date()`, then for i = 1..count clone-and-`setDate(base.getDate() - i)`
    using LOCAL calendar arithmetic, formatting each via the existing module-private `toLocalDateString`
    helper (reuse it — do NOT add a second formatter, and NEVER call toISOString()/toLocaleDateString()
    per the standing Phase 62 rule documented at the top of standup-date.ts). Return the array already
    most-recent-first (i ascending). The helper returns ONLY date strings; per-row label formatting
    stays in the component (Task 3) where getColumnHeading/formatDateLabel live.
    Create standup-date.test.ts covering the four behaviors above. Use vi.setSystemTime with
    local-component Date construction (mirror the pattern in YesterdayColumn.test.ts) and
    vi.useRealTimers() in afterEach. Write the test first, watch it fail, then implement.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/lib/standup-date.test.ts</automated>
  </verify>
  <done>standup-date.test.ts passes; buildRecentDayOptions exported and used by no UTC formatter.</done>
</task>

<task type="auto">
  <name>Task 2: Hold dateOverride state in StandupNotesPage and thread new props</name>
  <files>taskflow/src/routes/standup-notes/StandupNotesPage.tsx</files>
  <action>
    Replace the `yesterdayDate` useMemo (currently `resolveYesterdayDate(scheduleData ?? undefined)`,
    StandupNotesPage.tsx:178-181) with:
    (a) `const [dateOverride, setDateOverride] = useState&lt;string | null&gt;(null);`
    (b) `const resolvedYesterday = useMemo(() =&gt; resolveYesterdayDate(scheduleData ?? undefined), [scheduleData]);`
    (c) `const yesterdayDate = dateOverride ?? resolvedYesterday;`
    Leave `dateLabel = formatDateLabel(yesterdayDate)` and every query keyed on `yesterdayDate`
    exactly as-is — they re-key automatically when the override changes.
    CRITICAL (per constraints): do NOT touch the schedule query
    (`['standup','schedule', jiraBaseUrl, jiraUserKey ?? '']`, :163-175). It drives the resolved
    default and re-keying it would be circular. It must stay independent of the override.
    Pass three new props to `&lt;YesterdayColumn&gt;` (:399-411): `resolvedYesterday={resolvedYesterday}`
    and `onSelectDate={(date: string | null) =&gt; setDateOverride(date)}`. Keep all existing props.
    The override is React state ONLY — do NOT route it through useSettingsStore, localStorage, or
    stronghold (no-persistence is a locked decision).
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit</automated>
  </verify>
  <done>StandupNotesPage compiles; yesterdayDate = dateOverride ?? resolvedYesterday; schedule query unchanged; YesterdayColumn receives resolvedYesterday + onSelectDate.</done>
</task>

<task type="auto">
  <name>Task 3: Add caret-on-hover dropdown day picker to YesterdayColumn heading</name>
  <files>taskflow/src/routes/standup-notes/YesterdayColumn.tsx, taskflow/src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx</files>
  <action>
    Extend `YesterdayColumnProps` with `resolvedYesterday: string` and
    `onSelectDate: (date: string | null) =&gt; void`. (These are required at the call site after Task 2;
    to keep the tempo-disabled fixture simple they may be optional with no-op defaults — but you MUST
    update BASE_PROPS regardless, see below.)
    Import `buildRecentDayOptions` from `@/lib/standup-date`, the five dropdown exports
    (`DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup,
    DropdownMenuRadioItem`) from `@/components/ui/dropdown-menu`, and `ChevronDown` from `lucide-react`.
    Build a memoised `dayOptions = useMemo(() =&gt; buildRecentDayOptions(14).map(date =&gt; ({ date, label:
    date === resolvedYesterday ? 'Yesterday' : formatDayLabel(date) })), [resolvedYesterday])`.
    For non-default labels reuse the module's heading logic: `getColumnHeading(date)` returns 'Yesterday'
    for calendar-yesterday and the weekday name otherwise — wrap so that ONLY the resolvedYesterday row
    is labelled 'Yesterday' (per CONTEXT: the resolved default may be Friday after a weekend, yet must
    read 'Yesterday'); all other rows use a weekday + date string built locally (mirror
    StandupNotesPage.formatDateLabel — split on '-', index DAY_NAMES/MONTH_NAMES, NEVER toLocaleDateString).
    Add a small local label helper or inline it; do not import the page-private formatDateLabel.
    In the heading block (currently `&lt;div className="mb-2 flex items-baseline gap-2"&gt;` with `&lt;h2&gt;` + `&lt;p&gt;`,
    :556-559), wrap ONLY the `&lt;h2&gt;` (plus the caret) in a `DropdownMenuTrigger`; leave the `&lt;p&gt;` date
    label outside so layout is unchanged. Trigger className: `group/yhead flex items-baseline gap-1
    cursor-pointer text-left`. Caret: `&lt;ChevronDown className="size-4 self-center opacity-0
    transition-opacity group-hover/yhead:opacity-60" /&gt;` so default (non-hover) look is identical.
    Render `&lt;DropdownMenuContent align="start" side="bottom" sideOffset={4}&gt;` containing a
    `&lt;DropdownMenuRadioGroup value={yesterdayDate} onValueChange={(v) =&gt; onSelectDate(v === resolvedYesterday
    ? null : v)}&gt;` mapping `dayOptions` to `&lt;DropdownMenuRadioItem key={opt.date} value={opt.date}&gt;{opt.label}
    &lt;/DropdownMenuRadioItem&gt;`. Passing `null` when the selection equals resolvedYesterday reverts to
    follow-the-schedule mode. The RadioGroup `value` is `yesterdayDate`, so the resolved-default row
    renders checked whenever no override is active (first-row-selected requirement).
    base-ui note: DropdownMenuTrigger renders a native &lt;button&gt; (a11y free), RadioItem ships a built-in
    CheckIcon indicator — do not hand-roll a checkmark.
    TEST FIX: update BASE_PROPS in YesterdayColumn.tempo-disabled.test.tsx to include
    `resolvedYesterday: '2026-05-22'` and `onSelectDate: vi.fn()` so the fixture type-checks and renders.
    The existing assertions (Tempo-disabled notice) are unaffected.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx && npm run check</automated>
  </verify>
  <done>Heading is a dropdown trigger; caret appears on hover only; 14-day radio list with resolved default first-and-selected labelled 'Yesterday'; selecting default calls onSelectDate(null); tempo-disabled test passes; npm run check green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user→UI state | User selects a day; value is a date string used only as a queryKey discriminator and date-range arg into already-trusted Jira/GitLab/Tempo fetchers. No new network surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jwb-01 | Tampering | date string fed to query date-range | accept | Values come from buildRecentDayOptions (closed 14-item set), not free user text; fetchers already validate inputs. |
| T-jwb-02 | Information disclosure | accidental persistence of override | mitigate | Override held in useState only; explicitly NOT routed through settings store / localStorage / stronghold (verified in Task 2 done-criteria). |
| T-jwb-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages installed; all imports (@base-ui/react, lucide-react, @tanstack/react-query) already in package.json. No legitimacy gate needed. |
</threat_model>

<verification>
- `cd taskflow && npm run check` is green (biome check + tsc).
- `cd taskflow && npx vitest run src/lib/standup-date.test.ts src/routes/standup-notes/YesterdayColumn.tempo-disabled.test.tsx` passes.
- Manual sanity (optional): hovering the Yesterday heading shows a caret; clicking lists 14 days
  most-recent-first with the default row checked; selecting another day re-fetches; reload returns to default.
- grep confirms no toISOString / toLocaleDateString introduced:
  `grep -rn 'toISOString\|toLocaleDateString' taskflow/src/lib/standup-date.ts taskflow/src/routes/standup-notes/YesterdayColumn.tsx` returns nothing new.
</verification>

<success_criteria>
- Default no-interaction recap behaviour unchanged; heading visually identical until hover.
- Caret-on-hover + pointer cursor affordance present.
- Dropdown lists all 14 calendar days (incl. weekends), most-recent-first.
- First row = resolved default, labelled 'Yesterday', shown selected when no override active.
- Selecting any day re-keys all four data queries; selecting default reverts via onSelectDate(null).
- Override is window-session React state only — reload returns to default; no persistence path touched.
- All date math TZ-safe (local components only).
- `npm run check` green; new + existing tests pass.
</success_criteria>

<output>
Create `.planning/quick/260607-jwb-in-standup-notes-i-want-to-be-able-to-ch/260607-jwb-SUMMARY.md` when done.
</output>
