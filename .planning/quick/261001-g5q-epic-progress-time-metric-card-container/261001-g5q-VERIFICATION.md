---
phase: quick-261001-g5q
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Open an epic with estimated/logged time and toggle Count / SP / Time"
    expected: "Card separation looks right (header, spacing vs Attachments/Stories); Time tiles, logged / estimate column and the burnup Y axis in hours fit on one line at all densities"
    why_human: "Visual look and feel, row geometry"
  - test: "Hover and keyboard-tab tiles, status segments, legend items, assignee name, bar segments and value"
    expected: "Tooltips open readably in the real Tauri webview, with no stacked or clipped popups"
    why_human: "Real-browser tooltip positioning and feel; jsdom only proves that they open"
  - test: "Check the Time numbers against a real Jira epic"
    expected: "Estimated, Logged and Remaining include subtasks (aggregate fields)"
    why_human: "Depends on the live Jira instance returning the aggregate fields"
---

# Quick 261001-g5q Verification

**Goal:** Time metric as the 3rd toggle option, Card container, tooltips, and a burnup formatted per metric.
**Status:** human_needed. All automated checks pass. Look and feel is deferred to a human.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Toggle has Count / SP / Time, Count default | VERIFIED | `METRICS` array in EpicProgressSection.tsx, `useState<Metric>('count')` |
| 2 | Time weights burnup, status and assignee by aggregate original estimate | VERIFIED | `weightOf` 'time' branch uses `secOf(aggregatetimeoriginalestimate)`, which coerces non-finite or negative values to 0. `secOf` and `weightOf` are used by all derive* functions. |
| 3 | Time tiles Estimated / Logged / Remaining / % logged | VERIFIED | `deriveTimeTotals` in the lib, 4 `Tile`s in time mode, "—" when pctLogged is null |
| 4 | Assignee rows show logged / estimate | VERIFIED | `formatDuration(a.logged) / formatDuration(a.estimate)`. `logged` and `estimate` are accumulated in `deriveAssigneeBuckets`. |
| 5 | "No time estimated — switch to Count" guard | VERIFIED | The guard replaces the charts block when `time.estimated === 0` |
| 6 | Card container with title and toggle in the header | VERIFIED | `section[aria-label]` > `Card size="sm"` > `CardHeader` (`CardTitle` with h3, `CardAction` with toggle). The skeleton uses the same Card shell and has no region role. |
| 7 | Tooltips on tiles, legend, assignee name/value/segments and status segments | VERIFIED | `tooltip.tsx` is a base-ui wrapper. Every listed element is wrapped in Tooltip/TooltipTrigger. The native `title` attributes were dropped. Rendering is text-only, with no dangerouslySetInnerHTML. |
| 8 | Burnup tooltip and Y axis formatted per metric | VERIFIED | `formatter` uses `formatMetric(value, metric)`. YAxis `tickFormatter` shows hours in time mode, and the axis is widened to 40. |

Fetcher: `fetchEpicStories` requests `aggregatetimeoriginalestimate`, `aggregatetimespent` and `aggregatetimeestimate`. The `JiraIssue` type carries them. This matches the key link in the plan.

## Spot-checks

- vitest on EpicProgressSection, EpicDetailSheet, IssueDetailPage.progressive, epic-progress and jira.test: 5 files, 169 tests passed.
- `npx tsc --noEmit`: clean.
- `biome check` on the 4 touched source files: no diagnostics.
- EpicProgressCells.tsx: unchanged between 605d3ce9 and 18a6331d, so the constraint is met.
- Commits: exactly the two planned ones (ead77644, 18a6331d), each with tests alongside the implementation.

## Anti-patterns

No TODO, FIXME or XXX markers in the touched files. No stubs.

## Notes (info only)

- In Time mode the Projected finish / Unestimated tiles are replaced by the time tiles, as the plan specifies.
- The forecast `unestimated` semantics stay SP-based, as the plan specifies.

## Human verification

See the frontmatter. These are visual, real-webview tooltip and live-Jira checks.
