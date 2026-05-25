---
phase: quick-260525-rtu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
  - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
autonomous: false
requirements: [RTU-01]
tags: [ui, tailwind, standup-notes, visual-polish]

must_haves:
  truths:
    - "Today column has a subtle bg-muted/30 tint distinguishing it from the bright Yesterday column"
    - "Yesterday issue/MR groups render as individual rounded bordered cards with gap spacing between them"
    - "Each Today section header (IN PROGRESS, UP NEXT, MRS AWAITING YOU, PARTICIPATING) shows a count badge when it has items"
    - "Today sections after the first show a top border separator (border-t)"
    - "All existing functionality (clicks, navigation, markdown copy, queries) is unchanged"
  artifacts:
    - path: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      provides: "Today column wrapper with bg-muted/30 tint"
      contains: "bg-muted/30"
    - path: "taskflow/src/routes/standup-notes/YesterdayColumn.tsx"
      provides: "Outer group container using flex gap instead of divide-y"
      contains: "flex flex-col gap-2"
    - path: "taskflow/src/routes/standup-notes/IssueActivityGroup.tsx"
      provides: "Card-treated issue group root"
      contains: "rounded-lg border border-border bg-card"
    - path: "taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx"
      provides: "Card-treated standalone MR group root"
      contains: "rounded-lg border border-border bg-card"
    - path: "taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx"
      provides: "Count badge header replacing string interpolation"
      contains: "bg-muted px-1.5"
  key_links:
    - from: "StandupNotesPage Today wrapper"
      to: "TodayColumn full-height container"
      via: "background tint on the w-1/2 wrapper div"
      pattern: "w-1/2 overflow-auto bg-muted/30"
    - from: "YesterdayColumn outer container"
      to: "IssueActivityGroup / StandaloneMrGroup card roots"
      via: "flex gap-2 spacing between bordered cards"
      pattern: "flex flex-col gap-2"
---

<objective>
Polish the visual design of the standup notes page so it reads cleaner, sleeker, and matches the app's existing card/chip design language. This is a pure visual/CSS pass: Today column gets a subtle inset tint, Yesterday groups become individual bordered cards, and Today section headers gain count badges plus separators.

Purpose: Bring the standup notes page in line with the app's shadcn/ui design vocabulary (rounded bordered cards, muted tones, thin borders, count badges) without touching any business logic.
Output: 8 standup-notes component files updated with class-string edits and minor header JSX restructuring. Zero behavioral changes — all clicks, navigation, queries, and markdown generation preserved.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260525-rtu-polish-the-visual-design-of-standup-note/260525-rtu-CONTEXT.md
@.planning/quick/260525-rtu-polish-the-visual-design-of-standup-note/260525-rtu-RESEARCH.md

<interfaces>
<!-- Exact current source confirmed during planning. Executor should edit these
     known locations directly — no codebase exploration needed. Line numbers are
     planning-time references; match on the class string, not the line number. -->

App card pattern (target):      rounded-lg border border-border bg-card
App chip pattern (existing):    rounded bg-muted px-2 py-1 text-xs text-muted-foreground
Count badge pattern (new):      rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground
Section header (existing):      text-xs text-muted-foreground uppercase tracking-wide mb-2

StandupNotesPage.tsx line 362 (Today wrapper):
  <div className="w-1/2 overflow-auto">   →  add bg-muted/30

YesterdayColumn.tsx line 479 (outer group container, inside `hasAnyData &&`):
  <div className="divide-y divide-border">   →   flex flex-col gap-2

IssueActivityGroup.tsx line 89 (root):
  <div className="py-2">   →   rounded-lg border border-border bg-card overflow-hidden
  (inner button line 94 keeps its own px-2 py-2 padding; inner divide-y on line 108 stays)

StandaloneMrGroup.tsx line 61 (root):
  <div className="py-2">   →   rounded-lg border border-border bg-card overflow-hidden
  (inner divide-y on line 78 stays)

