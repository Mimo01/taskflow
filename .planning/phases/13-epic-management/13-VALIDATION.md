---
phase: 13
slug: epic-management
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-14
updated: 2026-03-15
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 + React Testing Library 16.3.2 |
| **Config file** | taskflow/vitest.config.ts |
| **Quick run command** | `cd taskflow && npx vitest run` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|-----------|-------------------|------|--------|
| 13-01-01 | 01 | 1 | EPIC-01 | integration | `cd taskflow && npx vitest run src/routes/dashboard/EpicsPage.test.tsx` | EpicsPage.test.tsx | ✅ green |
| 13-01-02 | 01 | 1 | EPIC-01 | integration | `cd taskflow && npx vitest run src/routes/dashboard/EpicsPage.test.tsx` | EpicsPage.test.tsx | ✅ green |
| 13-02-01 | 02 | 2 | EPIC-02 | integration | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | SprintBoardTab.test.tsx | ✅ green |
| 13-02-02 | 02 | 2 | EPIC-02 | integration | `cd taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | SprintBoardTab.test.tsx | ✅ green |
| 13-03-01 | 03 | 3 | EPIC-03 | integration | `cd taskflow && npx vitest run src/routes/dashboard/EpicDetailSheet.test.tsx` | EpicDetailSheet.test.tsx | ✅ green |
| 13-04-01 | 04 | 4 | EPIC-04 | integration | `cd taskflow && npx vitest run src/routes/dashboard/CreateEpicDialog.test.tsx` | CreateEpicDialog.test.tsx | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All requirements have automated behavioral tests. Wave 0 complete.

---

## Architecture Deviations (Accepted)

| Requirement | Original Plan | Actual Implementation | Deviation Accepted |
|-------------|---------------|----------------------|--------------------|
| EPIC-01 | Story count + story points columns in epic list | Removed for performance; list shows name, key, status, assignee only | Yes — user decision |
| EPIC-03 | Dedicated `EpicDetailSheet.tsx` component | `IssueDetailContent` with `isEpic=true` branch; `IssueDetailSheet` with `fetchEpicStories` query | Yes — approved architecture |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sprint board Epics NavLink visible in all roles | EPIC-01/02 | Requires real browser with auth state | Navigate to app as any role, verify Epics link appears in sidebar |
| Epic detail sheet opens from clicking epic row | EPIC-03 | Requires Tauri + real Jira token | On /epics page, click an epic name, verify slide-over opens with stories list |
| Create epic saves to Jira and re-appears in list | EPIC-04 | API integration requires live Jira | Open Create Epic dialog, submit, verify epic appears in list after refresh |

---

## Validation Sign-Off

- [x] All tasks have automated behavioral tests (vitest + React Testing Library)
- [x] Sampling continuity: every requirement covered by at least one test
- [x] Architecture deviations documented and accepted
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** nyquist-auditor 2026-03-15
