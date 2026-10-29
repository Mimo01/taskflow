---
phase: 93
slug: releases-list-and-detail-redesign-fix-version-driven-list-fi
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-29
---

# Phase 93 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4 (jsdom, Testing Library), setup `src/test/setup.ts` |
| **Config file** | `taskflow/vitest.config.ts` (inner app dir) |
| **Quick run command** | `cd taskflow && npx vitest run <path>` |
| **Full suite command** | `cd taskflow && npm test && npm run check` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched file's vitest + `npx biome check <files>` (pre-commit hook runs the full suite anyway)
- **After every plan wave:** Run `npm test` and `npm run check` (gate on no NEW biome-flagged files, not an absolute count)
- **Before `/gsd-verify-work`:** Full suite must be green; visual check of list + detail header
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-01/D-02 | List renders no milestone/branch UI, no GitLab calls | component | `npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | update | ⬜ pending |
| D-03/D-04 | Group labels; undated first, dated desc, released desc | unit | `npx vitest run src/lib/release-list.test.ts` | ❌ W0 | ⬜ pending |
| D-05 | Pill precedence/labels/tone, "In 1 day", local-date boundary | unit | `npx vitest run src/lib/release-list.test.ts` | ❌ W0 | ⬜ pending |
| D-06/D-11 | Batch fetch: pagination, multi-fixVersion grouping, id validation, category mapping | unit | `npx vitest run src/services/jira.versionsBreakdown.test.ts` | ❌ W0 | ⬜ pending |
| D-08 | 5 released, "Show N more" adds 10; only new chunk fetched | component | ReleasesTab test | update | ⬜ pending |
| D-09 | Names/pills render before counts/RM resolve; skeleton slots | component | ReleasesTab test | update | ⬜ pending |
| D-10 | Cached data renders w/o skeleton on refetch; Refresh staged invalidation, spinner | unit + component | `npx vitest run src/lib/release-refresh.test.ts` | ❌ W0 | ⬜ pending |
| D-12 | Package column absent when RM disabled; child / week-only / none states | component | `ReleasesTab.deploymentPackage.test.tsx` | update | ⬜ pending |
| D-13 | Header shows pill/date/package/graph + Pin/Edit/Open in Jira; bottom action row gone | component | `ReleaseHeader.test.tsx` | update | ⬜ pending |
| D-14 | Table header lacks done badge, keeps flagged; sidebar lacks Status/Date rows | component | `UnifiedTaskTable.test.tsx`, `ReleaseDetailSidebar.test.tsx` | update | ⬜ pending |
| Graph a11y | `role="img"` aria-label "{done} of {total} issues done"; zero → "No issues" | component | `ReleaseIssueGraph.test.tsx` | ❌ W0 | ⬜ pending |
| Cache contract | `useEditRelease`/mutations invalidate list batch; detail per-id key untouched | unit | `useReleaseDetail.test.tsx` + new | partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/release-list.ts` + `.test.ts` — pill, grouping/order, breakdown reducer, tooltip rows
- [ ] `src/services/jira.versionsBreakdown.test.ts` — new batch fetcher
- [ ] `src/lib/release-refresh.ts` + test
- [ ] Shared `ReleaseStatusPill` / `ReleaseIssueGraph` + tests
- [ ] Rewrite/remove obsolete ReleasesTab tests (milestone/branch testids, `versionCountsParity`) in the same commit as the code change

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|---------------|
| Visual consistency of list + detail header with app styling | UI-SPEC | Visual judgement | Render list and detail in app (or throwaway vite page + cached Chromium) and compare against UI-SPEC |
| Live `fixVersion in (…)` batch behaviour on Jira DC | D-06 (A1) | Needs live instance | Open Releases tab against live Jira; counts match each detail page |
| Perceived load speed | D-09 | Needs live network | Cold-load Releases tab; names/pills appear before counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
