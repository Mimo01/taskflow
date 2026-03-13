# Pitfalls Research

**Domain:** Adding Jira Parity features to an existing Jira Data Center v10.3.15 on-premise integration — issue detail view with description rendering, backlog view, epic management, create/edit issues, drag-and-drop sprint board, issue links
**Researched:** 2026-03-13
**Confidence:** HIGH (Jira DC API behavior confirmed in multiple Atlassian KB/community sources) / MEDIUM (DC v10.3.15 specific edge cases, screen config variability)

---

## Critical Pitfalls

---

### Pitfall 1: ADF Is a Jira Cloud v3 API Concept — Jira DC v2 Returns Wiki Markup Strings

**What goes wrong:**
Code designed to parse ADF (Atlassian Document Format) JSON objects will receive plain strings on Jira Data Center. The `description` field in `GET /rest/api/2/issue/{key}` on DC v10.3.15 returns a wiki-markup string, not an ADF JSON object. Attempting to walk an ADF `content` tree on a string silently produces nothing, causing blank description views.

The existing `adfToPlainText()` function in `SearchResultPanel.tsx` already handles this with the `typeof description === 'string'` branch — the full-page issue detail view must use the same defensive pattern and not assume ADF.

However, there is a more dangerous inversion: if you build a rich-text _editor_ (for creating/editing descriptions) and send ADF JSON as the request body to `PUT /rest/api/2/issue/{key}`, Jira DC will reject it or store the raw JSON object as a string literal in the description field. DC v2 expects wiki markup as a plain string in the `description` field of create/update payloads.

**Why it happens:**
ADF is a Jira Cloud-only feature introduced in REST API v3. Jira Data Center uses REST API v2, which predates ADF. The description field on DC has always been stored and returned as a wiki markup string. This distinction is poorly documented in Atlassian's primary developer docs, which feature Cloud/v3 prominently.

**How to avoid:**
- For reading descriptions: always use the existing defensive pattern — `typeof description === 'string'` falls through to wiki markup rendering; objects fall through to ADF walking. On DC, you will always hit the string branch.
- For displaying descriptions: implement a wiki markup renderer (not ADF renderer) for the full-page issue detail view. Key wiki tokens to support: `*bold*`, `_italic_`, `{code}...{code}`, `{noformat}...{noformat}`, `h1.` through `h6.`, `# numbered list`, `* bullet list`, `[link text|url]`, `||table||headers||`, `|row|cells|`.
- For writing descriptions (create/edit): send the description as a plain string. If the user edits in a textarea, send the raw text. Do not serialize a ProseMirror/ADF document to the `description` field.
- For the `JiraIssue` type, keep `description?: string | null` — it will always be a string on this instance. The `unknown` cast in `adfToPlainText` is a forward-compatibility hedge, not a DC reality.

**Warning signs:**
- Full-page issue detail view shows empty description despite Jira UI showing content.
- Description field returns non-empty but your ADF walker produces empty string.
- After editing and saving, the Jira UI shows `{"version":1,"type":"doc","content":[...]}` as literal text in the description field.

**Phase to address:**
Phase that builds the issue detail view and any create/edit description field — before any rich text component is wired to the API.

---

### Pitfall 2: Epic Link Field ID Is Instance-Specific — Must Be Discovered, Not Hardcoded

**What goes wrong:**
The Epic Link field is a custom field added by Jira Software (formerly GreenHopper). Its numeric ID is assigned at install time. While `customfield_10014` is the most common default, it is not guaranteed — instances with many custom fields created before Jira Software was installed may have Epic Link at `customfield_10200` or any other number.

Two additional wrinkles on DC:
1. The `customfield_10014` field name is "Epic Link" — but only if it was created with that name. Some older Agile/GreenHopper upgrades created it as "Feature" or with a different label depending on locale and version.
2. To identify the epic link field reliably, use `GET /rest/api/2/field` and match on `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'`. This is the stable type identifier regardless of field name or numeric ID.

**Why it happens:**
The same root cause as story points: Jira custom field IDs are assigned sequentially at field creation time. On a long-running DC instance, the epic link field may have been created at any point in the system's history.

**How to avoid:**
- Add an `epicLinkFieldKey` discovery to the settings store, alongside `storyPointsFieldKey`. Use `GET /rest/api/2/field` at startup and find the field where `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'`. Fall back to `'customfield_10014'` if not found.
- Use `GET /rest/api/2/field` and also check for `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-label'` to find the "Epic Name" field for display purposes.
- When reading an issue's epic link, use `issue.fields[epicLinkFieldKey]` — this returns the epic issue key string (e.g. `"PROJ-42"`), which you can then use to fetch the epic's summary.
- When writing the epic link (create/edit), send `{ fields: { [epicLinkFieldKey]: "PROJ-42" } }`.
- Do NOT attempt to use the Agile REST API (`/rest/agile/1.0/epic`) to set epic links — the Agile API's epic endpoints are read-oriented on DC and not all DC installations have equivalent write endpoints.

