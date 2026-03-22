# Pitfalls Research

**Domain:** Adding dashboard customization, activity history, and Jira/GitLab feature parity to existing Tauri 2/React desktop app
**Researched:** 2026-03-22
**Confidence:** HIGH (codebase patterns verified against existing code, Jira DC API behavior cross-referenced with Atlassian community forums and official docs)

## Critical Pitfalls

### Pitfall 1: Changelog expand=changelog Returns Max 100 Items Silently

**What goes wrong:**
Using `?expand=changelog` on the issue endpoint (`/rest/api/2/issue/{key}?expand=changelog`) returns only the most recent 100 changelog entries. There is no indication that results are truncated -- the response simply stops at 100 items. Issues with extensive history (status changes, field edits, reassignments over months) will show incomplete activity timelines.

**Why it happens:**
The issue endpoint's expand parameter hard-caps changelog at 100 entries. This is not documented in the response envelope -- there is no `total` field in the changelog portion to signal truncation. Developers test with recent issues that have fewer than 100 changes and never discover the limit.

**How to avoid:**
Use the dedicated changelog endpoint: `GET /rest/api/2/issue/{issueKey}/changelog?startAt=0&maxResults=100`. This endpoint returns proper pagination metadata (`startAt`, `maxResults`, `total`) and supports the same `fetchAllPages` loop pattern already established in `taskflow/src/services/jira/client.ts`. Never use `expand=changelog` on the issue endpoint for activity history.

**Warning signs:**
- Activity timeline stops abruptly at a consistent point for old issues
- Issues known to have many transitions show fewer entries than expected
- No `total` field in the changelog portion of the issue response

**Phase to address:**
Activity History phase -- must use the paginated changelog endpoint from the start. Retrofitting pagination after building on expand=changelog requires rewriting the data layer.

---

### Pitfall 2: Attachment Downloads Fail with PAT Bearer Token on Jira DC

**What goes wrong:**
Jira Data Center's attachment content URLs (e.g., `https://jira.example.com/secure/attachment/12345/file.png`) are served by the web application layer, not the REST API. Bearer token authentication via PAT does not create a full session, so requests to these URLs redirect to the HTML login page instead of returning the file content. The existing `apiFetch` wrapper (via `@tauri-apps/plugin-http` fetch) receives an HTML response with status 200 (the login page), not the binary attachment.

**Why it happens:**
PAT bearer tokens authenticate REST API endpoints (`/rest/api/2/*`), but attachment content URLs live outside the REST API scope. Jira DC treats attachment downloads as web-session requests. This is a known Jira DC limitation documented in JRASERVER-72019. The Tauri plugin-http fetch follows the redirect transparently, masking the failure -- the response looks successful but contains HTML.

**How to avoid:**
(1) Fetch attachment metadata via REST API (`/rest/api/2/issue/{key}?fields=attachment` -- this works with PAT and returns `content` URLs, `filename`, `mimeType`, `size`). (2) For actual file download, first attempt a direct fetch with the Bearer token -- Jira DC v10.x may have fixed this limitation. (3) If the response content-type is `text/html` (login page redirect), fall back to session-cookie auth: authenticate PAT against `/rest/auth/1/session` to obtain a session cookie, then retry the content URL with that cookie. (4) If session-cookie approach also fails, use Tauri's `shell.open()` to open the attachment URL in the system browser as the final fallback. (5) Build a `downloadAttachment` helper in a new `jira/attachments.ts` service module that handles this negotiation transparently. (6) Prototype this mechanism early -- if the target Jira DC instance does not support PAT-based attachment downloads, the fallback (open in browser) must be the designed UX, not an afterthought.

**Warning signs:**
- Attachment preview shows HTML content or blank iframe
- Image thumbnails fail to load but metadata (filename, size) appears correctly
- Response content-type is `text/html` instead of the expected MIME type
- Binary file downloads produce corrupt files (HTML wrapped in binary extension)

**Phase to address:**
Attachments Viewer phase -- must prototype the download mechanism before building the viewer UI. This is a blocking technical investigation.

---

### Pitfall 3: Widget Layout State Causes Full Dashboard Remount on Every Drag

