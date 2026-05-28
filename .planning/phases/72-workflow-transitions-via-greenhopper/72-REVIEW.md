---
phase: 72-workflow-transitions-via-greenhopper
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - taskflow/src/routes/dashboard/BulkActionBar.test.tsx
  - taskflow/src/routes/dashboard/BulkActionBar.tsx
  - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
  - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx
  - taskflow/src/routes/dashboard/QuickCreateInput.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/StatusPopover.test.tsx
  - taskflow/src/routes/dashboard/StatusPopover.tsx
  - taskflow/src/routes/dashboard/TaskRow.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/services/jira.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira/greenhopper/entityMaps.ts
  - taskflow/src/services/jira/greenhopper/transitions.test.ts
  - taskflow/src/services/jira/greenhopper/transitions.ts
  - taskflow/src/services/jira/greenhopper/warnOnce.test.ts
  - taskflow/src/services/jira/greenhopper/warnOnce.ts
  - taskflow/src/services/jira/statuses.test.ts
  - taskflow/src/services/jira/statuses.ts
  - taskflow/src/services/jira/transitions.test.ts
  - taskflow/src/services/jira/transitions.ts
  - taskflow/src/services/jira/types.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 72: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 72 swaps the per-issue REST `/transitions` GET path for a project-scoped GreenHopper envelope cache. The new module `services/jira/greenhopper/transitions.ts` is well-structured, with a clean two-layer cache (envelope + per-type adaptation), an imperative twin (`getGhTransitions`), a sync peek (`peekGhTransitions`), and an invalidation helper. Tests for the new surface are comprehensive.

Three defects stand out:
1. **Critical:** Bulk-action combined-mode (status + assignee/priority) double-counts successes and never increments completed/succeeded on the secondary pass — the final progress summary surfaces wrong totals to the user.
2. **Warning (duplication):** Two `postTransition` definitions now exist (`services/jira.ts:695` and `services/jira/transitions.ts:15`); call sites import inconsistently. The legacy one is dead-code candidate per Phase 72 GH-CUT-01 intent.
3. **Warning (type contract):** `JiraTransition` is duplicated in both `src/services/jira/types.ts` (no `fromStatusId`) and `src/services/jira.ts:193` (with `fromStatusId`). The greenhopper adapter imports the latter; the former is now wrong and any consumer that imports from `types.ts` will silently lose the new field.

Several smaller robustness gaps around input validation, env-derived numeric coercion, and warn-once test coverage are noted under Warnings/Info.

## Critical Issues

### CR-01: BulkActionBar combined-mode (status + assignee/priority) loses progress counters and double-counts

**File:** `taskflow/src/routes/dashboard/BulkActionBar.tsx:274-312`
**Issue:** When `targetStatus !== null` AND (`targetAssignee !== null` || `targetPriority !== null`), the secondary `parallelBatch` over `fieldKeys` only pushes to `failures` on error; it never increments `completed`, `succeeded`, or `failed`. As a result:
  - The final `setProgress({ total, completed: total, succeeded, failed, failures })` at line 314 reports `succeeded` from the status pass even when the subsequent assignee/priority pass failed for the same key. The user sees a key marked "succeeded" while the failures list also contains it — contradictory and misleading.
  - `failed` is not incremented for the secondary failures, so `succeeded + failed > total` becomes possible and the progress indicator math is wrong.
  - If status was attempted but `failures` already contains the key, the secondary still runs against `fieldKeys = keys.filter(k => !failures.some(f => f.key === k))` — correct gate — but failures from the secondary are never reflected in the counters.

