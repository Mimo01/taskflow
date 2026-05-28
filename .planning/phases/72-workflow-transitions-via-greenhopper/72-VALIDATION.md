---
phase: 72
slug: workflow-transitions-via-greenhopper
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `pnpm --filter taskflow test -- --run` |
| **Full suite command** | `pnpm --filter taskflow test -- --run && pnpm --filter taskflow lint` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command (vitest --run, narrowed by file when possible)
- **After every plan wave:** Run full suite (vitest + biome)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 | 1 | GH-TRANS-01, GH-TRANS-03 | T-72-03 | Warn-once semantics preserved across modules (single shared `seenMissing` Set) | unit (TDD) | `cd taskflow && npx vitest run src/services/jira/greenhopper/warnOnce.test.ts src/services/jira/greenhopper/entityMaps.test.ts` | ❌ W0 (`warnOnce.test.ts` created in same task) | ⬜ pending |
| 72-01-02 | 01 | 1 | GH-TRANS-01 | T-72-01, T-72-04 | `ApiError` for 401/403; auth header reused from Stronghold | unit (TDD) | `cd taskflow && npx vitest run src/services/jira/statuses.test.ts` | ❌ W0 (`statuses.test.ts` created in same task) | ⬜ pending |
| 72-01-03 | 01 | 1 | GH-TRANS-01, GH-TRANS-03 | T-72-02, T-72-03, T-72-05, T-72-06 | `staleTime+gcTime: Infinity` on envelope, per-type, and `['jira-statuses']`; warn-once on missing workflow/status id; fallback `statusCategory.key='indeterminate'` cannot grant capability | unit (TDD) | `cd taskflow && npx vitest run src/services/jira/greenhopper/transitions.test.ts src/services/jira/greenhopper/warnOnce.test.ts src/services/jira/greenhopper/entityMaps.test.ts src/services/jira/statuses.test.ts && npx tsc --noEmit -p .` | ❌ W0 (`transitions.test.ts` extended in same task) | ⬜ pending |
| 72-02-01 | 02 | 2 | GH-TRANS-02, GH-TRANS-03 | T-72-09, T-72-10 | Per-issue prefetch loop deleted (DoS mitigation); `aria-live` feedback strings exposed to assistive tech; 401/403 propagated via existing error states | integration (TDD) | `cd taskflow && npx vitest run src/routes/dashboard/StatusPopover.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx && npx tsc --noEmit -p .` | ❌ W0 (`StatusPopover.test.tsx` created + `SprintBoardTab.test.tsx` updated in same task) | ⬜ pending |
| 72-02-02 | 02 | 2 | GH-TRANS-02 | T-72-07, T-72-11 | Per-key issue lookup defends against missing-key spoof; transition match by `to.name`/`to.id` (not `statusCategory.key`) blocks privilege escalation via fallback | integration (TDD) | `cd taskflow && npx vitest run src/routes/dashboard/BulkActionBar.test.tsx src/routes/dashboard/QuickCreateInput.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx && npx tsc --noEmit -p .` | ❌ W0 (`BulkActionBar.test.tsx` created + `QuickCreateInput.test.tsx` updated in same task) | ⬜ pending |
| 72-03-01 | 03 | 3 | GH-TRANS-02, GH-TRANS-03 | T-72-13, T-72-14, T-72-15 | Hard cutover removes legacy code path; grep gate (`fetchTransitions` count = 0) is the hard D-08 contract; `postTransition` + `JiraTransition` retained | unit + static | `cd taskflow && test "$(grep -rn 'fetchTransitions' src --include='*.ts' --include='*.tsx' \| grep -v '^#' \| wc -l \| tr -d ' ')" = "0" && npx tsc --noEmit -p . && npx vitest run && npx biome check src/services/jira.ts src/services/jira/transitions.ts src/services/jira.test.ts src/services/jira/transitions.test.ts` | ❌ W0 (`services/jira.test.ts` + `services/jira/transitions.test.ts` edited in same task — legacy describe blocks removed) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Tests are created within each TDD task itself (no prior Wave 0 plan). "File Exists ❌ W0" means the test file does not exist before the task starts and is created (or extended) as the RED step of the same task.*

---

## Wave 0 Requirements

- [x] `src/services/jira/greenhopper/warnOnce.test.ts` — created in 72-01-01 as the RED step (warn-once semantics: dedupe per `${kind}:${id}` key, `__resetWarnOnce` clears, exact console format)
- [x] `src/services/jira/statuses.test.ts` — created in 72-01-02 as the RED step (200 success, URL composition, trailing-slash strip, 401/403 `ApiError`, 500 generic `Error`)
- [x] `src/services/jira/greenhopper/transitions.test.ts` — EXTENDED in 72-01-03 (existing fetcher tests stay; add `indexTransitions`, `adaptToJiraTransition`, `getGhTransitions` envelope dedupe, `invalidateGhTransitions` one-project + all-projects, hook dedupe across typeIds, cache config invariants)
- [x] `src/routes/dashboard/StatusPopover.test.tsx` — created in 72-02-01 as the RED step (renders from `useGhTransitions` hook return; loading/error states; no legacy `fetchTransitions` mock invoked)
- [x] `src/routes/dashboard/SprintBoardTab.test.tsx` — EXTENDED in 72-02-01 (single envelope fetch per project on mount; toolbar action invalidates envelope + `['jira-statuses']`; aria-live span renders the exact text `"Workflow transitions reloaded"` after success)
- [x] `src/routes/dashboard/BulkActionBar.test.tsx` — created (or extended) in 72-02-02 as the RED step (bulk status change calls `getGhTransitions` per key; throws when key missing from `issues` prop; no legacy `fetchTransitions` mock invoked)
- [x] `src/routes/dashboard/QuickCreateInput.test.tsx` — EXTENDED in 72-02-02 (post-create transition lookup via `getGhTransitions` with the new `projectId` + `issueTypeId` props; no legacy `fetchTransitions` mock invoked)
- [x] Existing vitest + React Testing Library setup is reused — no framework install

*Test files are all authored inside the same task that consumes them — there is no separate Wave 0 plan. The RED step of each TDD task creates/extends the test file; the GREEN step implements production code to satisfy the new assertions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No per-issue `/rest/api/2/issue/*/transitions` GET in the network log when transitioning on the sprint board | GH-TRANS-02 | Network-tab assertion is operator-driven | 1) Open sprint board for a project; 2) DevTools → Network → filter `transitions`; 3) Drag an issue between columns; 4) Confirm only one `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N` per fresh project (or zero on cache hit), and zero per-issue REST hits |
| Manual refresh toolbar action invalidates and refetches | GH-TRANS-03 | Visual confirmation of inline aria-live label + refetch | 1) Click "Reload workflow transitions" in sprint-board toolbar; 2) Confirm both `['gh-transitions-envelope', N]` (+ derived `['gh-transitions', N, ...]`) and `['jira-statuses']` queries refetch; 3) Confirm the inline aria-live span renders `"Workflow transitions reloaded"` on success or `"Failed to reload workflow"` on error (verbatim from D-07) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
