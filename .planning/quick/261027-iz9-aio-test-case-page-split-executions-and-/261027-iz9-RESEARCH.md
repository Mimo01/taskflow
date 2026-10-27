# Quick 261027-iz9: Split AIO cycle Executions/Defects into Not done / Done - Research

**Researched:** 2026-10-27
**Domain:** React UI refactor in the existing codebase. No new packages.
**Confidence:** HIGH. Every finding comes from reading the codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Executions: Done = `normalizeStatus(run.status) === 'pass'`. Not done = Fail, Blocked, In progress, Not run.
- Defects: Done = `fields.status.statusCategory.key === 'done'`. Not done = every other category. Loading rows (no issue yet) go in Not done. No row is ever silently dropped.
- Sections are stacked: **Not done first**, then **Done**. Both are always open (no collapsing). Each has a header with a label and a count.
- All existing filters, search and sort stay. One shared toolbar drives both tables. Each section shows its own filtered count.
- Each section's empty state tells apart "nothing here at all" and "nothing matches the filters".

### Claude's Discretion
- Empty-state visuals and copy.
- Section header styling, and how sticky column headers work with two tables (`--aio-sticky-top`).
- Whether the whole-tab "No defects" empty state stays when there are zero defects.

### Deferred Ideas
None.
</user_constraints>

## Summary

Both lists already work in the same way. Local state, then a `useMemo` filter, then a `useMemo` sort, give one array (`visible` in ExecutionsList, `sorted` in DefectsList). That array renders as one sticky column-header div plus flex rows. The cleanest seam is to **partition that final array into `[notDone, done]` right after the sort.** Both groups then keep the shared sort order. Then render one local `Section` component twice. It takes a title, a count, the rows, and an empty-state variant. The toolbar, chips, popovers and sort state stay where they are, owned by the list component.

**Primary recommendation:** Inside each list file, extract the existing header row plus row map into a local section renderer. Wrap each section in its own `<section data-testid="executions-section-{open|done}">`, using `SectionHeading` from `aio-cycle/RunSection.tsx` for the title and count. Give each section its own sticky column header, and render that header only when the section has rows. Use a compact empty-state variant. Update the tests listed below to query with `within(section)`.

## Current structure (seams)

| Concern | ExecutionsList.tsx | DefectsList.tsx |
|---|---|---|
| Filter + sort output | `visible` (l.265-286): search plus a single-select status chip, then sort | `filtered` (l.375-390), then `sorted` (l.393-427) |
| "Any filter active" | Not present. Derive `query.trim() !== '' \|\| statusFilter !== 'ALL'` | `anyFilterActive` (l.369) |
| Whole-list empty | `runs.length === 0`: EmptyState FlaskConical "No test runs found" (l.389) | `defects.length === 0`: skeleton or EmptyState "No defects" (l.479-500). This returns early, before the toolbar |
| No-match | `<p>No runs match the selected filters…</p>` (l.395) | `<p>No defects match the selected filters.</p>` (l.571) |
| Sticky col header | `sticky top-(--aio-sticky-top) z-10 … bg-[color-mix(...muted 10%...)]` (l.401) | Same, plus `pr-2` (l.577) |
| Column defs | `COL` const, container-query driven (`@[560px]` and so on) on the `@container` root (l.318) | `COL`, root `@container` (l.506) |
| Done predicate source | `normalizeStatus` from `@/lib/aioUtils` | Same predicate as `useCycleDefects.ts:61` (`statusCategory?.key !== 'done'`) |

Partition helpers (pure, unit-testable):
```ts
// Executions
const isDone = (r: AioTestRun) => normalizeStatus(r.status) === 'pass';
// Defects: loading rows and rows that failed to resolve (issue null) fall into Not done
const isDone = (d: ResolvedDefect) => !d.isLoading && d.issue?.fields.status?.statusCategory?.key === 'done';
```
Use one pass, for example a `reduce` into two arrays, so the stable sort order is kept in each group.

Note: when a defect filter is active, the existing filter already drops loading rows (l.378). That is existing behaviour and fine. Without a filter, loading rows must land in Not done.

## Reusable pieces (don't hand-roll)

