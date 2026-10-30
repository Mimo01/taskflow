---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
verified: 2026-10-30T10:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 5
overrides:
  - must_have: "F5 timeline graph on list rows (93-08)"
    reason: "Removed by the user during UAT (93-11-SUMMARY, APPROVED 2026-10-30)"
    accepted_by: "user (UAT)"
    accepted_at: "2026-10-30"
  - must_have: "Progress-bar and RM-package tooltips"
    reason: "Removed by the user during UAT"
    accepted_by: "user (UAT)"
    accepted_at: "2026-10-30"
  - must_have: "D-09 one-line rows for all rows"
    reason: "Planned rows with issues expand to full rows (UAT)"
    accepted_by: "user (UAT)"
    accepted_at: "2026-10-30"
  - must_have: "Detail header is a custom header"
    reason: "Standard app header bar used (UAT)"
    accepted_by: "user (UAT)"
    accepted_at: "2026-10-30"
  - must_have: "D-08 five released versions on first page"
    reason: "F5 shows 3 (RELEASED_PAGE_SIZE = 3), load-more stays 10; declared in 93-07/93-10 plans and approved at UAT"
    accepted_by: "user (UAT)"
    accepted_at: "2026-10-30"
human_verification: []
---

# Phase 93 Verification Report

**Goal:** fast, GitLab-free, fix-version-driven Releases list plus detail header echoing the row, each figure shown once.
**Status:** passed (initial verification). Visual judgement was already approved by the user at UAT (93-11).

## Checks run
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 250 files passed, 1 skipped; 3956 tests passed, 2 skipped, 7 todo. No flaky rerun was needed.

## Observable truths

| # | Truth (decision) | Status | Evidence |
|---|---|---|---|
| 1 | List has no GitLab or branch/milestone fetches (D-01, D-02) | VERIFIED | grep of `ReleasesTab.tsx`, `releases-list/*`, `useReleaseBreakdowns.ts` and `useReleasePackages.ts` for gitlab, milestone and branch returns nothing outside tests. The detail hook keeps its own milestone query. |
| 2 | Upcoming/Released grouping and ordering (D-03, D-04) | VERIFIED (override) | `ReleasesTab` renders `ReleaseAgenda` (Upcoming by month, TODAY line, next card) and `ReleasedPanel`. `groupReleases` and `buildAgenda` are unit-tested. The F5 design replaces the column-grid header strip. |
| 3 | One status pill per row (D-05) | VERIFIED | `ReleaseStatusPill` is used in the list rows and the detail header. |
| 4 | Small issue graph per row, streamed for visible rows only, with one batched paginated search (D-06, D-11) | VERIFIED | `fetchVersionsStatusBreakdown` runs one `fixVersion in (...)` search, 200 per page, looped on `startAt` with no page cap. Hidden released ids are never in the chunks: `useReleaseBreakdowns` takes `releasedVisible` and `planBreakdownChunks`. `ReleaseIssuesSlot` is the row graph. |
| 5 | Released paging (D-08) | VERIFIED (override) | First page is 3 (F5 supersedes 5, declared in the 93-07 and 93-10 plans); load-more is 10 and fetches only the new ids. |
| 6 | Only fix versions block first paint; fixed-size slots for package and graph (D-09) | VERIFIED | Names, pills and dates render from `fixVersions`. Package and graph render skeleton or placeholder slots. Planned rows expand once they have issues (override). |
| 7 | Instant cached revisits and Refresh (D-10) | VERIFIED | `showSkeleton` requires `!fixVersions`. `refreshReleaseList` is staged upstream-first: fix-versions, rm-week-list and jira-projects-rm, then rm-week-children and the batch counts. Refresh never blanks the list. |
| 8 | RM package via lazy `useRmWeekIndex`; column hidden when no RM project (D-12) | VERIFIED | `useReleasePackages({dates: upcoming})` supplies `showPackage={pkgs.enabled}`. |
| 9 | Detail header echoes the row: pill, date, package, wide graph, Pin/Edit/Open in Jira; each figure once (D-13, D-14, D-15) | VERIFIED | `ReleaseDetailHeader` has all of these and `ReleaseDetailPage` wires it. `UnifiedTaskTable` has no progress or done figure but keeps the flagged counts. The sidebar has no Status or Date rows (grep). The page has no action row at the bottom. |

All D-01..D-15 are accounted for across plans 93-01..93-11. D-07 is judged by the user at UAT (approved). D-15's sections and table were unchanged apart from the header drop, and the table tests pass.

## Anti-patterns
No TBD, FIXME or XXX debt markers were found in the key files. No stubs: the components render real query data.

## Code review warnings (93-REVIEW.md, 0 blockers)
None undermines the goal; all are polish or robustness issues.
- **WR-01 (WARNING):** breakdown errors are not surfaced. A failed chunk looks like "no data" (the idle dash). Failure path only.
- **WR-02 (WARNING):** the package cell shows the "week, no task" state while the children or projects queries are loading, and permanently if they fail. This is a brief flicker, but it can mislead.
- **WR-03 (WARNING):** `title` attributes on truncated names are dead under `pointer-events-none`. Move them to the overlay button.
- **WR-04 (WARNING):** the detail pill wording ("Overdue", "In 21 days") disagrees with the list wording ("3 days late", "In 3 weeks"), and the date formats differ. This weakens "echoes the list row" in wording only; pill, date, package and graph are all present.
- IN-01..IN-04 are info only: dead `list` variant, a stale invalidation key, keys missing `jiraBaseUrl`, and "0 done" on released versions with no issues.

Recommend a follow-up quick task for WR-01..WR-04. It is not blocking.

## Gaps
None.