**Warning signs:**
- `issue.fields.customfield_10014` is always `null` even for issues visibly linked to an epic in Jira.
- `GET /rest/api/2/field` returns no field with name "Epic Link" but does return one with schema type `com.pyxis.greenhopper.jira:gh-epic-link`.
- Epic link reads correctly in search results but not in issue detail (field list mismatch — epic link must be in the `?fields=` parameter explicitly).

**Phase to address:**
Phase that adds epic field discovery and epic management features — discover the field key at startup alongside `storyPointsFieldKey`.

---

### Pitfall 3: Backlog JQL Has a Documented Gap — Issues from Closed Sprints Are Invisible

**What goes wrong:**
The intuitive backlog JQL `sprint is EMPTY AND resolution = Unresolved` silently misses a significant class of issues: stories that were in a now-completed sprint but were not completed, and were moved back to the backlog. These issues have a non-empty sprint field (referencing the closed sprint) but are not in any open or future sprint. They appear in the Jira backlog UI but `sprint is EMPTY` excludes them from JQL results.

This is an Atlassian-documented limitation: "if there is an issue which was part of a Sprint and at present the issue sprint is marked as completed however the issue was moved to Backlog, it won't be fetched. You will see the issue in Backlog however not from the JQL results."

The correct query for true backlog semantics is:
```
project = PROJ AND resolution = Unresolved AND issuetype not in subtaskIssueTypes()
AND (sprint is EMPTY OR sprint not in openSprints())
ORDER BY created ASC
```

But this still returns issues in future sprints (planned but not yet started). The fullest backlog match is:
```
project = PROJ AND resolution = Unresolved AND issuetype not in subtaskIssueTypes()
AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints()))
ORDER BY created ASC
```

**Why it happens:**
Jira stores the sprint field as a reference to every sprint the issue has ever been in. `sprint is EMPTY` matches only issues that have never been in any sprint. Issues that passed through a sprint and were pushed back have a non-empty sprint history, so `is EMPTY` returns false. This is counterintuitive for users who think "backlog = not in sprint right now."

**How to avoid:**
- Use the combined `sprint is EMPTY OR sprint not in (openSprints(), futureSprints())` clause.
- Test against the Orange instance with at least one issue that was in a completed sprint and moved back — verify it appears in your backlog query.
- Be aware that `futureSprints()` is a Jira Software JQL function. If Jira Software is not installed (unlikely on this instance since sprints are used), the query fails with a 400. Wrap with the same error handling as `openSprints()` errors.
- The board-level backlog view in Jira applies a board filter on top of this — your app's backlog may legitimately differ from Jira's native backlog if your board has a narrower filter. Document this in the UI: "Shows all unresolved issues not in an active or future sprint."

**Warning signs:**
- User notices specific stories appear in Jira's backlog but not in the app's backlog view.
- All identified missing stories have a sprint field set to a closed sprint in Jira.
- `sprint is EMPTY` query returns fewer results than expected compared to Jira UI.

**Phase to address:**
Phase that builds the backlog view — test JQL correctness against real DC data before building the UI.

---

### Pitfall 4: Move-to-Sprint API Requires Jira Software License and "Edit Issues" + Board Membership

**What goes wrong:**
`POST /rest/agile/1.0/sprint/{sprintId}/issue` with body `{ "issues": ["PROJ-1"] }` fails silently or returns 400/403 for two common reasons:

1. The Agile REST API (`/rest/agile/`) is only available when Jira Software is installed and licensed. On DC instances without Jira Software (using only Jira Core/Service Management), this endpoint returns 404.
2. The permissions check is not just "Edit Issue" — the user also needs to be able to assign issues within the board's permission scheme. A PAT from a developer may have edit rights but fail this check if the board is restricted.

Additionally, the endpoint accepts up to 50 issue keys per call. Moving 100 backlog issues to a sprint requires two calls.

**Why it happens:**
The Agile REST API is a Jira Software extension, not a core Jira API. Its availability is license-gated. This trips up developers who test against their cloud or developer instance but deploy against a DC instance with different licensing.

**How to avoid:**
- Add a capability check: if `fetchActiveSprint` (which uses the Agile API) returns null due to a non-ok response, record that the Agile API may be unavailable and disable backlog-to-sprint move actions.
- Use `{ "issues": [key] }` body format exactly — not `{ "issueKeys": [...] }` (wrong field name).
- Handle the 50-issue limit: chunk calls if more than 50 issues are selected.
- On 403, show a user-visible error: "You don't have permission to move issues to sprints." Do not silently swallow.
- On 404 on the Agile endpoint, show: "Sprint management requires Jira Software." (Unlikely on this instance since sprints are already working via `openSprints()` JQL, but defensive.)

