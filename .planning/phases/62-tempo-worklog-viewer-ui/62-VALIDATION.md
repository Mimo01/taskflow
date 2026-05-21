---
phase: 62
slug: tempo-worklog-viewer-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm test -- --reporter=verbose WorklogsPage` |
| **Full suite command** | `cd taskflow && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm test -- WorklogsPage Sidebar`
- **After every plan wave:** Run `cd taskflow && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| sidebar-gate | 01 | 0 | D-06 | — | Sidebar hides link when tempoEnabled=false | unit | `npm test -- Sidebar` | ❌ Wave 0 | ⬜ pending |
| route-register | 01 | 0 | TEMPO-01 | — | Route resolves to WorklogsPage | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |
| worklog-table | 02 | 1 | TEMPO-01 | — | Table renders rows/columns from API | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |
| date-presets | 02 | 1 | TEMPO-02 | T: date range manip | to >= from validated; 6 presets visible | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |
| people-filter | 02 | 1 | TEMPO-03 | T: URL param injection | fetchWorklogs uses URLSearchParams.append | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |
| totals | 02 | 1 | TEMPO-07 | — | Sum per person (col) and per day (row) correct | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |
| zero-cells | 02 | 1 | D-08 | — | Zero-hour cells display blank (empty string) | unit | `npm test -- WorklogsPage` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` — stubs for TEMPO-01, TEMPO-02, TEMPO-03, TEMPO-07, D-08
- [ ] Extend `taskflow/src/components/app/Sidebar.test.tsx` — D-06 tempoEnabled gate tests (2 tests)

*Existing test infrastructure is sufficient — no new framework config needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Horizontal scroll on wide date ranges | TEMPO-01 | Visual layout; overflow behavior varies by browser | Load Tempo page with 30-day range; confirm table scrolls horizontally without breaking layout |
| Custom date picker UX | TEMPO-02 | UI interaction; end-to-end browser behavior | Select "Custom" preset; set from/to dates; confirm fetch fires and table updates |
| People filter autocomplete dropdown | TEMPO-03 | Combobox interaction; keyboard nav | Open filter; type partial name; confirm dropdown shows; select; confirm table filters |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
