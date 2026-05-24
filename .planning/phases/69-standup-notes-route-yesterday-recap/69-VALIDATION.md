---
phase: 69
slug: standup-notes-route-yesterday-recap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 69-01-01 | 01 | 1 | STAND-01 | — | N/A | unit | `npm run test -- routes` | ✅ routes.test.ts | ⬜ pending |
| 69-01-02 | 01 | 1 | STAND-02 | — | N/A | unit | `npm run test -- standup-date` | ❌ Wave 0 | ⬜ pending |
| 69-02-01 | 02 | 1 | STAND-03 | T-62-06 | readSecret() inside queryFn, token not in queryKey | unit | `npm run test -- StandupNotesPage` | ❌ Wave 0 | ⬜ pending |
| 69-02-02 | 02 | 1 | STAND-04 | T-62-06 | readSecret() inside queryFn, token not in queryKey | unit | `npm run test -- jira-standup` | ❌ Wave 0 | ⬜ pending |
| 69-02-03 | 02 | 2 | STAND-05 | T-62-06 | readSecret() inside queryFn, token not in queryKey | unit | `npm run test -- standup-date` | ❌ Wave 0 | ⬜ pending |
| 69-02-04 | 02 | 2 | STAND-06 | T-62-06 | readSecret() inside queryFn, token not in queryKey | unit | `npm run test -- gitlab` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/lib/standup-date.test.ts` — covers STAND-02 (resolveYesterdayDate weekend + holiday skip), STAND-05 (Jira key extraction)
- [ ] `taskflow/src/services/jira-standup.test.ts` — covers STAND-04 (client-side author+date filtering logic)
- [ ] `taskflow/src/pages/StandupNotesPage.test.tsx` — covers STAND-03 (empty-state when integrations disabled)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar entry visible and navigates to /standup-notes | STAND-01 | UI visibility requires running app | Click sidebar; verify route loads |
| Yesterday resolves correctly on Monday | STAND-02 | Date-sensitive; requires system clock or mock | Set system date to Monday; open page; verify Friday's data loads |
| Empty state per section when integration disabled | STAND-03–06 | Requires disabling integrations in settings | Disable each integration; verify per-section empty state renders without crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