**Warning signs:**
- `POST /rest/agile/1.0/sprint/{id}/issue` returns 404 (Agile API not available).
- Returns 400 with body mentioning "maximum 50 issues" when moving many issues.
- Returns 403 when the user has edit access but not board-level permission.

**Phase to address:**
Phase that builds backlog move-to-sprint and sprint board drag-to-reorder — add capability check and chunking before UI is built.

---

### Pitfall 5: Create Issue Validation Errors Are Instance-Specific — "Field Not on Screen" Is the Main Blocker

**What goes wrong:**
`POST /rest/api/2/issue` returns 400 with `errors: { "customfield_XXXXX": "Field 'customfield_XXXXX' cannot be set. It is not on the appropriate screen, or unknown." }` even when the field exists on the Jira instance.

This error means the field exists in Jira but has not been added to the "Create Issue" screen for the relevant project's screen scheme. The API surface does not match the UI surface: a field that admins added to the view/edit screen may be absent from the create screen.

A second category of error: `errors: { "summary": "Field 'summary' cannot be set" }` — this almost never happens, but `errors: { "issuetype": "Choose a valid issue type" }` happens when the `issuetype` sent is not a valid member of the project's issue type scheme.

**Why it happens:**
Jira has a three-level screen configuration: field configuration → screen → screen scheme → issue type screen scheme → project. A field that is "required" in the field configuration but absent from the create screen produces the "not on appropriate screen" error. This configuration is entirely instance-specific and cannot be predicted from outside the instance.

**How to avoid:**
- Before building the create form, call `GET /rest/api/2/issue/createmeta?projectKeys=PROJ&issuetypeNames=Story&expand=projects.issuetypes.fields` to discover which fields are available and required for the "Story" issue type in this project. Use this to build the form dynamically.
- Note: on DC v10.3+, the `createmeta` endpoint may be slow on large instances (it expands all field metadata). The alternative is `GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes` and then `GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` for field-level metadata per issue type.
- Do not hardcode a fixed set of fields in the create payload. Only send fields that `createmeta` confirms are available for the issue type.
- When a field is marked `required: true` in `createmeta`, block form submission until it has a value.
- Parse the `errors` object from 400 responses and display per-field validation messages to the user rather than a generic error string.
- Custom field for "Account" (the account custom field referenced in PROJECT.md): discover its ID from `createmeta` or from `GET /rest/api/2/field`. Its format on DC will be a user picker object (`{ "name": "username" }`) or a string depending on how it was configured.

**Warning signs:**
- Create issue succeeds in test but fails on Orange's Jira instance with "not on appropriate screen."
- Hardcoded field list includes a field that the Orange project's create screen does not include.
- 400 response `errors` object contains per-field messages but the app shows only a generic error.

**Phase to address:**
Phase that builds create/edit issue forms — `createmeta` call must be the first thing implemented, before any form UI.

---

### Pitfall 6: Drag-and-Drop Optimistic Updates Have a Documented Flicker With TanStack Query as the Source of Truth

**What goes wrong:**
Using TanStack Query's cache as the sole source of truth for drag-and-drop ordering causes a visible flash: when a card is dropped, `setQueryData` updates the cache, but DnD Kit (or any DnD library) has its own internal state that momentarily reverts to the pre-drop position before the re-render from the cache update settles. Users see the card snap back for a split second.

