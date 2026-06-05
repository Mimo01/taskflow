---
phase: 260605-hx2-add-resolution-field-control-to-issue-de (rework)
reviewed: 2026-06-05T12:15:15Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - taskflow/src/routes/dashboard/StatusPopover.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/services/jira/transitions.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/StatusPopover.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
  - taskflow/src/services/jira/transitions.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 260605-hx2: Code Review Report (rework)

**Reviewed:** 2026-06-05T12:15:15Z
**Depth:** quick (escalated to standard reads for the in-scope files)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope: the resolution-via-transition rework. The core primitives are mostly sound:

- `postTransition()` uses a correct **presence check** (`fields !== undefined`), so `{ resolution: null }` (clear) survives and no-fields callers still emit exactly `{ transition: { id } }`. Verified by both the code (transitions.ts:34) and the dedicated tests (transitions.test.ts:60-77). Good.
- `fetchIssueTransitionsWithFields()` has correct auth (Bearer), correct expand query, and a 401/403→`ApiError` / other→generic `Error` envelope mirroring `fetchResolutions`. Query keys are shared between StatusPopover and FieldsSection (`['jira-issue-transitions-fields', issueKey, jiraBaseUrl]`), enabling cache reuse. Good.
- The in-place loop transition gating (`to.id === f.status.id && t.fields?.resolution`) and the "no optimistic status change" property for the resolution mutation are implemented as specified.

However, there is one BLOCKER in the in-place resolution mutation (missing optimistic update + error rollback combined with broad cache invalidation produces a confusing revert/flicker and, more importantly, the success path never reflects the new resolution until a network round-trip — and on error there is no inline revert of any optimistic state because there is none, but the `value` binding can desync). The more serious correctness problem is the **null-clear path is unreachable from the UI given the gating**, plus several stale-gating / UX-correctness warnings. Details below.

## Critical Issues

### CR-01: In-place resolution mutation has no optimistic update AND no `f.resolution` refresh guarantee — Select value desyncs / stale gating after a real status transition

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:158-175, 329-359`

**Issue:** The `transitionsWithFieldsQuery` uses `staleTime: Infinity` and is keyed only on `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]` — it is **not** keyed on the current status id (`f.status.id`). The set of available transitions (and therefore which one is the "in-place" loop) is a function of the issue's current status. After a real status transition via `StatusPopover` (which changes `f.status.id`), `resolutionTransitionMutation.onSettled` invalidates `['jira-issue-detail', ...]` but does **not** invalidate `['jira-issue-transitions-fields', ...]`. Neither does `transitionMutation.onSettled` (lines 298-310). With `staleTime: Infinity` and no invalidation, the cached transitions-with-fields are reused against a **new** status id.

Consequence: `inPlaceResolutionTransition` is computed as `data.find(t => t.to.id === f.status.id ...)`. After a status change, `f.status.id` updates (via issue-detail invalidation) but the cached transition list still reflects the *old* status's transitions. The found transition's `id` may now be invalid for the new status, so `handleResolutionSelect` will `postTransition(... inPlaceResolutionTransition.id ...)` against a transition the workflow no longer offers → Jira 400/404, surfaced only as a generic inline "Failed to set resolution". This is the exact "race/stale gating after a real status transition" the rework was supposed to guard. It is not guarded.

**Fix:** Invalidate the shared transitions-with-fields key whenever status changes, and key the query on status id so the cache cannot be reused across statuses:

```ts
// In BOTH transitionMutation.onSettled and resolutionTransitionMutation.onSettled:
queryClient.invalidateQueries({ queryKey: ['jira-issue-transitions-fields', issueKey, jiraBaseUrl] });

// And key the query on the current status id so a stale list can never gate a new status:
queryKey: ['jira-issue-transitions-fields', issueKey, jiraBaseUrl, f.status.id],
```

(Note: StatusPopover.tsx:91 must adopt the same key shape, or the "shared cache key" claim in the comments breaks. See WR-04.)

## Warnings

### WR-01: Null-clear path is effectively unreachable from the FieldsSection UI

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:351-359, 530, 544-546`

**Issue:** `handleResolutionSelect` maps `__unresolved__` → `resolution: null` and `postTransition(..., { resolution: null })` is correctly built. But the `__unresolved__` option is only rendered when `!inPlaceResolutionTransition.fields?.resolution?.required` (line 544). The whole Select branch is also gated on `resolutionAllowedValues.length > 0` (line 530). For a typical Jira "Resolve"-style loop transition, `resolution` is `required: true`, so the clear option never renders. There is therefore no UI affordance to clear a resolution in the common case, even though the supporting code exists and is tested at the unit level. If clearing is a product requirement, the gating defeats it; if it is not, the null path / test is dead surface.

**Fix:** Decide intent. If clearing should be possible, render the Unresolved option independent of the transition's `required` flag (clearing a resolution and setting one are different operations and Jira often permits an "Abort/Reopen"-style loop). If not required, drop the null-clear code path and its test to avoid implying capability that the UI never exposes.

