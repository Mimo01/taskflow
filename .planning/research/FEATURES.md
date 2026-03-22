# Feature Research: Jira DC & GitLab Feature Parity for Taskflow v1.5

**Domain:** Project management desktop client (Jira Data Center + GitLab integration)
**Researched:** 2026-03-22
**Confidence:** HIGH (Jira DC REST API v2 endpoints verified against official Atlassian docs)

> This file supersedes the v1.3 FEATURES.md.
> v1.0-v1.4 features are shipped and stable. This file focuses exclusively on v1.5 feature parity targets.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that real Jira/GitLab users encounter daily. Missing these makes Taskflow feel like a toy next to the Jira web UI.

| Feature | Why Expected | Complexity | Jira DC REST API v2 Endpoints | Notes |
|---------|--------------|------------|-------------------------------|-------|
| **Issue Activity History** | Every Jira user clicks the "History" tab daily to see who changed what and when. PMs audit status transitions. Devs check why fields changed. | MEDIUM | `GET /rest/api/2/issue/{key}?expand=changelog` returns `changelog.histories[]` with `created`, `author`, `items[].field/from/to/fromString/toString`. Capped at 100 most recent entries via expand param. | Already have `JiraIssueDetail` -- add `expand=changelog` to existing fetch. Merge with comments into unified timeline sorted by timestamp. |
| **Time Tracking / Worklog CRUD** | Time logging is mandatory in most enterprise Jira setups. The PM dashboard already shows time columns from `fields.timetracking`. Currently `fetchIssueWorklogs` only returns author names -- need full CRUD. | HIGH | **Read:** `GET /rest/api/2/issue/{key}/worklog` (paginated). **Create:** `POST /rest/api/2/issue/{key}/worklog` body: `{timeSpent, started, comment}`. **Update:** `PUT /rest/api/2/issue/{key}/worklog/{id}`. **Delete:** `DELETE /rest/api/2/issue/{key}/worklog/{id}`. Time fields on issue: `fields.timetracking` (already in JiraIssue type). | Time tracking must be enabled in Jira instance config. `adjustEstimate` query param controls remaining estimate behavior (auto/leave/new/manual). Worklog `started` format: ISO 8601 date-time. |
| **Watchers / Starring** | Users watch issues to get notified of changes. "Am I watching this?" is visible on every Jira issue detail page. Basic expectation for any issue tracker. | LOW | **Get:** `GET /rest/api/2/issue/{key}/watchers` returns `{watchCount, isWatching, watchers[]}`. **Add self:** `POST /rest/api/2/issue/{key}/watchers` body: `"username"` (DC uses `name` field, not `accountId`). **Remove:** `DELETE /rest/api/2/issue/{key}/watchers?username={name}`. | Simple toggle UI. `isWatching` boolean drives the eye/star icon state. Low API complexity. Need current user's `name` from auth store. |
| **Attachments Viewer** | Every issue detail page in Jira shows attachments. Users attach screenshots, logs, specs constantly. `JiraAttachment` type already exists in `types.ts` but the UI does not render them. | MEDIUM | **List:** Already returned in `GET /rest/api/2/issue/{key}` as `fields.attachment[]` with `{id, filename, content (URL), thumbnail, mimeType}`. **Upload:** `POST /rest/api/2/issue/{key}/attachments` with `X-Atlassian-Token: nocheck` header, multipart form-data. **Download:** GET the `content` URL with Bearer auth header. **Delete:** `DELETE /rest/api/2/attachment/{id}`. **Size limits:** `GET /rest/api/2/attachment/meta` returns max upload size. | Tauri's `tauri-plugin-http` handles file downloads. Upload needs multipart form-data support. Thumbnails available for images via `thumbnail` field. |
| **Mention Autocomplete** | @mentioning teammates in comments is muscle memory for every Jira user. Without it, users must remember and type exact usernames in wiki markup `[~username]` format. | MEDIUM | **User search:** `GET /rest/api/2/user/picker?query={prefix}` returns matching users with `name`, `displayName`, `avatarUrl`. Also: `GET /rest/api/2/user/search?username={prefix}` for broader search. | Trigger on `@` keypress in comment textarea. Debounce 300ms. Insert `[~username]` (Jira wiki markup mention format). Need a popover/dropdown positioned relative to cursor in textarea. |
| **Board Quick Filters** | Every Jira Scrum/Kanban board has quick filter buttons at the top (e.g., "Only My Issues", "Recently Updated"). Users click these dozens of times daily during standups and triage. | MEDIUM | **Discover board:** `GET /rest/agile/1.0/board?projectKeyOrId={key}` returns board IDs. **List filters:** `GET /rest/agile/1.0/board/{boardId}/quickfilter` returns `[{id, name, jql, position}]`. **Single:** `GET /rest/agile/1.0/board/{boardId}/quickfilter/{id}`. | Quick filters are JQL fragments appended to the board's base query. Fetch once, apply client-side to sprint issues. Active filter state is local UI state, not persisted to Jira. Board ID discovery is the new prerequisite. |
| **Saved Filters / JQL** | Power users live in saved filters. "My open bugs", "Sprint blockers", "Unestimated stories" -- accessed multiple times per day. JQL is the single most powerful feature of Jira. | MEDIUM | **Favourites:** `GET /rest/api/2/filter/favourite` returns user's starred filters with `{id, name, jql, description}`. **Create:** `POST /rest/api/2/filter` body: `{name, jql, description, favourite}`. **Read:** `GET /rest/api/2/filter/{id}`. **Update:** `PUT /rest/api/2/filter/{id}`. **Delete:** `DELETE /rest/api/2/filter/{id}`. **Execute:** `POST /rest/api/2/search` with `{jql, fields, maxResults, startAt}`. | Taskflow already has global search with JQL. Add a "Save this search" action. Filters sync across devices since they live server-side. Show favourite filters in sidebar or command palette. |

