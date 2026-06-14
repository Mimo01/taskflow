---
phase: 82
slug: my-tasks-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom env) |
| **Config file** | `taskflow/vite.config.ts` (test section); setup `taskflow/src/test/setup.ts` |
| **Quick run command** | `npm run test -- --run src/lib/my-tasks-sort.test.ts src/stores/my-tasks.store.test.ts src/services/jira/client.test.ts` |
| **Full suite command** | `npm run check` (biome + tsc + vitest) |
| **Estimated runtime** | ~5s quick · ~60s full |

---

## Sampling Rate

- **After every task commit:** Run quick command (fast unit tests above)
- **After every plan wave:** Run `npm run test -- --run` (full vitest suite, no type-check)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds (quick) / ~60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | MYTASK-04 | — | N/A | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | MYTASK-07 | — | N/A | unit | `npm run test -- --run src/services/jira/client.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | MYTASK-08 | — | N/A | unit | `npm run test -- --run src/stores/my-tasks.store.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | MYTASK-02 | — | N/A | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 0 | MYTASK-01 | — | N/A | smoke | `npm run test -- --run src/routes/my-tasks/MyTasksPage.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `taskflow/src/lib/my-tasks-sort.ts` — pure band-classify + subtree-band + smart-sort functions (enables all MYTASK-04 unit tests)
- [ ] `taskflow/src/lib/my-tasks-sort.test.ts` — band classification, subtree-band float (overdue subtask → parent in Overdue band), flagged-parent-always-band-0, Done-parent-with-in-progress-subtask, filter-count derivation
- [ ] `taskflow/src/stores/my-tasks.store.test.ts` — MYTASK-08: persist groupingMode + scope, restore after re-create, filter state NOT persisted
- [ ] Pagination completeness assertion in `taskflow/src/services/jira/client.test.ts` — criterion 6: 250 results returned when total=250 and first page returns 50 (file may already exist; new assertion may be needed)
- [ ] `taskflow/src/routes/my-tasks/MyTasksPage.test.tsx` — smoke render test

*Existing infrastructure (vitest, @testing-library/react, jest-dom, global @tauri-apps/plugin-store mock) covers all these — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grouping/scope preferences survive a real app restart | MYTASK-08 | Tauri Store file round-trip across process restart is not exercised by jsdom mock | Set grouping=By Status, scope=All Assigned; quit and relaunch the Tauri app; confirm both restored |
| Peek slideover / StatusPopover / context menu open from real rows | MYTASK-05, MYTASK-06 | Full interaction wiring against live Jira data | Right-click a row → Log Work + Copy key; click row body → PeekPanel; click status pill → StatusPopover |
| Progressive "loading more…" indicator during All-Assigned paging | MYTASK-07 | Streaming UX against real multi-page result | Toggle scope to All Assigned on an account with >50 assigned issues; confirm list grows and indicator shows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
