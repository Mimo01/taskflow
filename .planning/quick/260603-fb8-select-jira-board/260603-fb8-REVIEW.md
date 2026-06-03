---
phase: 260603-fb8-select-jira-board
reviewed: 2026-06-03T00:00:00Z
depth: quick
files_reviewed: 12
files_reviewed_list:
  - taskflow/src/components/jira/BoardPicker.tsx
  - taskflow/src/hooks/useBoardId.ts
  - taskflow/src/routes/dashboard/DashboardSprintCard.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/onboarding/JiraStep.tsx
  - taskflow/src/routes/settings/ConnectionsSection.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/sprints.ts
  - taskflow/src/stores/auth.store.ts
  - taskflow/src/stores/onboarding.store.ts
  - taskflow/src/components/app/Sidebar.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: resolved
resolution_commit: e3f3b752
resolved:
  - WR-01 (DashboardSprintCard active-sprint queryKey now includes jiraBaseUrl)
  - WR-02 (onboarding resets jiraBoardId on project change)
  - WR-04 (BoardPicker auto-select driven off value prop, ref removed)
  - WR-05 (projectKey encodeURIComponent in board-list URLs, both files)
  - IN-02 (active-sprint devtools log relabeled 'Load Active Sprint')
  - IN-03 (Settings BoardPicker error + Retry wired)
accepted_as_is:
  - WR-03 (sprint-issues query is project-keyed; fetchSprintIssues takes no boardId, so a board switch within a project does not change its output — adding boardId would only cause needless refetch)
  - IN-01 (maxResults=100 cap — documented, acceptable per CONTEXT discretion)
  - IN-04 (jiraBoardIds map unbounded growth — harmless, lookups are by active project key)
---

# Phase 260603-fb8: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** quick
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the per-project Jira board selection feature: `listProjectBoards()`, the `jiraBoardIds` map in auth.store, `useBoardId` stored-preferred-then-fallback logic, the `boardId?` param threaded through `fetchActiveSprint` (both sprints.ts and legacy jira.ts), the shared `<BoardPicker>`, and its wiring into onboarding + Settings.

The core stored-board-preferred logic in `useBoardId` is correct and back-compatible (the `?.` guard and `enabled` gating handle pre-existing `auth.json` blobs without `jiraBoardIds`). The zustand persist merge is safe — `initialAuthState.jiraBoardIds = {}` plus `setJiraBoardId`'s spread mean missing keys never crash.

However there are several real cache-correctness and stale-state defects around the active-sprint queryKey. No critical/security issues. The strongest concerns are a queryKey divergence that silently breaks cache-sharing and stale board ids leaking across project switches.

## Warnings

### WR-01: DashboardSprintCard active-sprint queryKey omits `jiraBaseUrl` — breaks documented cache-sharing and prefetch hits

**File:** `taskflow/src/routes/dashboard/DashboardSprintCard.tsx:58`
**Issue:** The query key is `['jira-active-sprint', activeJiraProject, boardId]`, but every other consumer uses `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` (SprintBoardTab.tsx:708, Sidebar.tsx:147). The card's own docstring claims "Shares TanStack Query cache keys with SprintBoardTab" — it does not. The Sidebar dashboard prefetch (Sidebar.tsx:135-142 only warms `getGhAllData`, and the sprint-board branch warms active-sprint under the 4-element key) will never populate this 3-element key, so the card always refetches on mount. The keys must be identical to share cache.
**Fix:**
```ts
queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
```

### WR-02: Onboarding board id is not reset when the project changes — stale board id can be persisted for the wrong project