### Differentiators (Competitive Advantage)

Features that go beyond what Jira's web UI does well. These make Taskflow worth using over the browser.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Unified Activity Timeline** | Jira separates "History" and "Comments" into two separate tabs. Taskflow can merge changelog entries + comments + worklogs into one chronological timeline with filter toggles -- something Jira's own UI does not do. This is the single best differentiator for the activity view. | MEDIUM | Fetch changelog (`expand=changelog`), comments (already have), and worklogs (already paginate). Merge all by timestamp. Render with distinct visual styling per entry type. Filter toggles: "Show field changes / comments / worklogs". |
| **Customizable Dashboard with Widgets** | Jira's dashboard gadgets require admin configuration and are sluggish. Taskflow can let any user drag/drop widgets (my tasks, sprint health, MR attention, workload, saved filter results) into a personal layout with zero admin overhead. | HIGH | No Jira API needed -- purely client-side layout persistence. Use a grid layout system (react-grid-layout or similar). Store widget config in Tauri Store. Dev/PM roles become preset layouts, not hard role gates. |
| **Customizable Sidebar** | Jira's sidebar is fixed. Letting users choose which nav items appear and reorder them makes Taskflow feel personal and reduces clutter for users who only use 3-4 features. | LOW | Client-side only. Store order/visibility in Tauri Store. Provide "Developer preset" and "PM preset" as quick-start configs that replace the current hard-coded role-based views. |
| **Bulk Operations with Progress** | Jira's bulk edit is a multi-page wizard that takes 6+ clicks. A fast multi-select + inline bulk action bar in Taskflow is dramatically better UX for sprint grooming and triage. | HIGH | **No native bulk API in Jira DC.** Must iterate: JQL search, then `PUT /rest/api/2/issue/{key}` per issue. Transitions: `POST /rest/api/2/issue/{key}/transitions` per issue. Use `Promise.allSettled` with concurrency limit (max 5 parallel). Show progress bar with success/failure counts. |
| **Cross-Source Activity on Issues** | Show GitLab MR comments + pipeline status alongside Jira changelog on the same issue timeline. No tool does this for on-prem Jira + GitLab. | MEDIUM | GitLab Notes API: `GET /projects/:id/merge_requests/:iid/notes`. Pipeline: `GET /projects/:id/merge_requests/:iid/pipelines`. Link via existing task-to-MR key matching. |
| **Offline-Ready Saved Filters** | Store saved filter JQL + last results locally. Show stale data immediately, refresh in background. Jira's web UI shows nothing without connectivity. | LOW | Cache filter results in TanStack Query with long `staleTime` + background refetch. Also support local-only filters (not synced to Jira) for quick personal use. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full JQL editor with syntax highlighting** | Power users want a full query builder with autocomplete | JQL has 100+ functions, custom fields per instance. Building a real parser/autocomplete is months of work. Jira's own autocomplete is mediocre. | Plain text input with a link to Jira's JQL reference. Autocomplete field names only (from createmeta). Let users paste JQL from Jira. |
| **Attachment inline editing/annotation** | Users want to annotate screenshots directly | Image editing is a separate application domain. Massive complexity for near-zero daily value. | Open attachment in OS default app via Tauri `shell.open`. Provide download + re-upload flow. |
| **Real-time collaboration on comments** | "Google Docs for Jira comments" | Requires WebSocket infrastructure, conflict resolution. Jira DC has no real-time API. Polling is sufficient for a desktop client. | Poll comments on focus/interval. Show "new comments available" banner when remote changes detected. |
| **Custom workflow builder** | "Let me define my own status columns" | Jira workflows are admin-configured server-side. Client-side overrides cause data inconsistency and confusion. | Respect Jira's configured workflows. Show available transitions per issue (already implemented). Let quick filters narrow visible statuses. |
| **Full Jira admin panel** | "Manage users, permissions, schemes from Taskflow" | Admin operations are rare, complex, and high-risk. Jira's admin UI is purpose-built for this. | Deep-link to Jira admin pages. Taskflow is a daily-use tool, not an admin tool. |
| **Bulk file upload (drag entire folder)** | Batch-uploading many attachments at once | Jira attachment API is single-file. Parallel uploads risk rate limiting. Large files hit Jira's configured size limit. | Single-file upload with progress. Display Jira's attachment size limit from `/rest/api/2/attachment/meta`. Queue multiple files sequentially. |
| **Burndown / velocity charts** | PMs want sprint progress visualization | Already out of scope in PROJECT.md. Requires historical daily snapshots that Jira DC does not expose via REST API. Tools like LinearB/Swarmia exist for this. | Sprint progress bar with point breakdown (already built in PM dashboard). Link to Jira's built-in reports. |

