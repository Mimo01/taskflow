---
status: resolved
trigger: Bulk create subtasks fails 400 — customfield_10409 "Account is required"
created: 2026-06-12
updated: 2026-06-12
---

# Debug: bulk-subtask-account-required

## Symptoms
- POST /rest/api/2/issue returns 400 on bulk subtask create
- RESPONSE BODY: `errors: { customfield_10409: "Account is required." }`
- Single subtask create works; bulk does not.

## Current Focus
hypothesis: Bulk-create omits required custom fields inherited from parent; single-create inherits them via parentInheritMap.
test: Compare payload construction between bulk and single create paths.
expecting: Bulk path has no parent-required-field inheritance.
next_action: Mirror single-create inheritance in BulkCreateSubtasksModal.handleCreate.

## Root Cause
Single subtask create (`create-edit-issue/`) inherits required custom fields from the
parent issue:
- `useCreateEditQueries.ts:159-177` fetches parent `?fields=*navigable`
- `CreateEditIssueModal.tsx:83-90` builds `parentInheritMap` from `customRequiredFields`
- `useIssueMutations.ts:82-97` injects inherited scalar values into the create body

`BulkCreateSubtasksModal.tsx` does NONE of this. `handleCreate` (lines 396-432) only sends
custom fields explicitly typed into a row (lines 425-429). Required field
`customfield_10409` (Tempo "Account") is never sent → 400.

## Fix
Add parent-field fetch + `customRequiredFields` + `parentInheritMap` to the bulk modal,
and apply the same inheritance loop per-row in `handleCreate` (only when the row didn't
already set the field).

## Evidence
- timestamp 2026-06-12: confirmed single path at useIssueMutations.ts:82-97; bulk path
  has no inheritance block.
