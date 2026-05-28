---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: GreenHopper API Migration
status: planning
last_updated: "2026-05-28T17:55:07.305Z"
last_activity: 2026-05-28
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.
**Current focus:** Planning next milestone — v1.10 shipped 2026-05-25 (`/gsd:new-milestone`)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-28 — Milestone v1.11 started

## Performance Metrics

**Velocity:**

- v1.10 plans completed: 15 (6 phases, 3 days, 271 commits)
- Average phase size: 2.5 plans
- LOC delta: +30,286 / −1,489 (~80,895 total TS)

**By Phase (v1.10):**

| Phase | Plans | Description |
|-------|-------|-------------|
| 65 | 2 | Tech Debt Cleanup (CLEAN-01..07) |
| 66 | 2 | Roles Removal (store v22, no presets, 4-step wizard) |
| 67 | 1 | Settings UI Cleanup (visibility-only sidebar, no dnd-kit) |
| 68 | 3 | Startup Wizard — Integrations Step (AioBlock + Tempo) |
| 69 | 4 | Standup Notes — Route + Yesterday Recap |
| 70 | 3 | Standup Notes — Today Section |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key decisions affecting current/next work:

- Phase 66: roles removed entirely → universal access; settings store at v22 (drops `role`), then v23 (appends standup-notes sidebar item for upgrading users)
- Phase 65: AIO status map fetched from live `/config` endpoint via `initializeAioStatusMap`/`normalizeStatusById` — no static `AIO_STATUS_MAP`
- Phase 69: "yesterday" = last working day (weekends + Tempo-schedule holidays skipped); standup sources each load/degrade independently
- Phase 70: pinned issues + Log Work targets dropped from Standup Today (STAND-08/09 descoped) — standup page is read/plan-oriented
- Carried: verify cleanup with `npm run build` not just `tsc` (CSS imports fail silently in TypeScript checks)

### Roadmap Evolution

- v1.10 closed with tech debt (status `tech_debt`); all verification debt cleared 2026-05-26: Phase 69 VERIFICATION.md minted (passed 4/4), Phases 68 (passed 11/11) and 70 (passed 4/4) re-verified out of `human_needed`. Only remaining v1.10 items are non-blocking code-review notes WR-05 (unguarded SP cast) + IN-01 (uncleared setTimeout).

### Blockers/Concerns

- Apple Developer ID certificate not yet acquired — blocks macOS notarization (carried from v1.7)
- Windows code signing decision pending (carried from v1.7)

## Deferred Items

Items acknowledged and deferred at the v1.10 milestone close on 2026-05-25 (20 open from `audit-open` + audit tech-debt). All benign — see `.planning/milestones/v1.10-MILESTONE-AUDIT.md`.

