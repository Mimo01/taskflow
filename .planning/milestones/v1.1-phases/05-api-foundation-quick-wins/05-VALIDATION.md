---
phase: 5
slug: api-foundation-quick-wins
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | APIF-01 | unit | `npm run test -- --run src/lib/__tests__/jira.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | APIF-01 | unit | `npm run test -- --run src/lib/__tests__/jira.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | APIF-02 | unit | `npm run test -- --run src/lib/__tests__/jira.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | APIF-03 | unit | `npm run test -- --run src/lib/__tests__/jira.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | APIF-04 | unit | `npm run test -- --run src/lib/__tests__/gitlab.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | REL-01 | unit | `npm run test -- --run src/components/__tests__/ReleasesTab.test.tsx` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 1 | REL-02 | unit | `npm run test -- --run src/components/__tests__/ReleasesTab.test.tsx` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 1 | REL-03 | unit | `npm run test -- --run src/components/__tests__/ReleasesTab.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/jira.test.ts` — stubs for APIF-01 (type extension), APIF-02 (subtask two-query), APIF-03 (story points discovery)
- [ ] `src/lib/__tests__/gitlab.test.ts` — stubs for APIF-04 (searchGitLabMRs state=opened)
- [ ] `src/components/__tests__/ReleasesTab.test.tsx` — stubs for REL-01 (sort newest-oldest), REL-02 (overdue/in-X-days badges), REL-03 (released/unreleased badges)
- [ ] `npx shadcn add badge` — Badge component install (compile prerequisite for REL-02/REL-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge colors render correctly in browser | REL-02, REL-03 | Visual/CSS verification requires browser | Open Releases tab, verify green=released, amber=future, red=overdue, blue=due-today |
| MR Attention shows only open MRs | APIF-04 | Requires real GitLab connection | Open MR Attention tab, confirm merged/closed MRs absent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
