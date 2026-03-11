---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` — Wave 0 creates this |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | — | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | — | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-01, AUTH-06 | unit | `npx vitest run src/services/jira.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUTH-02, AUTH-06 | unit | `npx vitest run src/services/gitlab.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | AUTH-03, AUTH-05 | unit | `npx vitest run src/services/stronghold.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | AUTH-04, AUTH-06 | component | `npx vitest run src/routes/onboarding/JiraStep.test.tsx` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | ROLE-01 | component | `npx vitest run src/routes/onboarding/RoleStep.test.tsx` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | AUTH-05, ROLE-02 | component | `npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 1 | UI-01 | unit | `npx vitest run src/services/theme.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test runner configuration (jsdom environment, globals, setup file)
- [ ] `src/test/setup.ts` — jest-dom matchers + window.crypto shim for Tauri
- [ ] `src/services/jira.test.ts` — stubs for AUTH-01, AUTH-06
- [ ] `src/services/gitlab.test.ts` — stubs for AUTH-02, AUTH-06
- [ ] `src/services/stronghold.test.ts` — stubs for AUTH-03, AUTH-05 (mockIPC)
- [ ] `src/routes/onboarding/JiraStep.test.tsx` — stubs for AUTH-04, AUTH-06
- [ ] `src/routes/onboarding/RoleStep.test.tsx` — stub for ROLE-01
- [ ] `src/routes/settings/Settings.test.tsx` — stubs for AUTH-05, ROLE-02
- [ ] `src/services/theme.test.ts` — stub for UI-01
- [ ] `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding wizard back navigation preserves entered values | AUTH-01, AUTH-02 | Requires Tauri runtime; involves real navigation between wizard steps | Run app, fill in Jira URL + token, advance to GitLab step, press Back, verify Jira fields still populated |
| PAT survives app restart (Stronghold actually writes to disk) | AUTH-03 | Requires real Tauri runtime + disk I/O + app restart | Enter token, complete onboarding, quit app via OS, relaunch, verify connection is still active without re-entering token |
| Re-auth banner appears when token is expired at launch | AUTH-06 | Requires real expired token + Tauri runtime | Use a real revoked token, launch app, verify non-dismissible banner appears with correct message |
| Dark mode persists across app restarts | UI-01 | Requires real Tauri runtime + Tauri Store disk persistence | Toggle to dark, quit app, relaunch, verify dark mode is still active |
| Token masked by default, eye icon reveals plaintext | AUTH-05 | Requires visual verification | Open settings, verify token shows as `***...***`, click eye icon, verify token is readable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