Additionally, when `targetStatus === null && targetAssignee !== null && targetPriority !== null`, only the assignee branch runs (line 211 `if (targetStatus === null)` then line 244 `if (targetStatus === null && targetAssignee === null)` — the priority branch's guard excludes the assignee-set case). Priority is silently dropped in that scenario.

**Fix:** Unify the per-key work into a single async function that runs all selected mutations sequentially per key, then drive `parallelBatch` once with proper success/fail accounting. Sketch:
```ts
const ops = (key: string) => async () => {
  const issue = issues.find((i) => i.key === key);
  if (!issue) throw new Error(`Issue ${key} not in selection`);
  if (targetStatus !== null) {
    const transitions = await getGhTransitions(queryClient, jiraBaseUrl, jiraToken,
      Number(issue.fields.project?.id ?? 0), issue.fields.issuetype?.id ?? '');
    const t = transitions.find((x) => x.to.name.toLowerCase() === targetStatus.toLowerCase());
    if (!t) throw new Error(`No transition to "${targetStatus}"`);
    await postTransition(jiraBaseUrl, jiraToken, key, t.id);
  }
  if (targetAssignee !== null) {
    await updateIssueField(jiraBaseUrl, jiraToken, key, 'assignee', { name: targetAssignee });
  }
  if (targetPriority !== null) {
    await updateIssueField(jiraBaseUrl, jiraToken, key, 'priority', { name: targetPriority });
  }
};
await parallelBatch(keys, (k) => ops(k)(), 5, (result) => {
  completed++; if (result.ok) succeeded++; else { failed++; failures.push(...); rollbackIssue(result.item); }
  setProgress({ total, completed, succeeded, failed, failures: [...failures], isComplete: false });
});
```

## Warnings

### WR-01: Duplicate `postTransition` definitions invite drift

**File:** `taskflow/src/services/jira.ts:695-728` and `taskflow/src/services/jira/transitions.ts:15-48`
**Issue:** Two implementations of `postTransition` exist with subtly different error wrapping:
  - `jira.ts:695` — wraps non-ApiError throw paths with `Cannot reach ${baseUrl}` for all non-401/403 statuses.
  - `jira/transitions.ts:15` — same shape but doc-comments claim the legacy path was removed in Phase 72 GH-CUT-01.

Call sites are split: `BulkActionBar`, `QuickCreateInput`, `SprintBoardTab` import from `@/services/jira` (legacy); `FieldsSection.tsx:34` imports from `@/services/jira/transitions`. Either implementation could diverge silently. Per the Phase 72 "jira.ts dual-file gotcha" memory note, this is exactly the substrate-drift pattern flagged previously.

**Fix:** Pick one as canonical (the modular `jira/transitions.ts` per Phase 72 intent), have `jira.ts` either re-export it or remove the duplicate definition, and update all call sites to one import path.

### WR-02: `JiraTransition` type duplicated; `types.ts` version is missing `fromStatusId`

**File:** `taskflow/src/services/jira/types.ts:76-84` vs `taskflow/src/services/jira.ts:193-208`
**Issue:** `types.ts` exports a `JiraTransition` without `fromStatusId`. The greenhopper adapter (`services/jira/greenhopper/transitions.ts:38`) imports `JiraTransition` from `'../../jira'` (i.e. `services/jira.ts`) which has the field. Any consumer that imports from `services/jira/types` (the documented "single source of truth") will get the wrong shape and `filterTransitionsForStatus` results will not type-check correctly when assigned into `types.ts`-typed slots. This is silent drift waiting to cause a downstream bug.

**Fix:** Add `fromStatusId?: string` to `types.ts:76-84` and have `jira.ts` re-export from `types.ts` rather than re-declaring.

### WR-03: `Number(issue.fields.project?.id ?? 0)` silently maps "missing project id" to projectId=0

**File:** `taskflow/src/routes/dashboard/TaskRow.tsx:112`, `taskflow/src/routes/dashboard/SprintBoardTab.tsx:731,741,762`, `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:377`, `taskflow/src/routes/dashboard/BulkActionBar.tsx:169`
**Issue:** When `fields.project` is absent (legacy fixtures or any search where `project` was not in `fields=`), `projectId` collapses to `0`. The GH cache key then becomes `['gh-transitions-envelope', 0]` and `__indexTransitions` warns "no workflow for 0:xxx" once per type — but transitions silently return `[]` (warn-once), so the StatusPopover and bulk actions silently render no options. The user sees an empty popover with no error indicator. `useGhTransitions` is gated on `Number.isFinite(projectId)`, which `0` passes, so the bad request still fires.

**Fix:** Gate downstream calls on a real project id and surface an explicit "missing project context" error when absent. E.g. in `getTransitions` / StatusPopover, treat `pid === 0` as `undefined` and render a tooltip explaining the field needs to be in the search payload. The `SprintBoardTab` sentinel hook at line 733 should also early-return when `sentinelProjectId === 0`.

### WR-04: `QuickCreateInput.handleSubmit` swallows transition failure as creation failure

**File:** `taskflow/src/routes/dashboard/QuickCreateInput.tsx:50-81`
**Issue:** The try block covers `createIssue` AND `postTransition`. If `createIssue` succeeds but `postTransition` throws (or `getGhTransitions` throws on auth bounce), the user sees a generic error and may retry — but the issue was already created in Jira's default status. The component never calls `onCreated()` so the board does not refresh, and the user has no idea the issue was created. Worst case: repeated retries produce N duplicate issues.

**Fix:** Wrap `getGhTransitions` + `postTransition` in their own try/catch that calls `onCreated()` regardless and surfaces a softer notice ("Issue created but couldn't move it to {column}").
```ts
const { key: newKey } = await createIssue(...);
try {
  const transitions = await getGhTransitions(...);
  const t = transitions.find((tr) => tr.to.id === statusId);
  if (t) await postTransition(jiraBaseUrl, jiraToken, newKey, t.id);
} catch (err) {
  setError(`Created ${newKey} but couldn't move it: ${err instanceof Error ? err.message : 'unknown'}`);
}
setValue('');
setIsOpen(false);
setIsSubmitting(false);
onCreated();
```

### WR-05: `useGhTransitions` `useEffect` does not re-fire when `readSecret` changes

**File:** `taskflow/src/services/jira/greenhopper/transitions.ts:291-303`
**Issue:** The token-loading `useEffect` has an empty dependency array `[]`. If the user logs out and back in (Stronghold secret rotated), the hook continues to use the stale token captured at mount. Auth bounces ("Invalid token") will repeat with the dead value because the effect never re-reads. The same applies even on re-mount when the read failed first time — `cancelled` only protects against late resolution, not against subsequent rotations.

**Fix:** Either subscribe to the auth store's "connected at" timestamp or re-read on focus events. Minimum: include `jiraBaseUrl` in the dep list so the token re-reads when the user switches instances.

### WR-06: `__adaptToJiraTransition` casts `gh.fromStatusId` through `undefined` check that incorrectly treats null and 0

**File:** `taskflow/src/services/jira/greenhopper/transitions.ts:133-134`
**Issue:** `gh.isGlobal || gh.fromStatusId === undefined ? undefined : String(gh.fromStatusId)` only checks `=== undefined`. If the GreenHopper payload returns `fromStatusId: null` (some Jira DC versions do, per RESEARCH §Pitfall 4 history), the adapter passes `String(null)` = `"null"` as `fromStatusId`. `filterTransitionsForStatus` then never matches it and the transition is silently hidden from every status.

**Fix:** Use `== null` (covers both null and undefined) or coerce defensively:
```ts
const fromRaw = gh.fromStatusId;
const fromStatusId = gh.isGlobal || fromRaw == null ? undefined : String(fromRaw);
```

## Info

### IN-01: `transitions.ts:31` empty dep array marked silent by biome — but jiraBaseUrl is captured

**File:** `taskflow/src/services/jira/greenhopper/transitions.ts:303`
**Issue:** Comment-free empty deps `[]` will fail react-hooks/exhaustive-deps lint absent a `biome-ignore`. May currently compile because biome's rule is permissive vs. ESLint. Document the intent ("read secret once at mount") or add `biome-ignore`.

### IN-02: Magic number `HEADER_HEIGHT = 37` embedded in scroll math

**File:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx:262`
**Issue:** Hard-coded pixel value. If `StoryHeaderRow` styling changes (density-comfortable/compact mode is already in the codebase), this drifts and the push-out animation jumps. Pull from `getBoundingClientRect()` of the inner ref instead.

### IN-03: Inline `commentCount > 99 ? '99+'` magic — minor, but a top-level constant clarifies intent

**File:** `taskflow/src/routes/dashboard/TaskRow.tsx:164`
**Issue:** `> 99 ? '99+'` is fine but adopting `const MAX_COMMENT_BADGE = 99` (also used by the badge size class) reads cleaner.

### IN-04: `transitions.test.ts` does not assert `fromStatusId` is preserved

**File:** `taskflow/src/services/jira/greenhopper/transitions.test.ts:236-280`
**Issue:** Both `__adaptToJiraTransition` cases use `toEqual` and Vitest treats `{ fromStatusId: undefined }` as equal to a missing key. There is no positive assertion that a non-global GH transition with a real `fromStatusId` produces a stringified `fromStatusId` on the output. Add a case covering `isGlobal: false, fromStatusId: 7` → output `fromStatusId === '7'` to lock down the WR-06 behavior.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