**What goes wrong:**
Storing widget layout in a Zustand store and passing it as props to the grid component causes React to re-render every widget on every drag/resize event. With data-fetching widgets (TanStack Query hooks), this triggers query re-subscriptions, loading spinners, and visible flicker. The dashboard becomes unusable during layout customization.

**Why it happens:**
`react-grid-layout` fires `onLayoutChange` on every pixel of drag movement. If the layout array reference changes in the parent component's state on each event, React reconciliation sees new props and remounts all grid children. This is documented in react-grid-layout issue #945. The codebase's existing pattern of prop threading (per PROJECT.md: "Prop threading for onIssueClick, not React context") amplifies this because layout changes propagate through the entire component tree.

**How to avoid:**
(1) Use `React.memo` on every widget component with stable keys. (2) Store layout in a `useRef` during drag operations, only committing to Zustand state on `onDragStop`/`onResizeStop` (not `onLayoutChange`). (3) Debounce persistence to Tauri Store -- write layout to disk at most once per second after drag stops. (4) Keep widget content components completely decoupled from layout state -- widgets must not receive layout coordinates as props. (5) Use `useMemo` for the layout array to maintain referential stability when not dragging.

**Warning signs:**
- Console shows TanStack Query re-fetching during drag operations
- Widget content flickers or shows loading state during resize
- CPU spikes during drag visible in performance profiler
- The existing operation profiler waterfall shows redundant API calls during drag

**Phase to address:**
Dashboard Redesign phase -- the widget container architecture must be designed with this constraint from day one. Adding memoization retroactively to 10+ widget types is error-prone.

---

### Pitfall 4: Settings Store Migration Breaks Existing Users on Version Bump

**What goes wrong:**
The settings store is already at version 8 with 8 cumulative migrations and 60+ fields. Adding new fields for dashboard layout, sidebar customization, saved filters, and widget preferences requires careful version increments. A migration that incorrectly handles the `undefined` case for new fields, or that destructively modifies existing fields (e.g., converting `role` from a string to a sidebar preset object), causes existing users to lose their settings or see a blank app state on first launch after update.

**Why it happens:**
Zustand's persist middleware runs migrations sequentially. If version 9 adds `dashboardLayout` but does not check `if (s.dashboardLayout === undefined)`, users migrating from version 7 (who skipped v1.4) may hit unexpected states. The `as Record<string, unknown>` cast in the migrate function masks type errors at compile time. The codebase has already encountered this exact pattern -- the v1.4 migration from `debugMode` boolean to 6 granular toggles required careful conditional migration.

**How to avoid:**
(1) Each new version migration must guard every new field with `if (s.fieldName === undefined) s.fieldName = defaultValue`. (2) Never rename or restructure existing fields -- add new fields alongside old ones and deprecate gracefully. (3) The `role` field must remain as-is (`'developer' | 'pm' | 'tech-lead' | null`); sidebar presets should reference it, not replace it. (4) Add a migration test for each version bump that starts from version 0 state and migrates through all versions. (5) Split dashboard layout and sidebar config into separate stores (`dashboard.store.ts`, `sidebar.store.ts`) to avoid bloating settings.store.ts further. The existing codebase already uses separate stores for different concerns: `auth.store.ts`, `filter.store.ts`, `pinned-tabs.store.ts`, `recent-items.store.ts`.

**Warning signs:**
- App loads with default settings (light theme, no role selected) after update instead of user's configured state
- `quickFilters` array disappears after update
- Console errors about undefined properties during store rehydration
- Onboarding screen reappears for existing users

**Phase to address:**
First phase that touches persistence (likely Dashboard Redesign) -- establish the new store files and migration pattern before any other feature phase adds to them.

---

### Pitfall 5: Bulk Operations Leave Jira in Inconsistent State on Partial Failure

**What goes wrong:**
When performing bulk operations (e.g., transitioning 15 issues to "Done", bulk assigning, bulk labeling), some requests succeed and some fail. Without proper tracking, the UI shows either all-success or all-failure, leaving the user uncertain about which issues were actually modified. Retrying the operation double-applies changes to already-modified issues (e.g., duplicate comments, duplicate label additions).

