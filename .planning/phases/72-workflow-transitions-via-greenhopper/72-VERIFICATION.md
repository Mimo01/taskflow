---
phase: 72-workflow-transitions-via-greenhopper
verified: 2026-05-29T00:32:00Z
status: passed
score: 4/4 success criteria verified; 2 human UAT items approved 2026-05-29 (see 72-HUMAN-UAT.md); 2 gap-closure fixes (subtask transitions + status filter) committed as f7732dd1
re_verification:
  previous_status: null
  previous_score: null
human_verification:
  - test: "No per-issue /rest/api/2/issue/*/transitions GET in network log during drag-to-transition"
    expected: "Open sprint board, DevTools → Network → filter 'transitions', drag an issue between columns; only one /rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N per fresh project (or zero on cache hit), zero per-issue REST hits."
    why_human: "Network-tab observation against a live Jira backend cannot be reproduced by unit tests."
  - test: "Manual refresh toolbar action invalidates and refetches; aria-live label updates verbatim"
    expected: "Click 'Reload workflow transitions' in sprint-board toolbar; both ['gh-transitions-envelope', N] and ['jira-statuses'] queries refetch; inline aria-live span renders exactly 'Workflow transitions reloaded' on success or 'Failed to reload workflow' on error (verbatim from D-07)."
    why_human: "Visual confirmation of aria-live feedback with real backend timing."
---

# Phase 72: Workflow Transitions via GreenHopper Verification Report

**Phase Goal:** Replace per-issue REST `/transitions` calls with a cached per-project `transitions.json` map; wire it into sprint-board drag-to-transition and issue-detail status change.

**Verified:** 2026-05-29
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | transitions.json fetched once per project per session and cached (projectId × issueTypeId → workflow → transitions[]) | VERIFIED | `useGhTransitions` defined `transitions.ts:224`; two-layer cache `['gh-transitions-envelope', projectId]` + `['gh-transitions', projectId, issueTypeId]` with `staleTime/gcTime: Infinity` (5 grep hits for `gcTime: Infinity`); SUMMARY 01 test confirms 2 hook consumers with same projectId / different typeIds → 1 underlying fetch |
| 2 | Sprint-board drag-to-transition reads from cache (no per-issue REST /transitions in network log) | VERIFIED (automated) — needs human network-tab UAT | `SprintBoardTab.tsx:40` imports `useGhTransitions`; per-issue prefetch loop removed; `getTransitions(issue)` reads `['gh-transitions', ...]`. `BulkActionBar.tsx:171` uses `getGhTransitions`. Zero `fetchTransitions` references in entire `src/` |
| 3 | Issue-detail status change reads from the same cache | VERIFIED | `StatusPopover.tsx:43` consumes `useGhTransitions(projectId, issueTypeId)`; parents `TaskRow.tsx`, `FieldsSection.tsx` updated to thread props |
| 4 | Cache refreshed on session start and via manual refresh; old per-issue REST path deleted | VERIFIED | Toolbar `Reload workflow transitions` action at `SprintBoardTab.tsx:1147` invokes `invalidateGhTransitions(qc, pid)` + `invalidateQueries({queryKey: ['jira-statuses']})` (line 758-759); legacy `fetchTransitions` GET deleted from both `services/jira.ts` and `services/jira/transitions.ts`; grep `fetchTransitions` across `src/` returns 0 hits |

