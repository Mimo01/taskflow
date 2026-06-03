---
phase: quick-260603-fb8
verified: 2026-06-03T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Quick Task 260603-fb8: Select Jira Board Verification Report

**Task Goal:** Let users select which Jira board to use (fix wrong rapidViewId/board id). Persist a per-project chosen board id, prefer it everywhere sprint/backlog/active-sprint data is fetched (falling back to the first board when nothing is chosen), and add a board picker to BOTH the onboarding wizard Jira step and Settings → Connections.
**Verified:** 2026-06-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can choose which Jira board a project uses in the onboarding wizard and in Settings → Connections | ✓ VERIFIED | `BoardPicker` rendered in `JiraStep.tsx:169` (after project select) and `ConnectionsSection.tsx:229` (after successful test). Both call `setJiraBoardId`. |
| 2 | The chosen board id is stored per-project and survives app restart | ✓ VERIFIED | `auth.store.ts:31,69,123-124` — `jiraBoardIds: Record<string,number>` in `initialAuthState`, in `AuthState`, with `setJiraBoardId` spread-setter; persisted via `createTauriStorage('auth.json')`; `partialize` only strips `_hasHydrated`. |
| 3 | Sprint board, backlog, and dashboard active-sprint card all use the stored board id, not values[0] | ✓ VERIFIED | All 3 direct `fetchActiveSprint` callers thread the resolved boardId: `SprintBoardTab.tsx:710-714`, `DashboardSprintCard.tsx:60-64` (boardId prop from `dashboard/index.tsx:47,104` via `useBoardId`), `Sidebar.tsx:149`. Backlog/sprint-board data goes through `useGhAllData(boardId)` (`SprintBoardTab.tsx:622`). |
| 4 | When no board is stored, the app falls back to the first board (existing users unaffected) | ✓ VERIFIED | `useBoardId.ts:33` returns `storedBoardId ?? fetchedBoardId ?? null`; both `fetchActiveSprint` copies run `values?.[0]?.id` discovery only inside `if (resolvedBoardId === undefined)` (`sprints.ts:121-131`, `jira.ts` equivalent). zustand merges `{}` default over old auth.json — no crash. |
| 5 | Wizard auto-selects single board; requires choice when multiple; allows continue when none | ✓ VERIFIED | `BoardPicker.tsx:44-48` auto-selects single via value-driven effect; `JiraStep.tsx:81` `blockedOnBoardChoice = boards.length > 1 && chosenBoardId == null`; continue disabled on that gate only (`JiraStep.tsx:185`), zero boards allows continue. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `taskflow/src/services/jira/sprints.ts` | listProjectBoards() + JiraBoard + boardId param on fetchActiveSprint | ✓ VERIFIED | `listProjectBoards` (lines 66-87) returns `JiraBoard[]`/`[]` on failure, `maxResults=100`, `encodeURIComponent`; `fetchActiveSprint` accepts `boardId?` (line 113) and skips discovery when provided. |
| `taskflow/src/services/jira.ts` | Same boardId param on legacy fetchActiveSprint | ✓ VERIFIED | Legacy `fetchActiveSprint` (line 1088) accepts `boardId?`, identical skip-discovery logic; label corrected to 'Load Active Sprint' (IN-02 resolved). |
| `taskflow/src/stores/auth.store.ts` | jiraBoardIds map + setJiraBoardId, persisted | ✓ VERIFIED | Fields + setter present; persisted; back-compat safe. |
| `taskflow/src/hooks/useBoardId.ts` | stored-board preference funnel | ✓ VERIFIED | Reactive `jiraBoardIds?.[projectKey]` selector (line 20-22), `enabled` gates discovery off when stored, returns stored ?? fetched ?? null. |
| `taskflow/src/components/jira/BoardPicker.tsx` | shared picker, all states, ≥30 lines | ✓ VERIFIED | 116 lines; loading/error+retry/zero(null)/single(read-only auto-select)/multiple(Select, `name (id)` labels). |
| `taskflow/src/routes/onboarding/JiraStep.tsx` | picker wired + continue gate + persist | ✓ VERIFIED | Board fetch (line 47), picker (169), gate (81/185), persist (90), project-change resets board id (38, WR-02). |
| `taskflow/src/routes/settings/ConnectionsSection.tsx` | picker wired + persist + invalidate | ✓ VERIFIED | Success-gated board fetch with error/retry (75-102), picker (229), `setJiraBoardId` + `invalidateQueries(['jira-active-sprint'])` at root (477-481). |
| `taskflow/src/stores/onboarding.store.ts` | jiraBoards + jiraBoardId fields | ✓ VERIFIED | Lines 19-20, 39-40. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| useBoardId.ts | auth.store jiraBoardIds | useAuthStore selector | ✓ WIRED | `useBoardId.ts:20` reactive selector. |
| SprintBoardTab.tsx | fetchActiveSprint boardId param | resolved boardId from useBoardId | ✓ WIRED | `:535` useBoardId, `:710-714` threads boardId, `:708` queryKey includes boardId. |
| DashboardSprintCard.tsx | fetchActiveSprint boardId | boardId prop from index.tsx | ✓ WIRED | `:60-64`; queryKey `:58` includes jiraBaseUrl + boardId (WR-01 resolved). |
| Sidebar.tsx prefetch | fetchActiveSprint boardId | stored id resolved before discovery | ✓ WIRED | `:126` reads stored id via getState, `:149` threads it, `:147` queryKey includes boardId. |
| JiraStep.tsx | setJiraBoardId | BoardPicker onChange + continue gate | ✓ WIRED | `:90` persists on continue. |
| ConnectionsSection.tsx | setJiraBoardId + invalidate | onBoardSelected at section root | ✓ WIRED | `:477-481`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| BoardPicker (both insertion points) | `boards` | `listProjectBoards` → real `/rest/agile/1.0/board` fetch | Yes | ✓ FLOWING |
| useBoardId consumers | `boardId` | `jiraBoardIds[projectKey]` store ?? `fetchBoardId` | Yes | ✓ FLOWING |
| active-sprint queries | `boardId` 4th arg | resolved board id threaded | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Quality gate (biome + tsc) | `cd taskflow && npm run check` | "Checked 437 files. No fixes applied." exit 0 | ✓ PASS |
| No blind values[0] bypass on active paths | grep `values[0].id` across src | 3 hits, all inside `boardId === undefined` discovery-fallback branches | ✓ PASS |
| All fetchActiveSprint callers thread boardId | grep call sites | 3 callers all pass 4th arg | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| FB8-1 | listProjectBoards service | ✓ SATISFIED | `sprints.ts:66-87` |
| FB8-2 | per-project jiraBoardIds store | ✓ SATISFIED | `auth.store.ts` |
| FB8-3 | stored-board funnel threaded through all consumers | ✓ SATISFIED | `useBoardId` + 3 callers |
| FB8-4 | shared BoardPicker in wizard + settings | ✓ SATISFIED | `BoardPicker.tsx` + both insertion points |

