---
phase: 82
slug: my-tasks-page
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-14
audited: 2026-06-15
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
| 82-01 | 82-01 | 0 | MYTASK-04 | — | N/A | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ✅ | ✅ green |
| 82-01 | 82-01 | 0 | MYTASK-02 | — | N/A | unit | `npm run test -- --run src/lib/my-tasks-sort.test.ts` | ✅ | ✅ green |
| 82-03 | 82-03 | 0 | MYTASK-07 | T-82-05 | DoS accepted (no page cap, D-06) | unit | `npm run test -- --run src/services/jira/client.test.ts` | ✅ | ✅ green |
| 82-05 | 82-05 | 4 | MYTASK-01 | — | N/A | smoke | `npm run test -- --run src/routes/my-tasks/MyTasksPage.test.tsx` | ✅ | ✅ green |
| 82-02 | 82-02 | 0 | MYTASK-08 | — | N/A | — | — (feature descoped) | n/a | 🚫 descoped |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🚫 descoped*
*Audited 2026-06-15 against the live codebase: 50 tests green across the 3 files above.*

> **MYTASK-08 descoped.** The persisted store (`my-tasks.store.ts` / `createTauriStorage('my-tasks.json')`) planned in 82-02 was removed in the final 82-DESIGN-TARGET redesign. Scope is now **transient component state — intentionally NOT persisted** (`MyTasksPage.tsx:227–229`), and the grouping switcher was removed (page always renders My Day bands). There is no persistence behavior to verify, so no automated test exists or is owed. ⚠️ Note: `82-VERIFICATION.md` still records MYTASK-08 as SATISFIED with "human UAT confirmed restart persistence" — that claim is stale and does not match the shipped code.

---

## Wave 0 Requirements

- [x] `taskflow/src/lib/my-tasks-sort.ts` — pure band-classify + subtree-band + smart-sort functions (enables all MYTASK-04 unit tests)
- [x] `taskflow/src/lib/my-tasks-sort.test.ts` — band classification, subtree-band float (overdue subtask → parent in Overdue band), flagged-parent-always-band-0, Done-parent-with-in-progress-subtask, filter-count derivation **(green)**
- [x] Pagination completeness assertion in `taskflow/src/services/jira/client.test.ts` — criterion 6: 250 results returned when total=250 and first page returns 50 **(green, line 134)**
- [x] `taskflow/src/routes/my-tasks/MyTasksPage.test.tsx` — smoke render test **(green, 5 tests)**
- [~] ~~`taskflow/src/stores/my-tasks.store.test.ts` — MYTASK-08 persist/restore~~ **descoped** — store removed in final redesign; nothing to persist (see Per-Task Map note)

*Existing infrastructure (vitest, @testing-library/react, jest-dom, global @tauri-apps/plugin-store mock) covered all these — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Peek slideover / StatusPopover open from real rows | MYTASK-05, MYTASK-06 | Full interaction wiring against live Jira data | Click row body → PeekPanel; click issue key → full page; click status pill → StatusPopover. (Right-click context menu removed per UAT.) |
| Progressive "loading more…" indicator during All-Assigned paging | MYTASK-07 | Streaming UX against real multi-page result | Toggle scope to All Assigned on an account with >50 assigned issues; confirm list grows and indicator shows |

*Confirmed during live UAT 2026-06-14. The earlier "grouping/scope survive restart" row (MYTASK-08) was dropped — scope is transient by design and no longer persists.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (MYTASK-08 descoped — no behavior to verify)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (quick run ~1s, 50 tests)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-15

---

## Validation Audit 2026-06-15

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (MYTASK-01/02/04/07/08) |
| Gaps found | 0 |
| Resolved | 0 (all implemented requirements already COVERED) |
| Escalated | 0 |
| Descoped | 1 (MYTASK-08 — persistence removed in final redesign) |
| Tests green | 50 / 50 |

**Outcome:** Phase 82 is Nyquist-compliant. Every implemented requirement (MYTASK-01, -02, -04, -07) has passing automated verification across `my-tasks-sort.test.ts`, `client.test.ts`, and `MyTasksPage.test.tsx`. MYTASK-08 was descoped during the 82-DESIGN-TARGET redesign (scope is transient by design); no test is owed. The stale persistence claim in `82-VERIFICATION.md` should be corrected separately.