| Need | Use | Notes |
|---|---|---|
| Section label + count | `SectionHeading` in `aio-cycle/RunSection.tsx` | Renders `h3.text-sm.font-medium.text-muted-foreground` and "Title (n)". It already follows the detail-page convention (h3, no card panel). It has `mb-3` by default; override it with `className`, for example `mb-0 px-4 pt-4 pb-2`. It also has a `meta` slot |
| Empty state | `EmptyState` (`components/ui/empty-state.tsx`) | `py-8`, a `size-12` icon, `text-base` title. That is **too tall to stack twice**. Add an optional `compact` (or `className`) prop: `py-6`, `size-8` icon, `text-sm` title. Do not change the defaults, because about 30 call sites use it |
| Icon conventions | Existing: `FlaskConical` (no runs/defects), `ListFilter` (filter no-match, MyTasksPage "No matches"), `Inbox`, `ListChecks` | Suggested: no-match uses `ListFilter`; Executions Done-empty ("No passed runs yet") uses `FlaskConical` or `CircleDashed`; Executions Not-done-empty ("All runs passed") uses `CircleCheck` (or `PartyPopper`); Defects Not-done-empty ("No open defects") uses `ShieldCheck` or `CircleCheck`; Defects Done-empty ("No resolved defects yet") uses `Bug`. Keep icons `text-muted-foreground`. Colour encodes status only, so don't tint a celebratory icon. If you tint at all, only green on "all passed", and muted is the safer choice |
| Status rail / pills | Unchanged `RunRow` / `DefectRow` | No row changes are needed |

**Recommended copy (each section has two variants):**
- Exec Not done: empty → "All runs passed" / no-match → "No open runs match the filters"
- Exec Done: empty → "No passed runs yet" / no-match → "No passed runs match the filters"
- Defects Not done: empty → "No open defects" / no-match → "No open defects match the filters"
- Defects Done: empty → "No resolved defects yet" / no-match → "No resolved defects match the filters"

"Empty" means the unfiltered partition is empty. Compute the partition counts on the raw `runs`/`defects` as well, not only on the filtered list. "No-match" means the unfiltered partition has items but the filtered one does not. A no-match state can carry an action: a "Clear filters" link. Defects already has `clearAllFilters`. For Executions, reset `query` and `statusFilter`.

**Whole-tab empty:** keep the existing "No test runs found" and "No defects" states when the total is 0, rendered instead of the two sections. Two "nothing yet" sections would be noise, and the tests at l.880-881 assert this text.

## Sticky headers with two stacked tables

- Each `position: sticky` element sticks only inside its **containing block**, which is its parent. Put each section's column header inside that section's own wrapper div (heading, header, rows). The Not-done header then scrolls away naturally when its section ends, and the Done header takes over at the same `top-(--aio-sticky-top)`. Never make the two headers siblings under one shared parent. Both would stick at once and overlap.
- Keep the section heading (h3) **non-sticky**. If it is sticky, the column header needs `top: calc(var(--aio-sticky-top) + <heading h>)`, and the heading height changes with density. That is fragile. If the user later wants the label to stay visible, put the label and the column row into ONE sticky wrapper instead of stacking two sticky offsets.
- z-order: the tab bar is `z-20`, the column headers are `z-10`. Keep it that way. Row overlay buttons are `absolute` with no z-index, and trigger chips are `relative z-10`. Chips can paint over the header at the same z-index. This is an existing issue and still fine, because the header comes later in DOM order only within its own section. If overlap appears, bump headers to `z-[11]`.
- Don't render a column header for an empty section. Show the heading and the empty state only.
- The `@container` must stay on the outer list root that wraps both sections. Container variants never style the container itself (memory note). The `COL` classes in the rows and headers are descendants, so they keep working.

## Project gotchas that apply

- **One row = one line at every density.** Don't add the count or other meta as a second line in a row. The section heading is a single line.
- **Colour = status only. No legends.** Section headings stay muted text, with no coloured badges.
- **Tailwind v4 `space-y` vs margins:** don't use `space-y-*` on the sections wrapper while also giving children `m*`/`-my-*`. Use `flex flex-col gap-*` or explicit `pt-*` on the section.
- **Detail pages: no card panels.** Sections are plain blocks with an h3, not `<Card>`.
- **React Compiler:** keep the partition inside `useMemo` or plain render derivations from state and props. Don't add any module-level mutable reads.
- **Biome:** run `biome check` only on the touched files, not `--write` on all of `src`.