A more severe failure: if two rapid drag operations occur (user drags card A, then quickly drags card B before card A's API call completes), the `onSettled` refetch from the first mutation overwrites the local cache with server-state that doesn't reflect the second operation yet, causing a jarring reorder.

**Why it happens:**
DnD Kit and TanStack Query are two independent state systems. DnD Kit manages drag state internally; TanStack Query manages server cache. Attempting to use TanStack Query cache as the authoritative drag position creates a timing mismatch across two render cycles.

**How to avoid:**
- Use a hybrid pattern: maintain `localOrder` in component `useState` that holds the current card order. On drop, immediately set `localOrder` to the new order (synchronous, no flicker). Fire the mutation to update the server (move to sprint, or update sprint ranking). In `onError`, reset `localOrder` to the pre-drag snapshot. In `onSettled`, call `invalidateQueries` to sync server truth.
- The `localOrder` state is temporary (cleared after refetch resolves) — it exists only to fill the render gap between drop and server confirmation.
- For sprint board status transitions via drag (moving a card between columns = status change): this is the same optimistic update pattern already used in `StatusPopover`. Reuse the same pattern — snapshot the old status in `onMutate`, apply optimistic in `setQueryData`, rollback in `onError`.
- Cancel in-flight queries before applying optimistic updates: `await queryClient.cancelQueries({ queryKey })` in `onMutate`.
- For the move-to-sprint drag (backlog → sprint column), the server call is `POST /rest/agile/1.0/sprint/{sprintId}/issue`. Optimistic update: remove the issue from backlog cache and add it to sprint cache. Rollback: reverse both cache operations.

**Warning signs:**
- Card visibly snaps back to original position for one frame after drop.
- Console shows TanStack Query refetch completing after a drag, resetting order unexpectedly.
- Two rapid drags leave the board in an inconsistent state.

**Phase to address:**
Phase that builds drag-to-move sprint board and backlog move-to-sprint — implement `localOrder` pattern before connecting to the API.

---

### Pitfall 7: Issue Links API Requires Link Type ID Discovery — Type Names and IDs Are Instance-Specific

**What goes wrong:**
`POST /rest/api/2/issueLink` requires a `type` object with the link type name (e.g., `"Blocks"`, `"Duplicates"`, `"Relates"`) or its numeric ID. The link type names are admin-configurable. Common defaults exist (`"Blocks"`, `"Clones"`, `"Duplicates"`, `"Relates"`) but an Orange-specific instance may have additional or renamed types.

When reading linked issues, `issue.fields.issuelinks` contains objects with `type.name`, `type.inward`, and `type.outward` strings — these are always present for read operations. For write operations, you need the exact `type.name` string or `type.id`.

**Why it happens:**
Jira allows admins to create, rename, and delete issue link types. The `name` field in the `type` object when creating a link must exactly match an existing link type name. Attempting to use `"is blocked by"` (inward direction description) instead of `"Blocks"` (type name) causes a 400 error.

**How to avoid:**
- Call `GET /rest/api/2/issueLinkType` at startup or on demand to discover all available link types. Response: `{ "issueLinkTypes": [{ "id": "10001", "name": "Blocks", "inward": "is blocked by", "outward": "blocks" }, ...] }`.
- Cache the result (it changes rarely — an app restart or 24h TTL is sufficient).
- Build the "add link" UI from the discovered list, not from a hardcoded set.
- When reading linked issues in the issue detail view, use `issuelink.type.outward` or `issuelink.type.inward` for display (these are the human-readable direction labels). Use `issuelink.type.name` only for write operations.
- Note: `issue.fields.issuelinks` is not returned by default — add `issuelinks` to the `?fields=` parameter when fetching the full issue detail.

**Warning signs:**
- `POST /rest/api/2/issueLink` returns 400 with `errors: { "linkType": "That link type ID is not valid" }`.
- The link type dropdown shows hardcoded values that don't match what the Orange instance has configured.
- `issue.fields.issuelinks` is always undefined even though the issue has links visible in Jira UI — `issuelinks` missing from `?fields=`.

**Phase to address:**
Phase that builds issue detail view (reading links) and create/edit issue (adding links) — discover link types from the API; never hardcode.

---

### Pitfall 8: Epic Fetch Strategy — REST v2 vs Agile API Mismatch for Epic Issues List

**What goes wrong:**
There are two ways to fetch issues belonging to an epic on DC:

1. **REST v2 JQL**: `"Epic Link" = PROJ-42` — unreliable because "Epic Link" is a human-readable field name. If the field is named differently on the instance, this fails with JQL parse error.
2. **Agile API**: `GET /rest/agile/1.0/epic/{epicId}/issue` — returns issues in the epic, but requires knowing the epic's internal numeric `id` (not its key), and returns Agile board representations not full `JiraIssue` objects.

The safe approach is REST v2 JQL using the discovered epic link field key: `${epicLinkFieldKey} = PROJ-42` — this uses the field ID not the display name, so it is immune to renaming.

Additionally, fetching the epic list itself: `GET /rest/agile/1.0/board/{boardId}/epic` returns epics for a board. This requires board ID discovery (already done in `fetchActiveSprint`). But the Agile epic endpoint returns minimal data — just id, key, name, color. To get full issue details for epics (summary, description, status), fetch them as regular issues via `GET /rest/api/2/issue/{key}` or JQL `issuetype = Epic AND project = PROJ`.

**Why it happens:**
Epics in Jira Data Center exist in a hybrid state: they are real issue types (queryable via REST v2 JQL) but also have Agile API representations for board views. The Agile API predates REST v2 epic support and the two surfaces don't return identical fields.

**How to avoid:**
- Fetch the epic list via JQL: `project = PROJ AND issuetype = Epic AND resolution = Unresolved ORDER BY created ASC` using `GET /rest/api/2/search`. This returns full `JiraIssue` objects with all requested fields.
- To fetch issues in an epic for the epic detail page, use JQL: `project = PROJ AND ${epicLinkFieldKey} = EPIC-KEY AND resolution = Unresolved`. Never use the human-readable field name "Epic Link" in JQL.
- To create an epic: `POST /rest/api/2/issue` with `issuetype: { name: "Epic" }` and `customfield_XXXXX: "Epic Name"` where XXXXX is the epic name field (discover via `GET /rest/api/2/field` looking for `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-label'`).
- Avoid the Agile epic endpoints for primary data fetching — use them only if REST v2 JQL results differ from what the Jira UI shows.

**Warning signs:**
- JQL `"Epic Link" = PROJ-42` fails with 400 "Field 'Epic Link' does not exist or you do not have permission to view it."
- Agile API returns epics but the data lacks `description`, `status.statusCategory`, `assignee`.
- Epic name field is missing from create issue form — epic name field key not discovered.

**Phase to address:**
Phase that builds epic list, epic detail, and create epic — discover both epic link field key and epic name field key at startup.

---

### Pitfall 9: TanStack Query Cache Keys Must Include New Field Lists or Stale Responses Break New Features

**What goes wrong:**
Adding new fields to existing `fetchSprintIssues` or `fetchMyTasksHierarchy` calls (e.g., adding `issuelinks`, `epicLinkFieldKey` value, or `comment`) without updating the query key causes TanStack Query to serve cached responses that lack the new fields. On the issue detail view, `issue.fields.issuelinks` is `undefined` even though the field is now in the fetch call — the old cache object is served.

This is especially insidious because the bug disappears after the cache TTL expires (typically `staleTime` of 5 minutes), making it a "works after refresh" bug.

**Why it happens:**
TanStack Query's cache key is the identity of a query. If the key doesn't change when the fetched data structure changes, the stale cache entry is reused. The `storyPointsFieldKey` is already in the query key for this reason — but new fields added to the `?fields=` parameter are not automatically reflected in the key.

**How to avoid:**
- The issue detail view should fetch the full issue via `GET /rest/api/2/issue/{key}?fields=summary,status,assignee,description,issuetype,subtasks,issuelinks,comment,${epicLinkFieldKey},${storyPointsFieldKey},timetracking,priority,labels,fixVersions,parent` independently, with query key `['jira-issue-detail', issueKey, jiraBaseUrl]`. This avoids polluting the sprint board's cache with heavy fields and eliminates the stale-cache problem for issue detail.
- For the sprint board: add `epicLinkFieldKey` to the sprint-board query key so that a new field discovery triggers a fresh fetch.
- Never add heavy fields (`comment`, `issuelinks`) to `fetchSprintIssues` — those are for detail views only, fetched per-issue on demand.

**Warning signs:**
- Issue detail view shows `undefined` for `issuelinks` or `description` despite the fetch including them.
- Bug resolves after clearing storage or waiting 5+ minutes.
- Network inspector shows the issue detail fetch is not being made (cache hit from sprint board query is being returned instead).

**Phase to address:**
Phase that builds issue detail view — use a separate `['jira-issue-detail', key]` query, never reuse the sprint-board query for per-issue detail.

---

### Pitfall 10: Wiki Markup Rendering Scope — What Must Be Supported vs What Can Be Deferred

**What goes wrong:**
Building a full wiki markup renderer is a significant effort. Missing key tokens causes descriptions to look broken or confusing (raw `*bold*` markers instead of rendered bold). Over-engineering a perfect renderer wastes time.

Common wiki markup tokens that appear in real Jira DC descriptions:
- `*bold*`, `_italic_`, `-strikethrough-`, `+underline+`, `^superscript^`, `~subscript~`
- `{code}...{code}`, `{code:java}...{code}`, `{noformat}...{noformat}`
- `h1.` through `h6.` headings
- `* item` (unordered list), `# item` (ordered list)
- `[link text|url]`, `[url]`
- `||heading||` / `|cell|` tables
- `----` horizontal rule
- `{color:red}...{color}` (rare, skip for now)
- `!image.png!` attachments (skip — no attachment support)

**Why it happens:**
Teams using Jira DC for years accumulate rich descriptions written in the wiki markup editor. An app that shows raw wiki markup instead of rendered content appears low-quality.

**How to avoid:**
- Implement a minimal wiki-to-HTML/React renderer covering the tokens listed above. A simple regex-based approach per line is sufficient.
- Use a library if available: `jira2md` (npm) converts Jira wiki markup to Markdown, which can then be rendered with an existing Markdown library. This is the practical approach.
- Check if `jira2md` is actively maintained before adopting. As of 2025, the ecosystem has alternatives — verify at plan time.
- For the create/edit description textarea: let the user type raw text. Show a "Preview" toggle that renders the wiki markup. Do not invest in a full WYSIWYG editor — the text area with preview is sufficient for v1.2.

**Warning signs:**
- Description shows raw `*bold*` and `{code}` delimiters instead of formatted content.
- Users complain that descriptions are unreadable.

**Phase to address:**
Phase that builds the issue detail view — implement or wire wiki markup rendering before the description section is shipped.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `customfield_10014` for epic link | No field discovery needed | Breaks on any DC instance where ID differs | Never — the field ID varies; must discover |
| Use "Epic Link" (display name) in JQL directly | No field key lookup needed | JQL parse error if field is renamed | Never |
| Send description as ADF JSON to DC v2 create endpoint | Familiar format from Cloud docs | Description stored as JSON literal string in Jira | Never |
| Use `sprint is EMPTY` alone for backlog JQL | Simpler query | Silently misses issues from closed sprints | Never |
| Single drag-drop optimistic update via `setQueryData` only | No extra state management | One-frame flicker; broken on rapid sequential drags | Never for drag-drop; acceptable for single-click status transitions |
| Hardcode issue link type names (`"Blocks"`, `"Relates"`) | No API call for link types | Fails on instance with renamed/custom link types | Never for write operations; acceptable for display labeling if read from API response |
| Fetch full issue detail from sprint-board cache | No extra API call | Stale cache serves response without new fields (issuelinks, comment) | Never — issue detail requires its own query |
| Call `createmeta` once and cache forever (session lifetime) | Fewer API calls | Stale required-fields definition if admin changes screen config | Acceptable — cache per session; show field validation errors gracefully |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira DC v2 — description field | Assuming ADF JSON format from Cloud docs | Description is a wiki markup string on DC; render with wiki parser, write as plain string |
| Jira DC v2 — epic link field | Hardcoding `customfield_10014` | Discover at startup via `GET /rest/api/2/field` matching `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'` |
| Jira DC v2 — backlog JQL | Using `sprint is EMPTY` only | Use `sprint is EMPTY OR sprint not in (openSprints(), futureSprints())` |
| Jira Agile API — move to sprint | Calling `/rest/agile/1.0/sprint/{id}/issue` without capability check | Check Agile API availability; handle 50-issue batch limit; show 403 as user-visible error |
| Jira DC v2 — create issue | Sending all known fields regardless of screen config | Call `createmeta` first; only send fields that appear in `createmeta` response for the issue type |
| Jira DC v2 — create issue errors | Showing a generic error on 400 | Parse `errors` and `errorMessages` from 400 response body; display per-field messages |
| Jira DC v2 — issue link types | Using `"is blocked by"` (inward description) as type identifier | Use `type.name` (e.g. `"Blocks"`) for writes; discover all types via `GET /rest/api/2/issueLinkType` |
| Jira DC v2 — issue links in fetch | Not including `issuelinks` in `?fields=` | Always list `issuelinks` explicitly when fetching the issue detail |
| Jira DC v2 — epic issues list | Using Agile API `/rest/agile/1.0/epic/{id}/issue` | Use JQL `${epicLinkFieldKey} = EPIC-KEY` against `/rest/api/2/search` |
| TanStack Query — drag-drop | Setting query cache as sole drag state source | Maintain `localOrder` in component state; use cache only for server sync |
| TanStack Query — issue detail fields | Adding fields to sprint-board query to power issue detail | Use a separate `['jira-issue-detail', key]` query; never load detail-only fields in the board query |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all epics' issue lists on backlog page load | N epic-detail API calls on backlog render | Only fetch epic issues when the user opens an epic detail or filters by epic | At >5 epics in the project |
| Calling `createmeta` on every create-form open | Slow form load; repeated heavy API call | Cache `createmeta` result per session (or per hour) in a React ref or query with `staleTime: 60 * 60 * 1000` | Every form open if not cached |
| Adding `comment`, `description`, `issuelinks` to `fetchSprintIssues` | Sprint board query becomes very heavy; all 50 issues fetch full comment lists | Fetch detail-only fields per-issue on demand, not in the board sweep | Immediately noticeable — 50 issues × full comment lists = large payload |
| Fetching issue detail inline in the sprint board drag layer | Re-fetches issue on every drag-over event | Fetch issue detail once on card click/expand, not on drag | At >10 concurrent drags (theoretical) |
| Invalidating all `jira-issues` queries on any mutation | All board, backlog, and my-tasks queries refetch simultaneously after a single transition | Invalidate only the specific query key affected; for cross-view consistency, limit to the two or three affected keys | At first use — causes visible loading on all tabs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full issue payloads (including `description`) to the debug log store | Work content (customer names, project details) written to a debug log that may be shared | Log only API call metadata (URL, status, duration) — never log response body for issue content |
| Interpolating user-supplied text directly into JQL without validation | JQL injection — a user who crafts a search query with `" OR project != X` could bypass project scope | Jira issue keys are validated to `[A-Z]+-\d+`; free text search uses `text ~ "..."` with the query escaped (replace `"` with `\"`); never interpolate raw user input as a JQL clause |
| Storing the epic link field key or issue link type list in plaintext without validation | Low risk — field keys are non-secret | Not a meaningful security concern; field metadata is not sensitive |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw wiki markup instead of rendered description | Description appears broken and unreadable | Implement wiki markup renderer before shipping issue detail |
| Empty "Backlog" view when issues exist in closed sprints | User loses trust; thinks the app is broken | Use the combined `sprint is EMPTY OR sprint not in (openSprints(), futureSprints())` JQL; add a note if the query differs from Jira's board backlog |
| Blocking create-issue on all optional fields that `createmeta` marks "required" at the project level | User cannot create issue even with summary + issue type | Distinguish `required: true` fields that are on the create screen from those that are not; only block on fields that are both required AND on the screen |
| Generic "Something went wrong" on create-issue 400 | User doesn't know which field caused the error | Parse the `errors` map from the 400 body and show inline per-field error messages |
| Card flicker on drag-and-drop | Jarring UX; looks like a bug | Implement `localOrder` pattern; use library-native sortable state, not query cache, as drag source of truth |
| Showing epic link field when it is unavailable on the create screen | User sees a field, fills it in, then gets 400 | Only show fields that `createmeta` confirms are on the create screen for the selected issue type |
| Moving issue to sprint with no feedback for 400ms API latency | User thinks the drag didn't register | Show immediate optimistic card move; display error if API call fails with rollback |

---

## "Looks Done But Isn't" Checklist

- [ ] **Description rendering:** Open an issue with a complex description in Jira UI (tables, code blocks, headers) — verify the app renders equivalent content, not raw `{code}` literals.
- [ ] **Epic link field:** Check `GET /rest/api/2/field` response for `com.pyxis.greenhopper.jira:gh-epic-link` schema type — confirm the discovered key is not `customfield_10014` if the instance assigned it differently.
- [ ] **Backlog completeness:** Find an issue that was in a now-closed sprint and was moved back to the backlog — confirm it appears in the app's backlog view.
- [ ] **Move to sprint:** Attempt move-to-sprint as a developer user (not admin) — verify the PAT's permissions are sufficient; confirm 403 is surfaced as a readable error not a silent failure.
- [ ] **Create issue required fields:** Open the create form and try submitting with only `summary` — verify that any truly required fields (per `createmeta`) prevent submission with clear error messages.
- [ ] **Create issue with epic link:** Create a story and set its epic link — verify the issue appears under the correct epic in Jira UI after creation.
- [ ] **Issue links read:** Open an issue that has linked issues in Jira — verify `issuelinks` is populated (check the `?fields=` parameter includes `issuelinks`).
- [ ] **Issue links write:** Add an issue link via the app — verify the correct `type.name` from `GET /rest/api/2/issueLinkType` is used, not a hardcoded string.
- [ ] **Drag-drop flicker:** Drag a card from one sprint column to another — verify no one-frame snap-back occurs.
- [ ] **Drag-drop rollback:** Simulate API failure for move-to-sprint (via network throttle + abort) — verify card returns to original position with a user-visible error.
- [ ] **Cache key correctness:** After adding `epicLinkFieldKey` to sprint-board fetch, verify old cache is not served — confirm the query key includes the epic field key.
- [ ] **Create issue screen validation:** Submit the create form with a field that is NOT on Orange's create screen — verify the app shows the per-field error from the 400 response, not a generic message.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Description stored as ADF JSON literal string after wrong write | MEDIUM | Fix write payload (send string not object); already-corrupted descriptions require manual edit in Jira UI |
| Epic link field hardcoded wrong | LOW | Add `discoverEpicLinkField()` to settings store alongside `discoverStoryPointsField()`; update all usages |
| Backlog missing closed-sprint issues | LOW | Update JQL to add `OR sprint not in (openSprints(), futureSprints())` clause |
| Move-to-sprint 403 silent failure | LOW | Add `.ok` check and surface error to user |
| Create issue 400 showing generic error | LOW | Parse `response.json().errors` and display per-field |
| Drag-drop flicker shipped | LOW | Introduce `localOrder` state in the board component; 1-2 hour fix |
| Issue detail showing stale data missing `issuelinks` | LOW | Introduce separate `['jira-issue-detail', key]` query; invalidate on mutation |
| Issue link type hardcoded names fail | LOW | Call `GET /rest/api/2/issueLinkType` and build type options from response |
| `createmeta` too slow on large instance | MEDIUM | Use paginated createmeta endpoints (DC 8.4+); cache per session with `staleTime: Infinity` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ADF vs wiki markup description format (Pitfall 1) | Phase: Issue detail view + create/edit description | Description renders correctly for an issue with tables and code blocks; create sends string not ADF object |
| Epic link field ID discovery (Pitfall 2) | Phase: Epic management setup — add `discoverEpicLinkField()` to settings store before any epic UI | `epicLinkFieldKey` in settings store resolves to correct field key on Orange instance |
| Backlog JQL gap for closed-sprint issues (Pitfall 3) | Phase: Backlog view — JQL design before UI | Manual verification: a previously-in-sprint issue appears in the backlog view |
| Move-to-sprint API permissions and limits (Pitfall 4) | Phase: Backlog view + drag-drop — capability check before UI | Move-to-sprint works for developer PAT; 403 surfaced as error; 50-issue chunking tested |
| Create issue validation errors (Pitfall 5) | Phase: Create/edit issue — `createmeta` call before form build | Per-field error messages shown on 400; required fields respected per `createmeta` |
| Drag-drop optimistic update flicker (Pitfall 6) | Phase: Sprint board drag-to-move — `localOrder` pattern before wiring to API | No visible flicker after drop; rollback on simulated failure |
| Issue link type IDs (Pitfall 7) | Phase: Issue detail (read links) + create/edit (add links) | Link type dropdown built from `GET /rest/api/2/issueLinkType`; write uses `type.name` from API response |
| Epic fetch strategy (REST v2 vs Agile API) (Pitfall 8) | Phase: Epic management — use JQL not Agile API for issue lists | Epic issues list uses `${epicLinkFieldKey} = KEY` JQL; epic list uses `issuetype = Epic` JQL |
| TanStack Query cache key and stale field list (Pitfall 9) | Phase: Issue detail view — separate query key | Issue detail fetches independently; sprint board query not polluted with detail-only fields |
| Wiki markup rendering scope (Pitfall 10) | Phase: Issue detail view — renderer before shipping | Description with `{code}`, `*bold*`, `h2.` heading renders visually correctly |

---

## Sources

| Finding | Confidence | Source |
|---------|------------|--------|
| ADF is Cloud v3 only; DC v2 returns wiki markup strings | HIGH | Atlassian community: "For all the v2 endpoints for any Jira platform type, the content of Description field is plain text with optional Wiki markup"; multiple community confirmations |
| Epic link field ID varies; stable identifier is `schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'` | HIGH | Atlassian community: "Can we edit EPIC Link as a customfield_13386 using jira rest api 2"; Atlassian greenhopper API docs; community thread on epic link field discovery |
| Backlog JQL `sprint is EMPTY` silently misses issues from closed sprints | HIGH | Atlassian Support KB: "JQL to fetch Issues in scrum board Backlog and not part of Sprint" — explicit statement about this limitation |
| Move-to-sprint endpoint `POST /rest/agile/1.0/sprint/{id}/issue` max 50 issues; requires assign-issue permission | MEDIUM | Atlassian community: "How to move Jira issues to a specific sprint via REST API?"; Jira Agile Server REST API reference |
| "Field not on appropriate screen" error from create issue; `createmeta` is the correct discovery path | HIGH | Atlassian Developer Community: "Field 'customfield_XXXX' cannot be set. It is not on the appropriate screen, or unknown."; Atlassian server REST API examples |
| Drag-drop with TanStack Query: flicker due to dual state systems; `localOrder` hybrid pattern is recommended | HIGH | DnD Kit GitHub Discussion #1522: "React Query with DnD Kit: Item Goes Back to Original Position"; TanStack Query docs on optimistic updates |
| Issue link type names are admin-configurable; discover via `GET /rest/api/2/issueLinkType` | HIGH | Atlassian Support KB: "How to use REST API to add issue links in JIRA issues"; Atlassian DC REST API reference |
| `createmeta` endpoint slow on large DC instances; paginated variant recommended for DC 8.4+ | MEDIUM | Atlassian REST API examples note: "reported to cause issues especially on larger instances" |
| `issuelinks` field must be explicitly requested in `?fields=` parameter | HIGH | Atlassian community: "Get Issue links via Jira Server REST API" — confirmed navigable field requiring explicit request |
| Epic list best fetched via JQL `issuetype = Epic`; Agile API epic endpoints return minimal data | MEDIUM | Atlassian community: "How to get Epic Link (custom field) from JIRA Data Center" thread; Atlassian Agile REST API reference (epic endpoint field set) |

- Atlassian Support KB — Backlog JQL: https://support.atlassian.com/jira/kb/jql-to-fetch-issues-in-scrum-board-backlog-and-not-part-of-sprint/
- Atlassian Developer Community — Field not on screen: https://community.developer.atlassian.com/t/field-customfield-xxxx-cannot-be-set-it-is-not-on-the-appropriate-screen-or-unknown/48732
- Atlassian Support KB — Update Epic Link via REST API: https://support.atlassian.com/jira/kb/update-epic-link-via-rest-api/
- Atlassian Support KB — Issue Links via REST API: https://support.atlassian.com/jira/kb/how-to-use-rest-api-to-add-issue-links-in-jira-issues/
- Atlassian Server REST API Examples: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
- DnD Kit Discussion #1522 — Flicker with React Query: https://github.com/clauderic/dnd-kit/discussions/1522
- TanStack Query Optimistic Updates: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
- tkdodo — Concurrent Optimistic Updates: https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query
- Atlassian Jira Software Agile REST API Reference: https://docs.atlassian.com/jira-software/REST/7.3.1/

---
*Pitfalls research for: Jira Data Center v10.3.15 — v1.2 Jira Parity (issue detail, backlog, epics, create/edit, drag-drop, issue links)*
*Researched: 2026-03-13*
