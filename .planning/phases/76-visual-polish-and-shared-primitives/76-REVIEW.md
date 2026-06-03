---
phase: 76-visual-polish-and-shared-primitives
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - taskflow/src/lib/issueDisplayUtils.ts
  - taskflow/src/lib/issueDisplayUtils.test.ts
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
  - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
  - taskflow/src/services/jira/greenhopper/adapter.ts
  - taskflow/src/services/jira/greenhopper/adapter.test.ts
  - taskflow/src/services/jira/rank.ts
  - taskflow/src/services/jira/rank.test.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/settings.store.test.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 76: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Phase 76 visual-polish + shared-primitives work: the new
`issueDisplayUtils` stripe/done helpers, their adoption across TaskCard /
BacklogRow / dashboard / standup sections, the GreenHopper adapter's priority
synthesis, the new LexoRank `rankIssue` calculator, and the `rankFieldKey`
settings addition.

The display-primitive extraction is clean and well-tested. The serious problems
are in `rank.ts`: two correctness defects in the midpoint algorithm that the
test suite does not catch because its assertions are too weak. `rankIssue` has
no production consumer yet (Phase 78 will wire it), so this is latent — but it
is shipping a broken, "green-tested" primitive that the next phase will build on
top of, which is exactly when the bug becomes expensive. Both are filed as
BLOCKER against the function's stated correctness contract ("a value strictly
between before and after").

## Critical Issues

### CR-01: `rankIssue` returns a value NOT between `before` and `after` across a bucket boundary

**File:** `taskflow/src/services/jira/rank.ts:21-24`
**Issue:**
`rankIssue` keeps `before`'s bucket (`bucket(before)`) but computes the midpoint
of the two *value* portions, ignoring `after`'s bucket entirely. When `before`
and `after` straddle a bucket boundary (the normal LexoRank rebalance case —
e.g. inserting between the last row of bucket `0` and the first row of bucket
`1`), `after`'s value is numerically *smaller* than `before`'s value, so the
midpoint lands *below* `before`:

```
rankIssue('0|zzzzzz:', '1|000000:')  →  '0|hzzzzz:'
// '0|hzzzzz:' < '0|zzzzzz:'  ← new rank sorts BEFORE the item it must follow
```

The dropped issue then renders out of order (and can flip on every adjacent
insert). The test suite masks this: E7 (`rank.test.ts:66-71`) only asserts
`result.startsWith('0|')` and never checks `rankLt(before, result)` or
`rankLt(result, after)`.

**Fix:** Reject / special-case cross-bucket inputs instead of silently averaging
values. Minimal correct behavior when buckets differ is to anchor to one bucket
and rank relative to that bucket's extreme, e.g.:

```ts
export function rankIssue(before: string | null, after: string | null): string {
  const bBucket = bucket(before);
  const aBucket = after ? bucket(after) : bBucket;
  if (before && after && bBucket !== aBucket) {
    // Cross-bucket: midpoint of values is meaningless. Anchor in before's
    // bucket above before's value (treat after as the bucket ceiling).
    const beforeVal = extractValue(before);
    return `${bBucket}|${midpoint(beforeVal, pad(beforeVal, beforeVal.length + 1))}:`;
  }
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after) || pad(beforeVal, beforeVal.length + 1);
  return `${bBucket}|${midpoint(beforeVal, afterVal)}:`;
}
```

Add a test asserting `rankLt(before, result) && rankLt(result, after)` for the
cross-bucket case.

### CR-02: `rankIssue` midpoint loses precision (parseInt → float64) and can return a non-strictly-between or duplicate rank

**File:** `taskflow/src/services/jira/rank.ts:52-54`
**Issue:**
The comment claims "Convert to BigInt (base-36) for precise integer
arithmetic", but precision is already destroyed *before* BigInt wraps the value:
`parseInt(pa, 36)` returns a JS `number` (float64). Any value portion of ~11+
base-36 characters exceeds `Number.MAX_SAFE_INTEGER` (2^53), so distinct ranks
collapse to the same float:

```
parseInt('zzzzzzzzzzz0', 36) === parseInt('zzzzzzzzzzzz', 36)  // true (both rounded)
```

When `ia === ib` after rounding, `midpoint` computes `mid = ia`, so
`result === pa` triggers the single-char `'i'` extension — but that only
guarantees `result > before`, not `result < after`. For adjacent long ranks this
yields a value that is **not strictly between** the two (or equal to one
endpoint), which is the exact failure LexoRank exists to prevent. Real Jira rank
value portions routinely grow past 11 chars after repeated rebalances.

**Fix:** Do the base-36 → integer conversion with BigInt directly (no
`parseInt`):

```ts
function toBig(base36: string): bigint {
  let acc = 0n;
  for (const ch of base36) acc = acc * 36n + BigInt(ALPHABET.indexOf(ch));
  return acc;
}
// ...
const ia = toBig(pa || '0');
const ib = toBig(pb || '0');
```

Add a regression test with a 12+ char value portion asserting strict
betweenness.

## Warnings

