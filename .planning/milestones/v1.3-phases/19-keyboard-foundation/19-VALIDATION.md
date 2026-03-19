---
phase: 19
slug: keyboard-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose src/components/app/KeyboardShortcutsPanel.test.tsx src/components/app/SearchOverlay.test.tsx src/stores/settings.store.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx src/components/app/KeyboardShortcutsPanel.test.tsx`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 0 | KEYS-01, KEYS-02, KEYS-07 | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 19-01-02 | 01 | 0 | Settings store | unit | `cd taskflow && npx vitest run src/stores/settings.store.test.ts` | ✅ exists | ⬜ pending |
| 19-01-03 | 01 | 1 | KEYS-01, KEYS-02, KEYS-07 | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx -t "opens"` | ❌ Wave 0 | ⬜ pending |
| 19-01-04 | 01 | 1 | SearchOverlay migration | unit | `cd taskflow && npx vitest run src/components/app/SearchOverlay.test.tsx` | ✅ exists | ⬜ pending |
| 19-01-05 | 01 | 1 | KEYS-01 | unit | `cd taskflow && npx vitest run src/components/app/KeyboardShortcutsPanel.test.tsx -t "opens"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx` — stubs for KEYS-01, KEYS-02, KEYS-07
- [ ] New test case in `taskflow/src/stores/settings.store.test.ts` — `keyboardOverrides` field and v1→v2 migration

*Existing infrastructure (`vitest`, `@testing-library/react`) covers framework needs. Only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `?` opens panel from any screen | KEYS-01 | End-to-end navigation context | Launch dev build; navigate to Board, Backlog, Settings; press `?` from each — panel must open |
| Panel does not open while typing | KEYS-07 | Requires real focus inside input | Click into a search or text field; press `?` — panel must NOT open |
| Focus returns after close | Accessibility | jsdom doesn't fully simulate focus restoration | Open panel, press Escape, verify cursor is back in original position |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
