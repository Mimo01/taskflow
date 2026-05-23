---
phase: 66
slug: roles-removal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `taskflow/vite.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/components/app/sidebar-items.test.ts src/stores/onboarding.store.test.ts src/routes/settings/SidebarItemsList.test.tsx src/lib/tauri-storage.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (affected test files only)
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` succeeds
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-01 | 01 | 1 | ROLES-01 | — | N/A | unit | `cd taskflow && npx vitest run src/stores/onboarding.store.test.ts` | ✅ | ⬜ pending |
| 66-01-02 | 01 | 1 | ROLES-01 | — | N/A | unit | Delete `src/routes/onboarding/RoleStep.test.tsx` | ✅ delete | ⬜ pending |
| 66-02-01 | 02 | 1 | ROLES-02, ROLES-03 | — | N/A | unit | `cd taskflow && npx vitest run src/routes/settings/SidebarItemsList.test.tsx` | ✅ | ⬜ pending |
| 66-03-01 | 03 | 1 | ROLES-04 | — | N/A | unit | `cd taskflow && npx vitest run src/lib/tauri-storage.test.ts` | ✅ | ⬜ pending |
| 66-04-01 | 04 | 2 | ROLES-06 | — | N/A | unit | `cd taskflow && npx vitest run src/components/app/sidebar-items.test.ts` | ✅ | ⬜ pending |
| 66-05-01 | 05 | 2 | ROLES-05 | — | N/A | grep | `grep -r "\.role" taskflow/src/components taskflow/src/routes` → 0 results | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All test files exist; four require updates (not creation), one requires deletion. No new test files need to be created.

*No Wave 0 setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No role-gated conditionals remain in components/routes | ROLES-05 | grep check, not a unit test | Run `grep -r "\.role" taskflow/src/components taskflow/src/routes` — must return no results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
