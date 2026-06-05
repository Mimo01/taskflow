---
phase: 80-subtask-templates-and-bulk-creation
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - taskflow/src/stores/subtask-templates.store.ts
  - taskflow/src/stores/subtask-templates.store.test.ts
  - taskflow/src/routes/dashboard/resolveTemplateFields.ts
  - taskflow/src/routes/dashboard/resolveTemplateFields.test.ts
  - taskflow/src/routes/dashboard/resolveRowPlaceholders.ts
  - taskflow/src/routes/dashboard/resolveRowPlaceholders.test.ts
  - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
  - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx
  - taskflow/src/routes/dashboard/BulkCreateSubtasksModal.test.ts
  - taskflow/src/routes/dashboard/BulkProgressIndicator.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/settings/SubtaskTemplatesSection.tsx
  - taskflow/src/routes/settings/Settings.tsx
  - taskflow/src/services/jira.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 80: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the subtask-templates store, the field/placeholder resolvers, the settings
editor, and the bulk-create modal. The pure resolver functions and the store are
well-tested and correct. The defects cluster in `BulkCreateSubtasksModal.tsx`, which
orchestrates async createmeta loading and the create loop. Two correctness defects
will surface in real use: (1) the progress-failure detail list cites the wrong row's
title because it indexes a filtered array against the original `rows` array, and
(2) template custom-field values are silently dropped when a template is selected
before its createmeta query resolves, with no re-resolution when the data arrives.
Several warnings concern unreachable inherit logic for priority/labels/duedate (no UI
to set those sentinels) and React key collisions on duplicate titles.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Failure detail list maps filtered array index back onto unfiltered `rows`

**File:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:445-447`
**Issue:**
```ts
const progressFailures = rowStates
  .filter((s) => s.status === 'failed')
  .map((s, i) => ({ key: rows[i]?.title ?? `Row ${i + 1}`, error: s.error ?? 'Unknown error' }));
```
After `.filter()`, `i` is the index within the *filtered* (failures-only) array, not
the index within `rows`/`rowStates`. So `rows[i]` does not point at the failed row.
Concrete example: rows 0 and 1 succeed, row 2 fails. The filtered array has one entry
at `i = 0`, so the detail line reads `rows[0].title` — a row that *succeeded* — instead
of `rows[2].title`. Every failure detail can name the wrong subtask, which is actively
misleading during the exact moment the user needs to identify what failed.
**Fix:** Filter by index against the original arrays:
```ts
const progressFailures = rowStates
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => s.status === 'failed')
  .map(({ s, i }) => ({
    key: rows[i]?.title || `Row ${i + 1}`,
    error: s.error ?? 'Unknown error',
  }));
```

### CR-02: Template custom-field values silently dropped when selected before createmeta loads

**File:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:279-318`
**Issue:** `applyTemplate` resolves rows once, at the moment the template is chosen, using
`creatmetaFields ?? []`. The `creatmetaFields` query is gated on `effectiveTypeId`, which
itself is only set inside `applyTemplate` (line 305/308) during the same synchronous tick —
so on first selection `creatmetaFields` is almost always `undefined`. `resolveTemplateFields`
therefore runs against an empty createmeta set, drops *all* `customFieldValues` (and any
`components`) as unsupported, and inflates `totalSkipped`. There is no effect that re-runs
`applyTemplate` when `creatmetaFields` later resolves, so the dropped values never come back —
the user sees "N fields skipped" and creates subtasks missing their custom-field data.
**Fix:** Re-resolve when createmeta arrives, e.g. keep the raw selected template in state and
recompute via `useMemo`/`useEffect` keyed on `creatmetaFields`:
```ts
useEffect(() => {
  if (selectedTemplateId !== '__adhoc__' && creatmetaFields) {
    applyTemplate(selectedTemplateId, selectedSubtaskTypeId || undefined);
  }
}, [creatmetaFields]); // re-resolve once fields load
```
Be careful to preserve user edits made after selection (resolve from the stored template, not
from the already-resolved `rows`).

## Warnings

### WR-01: `@inherit` sentinel for priority / labels / duedate is unreachable from the UI

**File:** `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts:76-94`; `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx:254-295`
**Issue:** `resolveRowForCreate` honors `row.priority === '@inherit'`, `row.labels === ['@inherit']`,
and `row.duedate === '@inherit'` (D-09). But the row editor exposes no control to enter those
sentinels: the Priority `Select` only offers `None/Blocker/Critical/Major/Medium/Minor`, the
Labels input splits on commas into plain strings, and the Due date input is a native `type="date"`.
The inherit branches for these three fields are dead code in practice — only assignee `@inherit`
is reachable. Either the UI is missing the inherit affordance or the resolver logic is speculative.
**Fix:** Add an `@inherit` option to the priority/labels/duedate controls, or remove the dead
branches and their tests to avoid implying functionality that does not exist.

### WR-02: Failure list React keys collide on duplicate subtask titles

**File:** `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx:101-105`
**Issue:** `<li key={f.key}>` uses the subtask title as the React key. Bulk templates routinely
contain repeated titles (e.g. two "Write tests" rows). Duplicate keys cause React to drop/merge
list items, so the failure detail panel can omit failures. Combined with CR-01 this makes the
failure view unreliable.
**Fix:** Pass a stable unique id (the row id) through `failures` and key on it, or key on the
array index: `failures.map((f, i) => <li key={i}>...)`.

