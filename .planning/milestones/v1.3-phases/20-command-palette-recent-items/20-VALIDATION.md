---
phase: 20
slug: command-palette-recent-items
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | PALETTE-01 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 0 | PALETTE-02 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 0 | PALETTE-03 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-04 | 01 | 0 | PALETTE-04 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-05 | 01 | 0 | PALETTE-05 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-06 | 01 | 0 | PALETTE-06 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-01-07 | 01 | 0 | PALETTE-07 | unit | `cd taskflow && npx vitest run src/components/app/CommandPalette.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 0 | RECENT-01 | unit | `cd taskflow && npx vitest run src/components/app/RecentItemsPopover.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 0 | RECENT-02 | unit | `cd taskflow && npx vitest run src/components/app/RecentItemsPopover.test.tsx -x` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 0 | KEYS-03 | unit | `cd taskflow && npx vitest run src/components/app/TopBar.test.tsx -x` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/app/CommandPalette.test.tsx` — stubs for PALETTE-01 through PALETTE-07
- [ ] `src/components/app/RecentItemsPopover.test.tsx` — stubs for RECENT-01, RECENT-02
- [ ] `src/stores/recent-items.store.test.ts` — store push/cap/dedup logic
- [ ] shadcn command install: `cd taskflow && npx shadcn add command` — generates src/components/ui/command.tsx
- [ ] Mock for cmdk if needed: vitest may need `vi.mock('cmdk', ...)` for jsdom

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+K opens palette visually | PALETTE-01 | Visual overlay rendering in Tauri webview | Press Cmd+K, verify palette appears centered with backdrop blur |
| Fuzzy search result ordering | PALETTE-02 | cmdk filter scoring is internal | Type partial issue key, verify relevant results appear first |
| Live Jira search fires network request | PALETTE-05 | Requires real Jira connection | Type 3+ chars, verify "Search Jira for X" shows loading then results |
| Clock icon popover position | RECENT-01 | Visual alignment in TopBar | Click clock icon, verify popover appears below aligned to icon |
| Navigation shortcuts work globally | KEYS-03 | Tauri webview shortcut interception | Press Cmd+Shift+S from any page, verify Sprint Board loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