**Why it happens:**
Jira DC REST API has no native bulk-update endpoint for arbitrary field changes. Each issue requires a separate PUT request. Network hiccups, rate limiting (Jira DC has configurable rate limits with a token-bucket approach since v8.6, and the target instance is v10.3.15), or per-issue permission differences cause partial failures. Implementing with `Promise.all` (instead of `Promise.allSettled`) short-circuits on first failure, abandoning remaining operations.

**How to avoid:**
(1) Always use `Promise.allSettled`, never `Promise.all`, for bulk operations. (2) Track per-issue success/failure state in the UI with a progress indicator showing "X of Y complete, Z failed". (3) Implement idempotency checks where possible -- before transitioning, check current status; before assigning, check current assignee. (4) Check `x-ratelimit-remaining` response header and throttle requests when tokens are low. (5) Provide a "retry failed only" button that re-processes only the failed subset. (6) Cap batch size at 25-50 issues to keep the operation manageable and reduce blast radius. (7) Use sequential execution with a concurrency limit (e.g., 5 parallel requests) rather than firing all N requests simultaneously -- this respects rate limits and reduces server load.

**Warning signs:**
- Bulk operation shows spinner for 30+ seconds then fails with a single generic error
- Users report issues in wrong state after bulk operations
- Rate limit 429 responses in the debug log store during bulk operations
- Jira admin reports elevated API load from the app

**Phase to address:**
Bulk Operations phase -- partial failure handling is the core concern and must be designed from the start.

---

### Pitfall 6: N+1 Query Pattern in Activity History Enrichment

**What goes wrong:**
Building an activity timeline that combines changelog entries, comments, and worklogs requires three separate API calls per issue. If the activity view is used in a list context (e.g., "recent activity across my issues" dashboard widget), this becomes N issues x 3 endpoints = 3N requests. For a developer with 15 active sprint issues, that is 45 API calls. Combined with the existing 60-second poll interval via TanStack Query, this generates sustained load on the Jira DC instance.

**Why it happens:**
Jira DC REST API v2 has no "activity stream" endpoint that combines changelog, comments, and worklogs into a single feed. Each must be fetched separately. The existing codebase fetches issue lists via search (1 paginated call) and enriches per-issue (e.g., `fetchIssueWorklogs` per issue for time tracking attribution) -- this pattern works for 1-2 enrichment fields but collapses at 3+ per issue.

**How to avoid:**
(1) Activity history should only be fetched for the currently-viewed issue (issue detail page), never in batch for a list view. (2) Use TanStack Query `staleTime` aggressively -- changelog data is append-only, so a 5-minute staleTime is safe. (3) For a dashboard "recent activity" widget, use the issue's `updated` field (already in the search response) to show "recently changed" -- do not fetch full changelogs for multiple issues. (4) Paginate changelog fetches with a small initial page (20 entries) and load more on scroll. (5) Never include `expand=changelog` in search/list queries -- it multiplies response size by 10-50x and still caps at 100 entries per issue.

**Warning signs:**
- Dashboard load time exceeds 5 seconds
- Network tab shows 30+ parallel Jira requests on page load
- Jira admin reports elevated API load from the app
- TanStack Query devtools shows dozens of in-flight queries
- The existing 15-second `API_TIMEOUT_MS` in `apiFetch.ts` starts timing out due to server congestion

**Phase to address:**
Activity History phase -- enforce the "detail view only" rule architecturally by placing activity hooks in the issue detail component, not in shared data hooks.

---

### Pitfall 7: Watchers API Uses `name` (Username) on DC, Not `accountId`

**What goes wrong:**
Copying Jira Cloud API documentation leads to sending `accountId` in the watchers POST body. Jira DC expects a raw username string (not even a JSON object) as the request body for adding a watcher: `POST /rest/api/2/issue/{key}/watchers` with body `"username"` (a JSON string, not an object). Using `{ "name": "username" }` or `{ "accountId": "..." }` returns 400.

**Why it happens:**
Most Jira API documentation online targets Cloud. The codebase already handles the DC/Cloud difference for assignee fields (`{ name: username }` not `{ accountId }`, per the `createIssue` function in `issues.ts`), but the watchers endpoint is uniquely different -- it takes a bare JSON string, not an object. This is inconsistent with every other Jira DC endpoint.