### Anti-Patterns Found

None blocking. The 3 `values?.[0]?.id` occurrences are intentional fallback discovery inside `boardId === undefined` guards (the agreed existing-user fallback), not stubs or blind bypasses. No TBD/FIXME/XXX debt markers in modified files. `maxResults=100` cap documented and accepted (IN-01, REVIEW).

### Human Verification Required

None required for goal achievement — all five truths are verifiable in the codebase and the quality gate passes. (Optional live smoke test of the motivating two-board scenario — selecting "Eshop Scrum Board (163)" over "Copy of …" 6708 and confirming sprint data follows — would exercise the runtime path but is not needed to confirm the implementation is wired correctly.)

### Gaps Summary

No gaps. All five observable truths are verified against the actual codebase. Both `fetchActiveSprint` copies honor a passed `boardId` and only run blind `values[0]` discovery when no board is resolved (the intended fallback). All 3 direct callers (SprintBoardTab, DashboardSprintCard via dashboard/index, Sidebar prefetch) thread the resolved board id and include it in their `['jira-active-sprint', …]` queryKeys. Per-project storage is persisted and back-compatible. The shared BoardPicker is wired into both the onboarding wizard and Settings → Connections with all locked UX behaviors (auto-select single, require choice on multiple, allow continue when none, name+id labels, loading + error/retry states). All 5 REVIEW warnings (WR-01..WR-05) and 2 info items (IN-02, IN-03) marked resolved are confirmed fixed in code. The quality gate `cd taskflow && npm run check` is GREEN (biome clean + tsc clean, exit 0).

---

_Verified: 2026-06-03_
_Verifier: Claude (gsd-verifier)_
