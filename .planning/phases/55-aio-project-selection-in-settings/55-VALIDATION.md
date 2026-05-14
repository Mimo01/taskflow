---
phase: 55
slug: aio-project-selection-in-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (jsdom) + @testing-library/react |
| **Config file** | `taskflow/vite.config.ts` (vitest block) |
| **Quick run command** | `cd taskflow && npm test -- --run <file>` |
| **Full suite command** | `cd taskflow && npm test -- --run` |
| **Estimated runtime** | ~30s full suite (existing) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <changed-test-file>` (~2s)
- **After every plan wave:** Run `npm test -- --run` (~30s)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — populated by planner | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*To be populated by planner — see RESEARCH.md `## Validation Architecture` for layer-by-layer test artifacts.*

Expected Wave 0 items (derived from RESEARCH.md):
- [ ] Update `taskflow/src/stores/settings.store.test.ts` v16 → v17 migration test scaffold
- [ ] Update `taskflow/src/components/app/Sidebar.test.tsx` mock to include `selectedAioProjectKey`
- [ ] Update `taskflow/src/routes/settings/IntegrationsSection.test.tsx` mock to include `selectedAioProjectKey`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rendering of picker inside Settings → Integrations | AION-02 (visual surface) | jsdom can't verify shadcn Select dropdown positioning / focus ring | Open Settings → Integrations, toggle AIO on, open the picker, pick a project, verify sidebar entry deep-links to the project overview |
| Persist hydration across app restart | D-07 (migration) | Stronghold + Tauri runtime not available in vitest | Pick a project, close app, reopen, verify sidebar entry still deep-links to the same project |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
