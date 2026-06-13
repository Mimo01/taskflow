# Requirements: Taskflow — v1.13 Personal Workspace

**Defined:** 2026-06-14
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.13 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Charting Foundation

The app's first charting dependency — an enabling capability for the Dashboard.

- [ ] **CHART-01**: Charts render via an integrated charting library (Recharts v3 + shadcn `chart` primitive) and follow the app's dark/light theme tokens (`--chart-1..5`)
- [ ] **CHART-02**: Charts render correctly in the Tauri webview (WebKit + WebView2) — explicit-height wrapper, responsive width with no 0×0 collapse, animations disabled
- [ ] **CHART-03**: A reusable chart-card wrapper provides consistent sizing, theming, and loading/empty/error states, and is lazy-loaded to protect bundle size

### My Tasks Page

A personal command center — independent from the Dashboard.

- [ ] **MYTASK-01**: User can open a dedicated "My Tasks" page from the sidebar
- [ ] **MYTASK-02**: User sees a summary/filter strip with counts (To Do / In Progress / In Review / Done this sprint, Overdue, MRs awaiting me) that double as filters
- [ ] **MYTASK-03**: User can switch between three groupings — My Day (smart sort), By Status, By Sprint & Parent
- [ ] **MYTASK-04**: My Day smart sort surfaces what needs attention first (flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do)
- [ ] **MYTASK-05**: Each task row shows type, key, priority, summary, status pill, due date (overdue highlighted), story points, MR health badge, and time logged/remaining
- [ ] **MYTASK-06**: User can act on a task inline — peek (body click) / open full page (key), transition status, log work, and right-click context menu
- [ ] **MYTASK-07**: User can toggle scope between current sprint and all issues assigned to me (across sprints + backlog), with all-assigned fetched via proper server-side pagination (no fetch-once page cap)
- [ ] **MYTASK-08**: User's grouping and scope preferences persist across sessions

### Dashboard Redesign

A graph-driven personal overview. Keeps the hero, replaces the cards.

- [ ] **DASH-01**: Dashboard keeps the gradient hero greeting + en-GB date and removes the previous 3 cards
- [ ] **DASH-02**: User sees personal stat tiles — open tasks, in progress, overdue, MRs awaiting my review, hours logged this week vs schedule
- [ ] **DASH-03**: User sees a sprint-health section with progress, days remaining, and a points-by-status chart (donut / stacked bar)
- [ ] **DASH-04**: User sees a weekly-logged-hours trend chart (hours per day this week vs schedule)
- [ ] **DASH-05**: User sees an activity & releases section — recent notifications/mentions + next-release countdown with progress
- [ ] **DASH-06**: User sees an MR review queue — MRs awaiting my review and my open MRs' health
- [ ] **DASH-07**: Each dashboard section degrades independently (own loading/empty/error state) and reuses warm caches to avoid redundant fetching

### Sprint Insights (Conditional — probe-gated)

Built only if a live Jira Data Center probe confirms the data is obtainable at acceptable cost.

- [ ] **INSIGHT-01**: User sees a personal velocity trend (committed vs completed points across the last N closed sprints) — gated on a closed-sprint REST endpoint probe, concurrency-capped, shown only with ≥3 closed sprints; cleanly omitted if the probe fails
- [ ] **INSIGHT-02**: User sees a sprint burndown chart — attempted via a GreenHopper burndown endpoint probe; cleanly omitted if the endpoint/data is not viable (consciously revisits the prior "burndown out of scope" decision)

## Future Requirements

Deferred to a future release. Tracked but not in this roadmap.

### My Tasks

- **MYTASK-F1**: Cross-project "My Tasks" aggregation (currently one active project at a time)
- **MYTASK-F2**: Saved personal views / custom filters on My Tasks

### Dashboard

- **DASH-F1**: User-configurable dashboard layout (deliberately deferred — the widget dashboard was removed in v1.9; reintroduce only if a static redesign proves insufficient)

## Out of Scope

Explicitly excluded for this milestone.

| Feature | Reason |
|---------|--------|
| Customizable widget/grid dashboard | Removed in v1.9 (react-grid-layout, 11 widget types); v1.13 ships a curated static redesign, not a return to widgets |
| Team-wide / multi-user dashboards | Personal workspace only; team analytics belong to external tools (LinearB/Swarmia) |
| Historical analytics beyond the velocity/burndown probe attempts | No daily-use value; complex data pipeline; only the two probe-gated INSIGHT charts are attempted |
| Cross-project task aggregation | One Jira + one GitLab project at a time stays the model (data-model complexity) |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHART-01 | Phase 81 | Pending |
| CHART-02 | Phase 81 | Pending |
| CHART-03 | Phase 81 | Pending |
| MYTASK-01 | Phase 82 | Pending |
| MYTASK-02 | Phase 82 | Pending |
| MYTASK-03 | Phase 82 | Pending |
| MYTASK-04 | Phase 82 | Pending |
| MYTASK-05 | Phase 82 | Pending |
| MYTASK-06 | Phase 82 | Pending |
| MYTASK-07 | Phase 82 | Pending |
| MYTASK-08 | Phase 82 | Pending |
| DASH-01 | Phase 83 | Pending |
| DASH-02 | Phase 83 | Pending |
| DASH-03 | Phase 83 | Pending |
| DASH-07 | Phase 83 + Phase 84 | Pending |
| DASH-04 | Phase 84 | Pending |
| DASH-05 | Phase 84 | Pending |
| DASH-06 | Phase 84 | Pending |
| INSIGHT-01 | Phase 85 | Pending (Conditional) |
| INSIGHT-02 | Phase 85 | Pending (Conditional) |

**Coverage:**
- v1.13 requirements: 20 total (18 committed + 2 conditional)
- Mapped to phases: 20/20
- Unmapped: 0

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 — traceability table populated by roadmap creation*