### WR-01: Backlog `applyFilters` reads `issue.fields.labels`, but Phase 74/76 dropped labels from the GH backlog shape

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:525-527`
**Issue:**
`filterOptions` deliberately publishes `labels: []` (D-05a — GhIssue carries no
`labels[]`), yet `applyFilters` still evaluates a label predicate against
`issue.fields.labels`. Because `activeLabels` can never be populated from an
empty dropdown the branch is effectively dead, but it is silently inconsistent:
if any other surface sets `activeLabels` in the shared filter store, every
backlog row is filtered out (no GH issue has `fields.labels`). Dead-but-live
logic that depends on store state set elsewhere is a latent correctness trap.

**Fix:** Drop the label predicate on the backlog (it has no data source):
```ts
const labelMatch = true; // backlog carries no labels (D-05a)
```
or short-circuit when `filterOptions.labels` is empty.

### WR-02: `DashboardInProgressCard` overflow count is computed before grouping, so "and N more" can mislead

**File:** `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx:67-68`
**Issue:**
`displayed = myInProgressSubtasks.slice(0, 3)` caps at 3 *subtasks*, and
`overflow = total - 3`. But the rendered list also injects parent-story header
rows (one per distinct parent). The visible row count is therefore
`groups + displayed.length`, which can exceed the "3" the cap implies, while the
"and N more" caption still counts only hidden subtasks. The header copy ("up to
3 subtask rows") and the overflow number describe subtasks, but the rendered
density is larger. Not a crash, but the displayed-vs-overflow accounting is
inconsistent with what the user sees.

**Fix:** Either cap on rendered rows (parents + subtasks) or document that the
cap is subtasks-only and the caption is correct by that definition. At minimum
align the header comment with the actual grouping behavior.

### WR-03: Orphan subtasks render with no issue-type icon and a different layout, inconsistent with grouped rows

**File:** `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx:172-189`
**Issue:**
A subtask whose `parent.key` is falsy falls into `orphans` and renders key-first
with no `IssueTypeIcon` and no indentation, unlike every grouped subtask row.
With the adapter now able to produce subtasks whose `parent` was *not*
synthesized (adapter CR-01: parent only when both `parentId` AND `parentKey`
present), orphans are a reachable path, not a theoretical one. The visual result
is a subtask that looks like a top-level item.

**Fix:** Render orphan rows with the same `IssueTypeIcon` + indent treatment as
grouped subtasks, or group orphans under a synthetic "No parent" header.

### WR-04: `confirmMoveToSprint` / `confirmMoveToBacklog` fire-and-forget `invalidateQueries` without awaiting, swallowing rejections

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:693-694, 723-724`
**Issue:**
Inside the `try`, `invalidateGhBacklogData(...)` and
`queryClient.invalidateQueries(...)` are called without `await`. If
`addIssuesToSprint` resolves but a subsequent invalidation rejects, the
rejection is an unhandled promise (the surrounding `catch` only covers the
awaited `addIssuesToSprint`). The optimistic cache is also never reconciled if
invalidation silently fails, leaving the UI on optimistic state indefinitely.

**Fix:** `await` the invalidations inside the `try`, or attach `.catch()`
handlers. Note `confirmMoveToSprint` awaits `addIssuesToSprint` but not the
invalidations — make the pattern uniform.

### WR-05: `handleToggleFlag` dead `newFlaggedValue` + `void` suppression hides a real omission

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:621-643`
**Issue:**
`newFlaggedValue` is computed (the proper Jira REST flag payload shape) but never
used; the optimistic cache update instead writes a bare boolean
`{ ...g, flagged: !currentFlagged }`. The `void newFlaggedValue;` at line 643
exists only to silence the unused-var lint, with a comment admitting it. This is
a code smell masking that the optimistic update and the server payload use two
different shapes — if the cache consumer ever reads `flagged` as the array form
(as the adapter's `flaggedValue` synthesis at line 303 does), the optimistic
boolean write is shape-inconsistent.

**Fix:** Remove the dead `newFlaggedValue` and the `void` line, or use it. Verify
the optimistic boolean write matches what `adaptIssue` expects from
`gh.flagged` (it reads `gh.flagged` as boolean at adapter:157 — so the boolean
write is correct and `newFlaggedValue` is simply dead code that should be
deleted).

## Info

### IN-01: `doneSummaryClass` name is misleading and self-documented as such

**File:** `taskflow/src/lib/issueDisplayUtils.ts:24`
**Issue:** The function returns `line-through` applied to the issue *key*, not
the summary, and the JSDoc explicitly apologizes for the name ("Despite the
name… applied to the issue KEY element… Name kept per roadmap export contract").
Keeping a knowingly-wrong name as a contract is debt.
**Fix:** Rename to `doneStrikethroughClass` (or similar) and update the ~5
callers; the roadmap export contract can be amended in the same phase that
introduced it.

### IN-02: Stripe color ramp ships a documented sub-WCAG value

**File:** `taskflow/src/lib/issueDisplayUtils.ts:90`
**Issue:** `medium` uses `yellow-500` at 1.92:1 against the light card — below
the 3:1 floor the rest of the ramp is verified to — as a documented "product
trade-off." Recording it here so it is a tracked accessibility exception, not an
oversight.
**Fix:** None required if accepted; consider `yellow-600` for a WCAG-clean
compromise.

### IN-03: `useVirtual = false` leaves a large block of dead virtualization code

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:106-117, 180-191`
**Issue:** `rowVirtualizer`, `virtualItems`, and the entire `useVirtual` branch
(including per-row absolute-positioning style writes) are computed but never
reached because `useVirtual` is hardcoded `false`. The `@tanstack/react-virtual`
import and `estimateSize`/`overscan` config are pure overhead.
**Fix:** Delete the virtualization scaffolding and the import, or gate it behind
a real condition. Dead `useVirtualizer()` still runs its hook work each render.

### IN-04: `settings.store` migrate returns the mutated `persisted` while building a separate typed `s` alias

**File:** `taskflow/src/stores/settings.store.ts:347-450`
**Issue:** `const s = persisted as Record<string, unknown>` then mutates `s`
in place and `return persisted as SettingsState`. It works (same reference) but
the dual naming (`persisted` vs `s`) for one object obscures that they alias,
and the final cast bypasses any validation that all v25 fields exist. Long
migrate chains like this are where a missed default silently ships `undefined`.
**Fix:** Return `s as unknown as SettingsState` for naming consistency; consider
asserting required keys after the chain.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
