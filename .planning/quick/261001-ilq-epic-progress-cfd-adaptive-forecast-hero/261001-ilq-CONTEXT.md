# Quick Task 261001-ilq: Epic progress — CFD, adaptive forecast, hero stats, unified tooltips - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Fourth iteration on the epic detail progress section (prior: 261001-fmk, -g5q, -hsz; all on main).
Key files: `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, `EpicTimeBurnup.tsx`,
`taskflow/src/lib/epic-progress.ts`, `taskflow/src/services/jira.ts` (fetchEpicStories, fetchEpicWorklogs),
`taskflow/src/components/ui/tooltip.tsx`, `taskflow/src/components/ui/chart.tsx` (ChartTooltipContent),
`taskflow/src/routes/dashboard/EpicProgressCells.tsx`, `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (Stories list mini bars),
`taskflow/src/lib/statusStyles.ts`.

User UAT feedback on 261001-hsz (tooltips "better"; otherwise):
1. "Unify the tooltip styles."
2. "I like the colors for the statuses, make it everywhere consistent."
3. "Redesign the 4 main info on top."
4. "The users should be shown as they are everywhere in Jira."
5. "The task count at the end of user rows is ugly, redesign it."
6. "Modify the estimates. 4 weeks is not enough when the tasks exist for a week, or when work started 3 days ago but has high
   velocity. Consider different cases and do the estimates better." (= the projected finish / forecast)
7. "Put more things into the graphs — in progress is not shown, remaining is not shown, and so on."

</domain>

<decisions>
## Implementation Decisions

### Graph (user choice: Cumulative flow + forecast)
- Count/SP mode main chart becomes a **cumulative flow diagram**: stacked areas over time for **Done / In Progress / To Do**
  (bottom→top), coloured with the status-category colours (same as statusCategoryDotClass), built from REAL status history.
  - Status history: lazy fetch of the epic's stories with `expand=changelog` (status field transitions → category per day via
    the status → statusCategory mapping; the codebase's standup feature already uses expand=changelog — reuse patterns/types from
    `services/jira-changelog.ts` and jira-standup; respect its timeout lesson: chunk keys, small pages, only this epic's stories).
  - Fallback when history unavailable/loading: current-state approximation (created → to do; statuscategorychangedate/done date) with a subtle note.
- **Remaining** line overlay (to do + in progress in the active metric).
- **Forecast projection**: dashed line from today's remaining to 0 at the likely finish date, with an optimistic–pessimistic
  range band, extending the x-axis into the future. Not shown when done / too early / stalled.
- Time mode chart: keep worklog-based model but add **Remaining** (estimate − logged) series and the time forecast projection.
  Colours consistent with the status palette (logged = done colour, remaining = in-progress colour, estimate = to-do/neutral) — planner to map coherently.
- Chart tooltip lists every series with values (+ forecast values for future points) in the active metric.

### Forecast (user choice: Adaptive range)
- Velocity window adapts to epic age: from first activity (first done/first in-progress transition/first worklog) up to 6 weeks,
  minimum a few days; recent weeks weighted more (e.g. EWMA or weighted weekly throughput).
- Output: likely date + optimistic/pessimistic range (e.g. from variance of daily/weekly throughput or percentile bands) + a confidence label.
- Accounts for scope growth (net: completion rate minus scope-add rate over the same window); if net ≤ 0 → "not converging" state.
- Explicit states with explanations: done; too early (insufficient activity — but a 3-day-old epic with high velocity MUST still forecast);
  stalled (no progress for N days); not converging (scope grows faster than done); ok.
- Time mode: forecast from logged-hours rate vs remaining hours.
- Pure, well-tested functions in `lib/` with injected `today`; cover the user's cases explicitly in tests
  (1-week-old epic, 3-day-old high-velocity epic, long-running steady epic, stalled epic, scope growth).
- Tooltip on the forecast explains the method in plain words (window used, rate, range).

### Top info (user choice: Hero + stat strip — preview selected)
```
┌───────────────────────────────┬──────────────┬──────────────┬──────────────┐
│ 62%  done                     │ Finish       │ Remaining    │ Risks        │
│ ████████████▓▓▓▓▓░░░░░░░      │ Oct 24       │ 9 items      │ ⚠ 3 unest.   │
│ 14 of 23 · 4 in progress      │ Oct 20–Nov 2 │ 31 SP · 42h  │ ⚠ 2 unassgn. │
└───────────────────────────────┴──────────────┴──────────────┴──────────────┘
```
- Hero: big % (active metric), segmented status bar in status colours, "X of Y done · N in progress".
- Finish: likely date + range (+ state text when not ok).
- Remaining: in active metric, plus the other metrics as secondary (items · SP · hours).
- Risks: chips (unestimated, unassigned; more if cheap, e.g. stalled) — hidden/"None" when clean.
- Responsive: stacks gracefully at narrow widths; keep full-width non-card layout from 261001-hsz.

### Users (Jira-like)
- Assignee rows render users the way Jira does: avatar (CachedAvatar, same size/shape as elsewhere in the app) + display name;
  Unassigned uses a neutral placeholder avatar like Jira's. Reuse existing app patterns (MyTaskRow, Stories list rows).

### User row trailing value (user choice: Status-coloured count chips)
- Replace the trailing text with small chips per category in status colours: done / in progress / to do (active metric);
  Time mode: logged / estimate chips. Zero-value chips hidden or dimmed. Fixed-width alignment across rows.

### Tooltips unified + colours consistent
- ONE tooltip visual style everywhere in this feature (base-ui Tooltip, recharts ChartTooltipContent, quick-peek, story mini bars):
  same background, ring, radius, padding, text size, row layout (swatch · label · value), muted secondary lines.
  Prefer a shared presentational `TooltipBody`/row component used by both base-ui tooltips and the chart tooltip content.
- Status-category colours used consistently everywhere in the feature: status bar, assignee bars, chips, CFD areas,
  quick-peek bar, story mini bars, tooltip swatches. No ad-hoc green/gray/red that disagrees with statusStyles (overrun may keep a
  distinct warning colour if it doesn't collide with a status colour).

### Constraints carried over
- Existing tests: update only intentionally changed expectations and list them; EpicDetailSheet.test.tsx text-collision rule
  (no standalone visible "Stories"/"In Progress"/"Done" text nodes in the section — e.g. "4 in progress" inside a larger string is ok
  only if not an exact standalone match; verify).
- Lazy fetches: changelog only when the chart is shown; separate react-query key including story-set signature; no shared-fetcher key reuse.
- Pre-commit: biome + tsc (incl tests, no `.at`) + full vitest; one commit per task (tests+impl); never --no-verify.
- One row = one line at every density. Do not fix fetchAllSearchPages 200-step bug here.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-hsz-epic-progress-time-burnup-from-worklogs-/ (latest plan, research, review)
- taskflow/src/services/jira-changelog.ts, jira-standup (expand=changelog usage + timeout lesson)
- taskflow/src/lib/statusStyles.ts (status colours)
- taskflow/src/components/ui/cached-avatar.tsx, taskflow/src/routes/my-tasks/MyTaskRow.tsx (user display)

</canonical_refs>