TodayInProgressSection.tsx lines 212-213 — `rows` prop in scope, first section (no border-t)
TodayUpNextSection.tsx lines 206-207 — `rows` prop in scope, add border-t
TodayMrsSection.tsx lines 65-68 — `items` prop in scope, add border-t
TodayParticipatingSection.tsx lines 59-66 — `items` prop in scope, add border-t, remove `header` string var
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Today column tint + Yesterday card treatment</name>
  <files>
    taskflow/src/routes/standup-notes/StandupNotesPage.tsx,
    taskflow/src/routes/standup-notes/YesterdayColumn.tsx,
    taskflow/src/routes/standup-notes/IssueActivityGroup.tsx,
    taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
  </files>
  <action>
    Apply the locked column/card decisions from CONTEXT.md (D: column layout + Yesterday issue groups).

    1. StandupNotesPage.tsx — Today column wrapper (the `w-1/2 overflow-auto` div that wraps `<TodayColumn>`, ~line 362): add `bg-muted/30` so the class string becomes `w-1/2 overflow-auto bg-muted/30`. Do NOT touch the Yesterday wrapper (it keeps `border-r border-border px-6 py-4` and the default background — Yesterday stays on the bright side per decision).

    2. YesterdayColumn.tsx — the outer group container rendered inside `{hasAnyData && (...)}` (~line 479): change `divide-y divide-border` to `flex flex-col gap-2`. This is the OUTER container only.

    3. IssueActivityGroup.tsx — root div (~line 89): change `py-2` to `rounded-lg border border-border bg-card overflow-hidden`. Leave the inner header `<button>` (its `px-2 py-2 rounded hover:bg-muted/50`) and the inner sub-items `divide-y divide-border` (~line 108) untouched.

    4. StandaloneMrGroup.tsx — root div (~line 61): change `py-2` to `rounded-lg border border-border bg-card overflow-hidden`. Leave the inner sub-items `divide-y divide-border` (~line 78) untouched.

    Discretion (CompactEmptyNotice in YesterdayColumn ~line 371): you MAY change `bg-muted/40` to `bg-muted/30` and the icon `size-7` to `size-5` for consistency with the new card treatment — only if it reads as a subtle inline notice. Skip if uncertain.

    No-change zones: all `hover:bg-muted/50`, all inner `divide-y divide-border` inside card bodies, the Yesterday wrapper border-r, all click handlers, all query logic. No new imports, no new props.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "w-1/2 overflow-auto bg-muted/30" src/routes/standup-notes/StandupNotesPage.tsx && grep -q "flex flex-col gap-2" src/routes/standup-notes/YesterdayColumn.tsx && grep -q "rounded-lg border border-border bg-card overflow-hidden" src/routes/standup-notes/IssueActivityGroup.tsx && grep -q "rounded-lg border border-border bg-card overflow-hidden" src/routes/standup-notes/StandaloneMrGroup.tsx && echo OK</automated>
  </verify>
  <done>Today wrapper has bg-muted/30; YesterdayColumn outer container uses flex gap-2; both group roots are bordered cards with overflow-hidden. Inner divide-y and hover states preserved. `npx tsc --noEmit` (or the project type-check) passes.</done>
</task>

