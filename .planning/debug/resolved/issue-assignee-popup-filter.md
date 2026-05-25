---
status: resolved
trigger: "On issue detail when choosing assignee for a story, in the popup the filter doesn't work. Also make the popup wider so all content can easily fit"
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** Filter the list as I type (assignee list should narrow down based on typed input)
- **Actual:** Nothing — list doesn't change when typing in the filter field
- **Errors:** No console errors observed
- **Timeline:** Unsure when it last worked (may have always been broken)
- **Reproduction:** Open issue detail → click assignee field → popup opens → type in filter field → list does not update
- **Additional request:** Make the assignee popup wider so all content fits comfortably

## Current Focus

- hypothesis: "Filter input state is not wired to the list filtering logic"
- test: ""
- expecting: ""
- next_action: "resolved"
- reasoning_checkpoint: "Root cause found and fix applied"

## Evidence

- timestamp: 2026-05-25T00:00:00Z
  file: taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  finding: >
    The popup used a remote search pattern (debounced API call per keystroke). The
    input onChange called debouncedSearch(e.target.value) which hit
    /rest/api/2/user/assignable/search?issueKey=...&query=... after 300ms. Errors
    were silently swallowed (catch { // ignore }). When the popup opened,
    assigneeResults was empty and no initial list was shown. The user's expectation
    was local filtering of a pre-loaded list, not an async API search.

## Eliminated

- State/debounce wiring is correct — debouncedSearch did fire with the typed value
- Base UI Popover prop API is compatible — open/onOpenChange work correctly
- apiFetch itself has no bugs

## Resolution

- root_cause: "Assignee popup used remote API search (debounced per keystroke, results empty on open) instead of loading all assignable users upfront and filtering locally — silent catch block hid any API failures, leaving the list perpetually empty to the user"
- fix: "Replaced doSearch+debouncedSearch with a useQuery that fetches all assignable users (maxResults=50) when assigneeOpen becomes true (staleTime 60s); filter is now a pure client-side toLowerCase includes match on displayName and name; popup widened from w-60 to w-80; each user row now shows their avatar"
- verification: "TypeScript noEmit passed with exit code 0"
- files_changed: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
