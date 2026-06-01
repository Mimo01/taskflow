---
phase: 73
slug: sprint-board-on-alldata-json
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
updated: 2026-05-29
audited: 2026-05-29
---

# Phase 73 — Validation Strategy

> Per-task validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (existing) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run <path> --reporter=dot` |
| **Full suite command** | `cd taskflow && npx vitest run --reporter=dot` |
| **Estimated runtime** | ~45 seconds full suite |

---

## Sampling Rate

- **After every task commit:** quick run scoped to task's test file(s)
- **After every plan wave:** `cd taskflow && npx vitest run --reporter=dot`
- **Before `/gsd-verify-work`:** full suite green + `npx biome check src/` 0/0 + `npx tsc --noEmit` clean
- **Max feedback latency:** ~15 seconds for scoped task runs

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-01 | 01 | 1 | GH-BOARD-01, GH-BOARD-02 | T-73-01, T-73-03 | Hook only fires fetchAllData when route active + auth present | unit | `npx vitest run src/services/jira/greenhopper/useGhAllData.test.ts --reporter=dot` | ❌ Wave 0 (created in this task) | ✅ green |
| 73-01-02 | 01 | 1 | GH-BOARD-02 | T-73-02 | Time-ago helpers clamp future timestamps; no NaN | unit | `npx vitest run src/lib/formatTimeAgo.test.ts --reporter=dot` | ❌ Wave 0 (created in this task) | ✅ green |
| 73-01-03 | 01 | 1 | GH-BOARD-01, GH-BOARD-02 | — | Public surface routed through jira.ts (dual-file rule) | static | `cd taskflow && npx tsc --noEmit && npx biome check src/services/jira.ts src/services/jira/greenhopper/index.ts` | ✅ exists | ✅ green |
| 73-02-01 | 02 | 2 | GH-BOARD-02 | T-73-05 | Badge renders only when timeInColumn present; no PII leak | unit | `npx vitest run src/routes/dashboard/TaskCard.test.tsx --reporter=dot` | ⚠️ update or create | ✅ green |
| 73-02-02 | 02 | 2 | GH-BOARD-01, GH-BOARD-03, GH-BOARD-04 | T-73-04, T-73-06 | Adapter wrapped in useMemo (DoS mitigation); warnOnce on orphan parentId; activeSprint + boardQuickFilters kept (R-01/R-02) | integration | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=dot && npx tsc --noEmit` | ✅ exists (mocks updated) | ✅ green |
| 73-03-01 | 03 | 3 | GH-BOARD-04 | T-73-07 | Reload button disabled while in-flight; 5 invalidations fire; 3s auto-clear | integration | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=dot && npx tsc --noEmit` | ✅ exists (toolbar tests updated) | ✅ green |
| 73-03-02 | 03 | 3 | GH-BOARD-04 | T-73-08 | Sidebar prefetch silent-skip on null boardId; .catch swallow | integration | `npx vitest run src/components/app/Sidebar.test.tsx --reporter=dot && npx tsc --noEmit` | ✅ exists (prefetch tests updated) | ✅ green |
| 73-03-03 | 03 | 3 | GH-CUT-01 | T-73-09 | Pre-check grep blocks deletion if any caller remains | static + full suite | `cd taskflow && grep -rn "fetchSprintSubtasks" src/ \| wc -l` returns 0 + `npx tsc --noEmit` + `npx biome check src/` + `npx vitest run --reporter=dot` | ✅ infra exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts` — created in Plan 01 Task 1 (covers GH-BOARD-01 hook + getGhAllData + invalidateGhAllData)
- [ ] `taskflow/src/lib/formatTimeAgo.test.ts` — created in Plan 01 Task 2 (covers GH-BOARD-02 helpers)
- [ ] `taskflow/src/routes/dashboard/TaskCard.test.tsx` — verify file exists at start of Plan 02 Task 1; create if missing
- [ ] Update `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` mocks (Plan 02 Task 2): replace fetchSprintStories/fetchSprintSubtasks mocks with useGhAllData mock seeded from `__fixtures__/allData.real.json`

Vitest framework already installed and configured — no install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Exactly one `/rest/greenhopper/1.0/xboard/work/allData.json` GET on board open | GH-BOARD-01 | Network panel observation — automated harness would require Playwright/e2e | Open the app to /sprint-board, open devtools network panel, hard-reload. Assert exactly one allData.json GET; assert zero `/rest/agile/1.0/board/{id}/sprint`-stories REST calls and zero `/rest/agile/1.0/sprint/{id}/issue` (sprint-subtasks) calls |
| Drag-to-transition + StatusPopover anchoring for multi-target drops (UI-SPEC §4) | GH-BOARD-04 | Pointer + drop interaction; complex to drive headlessly | Drag a card from a column with multiple legal transitions; assert StatusPopover anchors at drop point and only valid transitions appear |
| Visual placement of timeInColumn badge (UI-SPEC §1) | GH-BOARD-02 | Layout regression; visual confirmation | Open the board with cards carrying timeInColumn; confirm badge sits inside the bottom-right shrink-0 row, after story-points chip, before status pill |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (useGhAllData.test.ts, formatTimeAgo.test.ts)
- [x] No watch-mode flags (every command uses `vitest run`, not `vitest`)
- [x] Feedback latency < 60s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-29

---

## Validation Audit 2026-05-29

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Findings.** Cross-referenced 5 referenced test files against the Per-Task Verification Map. Four ran green out of the gate (`useGhAllData.test.ts`, `formatTimeAgo.test.ts`, `TaskCard.test.tsx`, `Sidebar.test.tsx` — 33/33). `SprintBoardTab.test.tsx` reproducibly hit `ERR_WORKER_OUT_OF_MEMORY` after ~15s (1/14 tests completing) under `--pool=forks` *and* `--pool=threads` with `--max-old-space-size=8192`.

**Root cause (test-only).** The `vi.mock('@/services/jira', ...)` factory returned a fresh `createAdapter` closure on every call. `SprintBoardTab` threads the adapter through a `useMemo`-derived `adaptedIssues` and a `useEffect(() => setLocalIssues(data ?? []), [data])`. Unstable adapter ref → `adaptedIssues` rebuilds every render → `data` ref churn → effect refires → `setLocalIssues` → re-render → infinite loop → heap OOM in the worker. Same hazard latent in `buildEntityMaps` and `useGhTransitions` mock factories.

**Fix.** Hoisted three module-level constants (`IDENTITY_ADAPT`, `STABLE_ENTITY_MAPS`, `STABLE_TRANSITIONS`) and rewrote the `vi.mock` factories to return them, restoring referential stability. No implementation file touched.

**Re-verify.** `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=dot` → **14/14 passed in 4.0s**. Phase 73 companion suite remains green (33/33).
