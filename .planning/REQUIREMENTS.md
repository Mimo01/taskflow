# Requirements: Taskflow

**Defined:** 2026-05-20
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.9 Requirements

Requirements for milestone v1.9 — Tempo Timesheets, Dashboard Redesign & Cleanup.

### Tempo Worklog Viewer

- [x] **TEMPO-01**: User can view a day-column worklog table showing hours logged per person per day for a configurable date range
- [x] **TEMPO-02**: User can select date range using presets: This Week (default), Last Week, This Month, Last Month, Last Working Day, and custom date range
- [x] **TEMPO-03**: User can filter the worklog table by one or more team members (people filter with multi-select) — _Implementation note: single-select per documented user override (D-01 in 62-DISCUSSION-LOG.md / 62-CONTEXT.md). REQUIREMENTS wording predates the user decision; implementation is the authoritative source._
- [x] **TEMPO-04**: User can save a named filter combining a people selection and date preset
- [x] **TEMPO-05**: User can load, rename, and delete saved Tempo filters
- [x] **TEMPO-06**: User can enable/disable Tempo integration via Settings → Integrations toggle (same pattern as AIO; default off)
- [x] **TEMPO-07**: Worklog table shows a total column (sum of hours per person) and a total row (sum of hours per day)

### Dashboard Redesign

- [x] **DASH-01**: Dashboard presents as a welcome/home screen with a personalized greeting (user's name) and today's date as the entry point
- [x] **DASH-02**: Sprint health card shows the current sprint name, days remaining, and a % complete progress bar
- [x] **DASH-03**: My In Progress card shows up to 3 of the current user's active subtasks (status = In Progress) with links to open them
- [x] **DASH-04**: Next release countdown card shows the soonest unreleased fix version's name and the number of days until it
- [x] **DASH-05**: Dashboard is a static layout — no configuration, no drag/resize, no widget picker; pure information with visual warmth

### Removals

- [x] **REMOVE-01**: Workload page (`/workload` route, `WorkloadTab`, `WorkloadSkeleton`) and all routing/sidebar references are deleted
- [x] **REMOVE-02**: Widget-based customizable dashboard system is fully removed: `react-grid-layout` package, `WidgetGrid`, `WidgetCard`, `WidgetPicker`, all widget components, `widgets/` folder, and all widget state in `settings.store.ts`

### Quality & Cleanup

- [x] **QUAL-01**: All tests pass with zero failures after all removals and additions (no regressions)
- [x] **QUAL-02**: Dead code, unused imports, and stale components from removed features are eliminated across the codebase
- [x] **QUAL-03**: `react-grid-layout` and `@types/react-grid-layout` packages are removed from `package.json`

## v2 Requirements

Deferred to a future milestone.

### Tempo Enhancements

- **TEMPO-08**: Worklog table supports grouping by epic/story/subtask row hierarchy (deferred — HIGH complexity, N+1 Jira enrichment)
- **TEMPO-09**: Cell drill-down tooltip showing individual worklogs for a person/day cell
- **TEMPO-10**: Cell highlight for over/under hours threshold (configurable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Timesheet approval workflow | Tempo-native feature requiring Tempo write API; outside core use case |
| Billable/non-billable split | Not used by Orange eshop team |
| CSV/Excel export | Low daily-use value; complexity without proportional benefit |
| Tempo team management | Tempo plugin admin surface; not a daily-use feature |
| Dashboard widget system reimplementation | User explicitly removed it; static layout is the agreed direction |
| PM-specific dashboard variant | Removed with widget dashboard; sprint board + releases cover PM needs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REMOVE-01 | Phase 59 | Complete |
| REMOVE-02 | Phase 59 | Complete |
| QUAL-03 | Phase 59 | Complete |
| DASH-01 | Phase 60 | Complete |
| DASH-02 | Phase 60 | Complete |
| DASH-03 | Phase 60 | Complete |
| DASH-04 | Phase 60 | Complete |
| DASH-05 | Phase 60 | Complete |
| TEMPO-06 | Phase 61 | Complete |
| TEMPO-01 | Phase 62 | Complete (human-verify deferred) |
| TEMPO-02 | Phase 62 | Complete (human-verify deferred) |
| TEMPO-03 | Phase 62 | Complete (single-select override per D-01) |
| TEMPO-07 | Phase 62 | Complete (human-verify deferred) |
| TEMPO-04 | Phase 63 | Complete |
| TEMPO-05 | Phase 63 | Complete |
| QUAL-01 | Phase 63 | Complete |
| QUAL-02 | Phase 63 | Complete |
| TEMPO-08 | Phase 64 | Complete — pulled forward from v2 |
| TEMPO-EDIT-01 | Phase 64 | Complete (human-verify deferred for UAT 9-12) — phase-derived (cell drill-down + per-entry edit/delete/add) |

**Coverage:**
- v1.9 requirements: 17 total
- Mapped to phases: 17 ✓
- Unmapped: 0 ✓

Phase 64 (post-v1.9 follow-up) implements TEMPO-08 (previously v2-deferred) and a phase-derived TEMPO-EDIT-01.

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-23 — v1.9 milestone audit reconciliation: checkboxes + traceability table flipped to match VERIFICATION.md artifacts (per .planning/v1.9-MILESTONE-AUDIT.md)*