---

## Missed Features: What Real Users Rely On

Features not in the original v1.5 target list but used daily by Jira/GitLab power users.

| Feature | How Often Used | Jira DC API | Recommendation |
|---------|---------------|-------------|----------------|
| **Comment editing and deleting** | Weekly -- users fix typos, update info | `PUT /rest/api/2/issue/{key}/comment/{id}` to edit, `DELETE /rest/api/2/issue/{key}/comment/{id}` to delete | **Add to v1.5.** Low complexity. Users strongly expect to edit their own comments. Currently Taskflow is post-only. |
| **Due date overdue highlighting** | Daily for PMs, weekly for devs | `fields.duedate` already in `JiraIssueDetail` type | **Add to v1.5.** Trivial. Red badge/highlight on sprint cards and issue detail when `duedate < today`. Already have the data. |
| **Sprint goal visibility** | Every standup | `JiraActiveSprint.goal` already in type definition | **Add to v1.5.** Trivial. Display sprint goal as a banner/subtitle on the sprint board header. Already fetched. |
| **Issue cloning** | Weekly -- devs clone recurring tasks, PMs clone templates | `POST /rest/api/2/issue` with fields copied from source issue | **Consider for v1.5.** Low complexity. "Clone issue" button on issue detail copies summary, description, labels, priority, assignee. |
| **Label filter chips on board** | Daily during triage | Labels already in issue data; no new API | **Add to v1.5** as part of board quick filters. Client-side label filtering on sprint board. |
| **Comment reactions/emojis** | Not available in Jira DC REST API v2 | N/A -- Jira DC does not support comment reactions | **Skip.** Not available server-side. |
| **Issue voting** | Occasional | `GET/POST/DELETE /rest/api/2/issue/{key}/votes` | **Skip for v1.5.** Low daily value. |
| **Keyboard-driven time logging** | Daily for devs with mandatory time tracking | No new API -- UI convenience for worklog POST | **Add to v1.5** as part of time tracking. Natural language input like "2h 30m" parsed into seconds for the worklog body. |