**How to avoid:**
(1) The POST body for adding a watcher must be `JSON.stringify("username")`, which produces `"username"` as the raw request body (a JSON-encoded string). (2) The GET response for listing watchers returns `watchers[].name` (DC) not `watchers[].accountId` (Cloud). (3) Removing a watcher uses DELETE with the username as a query param: `?username=johndoe`. (4) The "Add me as watcher" action should use the current user's `name` field from `/rest/api/2/myself`. (5) Viewing watchers requires "View voters and watchers" project permission; managing watchers for others requires "Manage watcher list" permission. (6) Test against the actual Jira DC instance early -- this cannot be validated from documentation alone.

**Warning signs:**
- 400 errors when adding watchers with no clear error message
- Watchers list shows `accountId`-like values instead of display names
- "Add me as watcher" works but adding others fails

**Phase to address:**
Watchers/Starring phase -- include a manual integration test checklist for add/remove/list watcher operations against the live Jira DC instance.

---

### Pitfall 8: Mention Autocomplete Triggers Excessive User Search Requests

**What goes wrong:**
Implementing `@mention` autocomplete in comment fields triggers a Jira user search on every keystroke after `@`. The user search endpoint (`/rest/api/2/user/search?username=`) is relatively slow on Jira DC (200-500ms per call) and returns all matching users. Without debouncing and caching, typing `@john` fires 4 separate API calls, each returning potentially hundreds of users.

