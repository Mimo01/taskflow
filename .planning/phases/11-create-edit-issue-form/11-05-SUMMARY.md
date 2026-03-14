# Plan 11-05 Summary: Human Verification

**Status:** Complete — Human approved
**Date:** 2026-03-14

## What Was Verified

All four CREATE requirements verified against the live Orange Jira instance.

- **CREATE-01:** Create Story with summary, description, assignee, story points, priority, epic link ✓
- **CREATE-01:** Create Subtask from sidebar (parent required, epic hidden) ✓
- **CREATE-01:** Add subtask from IssueDetailContent "+ Add subtask" (type + parent pre-filled) ✓
- **CREATE-02:** Account custom field appears and supports autocomplete ✓
- **CREATE-03:** Edit modal opens pre-filled, saves changes, detail panel refreshes ✓
- **CREATE-04:** Issue links — type dropdown from Jira, issue search, multiple rows ✓

## Bugs Fixed During UAT

| Commit | Fix |
|--------|-----|
| f05aa9f | Wire Edit/AddSubtask handlers via outlet context |
| c93d4e2 | Restrict subtask creation to non-subtask issues |
| 0eee239 | Reset modal form state on each open |
| ecedbfa | Fix assignee search and subtask time estimate |
| 3a8c5ee | Fix assignee dropdown clipping and re-search on focus |
| 88e332b | Replace useDebounce/useCallback with useEffect for assignee search |
| e5c5096 | Assignee pagination, fuzzy filter, and custom field autocomplete |

## Key Decisions

- Assignee list fetched once on modal open (maxResults=200) via useQuery; client-side fuzzy matching
- Custom field autocomplete is generic: `deriveAutoCompleteUrl()` in jira.ts maps `schema.custom` patterns to REST endpoints — UI only checks `autoCompleteUrl`
- Response envelope handled generically (data.accounts, data.values, data.users, etc.)
- `wrapCustomFieldValue()` handles user/id/string submission wrapping by schema type
- Account field no longer excluded from `customRequiredFields` (was mistakenly reserved as "core")
