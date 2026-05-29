---
phase: 74
slug: backlog-on-data-json
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && pnpm vitest run --reporter=basic <pattern>` |
| **Full suite command** | `cd taskflow && pnpm vitest run` |
| **Estimated runtime** | ~30s quick / ~90s full |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to the touched file(s)
- **After every plan wave:** Run `pnpm vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + `pnpm biome check .` 0 errors/0 warnings
- **Max feedback latency:** 30 seconds (quick)

---

## Per-Task Verification Map

> Filled in by the planner during PLAN.md generation. Each task row maps to its `<automated>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Test scaffolding the planner MUST include before any production code lands:

- [ ] `taskflow/src/services/jira/greenhopper/__tests__/types-fixture.test.ts` — pin `GhBacklogResponse` (post-widening, D-04a) to the real fixture; fails if envelope drifts
- [ ] `taskflow/src/services/jira/greenhopper/__tests__/useGhBacklogData.test.tsx` — hook returns the fixture envelope, no `refetchInterval`, correct query key `['gh-backlog', boardId]`
- [ ] `taskflow/src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` — `adaptIssue` over `data.issues[0]` produces JiraIssue-compatible result with sprint reverse-index attached
- [ ] `taskflow/src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` — gate test: opening backlog issues exactly 1 `data.json` request and 0 legacy REST calls (`jira-backlog-issues`, `jira-backlog-sprint-stories`, `jira-sprint-list`)
- [ ] `taskflow/src/components/app/__tests__/Sidebar.prefetch.test.tsx` — sidebar prefetch on `/backlog` route issues 1 GH call, not 3 REST calls
- [ ] `scripts/check-legacy-backlog-keys.mjs` (static grep) — fail CI if `['jira-backlog-issues'`, `['jira-backlog-sprint-stories'`, or `fetchBacklogIssues`/`fetchBacklogSprintStories` re-appear outside the deletion commit

*If existing test infra is detected by the planner during Wave 0 task generation, prefer extension over new file creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Move-to-sprint UX (drag/dropdown) | GH-BACKLOG-02 | Drag interactions over virtualized list — hard to automate reliably | Open `/backlog`, drag a story onto an active sprint, verify it lands + persists after reload |
| Create-story UX | GH-BACKLOG-02 | Modal + form submission integrated with REST POST | Click "Create story", submit, verify card appears under correct section after invalidation |
| Filter-by-epic / assignee | GH-BACKLOG-02 | Combinatorial UI assertion across populated entity maps | Toggle epic chip, then assignee chip; verify list narrows and sprint sections respect the filter |
| Label filter is absent | D-05a | Negative UI assertion that's clearer manually | Open backlog filter bar — confirm label chip/dropdown is not rendered |
| Virtualized rendering perf | GH-BACKLOG-02 | Render-window verification needs real scroll behavior | Scroll a 200+ issue backlog — confirm rows recycle, no jank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
