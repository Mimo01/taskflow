# Quick Task 260922-bca: I want to have a nicer datepicker across the app. The current one works but I dont like the style - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the app's native `<input type="date">` fields (currently the de-facto "datepicker") with a styled, consistent date picker component, reused across every location that currently uses a native date input.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Use `react-day-picker` (new dependency) rendered inside the app's existing Popover (Base UI) as the trigger/positioning shell.
- Build one shared `DatePicker` component in `src/components/ui/` (shadcn-style) so every call site imports the same component.
- Style the calendar to match the app's existing design tokens/theme (base-nova shadcn style, neutral base color), not the library's default look.

### Scope
- Replace all 6 native `<input type="date">` locations:
  - `src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx`
  - `src/routes/dashboard/issue-detail/LogWorkPopover.tsx`
  - `src/routes/dashboard/release-detail/EditReleaseModal.tsx`
  - `src/routes/worklogs/WorklogsPage.tsx` (from + to filter fields)
  - `src/routes/worklogs/EditWorklogForm.tsx`

### Range UX (WorklogsPage from/to)
- Keep from/to as two independent single-date `DatePicker` popovers side by side (not a single range-picker component). Matches current two-field layout and avoids changing the from/to state shape.

### Claude's Discretion
- Exact visual styling details (colors, spacing, border radius) beyond "match existing design tokens" — align with `components.json` shadcn config (base-nova, neutral) and existing Popover styling conventions.
- Date formatting/display string in the trigger button (e.g. `MMM d, yyyy` vs locale default).
- Whether existing tests referencing `input[type="date"]` (e.g. `WorklogsPage.test.tsx`) need updating to target the new component's DOM structure — planner/executor should update these accordingly since the DOM shape will change.
- Package version pin for `react-day-picker` (and `date-fns` if required as a peer dependency) — pick current stable versions compatible with React 19 if applicable.

</decisions>

<specifics>
## Specific Ideas

No specific visual references given — user wants "nicer" styling than the native browser date input, consistent across the app. Standard shadcn/react-day-picker calendar popover pattern is the expected shape.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Reference existing `src/components/ui/popover.tsx` and `components.json` for styling conventions to follow.

</canonical_refs>
