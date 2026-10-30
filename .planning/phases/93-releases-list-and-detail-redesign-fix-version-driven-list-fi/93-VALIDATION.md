---
phase: 93
slug: releases-list-and-detail-redesign-fix-version-driven-list-fi
status: green
nyquist_compliant: true
wave_0_complete: true
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
| D-01/D-02 | List renders no milestone/branch UI, no GitLab calls | component | `npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` | ✅ | ✅ green |
| D-03/D-04 | (**list page superseded by sketch 002 F5 (user-approved 2026-10-29); see F5 rows below.**) Group labels; undated first, dated desc, released desc | unit | `npx vitest run src/lib/release-list.test.ts` | ✅ | ✅ green |
| D-05 | (**list page superseded by sketch 002 F5 (user-approved 2026-10-29); see F5 rows below.**) Pill precedence/labels/tone, "In 1 day", local-date boundary | unit | `npx vitest run src/lib/release-list.test.ts` | ✅ | ✅ green |
| D-06/D-11 | Batch fetch: pagination, multi-fixVersion grouping, id validation, category mapping | unit | `npx vitest run src/services/jira.versionsBreakdown.test.ts` | ✅ | ✅ green |
| D-08 | (**list page superseded by sketch 002 F5 (user-approved 2026-10-29); see F5 rows below. Released first page is now 3.**) 5 released, "Show N more" adds 10; only new chunk fetched | component | `ReleasesTab.test.tsx` | ✅ | ✅ green |
| D-09 | Names/pills render before counts/RM resolve; skeleton slots (relaxed at UAT: planned rows with issues expand when counts arrive) | component | `ReleasesTab.test.tsx` | ✅ | ✅ green |
| D-10 | Cached data renders w/o skeleton on refetch; Refresh staged invalidation, spinner | unit + component | `npx vitest run src/lib/release-refresh.test.ts` | ✅ | ✅ green |
| D-12 | Package column absent when RM disabled; child / week-only / none states | component | `ReleasesTab.deploymentPackage.test.tsx`, `ReleasePackageCell.test.tsx` (ReleaseListRow.test.tsx deleted in 93-10) | ✅ | ✅ green |
| D-13 | Header shows pill/date/package/graph + Pin/Edit/Open in Jira; bottom action row gone | component | `ReleaseHeader.test.tsx` | ✅ | ✅ green |
| D-14 | Table header lacks done badge, keeps flagged; sidebar lacks Status/Date rows | component | `UnifiedTaskTable.test.tsx`, `ReleaseDetailSidebar.test.tsx` | ✅ | ✅ green |
| Graph a11y | `role="img"` aria-label "{done} of {total} issues done"; zero → "No issues" | component | `ReleaseIssueGraph.test.tsx` | ✅ | ✅ green |
| Cache contract | `useEditRelease`/mutations invalidate list batch; detail per-id key untouched | unit | `useReleaseDetail.test.tsx`, `useReleaseBreakdowns.test.tsx` | ✅ | ✅ green |
| F5 agenda | Agenda order, countdown, quiet/pill rules, summary | unit | `npx vitest run src/lib/release-agenda.test.ts` | ✅ | ✅ green |
| F5 batch | Batch assignees for team column | unit | `npx vitest run src/services/jira.versionsBreakdown.test.ts` | ✅ | ✅ green |
| F5 hook | Teams + released first page | unit | `npx vitest run src/hooks/useReleaseBreakdowns.test.tsx` | ✅ | ✅ green |
| F5 planned-row expansion | Planned release with issues renders as a full row (UAT round 1; timeline graph removed) | component | `npx vitest run src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx src/routes/dashboard/ReleasesTab.test.tsx` | ✅ | ✅ green |
| F5 hero | Hero + summary line | component | `npx vitest run src/routes/dashboard/releases-list/ReleasesHero.test.tsx` | ✅ | ✅ green |
| F5 rail | Agenda rail + next card | component | `npx vitest run src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx` | ✅ | ✅ green |
| F5 released | Released panel (3 + show older) | component | `npx vitest run src/routes/dashboard/releases-list/ReleasedPanel.test.tsx` | ✅ | ✅ green |
| F5 page | Page composition + D-01/02/09/10/12 | component | `npx vitest run src/routes/dashboard/ReleasesTab.test.tsx src/routes/dashboard/ReleasesTab.deploymentPackage.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/release-list.ts` + `.test.ts` — pill, grouping/order, breakdown reducer, tooltip rows
- [x] `src/services/jira.versionsBreakdown.test.ts` — new batch fetcher
- [x] `src/lib/release-refresh.ts` + test
- [x] Shared `ReleaseStatusPill` / `ReleaseIssueGraph` + tests
- [x] Rewrite/remove obsolete ReleasesTab tests (milestone/branch testids, `versionCountsParity`) in the same commit as the code change

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|---------------|
| Visual consistency of list + detail header with app styling | UI-SPEC | Visual judgement | Render list and detail in app (or throwaway vite page + cached Chromium) and compare against UI-SPEC |
| Live `fixVersion in (…)` batch behaviour on Jira DC | D-06 (A1) | Needs live instance | Open Releases tab against live Jira; counts match each detail page |
| Perceived load speed | D-09 | Needs live network | Cold-load Releases tab; names/pills appear before counts |
| F5 visual match | sketch 002 F5 | Visual judgement | 93-10 screenshots + live UAT (93-11 Task 2) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gate green (247 files / 3911 tests pass; no newly biome-flagged files). `versionCountsParity` contract moved to `jira.versionsBreakdown.test.ts`. Gap-closure gate (93-11): 252 files / 3977 tests pass; no newly biome-flagged files. F5 live UAT pending.
