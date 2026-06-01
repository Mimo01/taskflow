---
phase: 75
slug: progressive-issue-detail-rendering
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-30
validated: 2026-05-31
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 75-02-T1 | 75-02 | 1 | PERF-DETAIL-01 | — | Header renders when base query resolves, before comments/subtasks/changelog resolve | unit | `npm run test` | `IssueDetailPage.progressive.test.tsx` | ✅ green |
| 75-02-T2 | 75-02 | 1 | PERF-DETAIL-02 | — | Comments & subtasks sections show localized skeleton while their own query isPending; no global spinner | unit | `npm run test` | `IssueDetailPage.progressive.test.tsx` (comments-skeleton + subtasks-skeleton) | ✅ green |
| 75-02-T2 | 75-02 | 1 | PERF-DETAIL-02 | — | ActivityTimeline receives `undefined` changelog and shows its built-in skeleton (now reachable) | unit | `npm run test` | `issue-detail/ActivityTimeline.test.tsx` (added 2026-05-31) | ✅ green |
| 75-01-T2 | 75-01 | 1 | PERF-DETAIL-02 | — | `useDelayedLoading(isPending,200)` gates each skeleton — no flash on cache-hit / <200ms resolve | unit | `npm run test` | `hooks/useDelayedLoading.test.ts` | ✅ green |
| 75-03-T1 | 75-03 | 2 | PERF-DETAIL-03 | — | Comment post/edit/delete invalidates `['jira-issue-comments', issueKey, jiraBaseUrl]` | unit | `npm run test` | edit+delete: `IssueDetailPage.progressive.test.tsx`; post: `CommentComposer.test.tsx` (added 2026-05-31) | ✅ green |
| 75-03-T2 | 75-03 | 2 | PERF-DETAIL-03 | — | Status transition invalidates `['jira-issue-changelog', ...]` | unit | `npm run test` | `IssueDetailPage.progressive.test.tsx` | ✅ green |
| 75-03-T1 | 75-03 | 2 | PERF-DETAIL-03 | — | Field edit optimistic update still targets base query key after split | unit | `npm run test` | `issue-detail/FieldsSection.test.tsx` | ✅ green |
| 75-01-T1 | 75-01 | 1 | GH-CUT-01 | — | Detail panel queries remain on Jira REST v2 (no GreenHopper endpoints introduced) | unit/source | `npm run test` | `services/jira/changelog.greenhopper-cut.test.ts` (added 2026-05-31) | ✅ green |
| 75-04-T2 | 75-04 | 3 | GH-CUT-02 | — | Verification artifact records before/after TTFMP + TTI + per-section latencies + gating section | manual | see Manual-Only | `docs/perf/75-issue-detail-progressive.md` | ✅ done (UAT) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/routes/dashboard/IssueDetailPage.progressive.test.tsx` — covers PERF-DETAIL-01, 02, 03 with mocked per-section query responses (independent resolution + per-section skeleton + error isolation) — 6/6 green
- [x] Comment-mutation invalidation tests — `jira-issue-comments` key invalidated on edit/delete (progressive test) and on post (`CommentComposer.test.tsx`, added 2026-05-31)

*Shape reference: `AioTestRunsSection.test.tsx` shows how to test a section with delayed skeleton + error state.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Before/after time-to-first-meaningful-paint (header) + time-to-fully-interactive, per-section latencies, which section gates "fully loaded" | GH-CUT-02 | Real-network perf timing against a live Jira instance can't be asserted deterministically in unit tests | Open an issue detail panel against the live Jira instance with the perf instrumentation enabled; capture header-visible timestamp and last-section-resolved timestamp; record per-section latencies; document the gating section in the verification artifact |
| Per-section inline error + retry isolation (one failed section doesn't blank the panel) | PERF-DETAIL-02 | Forcing a single-section network failure in the running app is an integration/manual check | Simulate a comments-endpoint failure; confirm comments shows inline error + retry while all other sections render normally |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-31

---

## Validation Audit 2026-05-31

Retroactive Nyquist audit (State A). VALIDATION.md was a stale RESEARCH-prefilled draft (TBD task IDs, all pending); cross-referenced against the implemented + verified phase and filled 3 automatable gaps.

| Metric | Count |
|--------|-------|
| Requirements audited | 5 (PERF-DETAIL-01/02/03, GH-CUT-01/02) |
| Already covered | 6 map rows |
| Gaps found | 3 |
| Resolved (tests added) | 3 |
| Escalated | 0 |
| Manual-only (unchanged) | 1 (GH-CUT-02 perf timing) |

**Tests added:**
- `taskflow/src/routes/dashboard/issue-detail/ActivityTimeline.test.tsx` — PERF-DETAIL-02: `undefined` changelog → built-in skeleton; `[]` → no skeleton
- `taskflow/src/routes/dashboard/CommentComposer.test.tsx` — PERF-DETAIL-03: comment POST invalidates `['jira-issue-comments', issueKey, jiraBaseUrl]`
- `taskflow/src/services/jira/changelog.greenhopper-cut.test.ts` — GH-CUT-01: `fetchIssueChangelog` targets `/rest/api/2/issue/`, no `greenhopper`/`/agile/`

**Proof:** `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/ActivityTimeline.test.tsx src/routes/dashboard/CommentComposer.test.tsx src/services/jira/changelog.greenhopper-cut.test.ts src/routes/dashboard/IssueDetailPage.progressive.test.tsx` → 4 files / 17 tests passed.
