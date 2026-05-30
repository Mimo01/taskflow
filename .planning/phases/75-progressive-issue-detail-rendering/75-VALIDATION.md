---
phase: 75
slug: progressive-issue-detail-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Pre-filled from RESEARCH.md §Validation Architecture. The planner refines the
> Per-Task Verification Map once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `npm run test` (from `taskflow/`) |
| **Full suite command** | `npm run test` (from `taskflow/`) |
| **Estimated runtime** | ~existing suite runtime (no watch mode) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** < 60 seconds

---

## Per-Task Verification Map

> Task IDs assigned during planning. Rows below are requirement-level behaviors
> the planner must bind to concrete tasks.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | PERF-DETAIL-01 | — | Header renders when base query resolves, before comments/subtasks/changelog resolve | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PERF-DETAIL-02 | — | Comments & subtasks sections show localized skeleton while their own query isPending; no global spinner | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PERF-DETAIL-02 | — | ActivityTimeline receives `undefined` changelog and shows its built-in skeleton (now reachable) | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PERF-DETAIL-02 | — | `useDelayedLoading(isPending,200)` gates each skeleton — no flash on cache-hit / <200ms resolve | unit | `npm run test` | ✅ (hook tested) | ⬜ pending |
| TBD | TBD | 2 | PERF-DETAIL-03 | — | Comment post/edit/delete invalidates `['jira-issue-comments', issueKey, jiraBaseUrl]` | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PERF-DETAIL-03 | — | Status transition invalidates `['jira-issue-changelog', ...]` | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | PERF-DETAIL-03 | — | Field edit optimistic update still targets base query key after split | unit | `npm run test` | ✅ (FieldsSection.test.tsx) | ⬜ pending |
| TBD | TBD | 1 | GH-CUT-01 | — | Detail panel queries remain on Jira REST v2 (no GreenHopper endpoints introduced) | unit/source | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | GH-CUT-02 | — | Verification artifact records before/after TTFMP + TTI + per-section latencies + gating section | manual | see Manual-Only | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` — covers PERF-DETAIL-01, 02, 03 with mocked per-section query responses (independent resolution + per-section skeleton + error isolation)
- [ ] Comment-mutation invalidation tests — assert the new `jira-issue-comments` key is invalidated on post/edit/delete

*Shape reference: `AioTestRunsSection.test.tsx` shows how to test a section with delayed skeleton + error state.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Before/after time-to-first-meaningful-paint (header) + time-to-fully-interactive, per-section latencies, which section gates "fully loaded" | GH-CUT-02 | Real-network perf timing against a live Jira instance can't be asserted deterministically in unit tests | Open an issue detail panel against the live Jira instance with the perf instrumentation enabled; capture header-visible timestamp and last-section-resolved timestamp; record per-section latencies; document the gating section in the verification artifact |
| Per-section inline error + retry isolation (one failed section doesn't blank the panel) | PERF-DETAIL-02 | Forcing a single-section network failure in the running app is an integration/manual check | Simulate a comments-endpoint failure; confirm comments shows inline error + retry while all other sections render normally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