---

## Feature Dependencies

```
[Customizable Sidebar]
    independent: No API dependency
    enhances: Customizable Dashboard (sidebar reflects user's personal layout)
    enhances: Saved Filters (filters can appear as sidebar items)

[Issue Activity History]
    requires: Issue Detail (DONE)
    enhances: Time Tracking (worklogs displayed in timeline)
    enhances: Watchers (watcher count shown in issue context)
    API: expand=changelog added to existing issue fetch

[Time Tracking / Worklog CRUD]
    requires: Issue Detail (DONE)
    requires: Issue Activity History (worklogs best rendered in unified timeline)
    API: New worklog service module (POST/PUT/DELETE)

[Watchers / Starring]
    requires: Issue Detail (DONE)
    requires: Current user's username from auth store
    independent: Simple toggle, no other feature dependency

[Mention Autocomplete]
    requires: Comment posting (DONE)
    requires: User Picker API (new endpoint: /rest/api/2/user/picker)
    enhances: Comment editing (mentions in edited comments)

[Attachments Viewer]
    requires: Issue Detail (DONE)
    requires: Tauri HTTP multipart support (for upload)
    API: attachment data already fetched, needs UI + upload/delete

[Board Quick Filters]
    requires: Sprint Board (DONE)
    requires: Board ID discovery (new: GET /rest/agile/1.0/board?projectKeyOrId={key})
    enhances: Saved Filters (quick filters are essentially saved JQL fragments)

[Saved Filters / JQL]
    requires: Global Search with JQL (DONE)
    API: /rest/api/2/filter CRUD + /rest/api/2/filter/favourite
    enhances: Sidebar (saved filters as nav items)
    enhances: Dashboard (saved filter results as widget)

[Customizable Dashboard]
    requires: Existing widgets -- Dev/PM panels (DONE)
    independent: No API dependency, purely client-side layout
    enhances: Saved Filters (filter results as dashboard widget)

[Bulk Operations]
    requires: Sprint Board or Backlog multi-select UI (selection mechanism DONE via existing lists)
    requires: Transitions API (DONE)
    conflicts-with: Rate limiting (must throttle to max 5 concurrent PUT requests)
    API: No native bulk API in DC; iterate single-issue updates

[Comment Edit/Delete]
    requires: Comment thread UI (DONE)
    API: PUT/DELETE /rest/api/2/issue/{key}/comment/{id}
```

### Dependency Notes

- **Activity History before Time Tracking:** The worklog UI is best rendered inside the unified activity timeline. Build the timeline container first, then add worklog entries as a timeline item type.
- **Board Quick Filters require board ID discovery:** Taskflow currently queries sprints via JQL (`sprint in openSprints()`), not the Agile board API. Need to discover the board ID via `GET /rest/agile/1.0/board?projectKeyOrId={key}` during onboarding or first use, then persist it.
- **Mention Autocomplete requires User Picker API:** New endpoint `/rest/api/2/user/picker?query={prefix}` not currently called. Simple to add but needs debounced search and cursor-relative popover positioning.
- **Bulk Operations have no native DC bulk API:** Must iterate `PUT /rest/api/2/issue/{key}` per issue. Rate limiting is the primary risk. Cap concurrent requests at 5 and show progress feedback.
- **Saved Filters are server-side:** Unlike most other v1.5 features, saved filters persist on the Jira server. They sync across devices and survive app reinstall.

