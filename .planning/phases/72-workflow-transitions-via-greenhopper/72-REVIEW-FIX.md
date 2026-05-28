---
phase: 72-workflow-transitions-via-greenhopper
fixed_at: 2026-05-29T00:00:00Z
review_path: .planning/phases/72-workflow-transitions-via-greenhopper/72-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 72: Code Review Fix Report

**Fixed at:** 2026-05-29
**Source review:** `.planning/phases/72-workflow-transitions-via-greenhopper/72-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (1 Critical, 6 Warnings — Info skipped by default scope)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: BulkActionBar combined-mode (status + assignee/priority) loses progress counters and double-counts

**Files modified:** `taskflow/src/routes/dashboard/BulkActionBar.tsx`
**Commit:** `7dd2eb25`
**Applied fix:** Replaced the four-branch parallelBatch dispatch with a single per-key `applyOps` that runs status → assignee → priority sequentially per key. Counters increment exactly once per key; any per-key error short-circuits into the failure path and rollback. The dropped "status=null, assignee=set, priority=set" case is also fixed (priority used to be silently skipped). **Requires human verification of progress-UI behavior under mixed success/failure across multiple fields.**

### WR-01: Duplicate `postTransition` definitions invite drift

**Files modified:** `taskflow/src/services/jira.ts`
**Commit:** `7bd3c5b1`
**Applied fix:** Removed the duplicate `postTransition` definition in `services/jira.ts` and replaced it with `export { postTransition } from './jira/transitions';`. All legacy `@/services/jira` import sites (BulkActionBar, QuickCreateInput, SprintBoardTab) continue to resolve through the re-export; FieldsSection's direct `@/services/jira/transitions` import now points at the same canonical function.

### WR-02: `JiraTransition` type duplicated; `types.ts` version is missing `fromStatusId`

**Files modified:** `taskflow/src/services/jira/types.ts`
**Commit:** `48151bce`
**Applied fix:** Added `fromStatusId?: string` to the canonical `JiraTransition` interface in `services/jira/types.ts` with a comment pointing at the legacy re-declaration in `services/jira.ts` so they stay in sync. (Not collapsing one into the other in this iteration — both files re-declare the type historically; a follow-up could have `jira.ts` re-export from `types.ts`.)

### WR-03: `Number(issue.fields.project?.id ?? 0)` silently maps "missing project id" to projectId=0

**Files modified:** `taskflow/src/services/jira/greenhopper/transitions.ts`, `taskflow/src/routes/dashboard/StatusPopover.tsx`
**Commit:** `c96dedd9`
**Applied fix:** Centralized the guard in the cache layer:
- `getGhTransitions` throws a typed "Missing project context" error when `projectId <= 0` or `issueTypeId` is empty.
- `peekGhTransitions` returns `undefined` (so render paths show their loading affordance, not an empty popover).
- `useGhTransitions` enables only when `projectId > 0 && !!issueTypeId`.
- `StatusPopover` surfaces "Missing project context — reload the board." when `projectId === 0 || !issueTypeId`, replacing the silent empty popover.

### WR-04: `QuickCreateInput.handleSubmit` swallows transition failure as creation failure

**Files modified:** `taskflow/src/routes/dashboard/QuickCreateInput.tsx`
**Commit:** `6bc87fb7`
**Applied fix:** Split the single try block into two. `createIssue` failures abort and keep the input open for retry. `getGhTransitions`/`postTransition` failures now show a softer "Created {key} but couldn't move it to {statusName}: {err}" notice, still reset the input, and call `onCreated()` so the board refreshes. Eliminates the duplicate-issue risk from retry-on-transition-error.

### WR-05: `useGhTransitions` `useEffect` does not re-fire when `readSecret` changes

**Files modified:** `taskflow/src/services/jira/greenhopper/transitions.ts`
**Commit:** `11570c88`
**Applied fix:** Added `jiraBaseUrl` to the token-loading effect's dep array so the secret re-reads when the user logs out/in or switches Jira instances. Comment documents the rationale.

### WR-06: `__adaptToJiraTransition` casts `gh.fromStatusId` through `undefined` check that incorrectly treats null and 0

**Files modified:** `taskflow/src/services/jira/greenhopper/transitions.ts`
**Commit:** `11570c88`
**Applied fix:** Replaced the strict `=== undefined` check with `== null` (covers both `null` and `undefined`) using a `fromRaw` local. Comment notes the Jira DC null-emission case from RESEARCH §Pitfall 4. Co-committed with WR-05 since both touch the same file.

## Verification Performed

- Tier 1 (re-read): every modified file re-read after edit; surrounding code intact.
- Tier 2 (TypeScript): `npx tsc --noEmit` reported no errors in the modified files for each fix (BulkActionBar, QuickCreateInput, StatusPopover, services/jira.ts, services/jira/types.ts, services/jira/greenhopper/transitions.ts).
- Tier 3 not needed — all files are TypeScript/TSX.

## Out-of-Scope Findings (Info)

The following Info-tier findings were intentionally NOT fixed (scope = critical_warning):

- IN-01: empty dep array biome lint note in `transitions.ts:303`
- IN-02: magic number `HEADER_HEIGHT = 37` in `SprintBoardTab.tsx:262`
- IN-03: inline `commentCount > 99 ? '99+'` in `TaskRow.tsx:164`
- IN-04: missing positive-case assertion for `fromStatusId` in `transitions.test.ts`

IN-04 is particularly worth adding in a follow-up — it positively locks down the WR-06 behavior that this iteration just corrected.

## Notes for Verifier

- **CR-01 requires human UAT** of the progress UI under mixed success/failure with status + secondary fields. The structural fix is sound (TypeScript-clean, single-pass dispatch) but progress-counter semantics under partial failure are a logic concern that automated checks cannot certify.
- Existing tests for `BulkActionBar`, `StatusPopover`, `QuickCreateInput` were NOT re-run by the fixer (per per-fix verification policy — the verifier phase runs full suites). Watch for test updates if behavioral expectations were asserted against the old four-branch dispatch in `BulkActionBar.test.tsx`.

---

_Fixed: 2026-05-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
