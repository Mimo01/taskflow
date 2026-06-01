---
phase: 74
slug: backlog-on-data-json
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
audited: 2026-05-29
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && ./node_modules/.bin/vitest run <pattern> --reporter=default` |
| **Full suite command** | `cd taskflow && ./node_modules/.bin/vitest run` |
| **Estimated runtime** | ~30s quick / ~90s full |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to the touched file(s)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green + `npx biome check .` 0 errors
- **Max feedback latency:** 30 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 74-01-T1 | 01 | 0 | D-04a (GhBacklogResponse pinned to fixture) | T-74-01 | Type/fixture drift detection | unit | `./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/types-fixture.test.ts` | ✓ | green |
| 74-01-T2 | 01 | 0 | useGhBacklogData contract (8 cases incl. D-02 no-polling) | — | Hook gating + single-flight + invalidation scope | unit | `./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/useGhBacklogData.test.tsx` | ✓ | green |
| 74-01-T3 | 01 | 0 | D-04b (sprint reverse-index) + D-05 (adapter story-points / assignee) | T-74-07 | Adapter mis-map prevention | unit | `./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` | ✓ | green |
| 74-01-T4 | 01 | 0 | GH-BACKLOG-01 (single `data.json` request, zero legacy REST hits) | T-74-06 | Network invariant at fetcher boundary | integration | `./node_modules/.bin/vitest run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | ✓ | green |
| 74-01-T5 | 01 | 0 | D-08 Sidebar prefetch collapse (helper-shape pin) | — | Prefetch fanout regression | unit | `./node_modules/.bin/vitest run src/components/app/__tests__/Sidebar.prefetch-helper-shape.test.tsx` | ✓ | green (partial — see Manual) |
| 74-01-T6 | 01 | 0 | GH-CUT-01 static-grep guard for 4 banned tokens | T-74-13 | Legacy symbol reintroduction | static-grep | `cd taskflow && npm run check:legacy-backlog` | ✓ | green |
| 74-02-T1 | 02 | 1 | Public barrel re-exports (`useGhBacklogData` / `getGhBacklogData` / `invalidateGhBacklogData` via `@/services/jira`) | — | Dual-file surface integrity | type-check | `./node_modules/.bin/tsc --noEmit` | ✓ | green |
| 74-03-T1 | 03 | 2 | BacklogPage routes through single hook + invalidation swap | T-74-06 / T-74-07 / T-74-08 | Cache-key migration | integration | `./node_modules/.bin/vitest run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | ✓ | green |
| 74-04-T1 | 04 | 2 | Sidebar `/backlog` prefetch single-call chain | T-74-09 / T-74-10 | Prefetch shape pin | unit | `./node_modules/.bin/vitest run src/components/app/__tests__/Sidebar.prefetch-helper-shape.test.tsx` | ✓ | green |
| 74-05-T1 | 05 | 3 | Reload-backlog toolbar action (handler + aria-live + invalidation set) | T-74-11 | Manual-reload affordance integrity | grep + suite | `./node_modules/.bin/vitest run src/routes/dashboard/__tests__` | ✓ | green |
| 74-06-T1 | 06 | 4 | Legacy fetchers deleted; CI guard wired; 5 mutation sites swapped | T-74-13 / T-74-14 / T-74-15 | Cutover irreversibility | static-grep + suite | `cd taskflow && npm run check:legacy-backlog && ./node_modules/.bin/vitest run` | ✓ | green |
| 74-REVIEW-BL-01 | REVIEW-FIX | 5 | Reverse-index built from ACTIVE/FUTURE only — CLOSED-sprint issues fall to backlog bucket | — | CLOSED-sprint carryover regression | unit | `./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` | ✓ | green |
| 74-REVIEW-BL-02 | REVIEW-FIX | 5 | `lookupSprintNameById` resolves from raw `backlog.sprints[]` (incl. CLOSED) | — | Sprint-name resolution under CLOSED-state edge | unit | `./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` | ✓ | green |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Test scaffolding the planner MUST include before any production code lands:

- [x] `taskflow/src/services/jira/greenhopper/__tests__/types-fixture.test.ts` — pins `GhBacklogResponse` to the real fixture
- [x] `taskflow/src/services/jira/greenhopper/__tests__/useGhBacklogData.test.tsx` — hook contract (8 cases)
- [x] `taskflow/src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` — adapter shape + reverse-index + BL-01/BL-02 CLOSED-sprint regressions
- [x] `taskflow/src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` — GH-BACKLOG-01 network invariant
- [x] `taskflow/src/components/app/__tests__/Sidebar.prefetch-helper-shape.test.tsx` — D-08 helper-shape pin (renamed from `Sidebar.prefetch.test.tsx` per WR-01)
- [x] `taskflow/scripts/check-legacy-backlog-keys.mjs` (static grep, wired via `npm run check:legacy-backlog`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Network log shows exactly one `data.json` request per backlog open | GH-BACKLOG-01 / SC-1 | Network panel verification (the on-wire request count) is runtime-only; the network test mocks the fetcher boundary but cannot prove what DevTools sees in the real desktop app | Open backlog in dev/desktop app with DevTools Network panel; confirm 1× `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId={boardId}` and zero `/rest/api/2/search` |
| Move-to-sprint UX (drag/dropdown) | GH-BACKLOG-02 / SC-2 | Drag interactions over virtualized list — hard to automate reliably | Open `/backlog`, drag a story onto an active sprint, verify it lands + persists after reload |
| Create-story UX | GH-BACKLOG-02 | Modal + form submission integrated with REST POST | Click "Create story", submit, verify card appears under correct section after invalidation |
| Filter-by-epic / assignee | GH-BACKLOG-02 | Combinatorial UI assertion across populated entity maps | Toggle epic chip, then assignee chip; verify list narrows and sprint sections respect the filter |
| Label filter is absent | D-05a | Negative UI assertion that's clearer manually | Open backlog filter bar — confirm label chip/dropdown is not rendered |
| Virtualized rendering perf | GH-BACKLOG-02 | Render-window verification needs real scroll behavior | Scroll a 200+ issue backlog — confirm rows recycle, no jank |
| Post-mutation cache freshness | GH-BACKLOG-02 (mutation paths) | React Query runtime invalidation depends on active boardId + real cache reads | After move-to-sprint / edit field / create story, hard-refresh backlog and confirm state matches without manual reload |
| Sidebar prefetch real-component gate (deferred WR-01 option a) | D-08 | Current `Sidebar.prefetch-helper-shape.test.tsx` only pins the helper shape — does not render the real Sidebar component | Manually verify `/backlog` prefetch issues exactly 1 GH call via DevTools network panel on cold sidebar mount |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-05-29

---

## Validation Audit 2026-05-29

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Gaps filled:**
- BL-01: CLOSED-sprint reverse-index exclusion — pinned in `adapter-backlog.test.ts` (synthetic CLOSED sprint; asserts CLOSED-only issueId absent from ACTIVE/FUTURE reverse-index; counter-proof against naïve all-sprints index)
- BL-02: `lookupSprintNameById` raw-list source — pinned in `adapter-backlog.test.ts` (parallel lookup functions over full vs filtered sprint lists; asserts full-list resolves CLOSED name while filtered returns null)

Test file: `taskflow/src/services/jira/greenhopper/__tests__/adapter-backlog.test.ts` — 4 tests, all green.
