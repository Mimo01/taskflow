---
slug: sprint-board-hidden-stories
status: root_cause_found
trigger: "On sprint board and backlog view, I dont see some stories. The story has a custom 'code review' status (should be in 'in progress' column). There are more statuses. The custom statuses are probably not mapped correctly and are hidden after incorrectly mapped"
created: 2026-06-03
updated: 2026-06-03
---

# Debug Session: sprint-board-hidden-stories

## Symptoms

- **Expected behavior:** Stories with custom statuses (e.g. "Code Review") appear on the sprint board and backlog. "Code Review" should map into the "In Progress" column.
- **Actual behavior:** Stories with custom statuses are missing/hidden from both the sprint board and backlog view. Likely also other lists.
- **Error messages:** None reported (silent omission).
- **Timeline:** Unsure when it started; unclear if it ever worked correctly.
- **Reproduction:** Open sprint board or backlog; stories whose status is a custom (non-default) status do not show. Several custom statuses affected, not just "Code Review".

## Hypotheses (suspected)

- Custom Jira statuses are not mapped to a board column category, so the grouping logic drops issues whose status falls outside the known mapping. — ELIMINATED for TaskFlow code; CONFIRMED as the upstream Jira board-config mechanism.

## Current Focus

- hypothesis: GreenHopper excludes issues whose status is not assigned to any board column (the board's "Unmapped Statuses" bucket) BEFORE TaskFlow receives them. TaskFlow renders every issue it receives, so the hidden issues are never delivered.
- test: trace the issue-delivery path from GH fetch → adapter → column grouping for unmapped/custom statuses.
- expecting: no client-side status filter exists; unmapped categories default to a visible column; therefore the omission must happen server-side.
- next_action: confirm with user whether the custom statuses are mapped to columns in the Jira board configuration.
- reasoning_checkpoint: (none)

## Evidence

- timestamp: 2026-06-03 — `SprintBoardTab.tsx:57-69,368-369`: columns are the fixed trio To Do / In Progress / Done keyed by `statusCategory.key`; `categoryOf()` defaults a missing/unknown category to `'new'` (To Do) and column cells filter by `categoryOf(c) === col.key`. An unmapped status would land in a column, NOT be dropped. → board grouping does not hide custom statuses.
- timestamp: 2026-06-03 — `entityMaps.ts:47-70`: `resolveStatus` miss → `statusCategory.key: 'indeterminate'` (In Progress) + warn-once; `narrowStatusCategoryKey` coerces any non-standard category to `'indeterminate'`. Custom statuses always resolve to a visible category. → adapter/resolver layer does not hide custom statuses.
- timestamp: 2026-06-03 — `adapter.ts:69-160`: pure transform, no filtering; every input GhIssue/GhBoardIssue produces an output AdaptedIssue.
- timestamp: 2026-06-03 — `allData.ts` / `data.ts`: both fetchers are pure pass-through over GH `work/allData.json` and `plan/backlog/data.json`; they return `issuesData.issues` / backlog issues untouched.
- timestamp: 2026-06-03 — `useGhBacklogData.ts`: React Query cache wrapper only; no status filtering. Backlog issue list is whatever GH returns.
- timestamp: 2026-06-03 — `rg "statusIds|columnsData"` across all non-test ts/tsx: only matches in `types.ts:139-141` (the `columnsData.columns[].statusIds` type). The board column→status mapping is NEVER read by TaskFlow code. → TaskFlow does not filter issues by column mapping client-side.

## Eliminated

- TaskFlow board column grouping dropping unmapped statuses — eliminated (defaults to To Do / In Progress, never drops).
- TaskFlow adapter / status resolver dropping custom statuses — eliminated (unknown statuses coerced to `indeterminate`, still rendered).
- Client-side filtering of issues by board column `statusIds` — eliminated (`columnsData.statusIds` is typed but never read anywhere in app code).
- Fetch-once page-cap pitfall (per MEMORY) — not applicable here; GH allData/backlog endpoints return the full board payload, not a paginated/capped picker list.

## Round 2 — prior root cause REFUTED by user evidence

User supplied the live `allData.json`:
- status `10612` "Code Review" IS in `entityData.statuses`, `statusCategory.key: "indeterminate"` (→ In Progress).
- `columnsData` column 188 "In Progress" `statusIds` includes `10612` (it IS mapped — not in an unmapped bucket).
- The hidden issue IS present in `issuesData.issues[]` with `statusId: "10612"`.
- The hidden issue is a **top-level Story** (no parentId/parentKey), `done: false`.
- Project has a **single board**; the inspected `rapidViewId` **matches** the board the user works in.

→ The Round-1 root cause ("server-side unmapped-status exclusion") is FALSE: the issue is delivered.

## Round 2 evidence (code elimination of every status-based hide)

- `entityMaps.ts:60` resolveStatus("10612") → hit → name "Code Review", category "indeterminate". Renders.
- `adapter.ts:79` D-03 done-override is inert here (`done:false`) → category stays "indeterminate" (In Progress), NOT forced to Done.
- `SprintBoardTab.tsx:913-931` top-level story (subtask=false) → always its own swimlane; its single card lands in the In Progress column via `categoryOf`. Header always renders.
- `SprintBoardTab.tsx:935-966` auto-collapse needs `categoryOf==='done'` → does not apply (indeterminate); collapsed swimlanes still show their header anyway.
- `allData.ts` fetch is pure pass-through; `useGhAllData.ts:71` POLLS (`refetchInterval`) so stale cache self-heals.
- `filter.store.ts` is session-only, defaults all-empty; quick filters apply only on explicit click.
- `useBoardId`/`fetchBoardId` returns `values[0]` — irrelevant here (single board, rapidViewId matches).

→ CONCLUSION: there is NO code path that hides a top-level, non-done story with a resolvable custom status when no filter is active. The discrepancy is RUNTIME STATE, not logic.

## Current Focus (round 2)

- hypothesis: An ACTIVE SHARED FILTER (status / assignee / epic / applied quick-filter) in `useFilterStore` is excluding the custom-status stories. The store is shared by SprintBoardTab AND BacklogPage — which is exactly why BOTH views are affected and why the excluded set correlates with specific statuses/assignees. (Secondary, less likely given polling: a not-yet-refreshed cache.)
- test: in the live app — (1) check for active filter chips / click "Clear all"; (2) click "Reload board" / "Reload backlog".
- next_action: user runs the two runtime checks; if neither reveals the story, add a one-line diagnostic log in the `adaptedIssues` map to confirm whether the story KEY is present in the app's actual in-memory dataset (separates data-absent from render-dropped).

## Round 3 — runtime instrumentation (DECISIVE)

Added a temp diagnostic in SprintBoardTab adaptedIssues stage tracing ESHOP-19168
(status 10612 "Code Review", top-level Story, done:false, assignee ext99328
"MOZOLAK Milan OSK (ext.)", typeId 10001, epicId 354389). Live console output:

```
inRawIssues: false      // NOT in the app's allData.issuesData.issues
totalRaw: 185           // app received 185 issues
inAdapted: false
inStoryIssues: false
statusEntity: { statusName: "Code Review", ... }   // status entity IS present
typeEntity: undefined
```

→ TaskFlow's PAT-authenticated `work/allData.json` returns 185 issues and
ESHOP-19168 is NOT among them. The earlier full issue object the user pasted came
from the BROWSER-logged-in Jira session (user confirmed), NOT TaskFlow's request.
The "Code Review" filter option appears because it is sourced from the project
workflow-status list / entityData.statuses (which includes 10612), independent of
whether any rendered issue has that status — hence zero matches.

Temp diagnostic REMOVED after capture.

## Resolution

- root_cause: The hidden issues are omitted SERVER-SIDE from TaskFlow's
  PAT-authenticated GreenHopper response. TaskFlow renders every issue it receives
  (185/185) and maps "Code Review" (statusCategory indeterminate) correctly to the
  In Progress column — proven by live instrumentation (inRawIssues:false while the
  status entity is present). The discrepancy vs the user's browser view is an
  IDENTITY/PERMISSION scope difference between the Bearer PAT account and the
  browser-logged-in account. Two candidate mechanisms (Jira-side): (1) issue
  security level / browse-permission restriction on the affected issues that the
  PAT account cannot see; (2) the board's saved filter JQL resolving per-user
  (e.g. currentUser()/role-scoped). NOT a TaskFlow code bug; NOT unmapped statuses
  (refuted R2); NOT the orphan-subtask drop (refuted R3 — it's a top-level Story).
- fix: Jira-side. Verify the PAT identity (GET /rest/api/2/myself with the PAT) vs
  the browser account; then either (a) issue the PAT from / grant browse permission
  to an account that can see the restricted issues, or (b) adjust the issue security
  level / board saved-filter so the PAT account is in scope. No TaskFlow code change
  resolves a server-side omission (the client cannot surface issues it never receives).
- verification: after aligning the PAT account's permissions, reload board/backlog —
  totalRaw rises to include ESHOP-19168 and the story renders in In Progress.
- files_changed: none (temp diagnostic added and removed; SprintBoardTab.tsx restored).
