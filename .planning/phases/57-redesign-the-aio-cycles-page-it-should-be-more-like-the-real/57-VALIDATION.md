---
phase: 57
slug: redesign-the-aio-cycles-page-it-should-be-more-like-the-real
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 57-W0-01 | 01 | 0 | AION-03: probe live endpoints | unit | `cd taskflow && npx vitest run src/lib/aioUtils.test.ts` | ✅ | ✅ green |
| 57-W0-02 | 01 | 0 | AION-03: probe live endpoints | unit | `cd taskflow && npx vitest run src/services/jira/users.test.ts` | ✅ | ✅ green |
| 57-W0-03 | 01 | 0 | AION-03: probe live endpoints | unit | `cd taskflow && npx vitest run src/services/aio/cycles.test.ts` | ✅ | ✅ green |
| 57-02-T1 | 02 | 1 | AION-03: AioFolder, AioCycleDetailItem, AioCycleSummaryItem, AioCycleDetailPagedResponse types | unit | `cd taskflow && npx vitest run src/services/aio/cycles.test.ts` | ✅ | ✅ green |
| 57-02-T2 | 02 | 1 | AION-03: fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries | unit | `cd taskflow && npx vitest run src/services/aio/cycles.test.ts` | ✅ | ✅ green |
| 57-02-T3 | 02 | 1 | AION-03: AIO_STATUS_MAP + normalizeStatusById | unit | `cd taskflow && npx vitest run src/lib/aioUtils.test.ts` | ✅ | ✅ green |
| 57-03-T1 | 03 | 1 | AION-03: fetchJiraUserByUsername (200/404/network) | unit | `cd taskflow && npx vitest run src/services/jira/users.test.ts` | ✅ | ✅ green |
| 57-04-T1 | 04 | 2 | AION-03: two-panel layout, folder tree, cycle table, progress bar | unit | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ✅ | ✅ green |
| 57-UAT-01 | 05 | 3 | AION-03: fetchJiraProjectNumericId (numeric id from Jira project endpoint) | unit | `cd taskflow && npx vitest run src/services/jira/projects.test.ts` | ✅ | ✅ green |
| 57-UAT-02 | 05 | 3 | AION-03: fetchAioProjectConfig (dynamic status map from /config endpoint) | unit | `cd taskflow && npx vitest run src/services/aio/cycles.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Folder tree renders correctly with real data | AION-03 | Mocked data may not capture all edge cases | Load page with real Jira/AIO credentials, verify folder tree structure matches API-EXAMPLES.md shapes |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete

---

## Validation Audit 2026-05-19

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

Gaps filled: unit tests for `fetchJiraProjectNumericId` (jira/projects.test.ts) and `fetchAioProjectConfig` (aio/cycles.test.ts) — both were UAT inline fixes (commits 4937f16, eed2c3b) that were mocked in component tests but lacked dedicated unit coverage. All 4 error-path branches (200, 401, 404, network) now verified.
