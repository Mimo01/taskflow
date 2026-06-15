# Phase 83: Dashboard Stat Tiles and Sprint Health Chart - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 83-dashboard-stat-tiles-and-sprint-health-chart
**Areas discussed:** Tile scope, Chart shape, Tile interaction, Sprint health composition

---

## Tile scope

| Option | Description | Selected |
|--------|-------------|----------|
| Personal (my assigned) | Open/In Progress/Overdue + SP Done count only my issues | |
| Whole-sprint | Counts reflect the whole sprint regardless of assignee | (initial) |
| Mixed | Open/In Progress/Overdue personal; SP Done whole-sprint velocity | ✓ (final) |

**User's choice:** Initially Whole-sprint, then revised to personal counts for Open/In Progress/Overdue with SP Done as whole-sprint velocity (effectively the Mixed interpretation) after the count-vs-drill-down coherence follow-up.
**Notes:** Switching the three personal tiles to assignee-filtered matches the ROADMAP "personal stat tiles" wording; SP Done remains whole-sprint as a velocity signal.

---

## Chart shape

| Option | Description | Selected |
|--------|-------------|----------|
| Donut, by category | 3 segments by statusCategory → 3 --chart vars; center can show total SP | ✓ |
| Stacked bar, by category | Horizontal stacked bar, 3 segments by statusCategory | |
| Donut, per status | One segment per workflow status; more granular, >5 colors | |

**User's choice:** Donut, by statusCategory (To Do / In Progress / Done).
**Notes:** Points-weighted segments (subtasks excluded). Per-status granularity deferred.

---

## Tile interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Static display | Read-only numbers | ✓ (final) |
| Link to My Tasks | Tiles deep-link to /my-tasks with matching filter | (initial) |
| Link all + extend My Tasks | Add Overdue bucket + filter param to Phase 82 page | |

**User's choice:** Initially "Link to My Tasks", revised to **Static display** after discovering the shipped My Tasks page has only 3 filter buckets (To Do / In Progress / Done), no Overdue bucket, and no deep-link param.
**Notes:** Static keeps Phase 83 additive to the Dashboard with no Phase 82 page changes. Drill-down preserved as a deferred idea.

---

## Sprint health composition

| Option | Description | Selected |
|--------|-------------|----------|
| Days + % progress + chart | Days-remaining, overall %-complete bar, and the donut | ✓ |
| Days + chart only | Just days-remaining and the donut | |

**User's choice:** Days remaining + % progress bar + donut.
**Notes:** Reuses old DashboardSprintCard days-remaining and %-progress logic.

---

## Claude's Discretion

- Tile layout/grid and visual treatment
- Donut center content (total SP vs nothing)
- Progress-bar styling and days-remaining placement within the sprint-health section
- Placement of the retained next-release countdown
- Component decomposition (new StatTile / SprintHealthSection vs inline)

## Deferred Ideas

- Stat-tile drill-down (would require Overdue bucket + filter param on the Phase 82 My Tasks page)
- Per-status donut granularity (vs statusCategory 3-bucket)
- MRs-awaiting-review tile and hours-logged tile — Phase 84 (DASH-04/06)
