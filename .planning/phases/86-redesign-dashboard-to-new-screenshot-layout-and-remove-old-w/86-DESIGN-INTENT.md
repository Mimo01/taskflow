# Phase 86 — Dashboard Redesign: Design Intent

> Captured at phase-creation time from user-provided screenshots so intent survives `/clear`.
> This is reference material for `/gsd-plan-phase 86`, **not** a plan.

## User directive (verbatim intent)

> "I want to redesign the dashboard to look like these screenshots. All the data
> should be available in the app already. Think about edge cases. The current
> dashboard widgets won't be used anymore, clean it up and don't leave any dead code."

## Hard constraints

- **No new API surface** — all data must come from sources already wired into the app
  (sprint issues, releases/versions, Tempo worklogs, GitLab commits). Reuse existing
  queries/cache; do not add new endpoints.
- **Remove the old dashboard** — the widgets built in Phases 83–84 (+ quick task
  260615-smu polish) are being replaced. Delete dead components, hooks, tests, and
  styles. Zero orphaned code.
- **Edge cases are in scope** — empty/zero states, missing release dates, no active
  sprint, days with 0 hours / 0 commits, partial weeks.

## Target layout (from screenshots)

Single full-width dashboard, three regions:

1. **Hero greeting**
   - Time-of-day greeting + first name: "Good evening, Milan"
   - Subline: full date + sprint position — "Monday, 15 June 2026 · Sprint day 4 of 10"
   - Edge: greeting must vary by local time; sprint line hides/degrades when no active sprint.

2. **Top row — two cards side by side**
   - **MY ISSUES** (left) — scope "this sprint"
     - Big number: `8` "of 13 done"
     - Stacked horizontal progress bar segmented To Do / In Progress / Done
     - Legend with counts: To Do 3 · In Progress 2 · Done 8
     - Edge: 0 issues → empty state; counts must sum to total.
   - **UPCOMING RELEASES** (right) — scope "next 3"
     - Horizontal timeline with up to 3 milestone dots
     - Per release: name (e.g. "Standard 16.6"), relative due ("Tomorrow", "in 8 days"),
       a thin readiness progress bar, and "{n}% ready"
     - Edge: fewer than 3 upcoming releases; release with no due date; 0% / 100% ready.

3. **Bottom — full-width chart card: "PAST 7 DAYS · HOURS & COMMITS PER DAY"**
   - Header-right summary: total "34.75 h logged" (blue) · "78 commits" (green)
   - Per-day grouped/stacked bars: blue = hours logged (top label e.g. "8h"),
     green = commits (bottom label e.g. "22")
   - X axis = weekday labels (Tue…Mon), today highlighted (pill on "Mon")
   - Dashed gridline at the max; 0-value days render flat with "0h" / "0" labels
   - Edge: all-zero week; today partial; weekend with no activity.

## Data source mapping (to confirm during planning)

- My Issues counts → existing sprint/board issue query (reuse SP/status grouping).
- Upcoming releases → existing Jira versions/releases data; "% ready" likely derived
  from issues-in-version done ratio (confirm a source already exists — do NOT add API).
- Hours per day → Tempo worklogs already used by standup/insights
  (remember `tempo.started.slice(0,10)` bucketing — no `toISOString()` UTC shift).
- Commits per day → GitLab commit data already fetched elsewhere.

## Cleanup checklist (planner to enumerate exact files)

- Old dashboard widget components from Phases 83–84 (stat tiles, sprint health chart,
  trend chart, activity strip, MR review queue — note DASH-06 was already descoped).
- Their hooks, query helpers, tests, and any now-unused chart wrappers.
- Verify `npm run check` stays GREEN and no unreferenced exports remain.

## Screenshots

Two screenshots were provided by the user. Image #1 is the full dashboard mockup
described above (hero + My Issues + Upcoming Releases + 7-day hours/commits chart).
Re-attach the originals when planning the visual contract (`/gsd-ui-phase` / ui-researcher).
