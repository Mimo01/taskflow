---
phase: 57
slug: redesign-the-aio-cycles-page-it-should-be-more-like-the-real
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-W0-01 | 01 | 0 | — | — | N/A | unit | `cd taskflow && npx vitest run src/lib/aioUtils.test.ts` | ❌ W0 | ⬜ pending |
| 57-W0-02 | 01 | 0 | — | — | N/A | unit | `cd taskflow && npx vitest run src/services/jira/users.test.ts` | ❌ W0 | ⬜ pending |
| 57-W0-03 | 01 | 0 | — | — | N/A | unit | `cd taskflow && npx vitest run src/services/aio/cycles.test.ts` | ✅ | ⬜ pending |
| 57-01-01 | 01 | 1 | — | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ✅ | ⬜ pending |
| 57-01-02 | 01 | 1 | — | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ✅ | ⬜ pending |
| 57-01-03 | 01 | 1 | — | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ✅ | ⬜ pending |
| 57-02-01 | 02 | 2 | — | — | N/A | unit | `cd taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/lib/aioUtils.test.ts` — new file for `normalizeStatusById` + `AIO_STATUS_MAP` tests
- [ ] `taskflow/src/services/jira/users.test.ts` — new file for `fetchJiraUserByUsername` (returns user or null on 404)
- [ ] `taskflow/src/services/aio/cycles.test.ts` — extend with `fetchAioFolderTree` and `fetchAioCycleSummaries` tests
- [ ] `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` — full rewrite after component rewrite (old tests will fail)

*Note: Wave 0 must also include a live API probe to confirm endpoint URLs (folder tree, count map, summary batch). Assumptions A1–A4 from RESEARCH.md carry medium-high risk.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API endpoint URLs correct in live environment | — | URLs are assumed (A1–A4 in RESEARCH.md); network probe required | Open DevTools → Network tab, navigate to AIO page in live app, capture actual request URLs for folder tree, count map, and summary endpoints |
| Folder tree renders correctly with real data | — | Mocked data may not capture all edge cases | Load page with real Jira/AIO credentials, verify folder tree structure matches API-EXAMPLES.md shapes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
