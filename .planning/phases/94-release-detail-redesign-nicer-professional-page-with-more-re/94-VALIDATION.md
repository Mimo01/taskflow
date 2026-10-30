---
phase: 94
slug: release-detail-redesign-nicer-professional-page-with-more-re
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-30
---

# Phase 94 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4 (jsdom, @testing-library/react); React Compiler NOT applied in tests |
| **Config file** | `taskflow/vitest.config.ts` (inner app dir), setup `src/test/setup.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage.test.tsx src/lib/release-refresh src/stores/settings.store.test.ts src/services/jira.fixVersionIssues.test.ts` |
| **Full suite command** | `cd taskflow && npm test && npm run check` |
| **Estimated runtime** | ~60 seconds (quick ~15s) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (pre-commit hook also runs full suite + biome)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green + visual check at 980/640/440 widths
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-03 | `fetchFixVersionIssues` requests `created,resolutiondate`; JQL unchanged | unit | `npx vitest run src/services/jira.fixVersionIssues.test.ts` | ❌ W0 | ⬜ pending |
| D-03 | previous-version resolver (released/unreleased, undated, ties, none) | unit | `npx vitest run src/routes/dashboard/release-detail/releaseBurnup.test.ts` | ❌ W0 | ⬜ pending |
| D-03/D-04/D-16 | burnup series rules (clamp, resolutiondate, missing resolutiondate → today, final point == done count, axis ends, <2 points) | unit | same | ❌ W0 | ⬜ pending |
| D-05 | MR donut incl. draft; type buckets; assignee sort, Unassigned last | unit | `npx vitest run src/routes/dashboard/release-detail/releaseBuckets.test.ts` | ❌ W0 | ⬜ pending |
| D-05/D-06 | graph loading / empty / error / aria-label / ≤4 tooltip rows / no legend | component | `npx vitest run src/routes/dashboard/release-detail/graphs` | ❌ W0 | ⬜ pending |
| D-06/D-07/D-13 | page: no sidebar, no resizer, single scroll wrapper, sticky table header, no duplicated figure | component | `npx vitest run src/routes/dashboard/ReleaseDetailPage.test.tsx` | ❌ W0 | ⬜ pending |
| D-07 | `releaseDetailPanelWidth` removed; persist version 32 migration | unit | `npx vitest run src/stores/settings.store.test.ts` | ✅ update | ⬜ pending |
| D-08/D-15 | every sidebar state reachable from facts strip; unlabeled-MR tooltip (3 + "+N more") | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseFacts.test.tsx` | ❌ W0 (port) | ⬜ pending |
| D-09 | description clamp + more/less only on overflow | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDescription.test.tsx` | ❌ W0 | ⬜ pending |
| D-11/D-12 | header: title, pill, date, package, actions, Refresh | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseHeader.test.tsx` | ✅ update | ⬜ pending |
| D-13 | `refreshReleaseDetail` upstream-first invalidation order | unit | `npx vitest run src/lib/release-refresh.test.ts` | check | ⬜ pending |
| D-14 | EditReleaseModal opens from Edit | component | page test | ❌ W0 | ⬜ pending |
| Skeleton | `ReleaseDetailSkeleton` mirrors new layout | component | `npx vitest run src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx` | ❌ W0 | ⬜ pending |
| Locked | table anatomy + hook contracts unchanged | existing | `npx vitest run src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/jira.fixVersionIssues.test.ts`
- [ ] `src/routes/dashboard/release-detail/releaseBurnup.test.ts`, `releaseBuckets.test.ts`
- [ ] `src/routes/dashboard/release-detail/graphs/*.test.tsx`
- [ ] `ReleaseFacts.test.tsx` (port of `ReleaseDetailSidebar.test.tsx` before sidebar deletion), `ReleaseDescription.test.tsx`, `ReleaseDetailSkeleton.test.tsx`
- [ ] `src/routes/dashboard/ReleaseDetailPage.test.tsx`
- [ ] `src/lib/release-refresh.test.ts` (extend if it exists)

No framework install needed.

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Sticky table header under single scroll wrapper | D-13 | WebKit layout, jsdom has none | Render real page, scroll; header stays pinned, opaque |
| Burnup ticks / TODAY + release markers | D-04 | recharts SVG layout | Screenshot released / undated / overdue releases |
| React-Compiler-only staleness | all graphs | vitest skips compiler | Run in app; change release, confirm graphs update |
| Narrow widths 980/640/440 + container queries | Discretion | layout | Compare against sketch 003/005 HTML at each width |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