### WR-03: `@current` assignee silently omitted when `jiraUsername` is null

**File:** `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts:34-39`, `:71-73`
**Issue:** For `@current`, `payloadName` is `ctx.jiraUsername`. If `jiraUsername` is `null`
(not yet loaded / not set), `resolveRowForCreate` omits assignee entirely (line 71 `if
(resolved.payloadName)`), so the subtask is created unassigned with no warning. The user
explicitly asked for "current user" and silently gets "unassigned".
**Fix:** Surface a visible warning (or block creation) when `@current` resolves to a null
username, rather than silently degrading to unassigned.

### WR-04: Createmeta issue-type query does not handle legacy (non-paginated) response shape

**File:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:212-230`; `taskflow/src/routes/settings/SubtaskTemplatesSection.tsx:114-132`
**Issue:** Both issue-type queries read `data.values ?? []` from
`/rest/api/2/issue/createmeta/{project}/issuetypes`. `fetchCreatemeta` in the same codebase
explicitly falls back to a legacy flat endpoint for pre-8.4 / re-enabled-flag Jira instances
(jira.ts:1729). These inline issue-type fetches have no such fallback, so on those instances
the subtask-type list is silently empty, `effectiveTypeId` stays `''`, and the user can never
create subtasks. Behavior is inconsistent with the project's documented version-adaptive pattern.
**Fix:** Reuse a shared helper that mirrors `fetchCreatemeta`'s fallback, or at minimum document
that subtask types require Jira 8.4+. At present the failure mode (empty dropdown, disabled create)
is opaque.

### WR-05: `Number(e.target.value)` for story points can yield `NaN` payload

**File:** `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx:311-318`
**Issue:** `storyPoints: e.target.value === '' ? null : Number(e.target.value)`. A `type="number"`
input can still emit non-numeric intermediate strings in some browsers/locales, and `Number('')`
guards only the empty case. Any unparseable value becomes `NaN`, which is then written to the
payload at BulkCreateSubtasksModal.tsx:394-396 (`row.storyPoints != null` is true for `NaN`) and
serialized as `null` by `JSON.stringify`, producing a confusing field clear rather than a no-op.
**Fix:** Guard against `NaN`: `const n = Number(e.target.value); onChange({ storyPoints:
Number.isFinite(n) ? n : null });` and skip the payload field when not finite.

### WR-06: `actionVerb` pastTense fallback produces ungrammatical labels

**File:** `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx:52-57`
**Issue:** The fallback `` `${actionVerb.toLowerCase()}d` `` yields strings like "movingd",
"deleted" only by luck. For the documented callers ("Creating"/"Updating") this is fine, but the
component is exported as reusable and the generic branch is reachable for any other verb. Low risk
but a latent correctness/quality issue for future reuse.
**Fix:** Either restrict `actionVerb` to a known union type, or pass an explicit `pastTense` prop
instead of deriving it.

## Info

### IN-01: Pervasive `creatmeta`/`Creatmeta` typo in identifiers

**File:** `taskflow/src/routes/dashboard/resolveTemplateFields.ts:22-25`; `BulkCreateSubtasksModal.tsx:53,132`; `SubtaskTemplatesSection.tsx:51`
**Issue:** `creatmetaFields`, `creatmetaFieldIds`, `CreatemtaIssueType`, `CreateAllRowsOptions`'s
neighbors consistently misspell "createmeta" as "creatmeta"/"creatmta". Harmless but propagates a
typo across new public-ish prop names and interfaces.
**Fix:** Rename to `createmetaFields` / `CreatemetaIssueType` for consistency with `fetchCreatemeta`
and `CreatemetaField` in jira.ts.

### IN-02: `assignees` prop received but unused in `SubtaskTemplateRow`

**File:** `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx:155`
**Issue:** `assignees: _assignees` is destructured and discarded; the concrete-assignee path uses a
free-text `Input` rather than a picker. The prop is threaded from BulkCreateSubtasksModal (the
`allAssignees` query) but never consumed, so the assignable-users fetch (modal lines 252-269) is
dead weight.
**Fix:** Either wire `assignees` into an autocomplete for the concrete branch, or drop the prop and
the `allAssignees` query.

### IN-03: Comment claims the wrong dedup semantics location

**File:** `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx:97`
**Issue:** The comment "the ONLY dedup mechanism" is accurate, but note retries re-derive the
whole `snapshotRows` (including re-resolving `@current`/`@inherit`) each pass; if parent state or
current user changed between attempts, a retried row may be created with different field values
than the original attempt. Worth a comment that retry re-resolves placeholders against current
context.
**Fix:** Add a clarifying comment, or snapshot resolved options once and reuse them on retry.

### IN-04: `JiraIssueDetail.fields.components` added but never consumed for inherit

**File:** `taskflow/src/services/jira.ts:1244,1377`
**Issue:** The new `components?: Array<{ id; name }>` field on `JiraIssueDetail` and the added
`'components'` fetch field suggest component inheritance, but no resolver reads
`parentIssue.fields.components` (resolveRowForCreate handles assignee/priority/labels/duedate only).
The field is currently fetched and typed but unused by this phase's logic.
**Fix:** Either implement component inheritance or note the field is reserved for a later phase.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
