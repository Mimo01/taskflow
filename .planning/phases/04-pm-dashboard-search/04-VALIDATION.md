---
phase: 4
slug: pm-dashboard-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | PM-01 | unit | `cd taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | PM-02 | unit | `cd taskflow && npx vitest run src/routes/dashboard/WorkloadTab.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 0 | PM-03, PM-04 | unit | `cd taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 0 | PM-03 | unit | `cd taskflow && npx vitest run src/services/releaseLinker.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 0 | SRCH-01, SRCH-02 | unit | `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 0 | SRCH-02 | unit | `cd taskflow && npx vitest run src/components/app/SearchResultPanel.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` — stubs for PM-01 (sprint progress buckets + progress bar hidden when unestimated)
- [ ] `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — stubs for PM-02 (workload grouped by assignee, unresolved only)
- [ ] `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` — stubs for PM-03, PM-04 (releases tab renders version rows)
- [ ] `taskflow/src/services/releaseLinker.test.ts` — stubs for PM-03 (fix version date matching: exact / fuzzy / none)
- [ ] `taskflow/src/components/app/SearchOverlay.test.tsx` — stubs for SRCH-01, SRCH-02 (search disabled when empty, parallel calls, results grouped)
- [ ] `taskflow/src/components/app/SearchResultPanel.test.tsx` — stubs for SRCH-02 (clicking result shows detail panel with open link)

*Note: TopBar.test.tsx already exists — SearchOverlay tests in separate file to avoid breaking existing TopBar tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PM dashboard only visible to users with PM role | PM-01 | Role-based routing requires auth state setup | Log in as dev user, verify `/pm-dashboard` redirects to dev dashboard |
| GitLab milestone linked correctly to Jira fix version | PM-03 | Requires real Jira + GitLab integration | Set up fix version with matching milestone name, verify link appears |
| Search keyboard shortcut (Cmd+K) opens overlay | SRCH-01 | Keyboard events in Tauri app window | Press Cmd+K, verify overlay opens; press Escape, verify it closes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
