---
slug: assignee-missing-users
status: resolved
trigger: "In issue detail I cant find some collegues in the asignee input. They are not showing on filtering. Isnt there a problem with fetching all users once and pagination?"
created: 2026-06-03
updated: 2026-06-03
---

# Debug Session: assignee-missing-users

## Symptoms

- **Expected:** Every colleague should be findable in the issue-detail assignee input when typing/filtering.
- **Actual:** Some colleagues never appear at all, no matter what is typed.
- **Filter behavior:** Missing users never appear (not intermittent, not select-fails).
- **Pattern of who's missing:** No obvious pattern noticed by user.
- **Timeline:** Unknown whether it ever showed everyone correctly.
- **Reproduction:** Open issue detail → click assignee input → type a missing colleague's name → they don't show.
- **User hypothesis:** Users are fetched once without pagination, so only the first page is available and the rest are silently dropped.

## Current Focus

- hypothesis: CONFIRMED — assignee picker fetches a single capped page (maxResults=50) of assignable users without sending the typed query to the server, then filters client-side. Users beyond the first 50 returned are never fetched and therefore never selectable.
- test: n/a (static trace + comparison to working sibling component)
- expecting: n/a
- next_action: user decision on how to apply fix (inline / plan / manual)
- reasoning_checkpoint:

## Evidence

- timestamp: 2026-06-03
  file: taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  lines: 157-186
  observation: assigneeUsersQuery fetches `/rest/api/2/user/assignable/search?issueKey={key}&maxResults=50` ONCE when the popover opens (enabled: assigneeOpen). The typed text (assigneeQuery) is NOT part of the queryKey and is NOT sent to the server. The endpoint returns at most one page (cap 50); there is no startAt pagination loop. filteredAssignees (177-186) then filters that capped array client-side and slices to 10. Net effect: any assignable user outside the first 50 the server returns can never appear, regardless of what is typed. Matches user's report exactly (missing colleagues NEVER appear, no pattern — they are simply whoever falls outside the returned 50).

- timestamp: 2026-06-03
  file: taskflow/src/routes/dashboard/MentionPopover.tsx
  lines: 30-50
  observation: The mention picker uses the SAME assignable-search endpoint correctly. It debounces the typed query (200ms), includes debouncedQuery in the queryKey (['jira-assignable-users', projectKey, jiraBaseUrl, debouncedQuery]), and calls fetchAssignableUsers(...query) so the SERVER performs the filtering. This is the proven in-codebase pattern the assignee picker fails to follow.

- timestamp: 2026-06-03
  file: taskflow/src/services/jira/users.ts
  lines: 20-47
  observation: Canonical fetchAssignableUsers() sends `&username=${encodeURIComponent(query)}` so the Jira Server/DC endpoint filters server-side. FieldsSection bypasses this helper with its own inline fetch that omits the username/query param. Deployment is Jira Server/DC (username= param, name field, Bearer PAT — consistent with project memory).

- timestamp: 2026-06-03
  file: .planning/debug/mr-discussions-cap-20.md
  observation: Prior resolved session — same class of bug (fetch-layer page cap silently truncating results). Reinforces that fetch-once-without-paging is a recurring pattern in this codebase.

## Eliminated

- Selection failure: handleAssigneeSelect (FieldsSection.tsx:335-340) correctly posts { name: user.name } in DC format; selection works for users that DO appear. The bug is purely that missing users are never in the candidate list.
- Render/slice cap: the slice(0,10) at line 185 only limits what is displayed AFTER filtering; the root limitation is the 50-user fetch cap combined with no server-side query.

## Specialist Review

- specialist: typescript-expert (react/typescript hint)
- verdict: LOOKS_GOOD
- notes: Fix direction is idiomatic for this React Query codebase. Honor: (1) debounce input and put debounced value in queryKey so RQ refetches per term (matches MentionPopover 200ms); (2) send term to server via &username= rather than client-filtering; (3) keep issueKey= scoping so results stay correct for this issue's assignable set; (4) drop client-side .filter() since server now filters, keep a display slice; (5) keep enabled: assigneeOpen. Pitfall: empty query must still return the default list — do not gate the fetch on non-empty query (Jira handles empty username fine).

## Resolution

- root_cause: The issue-detail assignee picker (FieldsSection.tsx assigneeUsersQuery, lines 157-175) calls the Jira assignable-user-search endpoint exactly once with a hardcoded maxResults=50 and no query/username parameter, then filters the returned 50 users client-side. The typed search term is never sent to the server and there is no pagination. Any assignable user beyond the first 50 returned is never fetched and is therefore never selectable, regardless of what the user types. (The working MentionPopover.tsx uses the same endpoint correctly with a debounced server-side query.)
- fix: NOT YET APPLIED — proposed. In FieldsSection.tsx: (a) add a debouncedAssigneeQuery state updated from assigneeQuery via a 200ms useEffect timer; (b) add debouncedAssigneeQuery to assigneeUsersQuery's queryKey; (c) append `&username=${encodeURIComponent(debouncedAssigneeQuery)}` to the request URL (keep issueKey scoping, keep maxResults=50 as the per-query cap); (d) replace filteredAssignees' client-side .filter() with the server-returned list, keeping the .slice(0, 10) for display. Net: server filters across the full assignable user base per typed term, so previously-missing colleagues become findable.
- verification: `npm run check` (biome + tsc) passes clean. Manual UAT pending: open an issue, type a colleague known to fall outside the first 50 assignable users — they should now appear.
- files_changed: taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (added 200ms debounced query state + effect; assigneeUsersQuery now sends &username= and includes the debounced term in its queryKey, keeping issueKey scoping; removed client-side .filter(), kept .slice(0,10) for display)
</content>
</invoke>
