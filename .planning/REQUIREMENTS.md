# Requirements: Taskflow

**Defined:** 2026-05-12
**Core Value:** Developers and PMs can see everything they need — tasks, merge requests, sprint state, notifications, and now test execution health — in one place, without switching between Jira, GitLab, and the AIO Test Management plugin.

## v1.8 Requirements

Requirements for milestone v1.8 — AIO Test Management integration.

### AIO Navigation

- [ ] **AION-01**: User can access AIO Test Management from a new sidebar section
- [ ] **AION-02**: User can view a list of all AIO test projects
- [ ] **AION-03**: User can view a project overview page showing all cycles with per-cycle summary stats
- [ ] **AION-04**: User can view a full-page cycle detail page (progress, test runs, defects)
- [ ] **AION-05**: User can enable/disable AIO integration from Settings (aioEnabled toggle)

### Cycle Detail

- [ ] **AIOC-01**: User can see an execution progress bar with pass/fail/blocked/not-run counts and percentages
- [ ] **AIOC-02**: User can see the test run list for a cycle (test case name, status, last run date)
- [ ] **AIOC-03**: User can see the defects list (Jira issues linked from failed runs, clickable to issue detail)

### Header Pinning

- [ ] **AIOP-01**: User can pin a test cycle to the header tab strip
- [ ] **AIOP-02**: User can unpin a pinned cycle from the header tab strip
- [ ] **AIOP-03**: Pinned cycle tabs persist across app restarts

### AIO on Issue Detail

- [ ] **AIOI-01**: Issue detail page shows a lazy-loaded AIO test runs section (only when aioEnabled is true)
- [ ] **AIOI-02**: AIO test run section renders a step table (step / expected / actual columns, colored failure markers)
- [ ] **AIOI-03**: AIO attachment images are fetched via authenticated HTTP client and open in the existing in-app lightbox

## Future Requirements

Features acknowledged but deferred beyond v1.8.

### AIO Charts

- **AIOCH-01**: Cycle execution burndown chart (time-series daily snapshots) — deferred; AIO REST API does not expose time-series execution data
- **AIOCH-02**: Cross-cycle trend charts across a project — deferred; requires historical snapshot data

### AIO Write Actions

- **AIOWR-01**: User can update test run execution status from within Taskflow — deferred to future milestone
- **AIOWR-02**: User can add defect links to failed test runs — deferred to future milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| Burndown chart | AIO TCMS REST API does not expose time-series execution data; computed client-side in the AIO plugin UI only |
| Test case creation/editing | Read-only integration; write actions deferred to future milestone |
| Cross-project AIO aggregation | Matches existing single-project constraint; exponential complexity |
| AIO webhook / real-time push | Requires server component; no-server architecture constraint |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AION-01 | Phase 52 | Pending |
| AION-02 | Phase 55 | Pending |
| AION-03 | Phase 52 | Pending |
| AION-04 | Phase 53 | Pending |
| AION-05 | Phase 51 | Pending |
| AIOC-01 | Phase 53 | Pending |
| AIOC-02 | Phase 53 | Pending |
| AIOC-03 | Phase 53 | Pending |
| AIOP-01 | Phase 53 | Pending |
| AIOP-02 | Phase 53 | Pending |
| AIOP-03 | Phase 53 | Pending |
| AIOI-01 | Phase 54 | Pending |
| AIOI-02 | Phase 54 | Pending |
| AIOI-03 | Phase 54 | Pending |

**Coverage:**
- v1.8 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-14 — AION-02 traceability re-pointed to Phase 55 (picker in Settings subsumes the deleted list page surface)*
