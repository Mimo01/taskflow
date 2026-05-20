# Requirements: Taskflow

**Defined:** 2026-05-20
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.9 Requirements

Requirements for milestone v1.9 — Tempo Timesheets, Dashboard Redesign & Cleanup.

### Tempo Worklog Viewer

- [ ] **TEMPO-01**: User can view a day-column worklog table showing hours logged per person per day for a configurable date range
- [ ] **TEMPO-02**: User can select date range using presets: This Week (default), Last Week, This Month, Last Month, Last Working Day, and custom date range
- [ ] **TEMPO-03**: User can filter the worklog table by one or more team members (people filter with multi-select)
- [ ] **TEMPO-04**: User can save a named filter combining a people selection and date preset
- [ ] **TEMPO-05**: User can load, rename, and delete saved Tempo filters
- [ ] **TEMPO-06**: User can enable/disable Tempo integration via Settings → Integrations toggle (same pattern as AIO; default off)
- [ ] **TEMPO-07**: Worklog table shows a total column (sum of hours per person) and a total row (sum of hours per day)

### Dashboard Redesign

- [ ] **DASH-01**: Dashboard presents as a welcome/home screen with a personalized greeting (user's name) and today's date as the entry point
- [ ] **DASH-02**: Sprint health card shows the current sprint name, days remaining, and a % complete progress bar
- [ ] **DASH-03**: My In Progress card shows up to 3 of the current user's active subtasks (status = In Progress) with links to open them
- [ ] **DASH-04**: Next release countdown card shows the soonest unreleased fix version's name and the number of days until it
- [ ] **DASH-05**: Dashboard is a static layout — no configuration, no drag/resize, no widget picker; pure information with visual warmth

### Removals

- [ ] **REMOVE-01**: Workload page (`/workload` route, `WorkloadTab`, `WorkloadSkeleton`) and all routing/sidebar references are deleted
- [ ] **REMOVE-02**: Widget-based customizable dashboard system is fully removed: `react-grid-layout` package, `WidgetGrid`, `WidgetCard`, `WidgetPicker`, all widget components, `widgets/` folder, and all widget state in `settings.store.ts`

### Quality & Cleanup

- [ ] **QUAL-01**: All tests pass with zero failures after all removals and additions (no regressions)
- [ ] **QUAL-02**: Dead code, unused imports, and stale components from removed features are eliminated across the codebase
- [ ] **QUAL-03**: `react-grid-layout` and `@types/react-grid-layout` packages are removed from `package.json`

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
| REMOVE-01 | Phase 59 | Pending |
| REMOVE-02 | Phase 59 | Pending |
| QUAL-03 | Phase 59 | Pending |
| DASH-01 | Phase 60 | Pending |
| DASH-02 | Phase 60 | Pending |
| DASH-03 | Phase 60 | Pending |
| DASH-04 | Phase 60 | Pending |
| DASH-05 | Phase 60 | Pending |
| TEMPO-06 | Phase 61 | Pending |
| TEMPO-01 | Phase 62 | Pending |
| TEMPO-02 | Phase 62 | Pending |
| TEMPO-03 | Phase 62 | Pending |
| TEMPO-07 | Phase 62 | Pending |
| TEMPO-04 | Phase 63 | Pending |
| TEMPO-05 | Phase 63 | Pending |
| QUAL-01 | Phase 63 | Pending |
| QUAL-02 | Phase 63 | Pending |

**Coverage:**
- v1.9 requirements: 17 total
- Mapped to phases: 17 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 — traceability updated after roadmap creation*
