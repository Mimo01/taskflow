# Quick Task 261014-m6e: Prompt to move story to Done when last open subtask closes - Research

**Researched:** 2026-10-14
**Domain:** Jira DC workflow transitions, React Query, Base UI Dialog
**Confidence:** HIGH (codebase verified), with one MEDIUM assumption about the Jira payload (A1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Entry points:** Trigger from BOTH places that transition issues: Sprint Board (SprintBoardTab.tsx drag/transition via postTransition) and the issue-detail sidebar status field (FieldsSection.tsx transitionMutation). Share one helper/hook + one modal component; don't duplicate logic.
- **"Last open subtask" definition:** Every other sibling subtask has statusCategory=done after this transition. Fetch siblings fresh from the server (not stale cache — see memory: enrichment invalidation no-op / fetch-once pitfalls). Skip the prompt if the parent is already in a done category, or if the issue transitioned is not a subtask / has no parent.
- **Story move:** On "Yes", the modal ALWAYS lets the user pick among the parent story's done-category transitions (list from REST expand=transitions; honour fields.resolution requirement via existing resolution flow in FieldsSection / postTransition fields param). "No"/dismiss leaves the story untouched.

### Claude's Discretion
- Modal visual design (reuse existing dialog primitives), query invalidation details, test layout.

### Deferred Ideas (OUT OF SCOPE)
- None listed.
</user_constraints>

## Project Constraints (from memory/CLAUDE.md)
- There is no root `CLAUDE.md` with extra rules. These constraints come from MEMORY.md:
- Resolution is set ONLY through a transition POST with `fields.resolution`, never through a field PUT.
- Do not read status from a cached parent (memories: enrichment no-op, fetch-once). Check freshness on the server.
- The pre-commit hook runs the full vitest suite, so RED and GREEN go in one commit per tdd task. Biome lint blocks commits, so do not run `biome --write` across all of src.
- Base UI Select needs `items`. The recommended UI below uses buttons, not Select, so this rule does not come into play.
- Scrutinize executor deviations: production code must not be bent to satisfy test mocks.

## Summary

All the building blocks are already in place. `services/jira/transitions.ts` exports `fetchIssueTransitionsWithFields`, which calls REST `GET /issue/{key}/transitions?expand=transitions.fields` and returns `to.statusCategory` plus `fields.resolution`. The same file has `postTransition(base, token, key, id, fields?)`, which presence-checks `fields`, and the pure `resolveDropResolution(meta)`, which returns `dialog | block | plain`. `BoardResolutionDialog.tsx` is a presentational resolution picker that both the board and StatusPopover already use. The codebase has no helper that fetches a parent's subtasks fresh. `fetchEnrichedSubtasks` (services/jira.ts:1889) needs the subtask list as input, so it is the wrong shape for this.

Both entry points already know the parent. On the board, `localIssues[i].fields.parent?.key` and `fields.issuetype.subtask` are synthesized by the GH adapter (`greenhopper/adapter.ts:105-124`). In the sidebar, FieldsSection has `issue.fields.parent?.key` and `isSubtask = f.issuetype.subtask` (line 143). Both also know the previous status category: `originalIssue.fields.status.statusCategory.key` on the board, `f.status.statusCategory?.key` in the sidebar.

**Primary recommendation:** Add one pure-ish service function `checkParentCompletion(base, token, subtaskKey, parentKey)` in a NEW module. Add one hook/component pair, `useParentCompletionPrompt()` + `<CompleteParentDialog/>`, in a NEW file. Call `prompt.check(...)` after a successful `postTransition` in both `SprintBoardTab.handleTransition` (after line 1367) and FieldsSection's `transitionMutation.onSuccess`. The dialog fetches the parent's transitions, lists the done-category ones as buttons, routes each pick through `resolveDropResolution`, and then shows a resolution step when one is needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Fresh parent + sibling status check | API service (`services/jira/parentCompletion.ts`) | — | One network call, no React, unit-testable |
| Prompt state machine (closed → ask → pick transition → pick resolution) | Client hook + dialog component | — | Shared by board and sidebar per the locked decision |
| Executing the parent transition | Existing `postTransition` | `resolveDropResolution` | Reuse. Resolution goes only through a transition |
| Cache refresh after the parent moves | React Query invalidation | GH all-data invalidation | Same families that FieldsSection.onSettled already hits |

## Key Findings

### 1. Fresh "all done" check (no existing helper, so build one small one)
Recommended call: `GET /rest/api/2/issue/{parentKey}?fields=status,subtasks`.
- This is a single request. It reads the issue from the DB rather than the search index, so it has no JQL index lag right after the POST. A `parent = X` JQL search could still return the old status for the sibling that was just transitioned. [ASSUMED: Jira DC search index is near-real-time but not transactional]
- Logic:
  - If `parent.fields.status.statusCategory.key === 'done'`, skip the prompt.
  - Otherwise, set `others = subtasks.filter(s => s.key !== subtaskKey)`. The result is `others.every(s => s.fields.status.statusCategory?.key === 'done')`.
  - The just-transitioned subtask is treated as done by the caller's gate (see below), so this check does not depend on its echoed status.
- Return `{ shouldPrompt: boolean, parentKey, parentSummary, parentStatusId }`. `parentStatusId` is needed for `transitionsWithFieldsKey`.
- **Type gotcha:** `JiraIssueDetail.fields.subtasks[].fields.status` is typed `{ name: string }` only (types.ts:191-195). Declare a local response type with `statusCategory?: { key: string }`. Do not widen the shared type.
- **Missing-category handling:** If any sibling has no `statusCategory`, treat it as NOT done, which means no prompt. This fails safe.

**Caller gate (cheap, avoids an extra GET on every move):** Call `check` only when all three of these hold:
- The issue is a subtask with a parent key.
- The target category is `'done'`.
- The previous category was not `'done'`. A done→done move such as Resolved→Closed should not re-prompt.

Where the target category comes from:
- Board: `toStatusCategoryKey` is already a parameter of `handleTransition`.
- Sidebar: `StatusPopover.onSelect(transitionId, toStatusName, opts?)` does not pass the category today. Extend it with an optional 4th arg `toStatusCategoryKey`. `transition.to.statusCategory?.key` is already in scope at StatusPopover.tsx `handleSelect`/the button map. The optional arg keeps existing callers compatible. Alternatively, skip the target-category gate in the sidebar and rely on the fresh fetch, which would also need the subtask's own status checked from the payload. The extension is cleaner.

### 2. Dialog / resolution flow to reuse
- Primitives: `@/components/ui/dialog` (`Dialog, DialogContent showCloseButton={false}, DialogHeader/Title/Description, DialogFooter, DialogClose render={<Button variant="outline"/>}`). The canonical shape is in `components/ui/confirm-sprint-move-dialog.tsx`. Use controlled `open/onOpenChange`.
- `BoardResolutionDialog` (routes/dashboard/BoardResolutionDialog.tsx) is purely presentational: `open, onOpenChange, issueKey, toStatusName, allowedValues, onConfirm(resolution|null), isPending`. Reuse it for the resolution step and key it by `parentKey` (CR-02 pattern).
- Recommended `CompleteParentDialog` steps:
  1. **Ask:** "All subtasks of {PARENT} are done. Move {PARENT} to done too?" with [Not now] [Choose status…].
  2. **Pick:** Fetch `queryClient.fetchQuery({ queryKey: transitionsWithFieldsKey(parentKey, base, parentStatusId), queryFn: fetchIssueTransitionsWithFields(...) })`. Filter to `t.to.statusCategory?.key === 'done'` and render each as a button with `statusPillClass('done')`, the same as the StatusPopover rows. Always show this list, even when it has only one entry (locked). If the list is empty, show "No done transition available from {status}".
  3. On pick, run `resolveDropResolution(meta)`:
     - `dialog`: render `BoardResolutionDialog`. Confirm calls `postTransition(..., { resolution })`.
     - `block`: show the inline error used by StatusPopover WR-05 and fire nothing.
     - `plain`: call `postTransition(...)` with no fields.
- The dialog chain can live in a single component. Swap the content by step, or render BoardResolutionDialog in place of the main dialog. Do not nest two open Base UI dialogs.

### 3. Integration points & gotchas
- **SprintBoardTab.handleTransition (line 1316):** Add the check inside the `try` after `postTransition` succeeds. Only `handleTransition` runs the POST, and both `beginTransition` (drag/context menu) and `handleResolutionConfirm` route through it, so one hook covers every board path. Render `<CompleteParentDialog>` next to the existing `BoardResolutionDialog` (line ~1874). Pass `jiraToken`/`jiraBaseUrl` from the existing locals.
- **FieldsSection.transitionMutation (line 336):** Add `onSuccess`. The current code only has `onSettled`. Carry `fromCategory` and `toCategory` in the mutation variables, and capture `fromCategory` from `f.status.statusCategory?.key` BEFORE the optimistic update. That update only changes `name`, but capturing first is still the safe order. `resolutionTransitionMutation` (line 432) is an in-place loop that does not change status, so it does NOT trigger the check.
- **Parent-move invalidation:** Mirror FieldsSection's `onSettled` list for `parentKey`:
  - `['jira-issue-detail', parentKey, base]`, `['jira-issue-changelog', parentKey, base]`, `['jira-issue-transitions-fields', parentKey]`, `['jira-parent-detail', parentKey]`.
  - Prefix families: `['jira-subtask-enrichment']`, `['jira-epic-stories']`, `['jira-issues']`, `['jira-epics-basic']`, `['jira-fixversion-issues']`, `['jira-version-counts']`.
  - `invalidateGhAllData(qc, boardId)` and `invalidateGhBacklogData(qc, boardId)`.
  - Recommended: extract `invalidateAfterTransition(qc, issueKey, base, boardId?)` into the new module and use it there. Refactoring the two existing call sites is optional, so keep the diff scoped.
- **Board optimistic state:** The board re-seeds `localIssues` from gh-all-data (`setLocalIssues(data ?? [])`, line 1039), so invalidating gh-all-data refreshes the story card. No manual optimistic patch is needed for the parent.
- **Stale-drag token:** `handleTransition` is async and the check adds another await. If a second card's prompt is pending, drop the new prompt rather than clobbering it, the same rule as `pendingResolution`.
- **Shared key factory:** Use `transitionsWithFieldsKey` with the parent's CURRENT status id. Never hand-build the key (CR-01/WR-04).
- **Test-mock trap (important):** `SprintBoardTab.test.tsx` (line ~133) and `FieldsSection.test.tsx` (line 64) `vi.mock('@/services/jira/transitions', () => ({...}))` with a full factory. Any NEW export added to `transitions.ts` would be `undefined` in those suites and crash them. Put `checkParentCompletion`/`invalidateAfterTransition` in a new module (e.g. `services/jira/parentCompletion.ts`) and `vi.mock` it in both existing suites. Default it to `{ shouldPrompt: false }` so existing assertions are untouched. FieldsSection.test also mocks `../StatusPopover`, so the extended `onSelect` signature needs no mock change.
- `jira.ts` dual-file memory: transitions are already canonical in `services/jira/transitions.ts`. Import from `@/services/jira/transitions` and the new module directly, not from legacy `jira.ts`.

## Don't Hand-Roll
| Problem | Use Instead |
|---|---|
| Resolution decision | `resolveDropResolution(meta)` |
| Resolution picker UI | `BoardResolutionDialog` |
| Transition POST incl. `{resolution:null}` | `postTransition` (presence-checked `fields`) |
| Transitions-with-fields cache key | `transitionsWithFieldsKey` |
| GH board refresh | `invalidateGhAllData` / `invalidateGhBacklogData` |

## Common Pitfalls
1. **Reading sibling status from cache** (`jira-subtask-enrichment`, the parent's `jira-issue-detail`): these are stale right after a transition. Always fetch fresh.
2. **Search-index lag** if you use JQL `parent = X`. Prefer the issue GET.
3. **Re-prompting on done→done moves.** Gate on `fromCategory !== 'done'`.
4. **Prompt on failed transition.** Check only after the POST resolves. On the board that means inside the `try` after `await postTransition`, never in the `catch`.
5. **Double Base UI dialogs open at once.** Close the ask/pick dialog before opening the resolution step.
6. **Parent may be an Epic-child Story without permission to transition.** A 400 from `postTransition` should show an error in the dialog, not throw unhandled.

## Assumptions Log
| # | Claim | Risk if Wrong |
|---|---|---|
| A1 | Jira DC `GET /issue/{key}?fields=subtasks` returns each subtask's `fields.status.statusCategory.key` | Check always returns "not done", so the prompt never shows. Mitigation: verify live once. Fallback is a JQL `key in (siblings)` search with `fields=status` (the fetchEnrichedSubtasks pattern), which returns full status objects |
| A2 | REST transitions payload includes `to.statusCategory.key` | The done filter would yield an empty list. The type already declares it optional, and StatusPopover/board already rely on it for pills |
| A3 | JQL search index may lag the POST by a moment | Only affects the JQL fallback |

## Validation Architecture
- Framework: vitest 4 (`taskflow/package.json` `"test": "vitest run"`).
- Quick run: `cd taskflow && npx vitest run src/services/jira/parentCompletion.test.ts src/routes/dashboard/CompleteParentDialog.test.tsx`
- Full suite: `cd taskflow && npm test`. The pre-commit hook runs this anyway.

| Behavior | Test | File |
|---|---|---|
| Parent done → no prompt. Any sibling not done → no prompt. All others done → prompt. Missing category → no prompt | unit (mock `apiFetch`) | NEW `services/jira/parentCompletion.test.ts` |
| Dialog lists only done-category transitions. plain → `postTransition` without fields. dialog → resolution step → `postTransition` with `{resolution}`. block → error, no POST. "Not now" → no POST | component | NEW `routes/dashboard/CompleteParentDialog.test.tsx` |
| Board: subtask drag into done whose parent qualifies → dialog shown. Non-subtask → `check` not called | integration | extend `SprintBoardTab.test.tsx` (mock new module) |
| Sidebar: subtask transition success → `check` called with parent key. Failure → not called | integration | extend `issue-detail/FieldsSection.test.tsx` (mock new module) |

## Security Domain
No new auth surface. The existing PAT (`readSecret('jira-pat')`) and `apiFetch` are reused. Input is the server-provided issue keys only. Keys interpolated into URLs come from Jira payloads. Match existing practice of no encoding for keys.

## Sources
- Codebase (VERIFIED by read): `src/services/jira/transitions.ts`, `src/services/jira/types.ts:133-142,180-205`, `src/services/jira.ts:1889-1990`, `src/routes/dashboard/{SprintBoardTab,StatusPopover,BoardResolutionDialog}.tsx`, `src/routes/dashboard/issue-detail/FieldsSection.tsx:200-480`, `src/routes/dashboard/IssueDetailView.tsx:160-195`, `src/components/ui/confirm-sprint-move-dialog.tsx`, `src/services/jira/greenhopper/adapter.ts:99-146`, test mocks in `SprintBoardTab.test.tsx` / `FieldsSection.test.tsx`.
- No packages installed, so no legitimacy audit is needed.
