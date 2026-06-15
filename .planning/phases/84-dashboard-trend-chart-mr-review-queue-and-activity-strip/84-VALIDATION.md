---
phase: 84
slug: dashboard-trend-chart-mr-review-queue-and-activity-strip
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | taskflow/vitest.config.ts (or vite config test block — planner to confirm path) |
| **Quick run command** | `cd taskflow && npx vitest run <new test file>` |
| **Full suite command** | `cd taskflow && npm run check && npx vitest run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite + `npm run check` (biome + tsc) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| trend-bucketing | TBD | TBD | DASH-04 | — | N/A | unit | `npx vitest run` (timezone-safe bucketing: `started:"2026-06-14T23:00:00"` ⇒ `2026-06-14`) | ❌ W0 | ⬜ pending |
| activity-shared-key | TBD | TBD | DASH-05 | — | N/A | unit/integration | `npx vitest run` (strip query keys === Standup keys, byte-identical) | ❌ W0 | ⬜ pending |
| mr-queue-grouping | TBD | TBD | DASH-06 | — | N/A | unit | `npx vitest run` (reviewer vs author grouping from `{filtered,merged}` cache) | ❌ W0 | ⬜ pending |
| independent-degrade | TBD | TBD | DASH-07 | — | N/A | manual + component | one section error does not blank the others | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Task IDs finalized by planner.*

---

## Wave 0 Requirements

- [ ] Timezone-safe weekly-bucketing helper extracted as a pure, importable function (so the criterion-1 unit test can call it directly against raw `started` input) — DASH-04
- [ ] Shared-query-key constants/helpers extracted so the activity strip and Standup Notes provably use byte-identical keys (testable equality) — DASH-05
- [ ] MR-grouping (reviewer vs author) extracted as a pure function over the `{ filtered, merged }` cache payload — DASH-06

*If existing test infrastructure (vitest) is already configured, no framework install is needed — only the pure-function seams above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "No duplicate network request when both Standup and Dashboard visited same session" | DASH-05 | Requires live cache + network observation across two route visits | Visit Standup Notes, then Dashboard in the same session; confirm zero new Jira-activity/commits requests fire (DevTools Network / TanStack Query devtools) |
| Independent section degradation — Dashboard never goes fully blank | DASH-07 | Requires simulating per-source failure at runtime | Force one section's query to error; confirm the other sections + tiles still render their own state |
| "Tempo not connected" / "GitLab not connected" empty states | DASH-04, DASH-06 | Config-gated runtime states | Toggle `tempoEnabled` off / unconfigure GitLab; confirm graceful empty states (not errors) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