## Tests that break (AioCycleDetailPage.test.tsx)

Fixtures: `mockRuns` has run-1 PASS, run-2 FAIL and run-3 NOT_EXECUTED. The defect fixtures have 1001 Open (new), 1002 Done (done) and 1003 Open (new).

| Test (line) | Why it breaks | Fix |
|---|---|---|
| `sort buttons cycle asc, desc…` (~662) | DOM order becomes [run-2, run-3 \| run-1]. Both sections render a header, so `getByTestId('executions-sort-key')` and `executions-sort-indicator-key` find **2 matches and throw** | Click the sort button inside `within(getByTestId('executions-section-open'))`. Assert order within each section, or assert the new combined order |
| `status sort puts failing runs first` (~683) | Passes by coincidence (run-2 first, run-1 last), but `getByTestId('executions-sort-status')` now has 2 matches | Use `within(section)` |
| `shows "No runs match the selected filters"` (651) | Copy changes, and two sections could both match the regex, so `getByText` throws on multiple | Assert each section's no-match text through the section testid |
| Defects Test 1 sort Key (~1780) | asc order becomes [1001, 1003 \| 1002] and desc becomes [1003, 1001 \| 1002]. Duplicate `defects-sort-header-key` and indicator testids | `within(section)`, and update the expected order |
| Defects Test 2 Priority (~1832) | Order passes by coincidence. Duplicate header testid | `within(section)` |
| Defects Test 3 indicator (~1853) | `getByTestId('defects-sort-indicator-status')` finds 2 matches. `queryBy…toBeNull` still works when there are 0 matches | `within(section)` |
| Defects Tests 4, 5, 6 filter | Row counts still work. Test 6 order (C then A) is inside Not done, which is fine. Only the header clicks need scoping | `within(section)` for header clicks |
| `No defects` (880-881), `runs-table-skeleton` (332), `defects-skeleton`, `run-row-` muted (713), `defect-row-186227` (1181), T1-02 loading row (1646) | Survive if whole-tab empty and skeleton states are kept, and loading rows go to Not done | Keep the testids unchanged |

Other test files that reference this text (`DefectSummary.test.tsx` "No defects raised…", `AioTestRunsSection.test.tsx`) are separate components and are not affected.

Add these new tests:
- Partition: a pass run renders inside `executions-section-done`, and fail and not-run renders inside `-open`.
- The Done-category defect sits in the done section, and a loading defect sits in the open section.
- The empty variant: every run passes, so the open section shows "All runs passed".
- The no-match variant: the Pass chip selected, so the open section shows its no-match copy.
- The section counts.

## Validation

- Quick: `cd taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx`
- Lint and types on touched files: `npx biome check src/routes/dashboard/aio-cycle/ExecutionsList.tsx src/routes/dashboard/aio-cycle/DefectsList.tsx src/components/ui/empty-state.tsx && npx tsc --noEmit`
- The pre-commit hook runs the full vitest suite, so combine the test updates and the implementation into one commit.
- Manual check (Tauri/WebKit): scroll a long cycle and confirm the Not-done header releases and the Done header takes over under the tab bar. Check all three densities and that a narrow width still hides columns.

## Assumptions Log

| # | Claim | Risk |
|---|---|---|
| A1 | Lucide exports `CircleCheck`, `CircleDashed`, `ShieldCheck`, `PartyPopper` under these names in the installed version | Low. Check with a grep in `node_modules/lucide-react` or the tsc run; fall back to `CheckCircle2` |
| A2 | Keeping the whole-tab "No defects" / "No test runs found" states (instead of two empty sections) is what the user wants | Low. This was left to Claude's discretion |

## Open Questions

None that block the work. A failed defect resolution (issue null, not loading) is placed in Not done. Note that the KPI `openCount` (useCycleDefects l.60) excludes such rows, so the Not-done count can be higher than the KPI by the number of unresolved defects. This is acceptable, but the planner may mention it.