---

## Implementation Priority (v1.5 Phasing)

### Phase 1: Foundation (no API dependencies, enables everything else)

- [ ] **Customizable Sidebar** -- LOW complexity, client-side only, unblocks dashboard redesign
- [ ] **Sprint goal banner** -- trivial, data already fetched in `JiraActiveSprint.goal`
- [ ] **Due date overdue highlighting** -- trivial, data already in `fields.duedate`

### Phase 2: Activity & Detail Enhancements

- [ ] **Issue Activity History + Unified Timeline** -- MEDIUM complexity, core feature, foundation for time tracking
- [ ] **Comment Edit/Delete** -- LOW complexity, fills important gap
- [ ] **Watchers / Starring** -- LOW complexity, standalone toggle

### Phase 3: Time & Attachments

- [ ] **Time Tracking / Worklog CRUD** -- HIGH complexity, builds on activity timeline
- [ ] **Attachments Viewer + Upload** -- MEDIUM complexity, needs multipart HTTP via Tauri

### Phase 4: Search & Filters

- [ ] **Saved Filters** -- MEDIUM complexity, builds on existing global search
- [ ] **Board Quick Filters** -- MEDIUM complexity, needs board ID discovery
- [ ] **Mention Autocomplete** -- MEDIUM complexity, needs user picker API

### Phase 5: Layout & Power Features

- [ ] **Customizable Dashboard** -- HIGH complexity, client-side layout engine
- [ ] **Bulk Operations** -- HIGH complexity, rate limiting risk, needs progress UI

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Issue Activity History | HIGH | MEDIUM | LOW | **P1** |
| Customizable Sidebar | HIGH | LOW | LOW | **P1** |
| Time Tracking / Worklog | HIGH | HIGH | MEDIUM | **P1** |
| Watchers / Starring | MEDIUM | LOW | LOW | **P1** |
| Customizable Dashboard | HIGH | HIGH | MEDIUM | **P1** |
| Saved Filters / JQL | HIGH | MEDIUM | LOW | **P1** |
| Board Quick Filters | HIGH | MEDIUM | MEDIUM | **P1** |
| Mention Autocomplete | MEDIUM | MEDIUM | LOW | **P2** |
| Attachments Viewer + Upload | MEDIUM | MEDIUM | MEDIUM | **P2** |
| Bulk Operations | MEDIUM | HIGH | HIGH | **P2** |
| Comment Edit/Delete | MEDIUM | LOW | LOW | **P1** |
| Due Date Highlighting | MEDIUM | LOW (trivial) | LOW | **P1** |
| Sprint Goal Banner | LOW | LOW (trivial) | LOW | **P1** |
| Issue Cloning | LOW | LOW | LOW | **P3** |

**Priority key:**
- P1: Must have for v1.5 milestone
- P2: Should have, include if time allows
- P3: Nice to have, defer if needed

---

## Jira DC REST API v2 Endpoint Reference

Complete endpoint map for all v1.5 features. All endpoints use Bearer PAT auth (`Authorization: Bearer {token}`).

### Changelog / Activity History
| Method | Endpoint | Request | Response Key Fields |
|--------|----------|---------|---------------------|
| GET | `/rest/api/2/issue/{key}?expand=changelog` | -- | `changelog.histories[].{created, author, items[].{field, fromString, toString}}` |

### Worklogs (Time Tracking)
| Method | Endpoint | Request Body | Notes |
|--------|----------|-------------|-------|
| GET | `/rest/api/2/issue/{key}/worklog` | -- | Paginated: `startAt`, `maxResults` params |
| POST | `/rest/api/2/issue/{key}/worklog` | `{timeSpent: "2h 30m", started: "2026-03-22T10:00:00.000+0000", comment: "..."}` | `adjustEstimate` param: auto/leave/new/manual |
| PUT | `/rest/api/2/issue/{key}/worklog/{id}` | Same as POST | Updates existing entry |
| DELETE | `/rest/api/2/issue/{key}/worklog/{id}` | -- | `adjustEstimate` param available |

