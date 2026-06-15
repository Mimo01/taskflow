# Phase 86: Redesign dashboard to new screenshot layout and remove old widgets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
**Areas discussed:** Removal scope, My Issues card, Upcoming Releases, 7-day chart

---

## Removal scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full clean slate | Remove EVERYTHING incl. Phase 85 Velocity + Burndown. Dashboard = exactly the 3 screenshot regions. | ✓ |
| Keep insights below | Replace 83–84 widgets but keep Velocity + Burndown appended at the bottom. | |

**User's choice:** Full clean slate
**Notes:** Velocity + Burndown shipped 2026-06-15 (Phase 85) but are not in the screenshots; user chose to retire them from the Dashboard surface. Reverses Phase 85's "append at bottom" placement. Can return as their own phase later.

---

## My Issues card

| Option | Description | Selected |
|--------|-------------|----------|
| Issue count + statusCategory | Big number + bar + legend all issue counts; bucket by statusCategory. | ✓ (after follow-up) |
| Story points + statusCategory | All values in SP, bucketed by statusCategory. | (initial pick, reversed) |

**User's choice:** Initially "Story points + statusCategory", then reversed to **issue count** on the follow-up.
**Notes:** Follow-up flagged that the screenshot's "8 of 13" + "To Do 3 · In Progress 2 · Done 8" are small integers that sum cleanly (3+2+8=13) — clearly issue counts, not SP. User confirmed "Switch to issue count" for everything. Bucketing by `status.statusCategory.key`; personal + this-sprint + `!subtask`.

---

## Upcoming Releases

| Option | Description | Selected |
|--------|-------------|----------|
| Next 3 with due dates, reuse donePct | Next 3 unreleased versions WITH a releaseDate, soonest-first; readiness = existing doneCount/totalCount by issue; no-date versions excluded. | ✓ |
| Next 3 incl. no-date, dot at end | Include up-to-3 even without due date; no-date ones parked at timeline end. | |

**User's choice:** Next 3 with due dates, reuse donePct
**Notes:** Reuses DashboardReleaseCard's existing donePct logic and fix-versions cache key; extends single-soonest card to a 3-dot timeline. Versions without a releaseDate are excluded.

---

## 7-day chart

| Option | Description | Selected |
|--------|-------------|----------|
| Rolling 7 days, dual Y-axis, grouped bars | Last 7 calendar days ending today; hours (left axis) + commits (right axis) side-by-side; today highlighted. | ✓ |
| Rolling 7 days, single axis, stacked | Same window, one shared axis, stacked bars. | |

**User's choice:** Rolling 7 days, dual Y-axis, grouped bars
**Notes:** Dual axis chosen because hours (~8–12) and commits (22+) live on different scales; shared axis would distort. Hours from Tempo `fetchWorklogs`, commits from GitLab `fetchUserCommits` (ActivityStrip's source). Window changes from the current Mon–Fri to rolling-7.

---

## Claude's Discretion

- Component decomposition (extract MyIssuesCard / UpcomingReleasesTimeline / HoursCommitsChart vs inline).
- Visual polish details — match screenshots; ui-researcher owns the visual contract.
- Whether to delete removed Phase 85 service helpers (delete iff no other consumer — reference search first).

## Deferred Ideas

- Personal velocity trend chart — removed from Dashboard (D-01); revive as own phase if wanted.
- Sprint burndown chart — same.
- Configurable N-day window for the 7-day chart (fixed at 7).
- Releases with no due date on the timeline (excluded for now).
