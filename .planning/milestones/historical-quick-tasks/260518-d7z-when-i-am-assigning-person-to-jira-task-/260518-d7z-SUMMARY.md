---
status: complete
quick_id: 260518-d7z
date: 2026-05-18
---

# Quick Task 260518-d7z: Add "Assign to me" quick action to Jira assignee popover

## What was done

Added a one-click "Assign to me" button at the top of the Assignee popover in `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`.

## Implementation

- Reads current user identity from auth store (`jiraUsername` / `jiraUserDisplayName`)
- Renders a button with avatar + "Assign to me (Display Name)" above the search input, separated by a divider
- Hidden when already self-assigned or when `jiraUsername` is not hydrated
- Calls the same `mutation.mutate({ fieldName: 'assignee', value: { name: jiraUsername } })` contract as the typeahead path
- Closes popover and resets state on click, identical to typeahead behavior

## Commits

- `d974d1b` feat(quick-260518-d7z-01): add Assign to me quick action to assignee popover

## Files changed

- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`

## Notes

`CachedAvatar` minimum size is 20 (not 16 as planned) — auto-corrected.