| Category | Item | Status |
|----------|------|--------|
| verification_gap | phase 69: 69-VERIFICATION.md | RESOLVED 2026-05-26 — minted retroactively via gsd-verifier, status passed (4/4) |
| verification_gap | phase 68: 68-VERIFICATION.md | RESOLVED 2026-05-26 — re-verified passed (11/11); wizard paths confirmed in code |
| verification_gap | phase 70: 70-VERIFICATION.md | RESOLVED 2026-05-26 — re-verified passed (4/4); STAND-07 confirmed, #2/#3 moot (Log Work removed) |
| code_review | WR-05 (70-REVIEW) | non-blocking — unguarded `as number\|null` SP cast in Today*Section.tsx |
| code_review | IN-01 (70-REVIEW) | benign — setCopied setTimeout not cleared on unmount in StandupNotesPage.tsx |
| debug_session | knowledge-base | archived (benign) |
| quick_task | 17 v1.10 quick tasks (scanner status "missing") | done — every one has a real commit; SUMMARY frontmatter unreadable by scanner (see Quick Tasks Completed table) |
| uat_gap | phase 57: 57-UAT.md | unknown (13/13 PASS; format not recognized by scanner) |
| uat_gap | phase 58: 58-UAT.md | unknown (15/15 PASS; format not recognized by scanner) |

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260521-t6m | Redesign worklog person filter: single-select, default me, input-as-selection, no chip | 2026-05-21 | 26a24552 | | [260521-t6m-on-worklog-page-there-is-a-filter-by-per](./quick/260521-t6m-on-worklog-page-there-is-a-filter-by-per/) |
| 260521-vyk | Redesign My Tasks widget on dashboard to show subtasks with parent story context using grouped indented layout | 2026-05-21 | aa95c644 | | [260521-vyk-redesign-my-tasks-widget-on-dashboard-to](./quick/260521-vyk-redesign-my-tasks-widget-on-dashboard-to/) |
| 260521-wbm | Update dashboard background curves to match new AMBIENT_CURVES values | 2026-05-21 | 03daabd5 | | [260521-wbm-update-dashboard-background-curves-to-ma](./quick/260521-wbm-update-dashboard-background-curves-to-ma/) |
| 260521-hq7 | Color worklog weekend columns gray and holiday columns red using Tempo schedule API | 2026-05-21 | 4844c337 | | [260521-hq7-color-worklog-weekends-holidays](./quick/260521-hq7-color-worklog-weekends-holidays/) |
| 260523-mqj | fix all failing tests | 2026-05-23 | 29dac3e7 | | [260523-mqj-fix-all-failing-tests](./quick/260523-mqj-fix-all-failing-tests/) |
| 260523-n5r | Check linters and fix any errors | 2026-05-23 | 2f8ff136 | | [260523-n5r-check-linters-and-fix-any-errors](./quick/260523-n5r-check-linters-and-fix-any-errors/) |
| 260523-s1h | Close v1.9 verification artifact gaps: write 61/63/64 VERIFICATION.md + reconcile REQUIREMENTS.md checkboxes | 2026-05-23 | 320c9665 | | [260523-s1h-close-v1-9-verification-artifact-gaps-wr](./quick/260523-s1h-close-v1-9-verification-artifact-gaps-wr/) |
| 260524-pqo | I want to add a 'reset all' button to settings | 2026-05-24 | de3f21c5 | Needs Review | [260524-pqo-i-want-to-add-a-reset-all-button-to-sett](./quick/260524-pqo-i-want-to-add-a-reset-all-button-to-sett/) |
| 260525-g5z | On standup notes copy markdown, in today view the participating merge requests are not written very well as a sentence, redo it | 2026-05-25 | 1764c0d4 | | [260525-g5z-on-standup-notes-copy-markdown-in-today-](./quick/260525-g5z-on-standup-notes-copy-markdown-in-today-/) |
| 260525-jd5 | In the search in the app, when I enter a number automatically also search for tasks in selected projects | 2026-05-25 | 95cd6358 | | [260525-jd5-in-the-search-in-the-app-when-i-enter-a-](./quick/260525-jd5-in-the-search-in-the-app-when-i-enter-a-/) |
| 260525-jrz | Standup notes: compact per-source empty-state notices, side-by-side with flex-wrap | 2026-05-25 | 339ea687 | Needs Review | [260525-jrz-on-standup-notes-page-in-the-last-workin](./quick/260525-jrz-on-standup-notes-page-in-the-last-workin/) |
| 260525-rtu | Polish the visual design of standup notes page — cleaner, sleek, match the rest of the app | 2026-05-25 | 24f69ba4 | Needs Review | [260525-rtu-polish-the-visual-design-of-standup-note](./quick/260525-rtu-polish-the-visual-design-of-standup-note/) |
| 260525-kfi | Unify Yesterday/Today views in Standup notes page — restyle Yesterday to match Today's row treatment | 2026-05-25 | b0c6c3a6 | Verified | [260525-kfi-in-standup-notes-page-the-yesterday-and-](./quick/260525-kfi-in-standup-notes-page-the-yesterday-and-/) |
| 260525-kza | Unify progress bar styles across the app to match releases detail style | 2026-05-25 | defaba80 | | [260525-kza-unify-progress-bar-styles-across-the-app](./quick/260525-kza-unify-progress-bar-styles-across-the-app/) |
| 260525-ltf | On Standup notes page, make all tasks (including subtasks) clickable. Also make merge requests clickable to mr detail | 2026-05-25 | 11fa5375 | | [260525-ltf-on-standup-notes-page-make-all-tasks-inc](./quick/260525-ltf-on-standup-notes-page-make-all-tasks-inc/) |
| 260526-h3u | Remove Sprint progress page entirely without replacement | 2026-05-26 | 3f5d9064 | Verified | [260526-h3u-remove-sprint-progress-page-entirely-wit](./quick/260526-h3u-remove-sprint-progress-page-entirely-wit/) |
| 260528-19k | I want to completely remove My tasks page | 2026-05-27 | 04bfacd6 | Verified | [260528-19k-i-want-to-completely-remove-my-tasks-pag](./quick/260528-19k-i-want-to-completely-remove-my-tasks-pag/) |
| 260528-20i | I want to fix as much biome problems as possible | 2026-05-27 | 30ef80af | Verified | [260528-20i-i-want-to-fix-as-much-biome-problems-as-](./quick/260528-20i-i-want-to-fix-as-much-biome-problems-as-/) |
| 260528-ct1 | I want to fix as much biome problems as possible | 2026-05-28 | f38084f9 | Verified | [260528-ct1-i-want-to-fix-as-much-biome-problems-as-](./quick/260528-ct1-i-want-to-fix-as-much-biome-problems-as-/) |
| 260528-jwr | On jira issue detail, when selecting fix version, the values in the popup should be sorted by release dates, not alphabetically | 2026-05-28 | 2c9c1737 |  | [260528-jwr-on-jira-issue-detail-when-selecting-fix-](./quick/260528-jwr-on-jira-issue-detail-when-selecting-fix-/) |

## Session Continuity

Last session: 2026-05-28T07:49:25.144Z
Stopped at: context exhaustion at 75% (2026-05-28)
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

| 2026-05-26 | fast | Aggregate Yesterday commits into one line per task | ✅ |
| 2026-05-26 | fast | Singularize 'commit' in Yesterday stat line | ✅ |