### Watchers
| Method | Endpoint | Request Body | Notes |
|--------|----------|-------------|-------|
| GET | `/rest/api/2/issue/{key}/watchers` | -- | Returns `{watchCount, isWatching, watchers[]}` |
| POST | `/rest/api/2/issue/{key}/watchers` | `"username"` (plain string, DC uses `name` not `accountId`) | Adds user as watcher |
| DELETE | `/rest/api/2/issue/{key}/watchers?username={name}` | -- | Removes watcher |

### Attachments
| Method | Endpoint | Headers | Notes |
|--------|----------|---------|-------|
| -- | `fields.attachment[]` on issue GET | -- | Already fetched: `{id, filename, content, thumbnail, mimeType}` |
| POST | `/rest/api/2/issue/{key}/attachments` | `X-Atlassian-Token: nocheck`, `Content-Type: multipart/form-data` | File in form field `file` |
| GET | `{attachment.content}` (direct URL) | Bearer auth | Downloads the actual file |
| DELETE | `/rest/api/2/attachment/{id}` | -- | Removes attachment |
| GET | `/rest/api/2/attachment/meta` | -- | Returns `{enabled, uploadLimit}` (max file size) |

### Saved Filters
| Method | Endpoint | Request Body | Notes |
|--------|----------|-------------|-------|
| GET | `/rest/api/2/filter/favourite` | -- | User's starred filters: `[{id, name, jql, description}]` |
| POST | `/rest/api/2/filter` | `{name, jql, description, favourite}` | Creates server-side filter |
| GET | `/rest/api/2/filter/{id}` | -- | Single filter with `searchUrl` |
| PUT | `/rest/api/2/filter/{id}` | `{name, jql, description, favourite}` | Updates filter |
| DELETE | `/rest/api/2/filter/{id}` | -- | Deletes filter |
| POST | `/rest/api/2/search` | `{jql, fields, maxResults, startAt}` | Execute any JQL query |

### User Picker (for Mention Autocomplete)
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/rest/api/2/user/picker?query={prefix}` | Returns `{users: [{name, displayName, avatarUrl}]}`. Respects project permissions. |
| GET | `/rest/api/2/user/search?username={prefix}` | Broader user search, returns `[{name, displayName, emailAddress}]` |

### Board Quick Filters (Jira Agile REST API)
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/rest/agile/1.0/board?projectKeyOrId={key}` | Discover board ID for project. Returns `{values: [{id, name, type}]}` |
| GET | `/rest/agile/1.0/board/{boardId}/quickfilter` | All quick filters: `[{id, name, jql, position}]` |
| GET | `/rest/agile/1.0/board/{boardId}/quickfilter/{id}` | Single quick filter detail |

### Comments -- Edit/Delete (new for v1.5)
| Method | Endpoint | Request Body | Notes |
|--------|----------|-------------|-------|
| PUT | `/rest/api/2/issue/{key}/comment/{id}` | `{body: "updated text"}` | Wiki markup format |
| DELETE | `/rest/api/2/issue/{key}/comment/{id}` | -- | Requires delete permission |

