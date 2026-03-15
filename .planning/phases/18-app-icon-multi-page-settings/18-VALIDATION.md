---
phase: 18
slug: app-icon-multi-page-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/settings/` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/routes/settings/`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | SETTINGS-01 | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 0 | SETTINGS-02 | unit | `cd taskflow && npx vitest run src/routes/settings/ConnectionsSection.test.tsx` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | BRAND-01 | smoke | `ls taskflow/src-tauri/icons/32x32.png taskflow/src-tauri/icons/icon.icns` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 1 | SETTINGS-01 | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 1 | SETTINGS-02 | unit | `cd taskflow && npx vitest run src/routes/settings/ConnectionsSection.test.tsx` | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | SETTINGS-03 | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |
| 18-04-02 | 04 | 2 | SETTINGS-04 | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |
| 18-04-03 | 04 | 2 | SETTINGS-05 | unit | `cd taskflow && npx vitest run src/routes/settings/Settings.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/settings/Settings.test.tsx` — rewrite tests for new sidebar nav structure; old flat-layout tests will break (SETTINGS-01 through SETTINGS-05)
- [ ] `taskflow/src/routes/settings/ConnectionsSection.test.tsx` — new file for inline test-connection feedback (SETTINGS-02)
- [ ] Mock for `applyDensity` in settings test setup — add to existing `vi.mock` patterns

*All other test infrastructure exists — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App icon appears in macOS Dock | BRAND-01 | Visual check — requires running app | Build and launch `taskflow`; verify Dock icon shows node-graph design not Tauri default |
| App icon appears in Windows taskbar | BRAND-01 | Visual check — requires Windows | Run on Windows; verify taskbar icon |
| Settings sidebar links navigate correctly without reload | SETTINGS-01 | Visual + interaction check | Open Settings; click each sidebar item; verify only that section's content shows |
| Test-connection button shows inline spinner | SETTINGS-02 | Async visual feedback | Click "Test Connection" on Jira card with valid credentials; verify spinner appears then resolves |
| Density affects all list/card surfaces | SETTINGS-03 | Visual check across routes | Set density to Compact; verify task rows, MR rows, sprint board cards, sidebar nav items all shrink |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
