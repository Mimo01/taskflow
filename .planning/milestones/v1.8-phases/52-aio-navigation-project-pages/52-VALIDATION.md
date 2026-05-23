---
phase: 52
slug: aio-navigation-project-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + @testing-library/react |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 52-W0-01 | W0 | 0 | AION-01 | — | N/A | unit | `npx vitest run src/components/app/Sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 52-W0-02 | W0 | 0 | AION-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/AioProjectsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 52-W0-03 | W0 | 0 | AION-03 | — | N/A | unit | `npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ❌ W0 | ⬜ pending |
| 52-W0-04 | W0 | 0 | AION-03 | T-52-01 | encodeURIComponent on projectKey | unit | `npx vitest run src/services/aio/cycles.test.ts` | ❌ W0 | ⬜ pending |
| 52-01-01 | 01 | 1 | AION-01 | — | N/A | unit | `npx vitest run src/components/app/Sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | AION-02 | — | N/A | unit | `npx vitest run src/routes/dashboard/AioProjectsPage.test.tsx` | ❌ W0 | ⬜ pending |
| 52-01-03 | 01 | 1 | AION-03 | T-52-01 | encodeURIComponent on projectKey param | unit | `npx vitest run src/services/aio/cycles.test.ts` | ❌ W0 | ⬜ pending |
| 52-02-01 | 02 | 1 | AION-03 | — | N/A | unit | `npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx` | ❌ W0 | ⬜ pending |
| (all) | — | — | regression | — | N/A | regression | `cd taskflow && npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/aio/cycles.test.ts` — fetchAioCycles pagination loop + 401/404/network error paths (AION-03 + T-52-01)
- [ ] `src/routes/dashboard/AioProjectsPage.test.tsx` — renders project rows, empty state, error state (AION-02)
- [ ] `src/routes/dashboard/AioProjectOverviewPage.test.tsx` — renders cycle rows, empty state, error state (AION-03)
- [ ] `src/components/app/Sidebar.test.tsx` — aioEnabled=true shows Testing section, aioEnabled=false hides it (AION-01); may already exist — verify before creating

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar "Testing" section visible when aioEnabled=true in running app | AION-01 | E2E integration — requires live Tauri app with real settings store | Toggle aioEnabled in Settings, verify Testing section appears/disappears |
| Clicking AIO Projects nav item routes to /aio-projects | AION-01 | Navigation integration | Enable AIO, click Testing → AIO Projects in sidebar |
| Projects page lists real AIO projects from live instance | AION-02 | Requires live AIO backend | Navigate to /aio-projects, verify real project names appear |
| Clicking project navigates to /aio-project/:projectKey | AION-02 | Navigation integration | Click a project row, verify URL changes |
| Project overview lists real cycles from live AIO | AION-03 | Requires live AIO backend | Navigate to /aio-project/:projectKey, verify cycle rows |

---

## Security Threats

| Threat ID | Pattern | STRIDE | Mitigation |
|-----------|---------|--------|------------|
| T-52-01 | URL path injection via `:projectKey` URL param | Tampering | `encodeURIComponent(projectKey)` in cycles.ts fetchAioCycles (same as issue-runs.ts) |
| T-52-02 | Token exposure in error messages | Information Disclosure | ApiError never includes token in message (confirmed in existing ApiError class) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
