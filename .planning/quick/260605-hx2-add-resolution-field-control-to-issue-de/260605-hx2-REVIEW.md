---
phase: 260605-hx2-add-resolution-field-control-to-issue-de
reviewed: 2026-06-05T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/services/jira/resolutions.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 260605-hx2: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the resolution-field change for quick task 260605-hx2: the new
`fetchResolutions` service, its re-export from the legacy `jira.ts`, the
`resolution` field added to `JiraIssueDetail` + `fetchIssueDetail`, the
done-gated Resolution `MetaRow` with inline `Select`, and the new tests.

Pattern scans (secrets, dangerous functions, debug artifacts, empty catch)
came back clean. The new service file is a faithful clone of the reference
`statuses.ts` error envelope. No Critical issues found. Four Warnings concern
correctness/robustness gaps around the optimistic-update payload shape, the
done-gating staleness during an in-flight transition, and the "Unresolved"
clear semantics against Jira DC. Two Info items cover test coverage gaps and a
minor select-value edge case.

## Warnings

### WR-01: Optimistic update writes a type-invalid `resolution` shape

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:337` (with `useFieldMutation.ts:33-39`)
**Issue:** `handleResolutionChange` calls `mutation.mutate({ fieldName: 'resolution', value: { name: value } })`. The shared `useFieldMutation` `onMutate` writes the value verbatim into the cache: `fields.resolution = { name: value }`. But `JiraIssueDetail.fields.resolution` is typed `{ id: string; name: string; description?: string } | null` (jira.ts:1216) — the optimistic object is missing the required `id`. This compiles only because `value` is `unknown` at the mutation boundary, silently defeating the type. It renders fine today (only `.name` is read), but any future consumer reading `resolution.id` off the optimistic snapshot will get `undefined` until the `onSettled` refetch lands.
**Fix:** Either widen the payload to a fuller shape using the selected resolution from `resolutionsQuery.data` (carry `id` + `name`), or relax the cache type to `Partial<...>` for optimistic frames. Minimal:
```ts
const chosen = resolutionsQuery.data?.find((r) => r.name === value);
mutation.mutate({ fieldName: 'resolution', value: chosen ? { id: chosen.id, name: chosen.name } : { name: value } });
```

### WR-02: Done-gating can go stale during an in-flight status transition

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:475` (vs `transitionMutation.onMutate` at 256-272)
**Issue:** The Resolution row is editable only when `f.status.statusCategory?.key === 'done'`. But `transitionMutation`'s optimistic update only patches `status.name` (line 269) and leaves `status.statusCategory.key` untouched. So immediately after transitioning an issue *into* a done status, the optimistic snapshot still has the old (non-done) category and the Resolution control stays read-only until `onSettled` refetch completes; conversely, transitioning *out of* done keeps the editable control visible against a stale category. This is a transient correctness gap in the gating logic, not just cosmetics.
**Fix:** Patch `statusCategory` in the transition `onMutate` (the `StatusPopover` `onSelect` already has the target status; thread its `statusCategory.key` through `toName`/a new field), or refetch status category eagerly. At minimum, document that the Resolution control reflects server status, not optimistic status.

### WR-03: Clearing resolution to null may be rejected by Jira DC outside a transition screen

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:333-335`
**Issue:** Selecting "Unresolved" sends `updateIssueField('resolution', null)` → `PUT /rest/api/2/issue/{key}` with `{ fields: { resolution: null } }` (jira.ts:1492). On many Jira Server/DC configurations the `resolution` field is only on the transition screen, not the edit screen, so a direct field PUT returns 400 ("Field 'resolution' cannot be set. It is not on the appropriate screen, or unknown."). The UI surfaces this only as the generic "Save failed — changes reverted" message, giving the user no actionable cause. The done-gating reduces but does not eliminate exposure.
**Fix:** No code change strictly required, but (a) confirm against the target instance that edit-screen resolution writes are allowed, and (b) consider catching the 400 screen-config error and surfacing a clearer message ("Resolution is not editable on this issue's screen"). At minimum capture this constraint in the task summary.

### WR-04: New `fetchResolutions` service has zero direct unit coverage

**File:** `taskflow/src/services/jira/resolutions.ts:32-49`
**Issue:** The test file mocks `fetchResolutions` wholesale (FieldsSection.test.tsx:72-77), so the actual service — including the 401/403 → `ApiError` vs generic-`Error` branch and the trailing-slash normalization — is never exercised. The sibling reference (`statuses.ts`) embodies the same envelope; if it has a test, this one should mirror it. The error-branch logic is exactly the kind of code that silently rots.
**Fix:** Add a small unit test for `fetchResolutions` covering: ok→parsed array, 401→`ApiError` with status, 500→generic `Error`, and `baseUrl` with trailing slash. Mock `apiFetch` directly.

## Info

### IN-01: Resolution `Select` value has no matching option when the current resolution is absent from the global list

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx:479-495`
**Issue:** The `Select` `value` is bound to `f.resolution?.name`. The options are "Unresolved" (`__unresolved__`) plus `resolutionsQuery.data`. If the issue's current resolution name isn't in the fetched global list (renamed/retired resolution), or the query hasn't resolved yet on first open, the `Select` shows no selected option. Cosmetic — the existing value still round-trips on save — but mildly confusing.
**Fix:** Optionally inject the current `f.resolution` as a synthetic option when it's not present in `resolutionsQuery.data`, mirroring the `selectedOlder` pattern already used for fix versions (lines 226-228).

### IN-02: Resolution tests don't cover the editable read-only display or the done-but-resolved state

**File:** `taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx:361-429`
**Issue:** Tests cover: non-done read-only (`resolution-value`), done→named mutate, done→null mutate. Not covered: a done issue that *already has* a resolution (e.g. `{ name: 'Done' }`) renders the resolution name on the edit button (line 510) rather than "Unresolved", and that the edit button (`resolution-edit`) is present for done issues. The current done tests all start from `resolution: null`, so the `f.resolution?.name ?? 'Unresolved'` button branch is only ever exercised on the null side.
**Fix:** Add a test with `doneIssue()` overridden to `resolution: { id: '1', name: 'Done' }` asserting the `resolution-edit` button text is "Done".

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