**File:** `taskflow/src/routes/onboarding/JiraStep.tsx:35,49-50,78-87`
**Issue:** `setSelectedProject` only does `set({ jiraProject: v })`. If the user picks project A, the single-board auto-select (or a manual pick) writes `jiraBoardId`, then they switch to project B, `jiraBoardId` still holds project A's board id. If B has multiple boards, `blockedOnBoardChoice` is `false` (because `chosenBoardId != null`) so Continue is enabled, and `setJiraBoardId(selectedProject /* B */, chosenBoardId /* A's id */)` persists A's board id under B's key. The board query refetches for B but the stale id is never cleared until BoardPicker's auto-select fires (only for the single-board case).
**Fix:** Clear the board id on project change:
```ts
const setSelectedProject = (v: string) => set({ jiraProject: v, jiraBoardId: null });
```

### WR-03: Settings board switch does not invalidate `gh-all-data` or DashboardSprintCard's `jira-issues` query — board change can leave stale board content

**File:** `taskflow/src/routes/settings/ConnectionsSection.tsx:466-471`
**Issue:** `onBoardSelected` invalidates only `['jira-active-sprint']`. The sprint board's primary data comes from `useGhAllData(boardId)` (SprintBoardTab.tsx:622), which is keyed by `boardId`, so it refetches automatically once `useBoardId` re-reads the new stored id — that path is fine. But the active-sprint invalidation is the only one fired; if any board-derived cache is keyed without boardId it will not refresh. Lower-impact but worth confirming: DashboardSprintCard's `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` (DashboardSprintCard.tsx:44) is project-keyed, not board-keyed, so switching boards within the same project will not refresh the sprint-issues progress bar. Confirm whether sprint issues should follow the chosen board; if so the key needs `boardId` and an invalidation here.
**Fix:** Add boardId to the sprint-issues key (if it should be board-scoped) and broaden invalidation, e.g. also `queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })`.

### WR-04: BoardPicker single-board auto-select uses a ref that survives prop changes — can skip re-selecting after the board list changes to a different single board

**File:** `taskflow/src/components/jira/BoardPicker.tsx:41-48`
**Issue:** `autoSelectedRef` guards against re-firing `onChange` for the same `singleBoardId`. That is correct for repeated renders. But the effect only fires `onChange` when `autoSelectedRef.current !== singleBoardId`. In Settings, the same `<BoardPicker>` instance is reused across project switches (it is not remounted — only `boards`/`value` props change). If project A resolves to single board id 5 (auto-selected, ref=5), then project B also resolves to a single board id 5 (same numeric id, different project), the effect sees `ref === singleBoardId` and never calls `onChange`, so `selectedBoardId` for project B may stay `null` / unwritten. Cross-project id collisions are unlikely but possible. Consider keying the auto-select on identity that changes per project, or reset the ref when `boards` reference changes.
**Fix:** Reset the guard when the board set changes, e.g. include the board list identity:
```ts
useEffect(() => {
  if (singleBoardId != null && value !== singleBoardId) onChange(singleBoardId);
}, [singleBoardId, value, onChange]);
```
(Drive off the actual `value` prop instead of a private ref so the effect self-corrects whenever the selection doesn't match the only board.)

### WR-05: `listProjectBoards` / `fetchBoardId` interpolate `projectKey` into the URL without encoding

**File:** `taskflow/src/services/jira/sprints.ts:32,76` (and legacy `jira.ts:1103`)
**Issue:** `projectKeyOrId=${projectKey}` is interpolated raw into the query string. Jira project keys are normally `[A-Z0-9]` so this is low-risk, but the value flows from user input in onboarding/Settings and `projectKeyOrId` also accepts numeric ids and arbitrary strings. An unencoded value containing `&`, `#`, or spaces would corrupt the query string and silently target the wrong board (or none). Sidebar.tsx:323 already uses `encodeURIComponent` defensively for project keys in URLs — be consistent here.
**Fix:**
```ts
`${base}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&type=scrum&maxResults=100`
```

## Info

### IN-01: `listProjectBoards` returns all scrum boards but never filters `type === 'scrum'` client-side and caps at 100 with no pagination

**File:** `taskflow/src/services/jira/sprints.ts:66-87`
**Issue:** The query already passes `&type=scrum`, so server-side filtering is correct. The `maxResults=100` cap is documented as intentional, but this is exactly the "fetch-one-capped-page" pattern flagged in MEMORY (mr-discussions-cap-20). A project with >100 boards would silently hide the real board. Acceptable as documented, but note the risk.
**Fix:** None required; document the cap in user-facing copy if board lists are ever expected to exceed 100.

### IN-02: Legacy `jira.ts` `fetchActiveSprint` passes wrong `apiFetch` label `'Discover Board'` for the sprint fetch

**File:** `taskflow/src/services/jira.ts:1118`
**Issue:** Step 2 (active sprint fetch) is labelled `'Discover Board'` — copy-paste from step 1. The sprints.ts copy correctly labels it `'Load Sprint Board'`. Mislabels devtools request logs.
**Fix:** Change the label to `'Load Sprint Board'` (or `'Load Active Sprint'`) to match sprints.ts.

### IN-03: `ConnectionsSection` board picker has no error/retry wiring while onboarding does

**File:** `taskflow/src/routes/settings/ConnectionsSection.tsx:219-226`
**Issue:** The Settings `<BoardPicker>` is rendered without `error`/`onRetry`. Board loading happens in a manual `useEffect` (lines 72-93) that swallows failures into `setBoards([])`, which BoardPicker renders as "nothing" (the zero-board fallback). A genuine fetch failure is indistinguishable from "project has no scrum boards," and there is no retry. Onboarding wires `onRetry={() => refetchBoards()}`. Inconsistent UX; a transient network error silently degrades to discovery-fallback with no user feedback.
**Fix:** Track an error state in the effect and pass `error`/`onRetry` to the Settings `<BoardPicker>`.

### IN-04: `jiraBoardIds` never pruned — entries persist for deleted/renamed projects

**File:** `taskflow/src/stores/auth.store.ts:123-124`
**Issue:** `setJiraBoardId` only ever adds/overwrites keys. There is no removal path, and `resetAuth` resets the whole map (fine). Over time the map accumulates board ids for projects the user no longer uses. Harmless (lookups are by active project key) but unbounded.
**Fix:** Optional — clear the entry when a project is disconnected/removed, or accept as negligible.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