**Why it happens:**
The natural implementation binds search to an `onChange` handler. Unlike the existing command palette (which uses `cmdk`'s built-in debounce), a raw textarea with mention detection has no built-in throttling.

**How to avoid:**
(1) Pre-fetch the project's assignable users on app init: `GET /rest/api/2/user/assignable/search?project={key}&maxResults=1000`. Cache this in TanStack Query with a 30-minute `staleTime` -- the user list rarely changes. Search locally for `@` completions against this cached list. This eliminates per-keystroke API calls entirely. (2) If the user list exceeds 1000, fall back to API search but debounce by 300ms after the `@` trigger character. (3) Only trigger search after 2+ characters following `@`. (4) Limit dropdown suggestions to 10 items. (5) On Jira DC, use the `username` parameter (not `query`, which is Cloud-only): `/rest/api/2/user/search?username=john`.

**Warning signs:**
- Typing `@` causes visible lag in the comment input
- Network tab shows rapid-fire user search requests
- Mention dropdown takes 500ms+ to appear
- Rate limit warnings in debug log store during comment editing

**Phase to address:**
Mention Autocomplete phase -- pre-fetching assignable users is the correct architecture. Per-keystroke API search should not be implemented at all.

---

### Pitfall 9: Worklog Time Format Mismatch Between Jira DC and ISO 8601

**What goes wrong:**
Submitting worklogs with ISO 8601 duration format (`PT2H30M`) or decimal hours (`2.5h`) to Jira DC results in 400 errors or incorrectly parsed time values. Jira DC expects its own duration format: `"2h 30m"`, `"1d 4h"`, `"30m"`. The API silently accepts some malformed values but logs incorrect time.

**Why it happens:**
JavaScript `Date` and `Intl` APIs naturally produce ISO 8601 durations. Most time-picker UI libraries output minutes or ISO 8601. Developers assume a standard format works without checking Jira's specific expectation. The existing `worklogs.ts` module only reads worklogs (author names for attribution) -- it does not write them, so this format issue has not surfaced yet.

**How to avoid:**
(1) Build a `formatJiraDuration(minutes: number): string` utility that converts total minutes to Jira format (e.g., 150 -> `"2h 30m"`, 510 -> `"1d 30m"` assuming 8h workday). (2) Validate the time input UI to accept only Jira-compatible units. (3) When reading worklogs, parse `timeSpentSeconds` (an integer) rather than `timeSpent` (a formatted string) for reliable computation. (4) The `worklog` POST body requires `timeSpent` (string in Jira format) plus `started` (ISO 8601 datetime with timezone), plus optional `comment`.

**Warning signs:**
- 400 errors on worklog submission with no clear field-level error
- Time tracking totals in Jira do not match what was entered in Taskflow
- Worklog entries show "0m" or incorrect duration in Jira after submission

**Phase to address:**
Time Tracking/Worklog phase -- the duration format utility must be built and tested before the worklog UI.

---

### Pitfall 10: Saved Filters Conflict with Existing quickFilters in Settings Store

**What goes wrong:**
The settings store already has `quickFilters: QuickFilter[]` (added in version 5 migration) for board quick filters. Adding a new "Saved Filters" feature that persists cross-view filter presets creates naming confusion, potential data model collisions, and migration complexity if both use the same store field or similar type names.

**Why it happens:**
v1.4 added `quickFilters` to the settings store for sprint board filtering. The v1.5 "Saved Filters" feature is conceptually different (cross-view, includes JQL-equivalent criteria, appears in sidebar) but has overlapping vocabulary. Developers may try to extend `quickFilters` to serve both purposes, creating a hybrid data model that satisfies neither use case well.

**How to avoid:**
(1) Keep `quickFilters` in `settings.store.ts` for board quick filters -- do not modify its shape. (2) Create a new `savedFilters` field (or better, a separate `saved-filters.store.ts`) for the cross-view saved filter feature. (3) Use distinct TypeScript types: the existing `QuickFilter` (from `filter.store.ts`) is board-specific; new `SavedFilter` should have a different type with different fields (view scope, filter criteria object, not raw JQL). (4) Store structured filter criteria objects, not raw JQL strings -- generate JQL at query time. This prevents breakage if JQL syntax changes between Jira versions and allows visual filter editing.

**Warning signs:**
- `QuickFilter` type is modified to accommodate both board and cross-view use cases
- Import confusion between `QuickFilter` and `SavedFilter` in components
- Board quick filters break after saved filter migration runs

**Phase to address:**
Saved Filters phase -- define the data model and store location before implementation. Board Quick Filters phase should not touch the existing `quickFilters` field shape.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing all new settings in `settings.store.ts` | No new store files, familiar pattern | Store exceeds 80+ fields, migrations become fragile, rehydration time grows | Never -- create `dashboard.store.ts` and `sidebar.store.ts` following the existing pattern of `pinned-tabs.store.ts` and `recent-items.store.ts` |
| Using `expand=changelog` on issue fetch | One fewer API call | Silent 100-item truncation, no pagination support | Never for activity history; acceptable only for a "last changed" timestamp badge on issue cards |
| Fetching all worklogs to compute time totals | Simple implementation | Issues with 500+ worklogs cause multi-second loads | Only for issue detail view; for list views, use the `timetracking` field already included in issue search responses |
| Hardcoding widget type IDs in dashboard layout schema | Faster initial build | Adding new widgets requires layout migration | MVP only -- use a registry pattern from the start so new widgets can be added without migrating stored layouts |
| Saving filter criteria as raw JQL strings | Direct API compatibility | JQL syntax varies between Jira versions; users cannot edit visually; special characters cause injection-like issues | Never -- save structured filter objects and generate JQL at query time |
| Using `Promise.all` for bulk operations | Simpler error handling | First failure aborts remaining operations; no partial success tracking | Never -- always use `Promise.allSettled` for multi-issue operations |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira DC changelog | Using `expand=changelog` on issue endpoint (capped at 100, no pagination) | Use dedicated `/rest/api/2/issue/{key}/changelog` endpoint with `startAt`/`maxResults` pagination |
| Jira DC watchers POST | Sending JSON object `{ "name": "user" }` as body | Send bare JSON string: `"user"` (result of `JSON.stringify("user")`) as request body |
| Jira DC watchers GET | Expecting `accountId` in response objects | Use `watchers[].name` (username) on Data Center |
| Jira DC watchers DELETE | Using body or JSON payload | Use query parameter: `DELETE /issue/{key}/watchers?username=johndoe` |
| Jira DC attachment download | Using Bearer PAT directly with content URL | Content URLs are outside REST API scope; may need session cookie via `/rest/auth/1/session` or fallback to `shell.open()` |
| Jira DC user search | Using `query` parameter (Cloud-only) | Use `username` parameter: `/rest/api/2/user/search?username=X` |
| Jira DC worklog POST | Sending ISO 8601 duration `PT2H30M` for `timeSpent` | Use Jira duration format: `"2h 30m"` (not ISO 8601) |
| Jira DC worklog read | Parsing `timeSpent` string for computation | Use `timeSpentSeconds` integer field for reliable arithmetic |
| Jira DC rate limiting | Ignoring rate limit headers on bulk operations | Check `x-ratelimit-remaining` and `x-ratelimit-interval-seconds` headers; throttle when tokens are low |
| Tauri plugin-http with redirects | Assuming redirects preserve auth headers | Tauri fetch follows redirects transparently but may drop Authorization header on cross-origin redirect; check response content-type to detect login page redirects |
| Jira DC changelog items | Expecting human-readable field names in `items[].field` | Changelog items use internal field IDs (e.g., `customfield_10016`); must map to display names using `/rest/api/2/field` metadata |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching changelog for all sprint issues in a list view | Dashboard takes 10s+; dozens of parallel requests visible in network tab | Only fetch changelog on issue detail view, never in list/board views | >10 issues in sprint |
| `react-grid-layout` `onLayoutChange` updating Zustand on every pixel of drag | All widgets re-render during drag; flicker and loading spinners visible | Use `useRef` during drag, commit to Zustand state only on `onDragStop`/`onResizeStop` | Any drag operation |
| Attachment thumbnails fetched eagerly on issue detail open | 20+ image downloads simultaneously; slow page load | Lazy-load thumbnails with intersection observer; show filename + size placeholder first | Issues with >5 attachments |
| Worklog pagination without result cap | `fetchAllWorklogPages` loops until `total` exhausted for enrichment | Set `maxResults=50` per page and cap total pages for list-view enrichment; full pagination only on detail view | Issues with >200 worklogs (long-running tasks) |
| Saved filter badge counts re-executed on every render cycle | Constant API polling for saved filter result counts | Use TanStack Query with `staleTime: 5 * 60 * 1000` for filter count queries | >5 saved filters visible in sidebar |
| Board quick filters recomputing on every issue state update | Board becomes laggy with complex filter expressions | Memoize filter results with `useMemo` keyed on issue data hash and filter criteria | >50 issues on board with 3+ active filters |
| Bulk operation firing all N requests simultaneously | Server overloaded; rate limit 429s; request timeouts | Use sequential execution with concurrency limit of 5; respect rate limit headers | >10 issues in batch |
| Dashboard widget initial data load waterfall | Each widget fetches independently; serial waterfall visible | Pre-fetch common data (sprint issues, my tasks) in dashboard parent; widgets read from TanStack Query cache | >4 data-fetching widgets on dashboard |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging attachment content URLs with session cookies in debug log store | Cookie values leak to persisted debug logs on disk | Extend the sanitization logic in `apiFetch.ts` to redact `Cookie` and `Set-Cookie` headers alongside existing `Authorization`/`PRIVATE-TOKEN` redaction |
| Storing raw JQL in saved filters with unescaped user input | JQL injection if filter values contain special characters (`"`, `\`, `)`) | Store structured filter objects; escape values when generating JQL using a JQL builder utility |
| Bulk operation error messages exposing other users' identity info | Information disclosure if bulk assign fails with "user X not found" messages | Catch and sanitize Jira error messages before displaying; show generic "operation failed" with option to view details |
| Session cookie from `/rest/auth/1/session` stored in memory without expiry tracking | Stale session used after PAT rotation or session invalidation | Treat session as ephemeral; re-obtain for each attachment download batch; never persist cookies to disk |
| Worklog POST allowing negative or zero time values | Corrupted time tracking data in Jira | Validate `timeSpent > 0` before API call; reject non-positive durations at the UI level |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dashboard resets to default layout after any data fetch error | User loses carefully arranged widgets after a transient network error | Persist layout independently of widget data; layout survives data fetch errors; show error state within individual widgets |
| Bulk operation shows only final aggregate result (success/fail) | User does not know which issues were affected | Show per-issue progress with checkmarks/crosses as each completes; provide "retry failed" button |
| Activity history shows raw field IDs for custom fields | "customfield_10016 changed from 3 to 5" is meaningless to users | Map custom field IDs to display names using field metadata (already have `discoverCustomFields` pattern); show "Story Points changed from 3 to 5" |
| Mention autocomplete blocks typing while loading suggestions | User cannot continue typing comment while waiting for user list | Show autocomplete asynchronously in a portal; never block the textarea input event loop |
| Sidebar customization has no "reset to default" action | User removes critical nav items and cannot recover without clearing app data | Always provide a "Reset to [role] defaults" action in sidebar settings |
| Saved filter names truncated in sidebar without tooltip | User creates "Critical bugs assigned to me in current sprint" but sees "Critical bugs assi..." with no way to see full name | Show full name on hover via tooltip; limit display to 30 chars with ellipsis |
| Board quick filters use AND vs OR ambiguously | User selects "Bug" + "High Priority" expecting AND but gets OR (or vice versa) | Default to AND logic; clearly label the combination behavior; consider adding a toggle |
| Time tracking input requires learning Jira format | User types "2.5 hours" or "150 minutes" but only "2h 30m" works | Accept multiple input formats (decimal hours, minutes) and convert to Jira format on submission; show preview of converted value |
| Watcher count badge shows stale data | User adds themselves as watcher but count does not update until next poll | Optimistic update on watcher add/remove -- increment/decrement count immediately, rollback on API failure |

## "Looks Done But Isn't" Checklist

- [ ] **Activity History:** Often missing changelog pagination for old issues -- verify with an issue that has 200+ changelog entries by checking the `total` field
- [ ] **Activity History:** Often missing custom field name resolution -- verify that `customfield_XXXXX` items display human-readable field names
- [ ] **Activity History:** Often missing combined timeline sort -- verify changelog entries, comments, and worklogs are interleaved chronologically (not grouped by type)
- [ ] **Attachments Viewer:** Often missing auth for content download -- verify actual file bytes are received by checking response content-type is not `text/html`
- [ ] **Attachments Viewer:** Often missing non-image file handling -- verify PDF, ZIP, and unknown MIME types show appropriate UI (download button, not broken preview)
- [ ] **Dashboard Layout:** Often missing persistence across app restart -- verify widget positions survive quit and relaunch on all platforms
- [ ] **Dashboard Layout:** Often missing responsive behavior -- verify layout adapts when window is resized by >50% without overlapping widgets
- [ ] **Dashboard Layout:** Often missing new-widget default placement -- verify adding a widget does not overlap existing widgets
- [ ] **Bulk Operations:** Often missing partial failure handling -- verify with a batch where 1 of 10 issues lacks edit permission; UI must show which 9 succeeded
- [ ] **Bulk Operations:** Often missing undo/rollback -- verify user can identify and reverse individual bulk changes
- [ ] **Watchers:** Often missing permission check -- verify graceful error handling when "Manage watcher list" permission is absent (user can still add self but not others)
- [ ] **Time Tracking:** Often missing Jira time format validation -- verify "2h 30m" works; verify "2.5h" is converted or rejected with helpful message
- [ ] **Saved Filters:** Often missing migration of existing quickFilters -- verify board quick filters still work after saved filter feature ships
- [ ] **Mention Autocomplete:** Often missing special character handling -- verify usernames with apostrophes and dots work correctly
- [ ] **Sidebar Customization:** Often missing role preset preservation -- verify switching roles resets sidebar to new role's defaults with confirmation dialog
- [ ] **Board Quick Filters:** Often missing filter state persistence -- verify selected quick filters survive page navigation and app restart

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Changelog expand=changelog truncation | MEDIUM | Switch to paginated endpoint; rewrite data fetching layer; existing UI timeline components can remain unchanged |
| Attachment PAT auth failure | LOW | Add session-cookie helper function; `shell.open()` fallback is acceptable UX for v1.5 |
| Widget remount on every drag | HIGH | Requires rearchitecting grid container to use ref-based drag state; must add React.memo to every widget component |
| Settings store migration failure | HIGH | Users lose settings; must ship emergency migration that detects and recovers broken state; consider store-repair utility |
| Bulk operation partial failure | MEDIUM | Add per-issue tracking and progress UI to existing bulk operation flow; moderate UI changes |
| N+1 activity queries | LOW | Move activity fetch from list hook to detail hook; no data model change needed; straightforward refactor |
| Watchers wrong body format | LOW | Fix request body format; single-line change per watcher operation |
| Mention excessive requests | LOW | Add debounce + pre-fetch; straightforward implementation change |
| Worklog time format | LOW | Add format conversion utility; update input validation; existing worklog read path unaffected |
| Saved filter / quickFilter confusion | MEDIUM | Rename types and create separate store; requires updating all import paths |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Changelog 100-item cap | Activity History | Verify with issue having 200+ history entries; confirm paginated endpoint used with `total` field for iteration |
| Attachment PAT download failure | Attachments Viewer | Verify binary file content received (check content-type header); test with image, PDF, and ZIP file types |
| Widget layout remount | Dashboard Redesign | Verify zero TanStack Query refetches during drag operation via debug log store; check React DevTools Profiler for re-renders |
| Settings store migration | Dashboard Redesign (first phase touching persistence) | Verify migration from version 8 to new version preserves all existing fields; automated test starting from version 0 state |
| Bulk partial failure | Bulk Operations | Verify with mixed-permission batch; confirm per-issue success/failure status visible in UI |
| N+1 activity queries | Activity History | Verify dashboard does not fetch changelog; network tab shows zero changelog requests when dashboard is active |
| Watchers body format | Watchers/Starring | Integration test against live Jira DC: add watcher, verify in Jira, remove watcher, verify removed |
| Mention excessive requests | Mention Autocomplete | Verify network tab shows max 1 user search request per 300ms; verify pre-fetched assignable user list used for local search |
| Worklog time format | Time Tracking/Worklog | Submit worklog with "2h 30m"; verify correct `timeSpentSeconds` value recorded in Jira |
| Saved filter / quickFilter collision | Saved Filters | Verify existing board quick filters function identically after saved filter feature ships; no data model changes to `QuickFilter` type |
| Board quick filter performance | Board Quick Filters | Verify board with 100+ issues and 5 active filters renders in <100ms measured via operation profiler |
| Sidebar customization persistence | Customizable Sidebar | Verify sidebar config survives app restart; verify role switch resets to role defaults |

## Sources

- [Jira DC REST API changelog 100-item limitation](https://community.atlassian.com/forums/Jira-questions/Rest-API-limiting-changelog-history-results-to-100-even-if/qaq-p/1466525)
- [Jira DC changelog pagination via dedicated endpoint](https://community.atlassian.com/forums/Jira-questions/Help-with-Pagination-for-Jira-On-Prem-Changelog-API/qaq-p/2961571)
- [Jira DC attachment PAT limitation (JRASERVER-72019)](https://jira.atlassian.com/browse/JRASERVER-72019)
- [Jira DC attachment download with SSO/PAT session cookie workaround](https://support.atlassian.com/jira/kb/how-to-download-attachments-using-rest-api-and-sso/)
- [Jira DC cookie-based authentication for REST API using PAT](https://support.atlassian.com/jira/kb/creating-cookie-based-authentication-for-rest-api-using-pat-tokens/)
- [Jira DC rate limiting documentation](https://confluence.atlassian.com/adminjiraserver/improving-instance-stability-with-rate-limiting-983794911.html)
- [Jira DC adjusting code for rate limiting](https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/987143384/Adjusting+your+code+for+rate+limiting)
- [Jira DC watchers API username format](https://community.developer.atlassian.com/t/help-adding-a-watcher-using-rest-api-json/76677)
- [Jira DC Personal Access Tokens documentation](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
- [react-grid-layout widget remount issue #945](https://github.com/react-grid-layout/react-grid-layout/issues/945)
- [Jira DC REST API reference v9.14.0](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/)
- Codebase: `taskflow/src/services/jira/client.ts` -- existing pagination patterns (`fetchAllSearchPages`, `fetchAllWorklogPages`)
- Codebase: `taskflow/src/services/jira/issues.ts` -- DC-specific patterns (`{ name: username }`, chunked subtask queries)
- Codebase: `taskflow/src/stores/settings.store.ts` -- migration pattern at version 8 with 60+ fields
- Codebase: `taskflow/src/lib/apiFetch.ts` -- Tauri plugin-http fetch wrapper with 15s timeout and header sanitization
- Codebase: `taskflow/src/stores/filter.store.ts` -- existing `QuickFilter` type

---
*Pitfalls research for: Taskflow v1.5 Dashboard Redesign & Feature Parity*
*Researched: 2026-03-22*