### Bulk Operations (no native bulk API in Jira DC)
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/rest/api/2/search` | Find target issues by JQL |
| PUT | `/rest/api/2/issue/{key}` | Update single issue fields (must iterate) |
| POST | `/rest/api/2/issue/{key}/transitions` | Transition single issue (must iterate) |

---

## GitLab API Equivalents

For features where GitLab data enriches the Jira-primary view.

| Feature | GitLab Endpoint | Notes |
|---------|----------------|-------|
| MR activity / notes | `GET /projects/:id/merge_requests/:iid/notes` | `system: true` notes are automated events (merges, approvals) |
| MR pipeline status | `GET /projects/:id/merge_requests/:iid/pipelines` | Show CI status on issue timeline |
| Time tracking | `POST /projects/:id/issues/:iid/time_estimate`, `POST .../add_spent_time` | Uses `/spend` slash command syntax |
| File uploads | `POST /projects/:id/uploads` | Returns markdown-formatted link |
| Issue subscriptions | `POST /projects/:id/issues/:iid/subscribe` | GitLab equivalent of watchers |

---

## Competitor Feature Analysis

| Feature | Jira Web UI | Linear | Taskflow v1.5 Approach |
|---------|-------------|--------|------------------------|
| Activity history | Separate "History" and "Comments" tabs; no unified view | Single activity feed with all changes | **Unified timeline** merging changelog + comments + worklogs. Filter toggles per type. Better than both. |
| Time tracking | Built-in worklog dialog; clunky modal | No native time tracking | Natural language input ("2h 30m") inline on issue detail. Worklog list in timeline. |
| Watchers | Eye icon on every issue; watch/unwatch toggle | "Subscribe" toggle | Same pattern: eye icon toggle with watch count badge |
| Saved filters | Sidebar filter list; JQL builder; star/favourite | Custom views with filter bar | Favourite filters synced from Jira server + local-only quick filters |
| Board quick filters | Filter buttons above board; JQL-based | Grouping + filtering in board view | Fetch Jira quick filters + render as toggle chips above sprint board |
| Attachments | Attachment section on issue; drag-drop upload | File attachments on issues | Thumbnail grid for images, file list for others; single-file upload with progress |
| Mentions | @username autocomplete in all text fields | @mention autocomplete | @-triggered dropdown in comment textarea; inserts `[~username]` wiki markup |
| Bulk edit | Multi-page wizard; 6+ clicks; server-side processing | Multi-select + inline toolbar | Multi-select checkbox + floating action bar; client-side iteration with progress |
| Dashboard | Admin-configured gadgets; heavy, slow | No traditional dashboard | User-configurable widget grid; role presets; instant load from local state |

---

## Sources

- [Jira Data Center REST API 9.14.0 Reference](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/) -- HIGH confidence
- [Jira Agile Data Center 9.14.0 REST API](https://docs.atlassian.com/jira-software/REST/9.14.0/) -- HIGH confidence
- [Jira REST API Examples (Server/DC)](https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/) -- HIGH confidence
- [Jira DC REST API - Attachment Group](https://developer.atlassian.com/server/jira/platform/rest/v10002/api-group-attachment/) -- HIGH confidence
- [Jira DC REST API - Worklog Group](https://developer.atlassian.com/server/jira/platform/rest/v10002/api-group-worklog/) -- HIGH confidence
- [Jira Issue Changelog Analysis (Atlassian Support)](https://support.atlassian.com/jira/kb/how-to-analyze-the-history-or-changelog-of-an-issue-in-jira/) -- HIGH confidence
- [Atlassian Community: Changelog 100-entry limit](https://community.atlassian.com/forums/Jira-questions/Rest-API-limiting-changelog-history-results-to-100-even-if/qaq-p/1466525) -- MEDIUM confidence
- [Atlassian Community: Bulk Edit via REST in DC](https://support.atlassian.com/jira/kb/update-issues-based-on-jql-with-rest-api-in-jira-data-center/) -- HIGH confidence
- [GitLab Issues API](https://docs.gitlab.com/api/issues/) -- HIGH confidence
- [GitLab Notes API](https://docs.gitlab.com/api/notes/) -- HIGH confidence
- [GitLab Time Tracking Docs](https://docs.gitlab.com/ee/user/project/time_tracking.html) -- HIGH confidence
- Taskflow codebase: `taskflow/src/services/jira/types.ts`, `taskflow/src/services/jira/worklogs.ts`, `taskflow/src/services/jira/index.ts` -- HIGH confidence

---
*Feature research for: Taskflow v1.5 Jira DC & GitLab Feature Parity*
*Researched: 2026-03-22*