<task type="auto">
  <name>Task 2: Today section headers — count badges + separators</name>
  <files>
    taskflow/src/routes/standup-notes/TodayInProgressSection.tsx,
    taskflow/src/routes/standup-notes/TodayUpNextSection.tsx,
    taskflow/src/routes/standup-notes/TodayMrsSection.tsx,
    taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
  </files>
  <action>
    Apply the locked section-header decisions from CONTEXT.md (D: section headers). For each of the four Today sections, replace the standalone `<h3>` with a flex row containing the existing `<h3>` (without `mb-2`) plus a conditional count badge, and add `border-t border-border pt-4` to sections 2-4. Use the count badge pattern: `rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground`.

    The header row replaces the `<h3 ...>LABEL</h3>` with:
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide">LABEL</h3>
        {COUNT > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{COUNT}</span>
        )}
      </div>

    Per-file specifics:
    - TodayInProgressSection.tsx (~lines 212-213): wrapper `mb-6` → `mb-4` (NO border-t — this is the first section). LABEL=`IN PROGRESS`, COUNT=`rows.length`.
    - TodayUpNextSection.tsx (~lines 206-207): wrapper `mb-6` → `mb-4 border-t border-border pt-4`. LABEL=`UP NEXT`, COUNT=`rows.length`.
    - TodayMrsSection.tsx (~lines 65-68): wrapper `mb-6` → `mb-4 border-t border-border pt-4`. LABEL=`MRS AWAITING YOU`, COUNT=`items.length`.
    - TodayParticipatingSection.tsx (~lines 59-66): wrapper `mb-6` → `mb-4 border-t border-border pt-4`. LABEL=`PARTICIPATING`, COUNT=`items.length`. REMOVE the `const header = items.length > 0 ? ... : 'PARTICIPATING'` variable entirely (it's replaced by the badge) — confirm `header` has no other references before deleting.

    All `rows`/`items` props are already in scope — no new props. No new imports. Do not alter any rendering branches below the header (skeleton/error/list), click handlers, or queries.

    Note (accepted per design): if IN PROGRESS is empty it returns null and UP NEXT becomes the first rendered section, showing its border-t at the column top. This is acceptable per the locked decision.
  </action>
  <verify>
    <automated>cd taskflow && grep -q "border-t border-border pt-4" src/routes/standup-notes/TodayUpNextSection.tsx && grep -q "border-t border-border pt-4" src/routes/standup-notes/TodayMrsSection.tsx && grep -q "border-t border-border pt-4" src/routes/standup-notes/TodayParticipatingSection.tsx && ! grep -q "border-t border-border pt-4" src/routes/standup-notes/TodayInProgressSection.tsx && grep -rq "bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" src/routes/standup-notes/TodayInProgressSection.tsx && ! grep -q "PARTICIPATING (" src/routes/standup-notes/TodayParticipatingSection.tsx && echo OK</automated>
  </verify>
  <done>All four sections show a count badge when populated. UpNext/Mrs/Participating have a top border separator; InProgress does not. The `header` string-interpolation variable is removed from TodayParticipatingSection. Type-check passes; no unused-variable warnings for `header`.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Visual polish of the standup notes page: Today column now has a subtle bg-muted/30 inset tint, Yesterday issue/MR groups render as individual rounded bordered cards with gap spacing, and the four Today section headers (IN PROGRESS, UP NEXT, MRS AWAITING YOU, PARTICIPATING) now show count badges with border-t separators between sections. All functionality unchanged.
  </what-built>
  <how-to-verify>
    1. Run the app (`cd taskflow && npm run tauri dev` or the usual dev command) and navigate to the Standup Notes page.
    2. Confirm the Today (right) column has a subtle gray tint distinguishing it from the bright Yesterday (left) column, with the border-r divider intact.
    3. Confirm Yesterday issue/MR groups appear as separate rounded bordered cards with visible gaps between them (not a single divided list). Expand a group — internal sub-item dividers should still be present inside the card.
    4. Confirm each Today section with items shows a small count badge next to its uppercase label (e.g. "IN PROGRESS  3"), and sections after the first have a thin top-border separator.
    5. Functionality check: click an issue row and an MR row — they should still navigate as before. Trigger the markdown copy — output should be unchanged.
    6. Visually confirm overall coherence with the rest of the app (card style, muted tones, thin borders).
  </how-to-verify>
  <resume-signal>Type "approved" if it looks clean and matches the app, or describe any visual issues to adjust.</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` (or the project's type-check script) passes with no new errors.
- Project lint passes on the 8 modified files (no unused `header` variable).
- All grep gates in Task 1 and Task 2 verify blocks return OK.
- Manual: human-verify checkpoint approved.
</verification>

<success_criteria>
- Today column visually distinct via bg-muted/30 tint; Yesterday stays bright; border-r divider preserved.
- Yesterday issue and MR groups render as individual rounded-lg bordered cards (bg-card) with gap-2 spacing; internal divide-y preserved inside cards.
- All four Today section headers show count badges (rounded bg-muted px-1.5 py-0.5) when populated.
- Sections 2-4 (UP NEXT, MRS AWAITING YOU, PARTICIPATING) have border-t separators; IN PROGRESS does not.
- Zero behavioral changes: clicks, navigation, queries, and markdown generation all work exactly as before.
- 8 files changed, all class-string edits plus header JSX restructuring; no new imports, no new props, no logic changes.
</success_criteria>

<output>
Create `.planning/quick/260525-rtu-polish-the-visual-design-of-standup-note/260525-rtu-SUMMARY.md` when done.
</output>
