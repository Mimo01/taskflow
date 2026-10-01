# Quick Task 261001-g5q: Epic progress — Time metric, card container, hover tooltips - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Follow-up to quick task 261001-fmk (UAT approved). Adjust the epic detail progress section
(`taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, derivation lib
`taskflow/src/lib/epic-progress.ts`, data from `fetchEpicStories` in `taskflow/src/services/jira.ts`):

1. Better visual separation from neighbouring sections.
2. Richer hover: today only some things show tooltips (status segments via `title`, burnup via recharts).
3. Third metric: time estimates / logged, counted for stories + their subtasks summed.

</domain>

<decisions>
## Implementation Decisions

### Time metric (user choice: 3rd toggle option)
- Toggle becomes **Count / SP / Time** (default still Count).
- Data: add Jira's server-computed aggregate fields to `fetchEpicStories` (same request, no extra calls):
  `aggregatetimeoriginalestimate`, `aggregatetimespent`, `aggregatetimeestimate` (seconds). These already sum
  the story's own time tracking PLUS all its subtasks (the issue sidebar's `TimeTrackingSummary.tsx` relies on them).
  Add them as optional fields on the `JiraIssue` type (services/jira.ts ~line 159 area); they already exist on the detail type ~line 1751.
- In Time mode:
  - Weight = aggregate original estimate (seconds); missing → 0. Burnup scope = estimates by story created date;
    done = estimates of done stories by done date (no per-day logged history — worklog dates would need per-story fetches, out of scope).
  - Status bar / legend and assignee bars weighted by estimate.
  - Tiles switch to: **Estimated**, **Logged**, **Remaining** (sum of aggregatetimeestimate), **% logged** (logged / estimated; guard 0).
    Forecast tile is not meaningful in time mode — replace with the four time tiles above (Count/SP tiles unchanged).
  - Assignee rows show `logged / estimate` on the right instead of remaining.
  - "Unestimated" message analog of SP: when total estimate is 0, show "No time estimated — switch to Count" instead of blank bars.
- Format durations with existing `formatDuration` from `@/services/jira/duration` (check its signature/output; hours-centric like "12h 30m" / "3d").

### Separation (Claude's discretion — chosen: Card container)
- Wrap the section in the shared `Card` (`components/ui/card.tsx`; rounded-xl ring-1, token-driven padding, role-less div —
  keep the `<section aria-label="Epic progress">` semantics). Title "Progress" + toggle become the card header.
- Memory gotcha: never wrap a non-bare ChartWrapper inside Card; ChartContainer usage here is direct, which is fine. Skeleton geometry must match the card (update EpicProgressSkeleton to the same Card shell).
- Add spacing so the card doesn't touch neighbouring sections.

### Hover (Claude's discretion)
- No tooltip primitive exists in `components/ui` yet; `@base-ui/react` is a dependency. Add a small `components/ui/tooltip.tsx`
  wrapper around base-ui Tooltip (styled like the recharts tooltip: bg-background, ring, text-xs, shadow), or a lighter local
  hover popover if base-ui is impractical in jsdom tests — planner decides with evidence.
- Tooltips on: each stat tile (explains what it counts + raw numbers, e.g. "7 of 23 stories done"), each status bar segment AND
  legend item (status, count, SP, time, % of total), each assignee bar segment (category, value in active metric) and the
  assignee name/right-hand value (full breakdown done/in progress/to do in active metric), burnup tooltip already exists —
  make its label/values metric-formatted (SP / duration).
- Tooltips must be keyboard-reachable where the trigger is focusable; plain hover is fine for bar segments.

### Constraints carried over
- Existing tests (`EpicDetailSheet.test.tsx`, epic-progress tests, EpicProgressSection tests) must keep passing; avoid the word
  "Stories" as standalone text and avoid duplicating standalone "In Progress"/"Done" text nodes in the section.
- Pre-commit hook runs full vitest; one commit per tdd task (tests + impl). Known flaky `WorklogsPage.test.tsx` timeout — retry, never --no-verify.
- One row = one line at every density.
- Do not modify `EpicProgressCells.tsx` (list quick peek).

</decisions>

<specifics>
## Specific Ideas

User: "The Storypoints and Count is not enough, I also need time estimates/logged (counted stories+subtasks summed)".

</specifics>

<canonical_refs>
## Canonical References

- .planning/quick/261001-fmk-epic-detail-progress-chart/ (prior plan, research, review)
- taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx (aggregate field usage)

</canonical_refs>