**Score:** 4/4 truths verified (automated). 2 items require human UAT.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira/greenhopper/transitions.ts` | Cache hook + helpers + adapter + invalidator | VERIFIED | 268 lines; exports `fetchGhTransitions`, `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions`, `__indexTransitions`, `__adaptToJiraTransition`, `__ensureStatusMap` |
| `taskflow/src/services/jira/greenhopper/warnOnce.ts` | Shared warn-once helper | VERIFIED | 39 lines; exports `warnOnce`, `__resetWarnOnce` |
| `taskflow/src/services/jira/statuses.ts` | fetchAllJiraStatuses + JiraStatus type | VERIFIED | 52 lines; exports both |
| `taskflow/src/services/jira.ts` | Legacy fetchTransitions GET deleted; re-exports added | VERIFIED | `grep export async function fetchTransitions` returns 0; re-exports `useGhTransitions`, `getGhTransitions`, `invalidateGhTransitions` (lines 2722-2729), `fetchAllJiraStatuses` (line 2732); `JiraTransition` interface retained at line 193 |
| `taskflow/src/services/jira/transitions.ts` | Legacy GET deleted; postTransition retained | VERIFIED | `export async function postTransition` at line 15; `fetchTransitions` 0 hits |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | useGhTransitions warm + Reload toolbar action | VERIFIED | Imports `useGhTransitions` + `invalidateGhTransitions` at lines 36/40; warm at line 731; toolbar button `aria-label="Reload workflow transitions"` at line 1147; aria-live span at line 1125 |
| `taskflow/src/routes/dashboard/StatusPopover.tsx` | useGhTransitions consumer | VERIFIED | Line 43 |
| `taskflow/src/routes/dashboard/BulkActionBar.tsx` | getGhTransitions consumer | VERIFIED | Line 21 import; line 171 call |
| `taskflow/src/routes/dashboard/QuickCreateInput.tsx` | getGhTransitions consumer with projectId/issueTypeId props | VERIFIED | Line 19 import; line 61 call |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| SprintBoardTab.tsx | @/services/jira (useGhTransitions, invalidateGhTransitions) | named import line 36/40 | WIRED |
| StatusPopover.tsx | @/services/jira (useGhTransitions) | named import line 20 | WIRED |
| BulkActionBar.tsx | @/services/jira (getGhTransitions) | named import line 21 | WIRED |
| QuickCreateInput.tsx | @/services/jira (getGhTransitions) | named import line 19 | WIRED |
| services/jira.ts | services/jira/greenhopper (re-exports) | export block lines 2722-2729 | WIRED |
| services/jira.ts | services/jira/statuses (re-export) | line 2732 | WIRED |
| SprintBoardTab.tsx toolbar | jira-statuses invalidation | `invalidateQueries({queryKey: ['jira-statuses']})` line 759 | WIRED |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| GH-TRANS-01 | transitions.json fetched once per project, keyed by projectId × issueTypeId → workflow → transitions[] | SATISFIED | useGhTransitions two-layer cache (transitions.ts:224, envelope dedupe tested) |
| GH-TRANS-02 | Sprint-board + issue-detail read from cache (no per-issue REST /transitions) | SATISFIED (automated) — human network-tab UAT remains | 4 call sites migrated; grep `fetchTransitions` = 0; legacy GET deleted |
| GH-TRANS-03 | Cache invalidated on project/workflow change; manual refresh action available | SATISFIED | invalidateGhTransitions + toolbar Reload action; aria-live feedback with D-07 verbatim strings |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `cd taskflow && npm test` | 140 files passed (3 skipped); 1649 tests passed (2 skipped, 18 todo); 0 failures | PASS |
| Legacy fetchTransitions purged from src | `grep -rn 'fetchTransitions' taskflow/src --include='*.ts' --include='*.tsx'` | 0 hits | PASS |
| New APIs present in jira.ts re-exports | `grep -n 'useGhTransitions\|getGhTransitions\|invalidateGhTransitions\|fetchAllJiraStatuses' taskflow/src/services/jira.ts` | 4 re-export lines (2722-2732) | PASS |
| postTransition retained | `grep -n 'export async function postTransition' taskflow/src/services/jira/transitions.ts` | line 15 found | PASS |
| JiraTransition interface retained | `grep -n 'export interface JiraTransition' taskflow/src/services/jira.ts` | line 193 found | PASS |

### Anti-Patterns Found

None. No TBD/FIXME/XXX/HACK/PLACEHOLDER markers introduced in the touched files. No empty handlers, no hardcoded empty data flowing to render, no console.log-only stubs.

### Human Verification Required

#### 1. Network-tab assertion (GH-TRANS-02)

**Test:** Open the sprint board for a project. Open DevTools → Network → filter `transitions`. Drag an issue between columns.
**Expected:** Exactly one `/rest/greenhopper/1.0/xboard/work/transitions.json?projectId=N` per fresh project (or zero on cache hit), and ZERO per-issue `/rest/api/2/issue/*/transitions` GETs.
**Why human:** Network-tab observation against a live Jira backend cannot be unit-tested. The grep+test evidence proves the code paths are absent; live observation confirms no rogue path exists.

#### 2. Toolbar Reload action visual + aria-live (GH-TRANS-03)

**Test:** Click the "Reload workflow transitions" button in the sprint-board toolbar.
**Expected:** Both `['gh-transitions-envelope', N]` (and dependent per-type `['gh-transitions', N, ...]`) and `['jira-statuses']` queries refetch. Inline aria-live span renders verbatim `"Workflow transitions reloaded"` on success or `"Failed to reload workflow"` on error.
**Why human:** Visual confirmation against real backend timing; aria-live announcement quality is subjective.

### Gaps Summary

No automated gaps. All 4 roadmap success criteria are observably true in the codebase:

1. Two-layer GH cache infrastructure shipped + tested (Plan 01, commits 55371c27, 6b596847, 3f280269).
2. All 4 call sites (StatusPopover, SprintBoardTab, BulkActionBar, QuickCreateInput) migrated (Plan 02, commits a41b395f, 7cd3df00).
3. Legacy fetchTransitions GET deleted from both jira.ts and jira/transitions.ts (Plan 03, commit 878cd8fe); grep gate `fetchTransitions` = 0 across src.
4. Toolbar Reload action with aria-live feedback present; postTransition + JiraTransition retained.

Full test suite (1649 tests) green. Only remaining items are the two human network-tab + visual UAT checks listed above — these are the standard manual verifications declared in 72-VALIDATION.md "Manual-Only Verifications" and must be confirmed before sign-off.

---

_Verified: 2026-05-29_
_Verifier: Claude (gsd-verifier)_
