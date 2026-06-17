# Quick Task 260617-e3z: in the app search, I should also be able to search issues by text - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Task Boundary

Add full-text issue search to the existing in-app search UI. Issues should appear inline alongside current results (no separate tab or section).

</domain>

<decisions>
## Implementation Decisions

### Search Trigger
- Debounced keystroke — fire ~300ms after the user stops typing

### Search Scope
- Match against issue title + description
- Scoped to the current/active project — do NOT query all of Jira globally
- Performance is a priority: limit result count (e.g. top 5–10 issues max)

### Results Display
- Inline with existing search results — keep everything in one unified list
- No dedicated "Issues" section header or separate tab

### Claude's Discretion
- Exact debounce delay (300ms recommended)
- Result count cap
- How "current project" is determined from app state
- How to render issue results vs existing result types in the shared list

</decisions>

<specifics>
## Specific Ideas

- Scope search to the active project to avoid slow global JQL queries
- Use existing search infrastructure/hooks if already present in the codebase

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