### WR-02: `handleResolutionSelect` guard `if (!value ...)` blocks legitimate selections and conflicts with the null-clear intent

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:351-354`

**Issue:** `handleResolutionSelect(value: string | null)` early-returns `if (!value || !inPlaceResolutionTransition)`. The `__unresolved__` sentinel is a truthy string so it passes, then maps to null — OK. But this guard means an empty-string value (the Select's placeholder `value=""`) is silently ignored, which is fine, yet it also couples "no transition" and "no value" into one branch with no user feedback. More importantly the comment at WR-01 shows the only path to `null` is the sentinel; a real `value === null` argument can never occur, so `!value` covering `null` is dead defensiveness that obscures the actual control flow.

**Fix:** Tighten to `if (!inPlaceResolutionTransition) return; if (value === '' ) return;` and handle the sentinel explicitly so the clear path is unambiguous.

### WR-03: Select `value={f.resolution?.id ?? ''}` can reference an id absent from `allowedValues`

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:533, 547-551`

**Issue:** The Select's controlled `value` is the issue's *current* resolution id, but the options rendered are the transition's `allowedValues`. A transition's allowed resolution set is not guaranteed to contain the issue's currently-set resolution (e.g. a resolution that has since been disabled, or a different scheme). When `f.resolution.id` is not in `allowedValues`, the controlled Select has a value with no matching option — base-ui Select will render an empty/blank trigger, misrepresenting current state to the user. This is a display-correctness bug, not just cosmetic, because the user may believe the field is unresolved when it is not.

**Fix:** Either include the current resolution as a synthetic option when missing, or drive the trigger label from `f.resolution?.name` independently of the option list (e.g. via `SelectValue` placeholder fallback) so the displayed state always matches the issue.

### WR-04: Shared query-key claim is fragile — StatusPopover and FieldsSection keys must stay identical, but CR-01's fix risks divergence

**File:** `taskflow/src/routes/dashboard/StatusPopover.tsx:91` and `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:159`

**Issue:** Both files hardcode `['jira-issue-transitions-fields', issueKey, jiraBaseUrl]` independently. Nothing enforces they match — a future edit to one (including the CR-01 fix that should add `f.status.id`) silently breaks cache sharing, causing a duplicate network fetch and, worse, two diverging gating computations. There is no shared constant or factory.

**Fix:** Extract a `transitionsWithFieldsKey(issueKey, baseUrl, statusId)` helper next to `fetchIssueTransitionsWithFields` and import it in both components.

### WR-05: StatusPopover resolution-during-transition has no handling for a `required` resolution that yields empty `allowedValues`

**File:** `taskflow/src/routes/dashboard/StatusPopover.tsx:111-119`

**Issue:** `handleSelect` only branches into the resolution step when `allowedValues && allowedValues.length > 0`. If the REST metadata marks `resolution` as `required: true` but returns an empty `allowedValues` (mis-configured workflow, or fields expansion partially populated), the code falls through to `onSelect(transitionId, toStatusName)` with no resolution. The downstream `postTransition` then omits `fields`, and Jira rejects the transition because a required field was not supplied — surfaced only as a generic "Transition failed" with no indication that a resolution was needed. The fallback-to-plain-transition design is reasonable for non-resolution transitions, but silently swallows the required-but-unfetchable case.

**Fix:** When `meta?.fields?.resolution?.required` is true but `allowedValues` is empty, either keep the popover open with an explicit "resolution required but unavailable" message, or block the transition rather than firing a request guaranteed to 400.

## Info

### IN-01: Duplicate `JiraIssueDetail` definition — types.ts copy omits `resolution`

**File:** `taskflow/src/services/jira/types.ts:168-212` vs `taskflow/src/services/jira.ts:1206-1252`

**Issue:** There are two `JiraIssueDetail` definitions. The canonical one (jira.ts, imported by FieldsSection) includes `resolution: { id; name; description? } | null`; the types.ts copy does **not**. FieldsSection happens to import the correct one, so `f.resolution?.id` type-checks. But the dual definition is a known trap (see MEMORY: jira.ts dual-file gotcha) — any consumer importing from `./jira/types` gets a `JiraIssueDetail` whose `resolution` is only reachable via the `[key: string]: unknown` index signature (typed `unknown`), losing all safety.

**Fix:** Add `resolution` to the types.ts copy (or, better, dedupe to a single source). Low priority since the in-scope code uses the correct import.

### IN-02: `postTransition` accepts 204 via an odd `!response.ok && status !== 204` shape

**File:** `taskflow/src/services/jira/transitions.ts:56`

**Issue:** `apiFetch` mocks return `ok: false, status: 204` in tests, and the guard `if (!response.ok && response.status !== 204)` treats 204 as success. Real `fetch` sets `ok = true` for 204, so the `!response.ok` already short-circuits in production; the `&& status !== 204` clause only matters for the test's hand-rolled `ok:false` mock. This couples the production guard to a test fixture quirk and reads as if 204 might arrive with `ok:false` in prod (it won't).

**Fix:** Drop the `status !== 204` special-case in production code (rely on `response.ok`), and fix the test mock to set `ok: true` for 204. Cosmetic; behavior is currently correct.

### IN-03: `transitionMutation.mutationFn` declares `toName` in its arg type but only `onMutate` reads it

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:261-273`

**Issue:** `toName` is part of the mutation variables purely to feed the optimistic `status.name` write in `onMutate`. It is unused in `mutationFn`. This is fine functionally but slightly obscures that `mutationFn` ignores it; a reader may expect `toName` to be sent to the server.

**Fix:** None required; optionally add a one-line comment clarifying `toName` is optimistic-only.

---

_Reviewed: 2026-06-05T12:15:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
