# Technology Stack

**Project:** Taskflow
**Researched:** 2026-03-10 (v1.0 base), 2026-03-12 (v1.1 Jira API addendum), 2026-03-13 (v1.2 Jira Parity addendum)
**Research mode:** v1.0 — training knowledge. v1.1 addendum — live web research (verified). v1.2 addendum — live npm registry + Atlassian official docs (verified).

---

## v1.2 Addendum: New Libraries and API Endpoints for Jira Parity

This section documents the specific new npm dependencies and Jira REST API endpoints required for v1.2 features: ADF rich-text rendering, drag-and-drop kanban, create/edit issue forms, and Jira Agile API (epics, backlog, sprint management, issue links). No changes to Tauri plugins, state management, or UI library are needed.

---

### Actual Runtime Context (Verified 2026-03-13)

The app is currently running **React 19.1** (not React 18 as originally documented in v1.0 research). All library peer-dependency checks below are against React 19.

```
react: ^19.1.0         (not ^18.3 as documented in v1.0 section)
vite: ^7.0.4           (not v5.x)
vitest: ^4.0.18        (not v1.6)
zustand: ^5.0.11       (not v4.5)
@base-ui/react: ^1.2.0 (shadcn/ui components rendered via this)
```

---

### 1. New npm Dependencies

#### Drag-and-Drop (Kanban Board)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@dnd-kit/core` | `^6.3.1` | DndContext, Draggable, Droppable, DragOverlay primitives | Production-stable (v6 since 2021, 6.3.1 is current). MIT. Peer dep `react >=16.8.0` — confirmed compatible with React 19. Replaces unmaintained `react-beautiful-dnd` (archived by Atlassian). Has `DragOverlay` for smooth ghost card UX. |
| `@dnd-kit/sortable` | `^10.0.0` | SortableContext + useSortable for within-column reordering | Peer dep: `@dnd-kit/core ^6.3.0`. Required for columns where cards can be reordered within the same status. |
| `@dnd-kit/utilities` | `^3.2.2` | CSS.Transform.toString helper | Avoids manual transform math when positioning dragged elements. Tiny (no additional peer deps). |

**Why not `@dnd-kit/react` (the new API):** As of November 2025 the maintainer has not confirmed it is production-ready. A public discussion (#1842 on GitHub, Nov 26 2025) asking "should new projects start with @dnd-kit/react or stick to @dnd-kit/core for stability?" remains unanswered. Use `@dnd-kit/core` (the stable v6 API) for this milestone.

**Why not `@hello-pangea/dnd`:** Documented performance issues on large lists; less granular control over drag overlay; DragDropContext/Droppable/Draggable API is more prescriptive. dnd-kit gives direct control over sensors (PointerSensor + KeyboardSensor) and overlay rendering.

#### Form Management (Create/Edit Issue)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-hook-form` | `^7.71.2` | Uncontrolled form state for create/edit issue forms | Explicit React 19 peer dep (`^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`). Minimal re-renders via uncontrolled inputs — critical for dynamic custom field forms that can have 15–30 fields. |
| `@hookform/resolvers` | `^5.2.2` | Bridges react-hook-form with Zod validation | Peer dep: `react-hook-form ^7.55.0`. Works with Zod v3. |
| `zod` | `^3.24` | Runtime schema validation for form fields | Use **v3, not v4**. Zod v4 (4.3.6 on npm) breaks `zodResolver`: ZodError is thrown instead of captured by RHF, so `formState.errors` is never populated. Multiple open issues in `react-hook-form/resolvers` (issues #799, #813, #768) confirmed as of Aug–Sep 2025. Stay on v3 until a stable v4 resolver ships. |

#### ADF Rich-Text Rendering (Issue Detail View)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `simple-adf-formatter` | `^latest` | ADF document → React JSX elements | Under 2 kB, zero dependencies, Apache-2.0. Supports JSX output via `jsxFormatter`. Handles all standard ADF node types: text, paragraph, heading, bulletList, orderedList, codeBlock, blockquote, hardBreak, mentions, links. Avoids `@atlaskit/renderer` which adds 3.5–12 MB to the Vite bundle — incompatible with the ~10 MB Tauri portable target. |

**Why not `@atlaskit/renderer`:** The package is 3.51 MB unpacked and pulls in ProseMirror, Emotion CSS-in-JS, and dozens of `@atlaskit/*` sub-packages. Users report bundle growth from 400 kB to 12 MB after adding it. Unacceptable for a portable Tauri executable where total build size is a hard constraint.

**Fallback option:** If `simple-adf-formatter` proves insufficient for any node types, extend the existing inline `adfToPlainText()` function in `SearchResultPanel.tsx` to emit JSX rather than strings. The walker is ~30 lines and fully under project control. This is a 1–2 hour effort and keeps zero new dependencies.

---

### 2. Jira REST API — New Endpoints (No New Libraries)

All new Jira API calls use the existing `apiFetch.ts` + `@tauri-apps/plugin-http` pattern with Bearer PAT auth. No new HTTP client needed.

#### Jira Agile REST API (`/rest/agile/1.0/`)

| Feature | Endpoint | Notes |
|---------|----------|-------|
| Epic list for a board | `GET /rest/agile/1.0/board/{boardId}/epic` | Returns epics with `key`, `name`, `color`; paginated |
| Issues in an epic | `GET /rest/agile/1.0/board/{boardId}/epic/{epicId}/issue` | Returns issues belonging to that epic on the board |
| Issues not in any sprint (backlog) | `GET /rest/agile/1.0/board/{boardId}/backlog` | Returns incomplete issues not assigned to future/active sprint |
| Move issues to sprint | `POST /rest/agile/1.0/sprint/{sprintId}/issue` | Body: `{ "issues": ["PROJ-1", "PROJ-2"] }`. Max 50 per call. Only open/active sprints. |
| Move issues to backlog | `POST /rest/agile/1.0/backlog/issue` | Body: `{ "issues": ["PROJ-1"] }`. Equivalent to removing sprint assignment. |

**boardId discovery:** Already available via `GET /rest/agile/1.0/board?projectKeyOrId={key}`. Cache it alongside the current project key in the settings store.

#### Jira Platform REST API v2 — New Endpoints (`/rest/api/2/`)

| Feature | Endpoint | Notes |
|---------|----------|-------|
| Issue creation | `POST /rest/api/2/issue` | Body: `{ "fields": { "project": {...}, "summary": "...", "issuetype": {...}, ... } }` |
| Issue edit | `PUT /rest/api/2/issue/{issueKey}` | Body: `{ "fields": { ... } }` — only send fields being changed |
| Full issue detail | `GET /rest/api/2/issue/{issueKey}?expand=renderedFields,names` | `renderedFields` contains server-rendered HTML for ADF fields; `names` maps field IDs to display names |
| Issue link | `POST /rest/api/2/issueLink` | Body: `{ "type": { "name": "Blocks" }, "inwardIssue": {...}, "outwardIssue": {...} }` |
| Issue link types | `GET /rest/api/2/issueLinkType` | Returns all configured link types (Blocks, Clones, Duplicates, etc.) |
| Create-form metadata | `GET /rest/api/2/issue/createmeta?projectKeys={key}&expand=projects.issuetypes.fields` | Returns field schemas per issue type; use to discover custom field IDs and allowed values |
| User search (assignee picker) | `GET /rest/api/2/user/search?query={term}` | Returns users matching query; use for assignee autocomplete |
| Issue transitions | `GET /rest/api/2/issue/{key}/transitions` | Already used; no change needed |
| Apply transition | `POST /rest/api/2/issue/{key}/transitions` | Already used; no change needed |

**Custom field schema pattern for create/edit form:** Call `GET /rest/api/2/issue/createmeta?projectKeys={key}&expand=projects.issuetypes.fields` on form open. The response gives each field's schema including `type`, `allowedValues`, and `required`. Build the Zod schema programmatically from this response. For the "account" custom field, identify it by `schema.custom` containing `"com.atlassian.jira.plugin.system.customfieldtypes:userpicker"` or by its field `name` configured in the instance.

**Note on `expand=renderedFields`:** When fetching full issue detail, `renderedFields.description` contains server-side HTML rendering of the ADF description. This is an alternative to client-side ADF parsing with `simple-adf-formatter` — render the HTML via `dangerouslySetInnerHTML` in a sandboxed container. Evaluate both approaches; `renderedFields` gives Jira-native rendering fidelity but requires sanitization (`DOMPurify` or equivalent).

---

### 3. Installation Commands

```bash
# From: /Users/mimo/Desktop/Tasker/taskflow/

# Drag-and-drop (kanban board)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Form management (create/edit issue)
npm install react-hook-form @hookform/resolvers zod@^3

# ADF rich-text rendering
npm install simple-adf-formatter
```

---

### 4. Version Compatibility Matrix (v1.2 additions)

| Package | Version | React 19 Compatible | Notes |
|---------|---------|---------------------|-------|
| `@dnd-kit/core` | `^6.3.1` | Yes | peerDep: `react >=16.8.0` — verified via npm registry |
| `@dnd-kit/sortable` | `^10.0.0` | Yes | peerDep: `@dnd-kit/core ^6.3.0` — confirmed |
| `@dnd-kit/utilities` | `^3.2.2` | Yes | No peer dep constraints |
| `react-hook-form` | `^7.71.2` | Yes | peerDep explicitly includes `^19` — verified via npm |
| `@hookform/resolvers` | `^5.2.2` | Yes | peerDep: `react-hook-form ^7.55.0` — verified |
| `zod` | `^3.24` | Yes (no peer dep) | Do NOT use v4 — zodResolver breakage (open Aug–Sep 2025) |
| `simple-adf-formatter` | latest | Yes (no peer dep) | Zero deps, < 2kB — verified via GitHub |

---

### 5. Implementation Patterns

**Drag-and-drop kanban (subtask card layout):**
- `DndContext` wraps the board; one `SortableContext` per status column
- Sensors: `PointerSensor` (mouse/touch) + `KeyboardSensor` (accessibility)
- `DragOverlay` renders the ghost card during drag — avoids layout shift in the source column
- `onDragEnd`: fire optimistic status transition via existing `POST /rest/api/2/issue/{key}/transitions`; rollback on API error using the same pattern as v1.0 `StatusPopover`
- Keep drag state (active card ID) in local React state, not Zustand — it's ephemeral per-session

**Create/edit issue forms:**
- `useForm` with `zodResolver` wrapping a Zod schema built from `createmeta` response
- `useFieldArray` for issue links (variable count, add/remove)
- On mount: call `createmeta` to populate field definitions; show skeleton while loading
- Custom user-picker fields: `GET /rest/api/2/user/search?query=` with debounced input, render results as a combobox using `@base-ui/react` Select primitive (already in project)

**ADF rich-text in issue detail:**
- Gate behind type check: `typeof description === 'object'` → use `simple-adf-formatter`; `typeof description === 'string'` → render as plain text (existing Jira DC Server behavior)
- Alternatively: if `renderedFields.description` is available from `expand=renderedFields`, prefer it — Jira renders ADF server-side including complex macros
- If using `renderedFields`: sanitize HTML before setting `dangerouslySetInnerHTML` (Jira's rendered HTML is generally safe but add a lightweight sanitizer as defense)

**Backlog / move-to-sprint:**
- `fetchBacklog(boardId)` → paginated `GET /rest/agile/1.0/board/{boardId}/backlog`
- `moveToSprint(sprintId, issueKeys[])` → `POST /rest/agile/1.0/sprint/{sprintId}/issue` with SUBTASK_CHUNK_SIZE-style chunking (max 50 per call)
- Optimistic update: remove moved issues from backlog query cache via `queryClient.setQueryData`; invalidate sprint query

---

### 6. What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@atlaskit/renderer` | 3.51 MB package; 12 MB bundle growth in practice; pulls ProseMirror + Emotion | `simple-adf-formatter` (< 2kB) |
| `@atlaskit/editor-core` | Full collaborative editor; 8–12 MB; overkill for view-only ADF description | Not needed — issue description is read-only |
| `react-dnd` (original) | Unmaintained; React 19 support issue #3655 still open | `@dnd-kit/core ^6.3.1` |
| `react-beautiful-dnd` | Archived by Atlassian; no React 18+ support | `@dnd-kit/core ^6.3.1` |
| `@dnd-kit/react` (new API) | Pre-stable alpha; maintainer has not confirmed production-ready (Nov 2025) | `@dnd-kit/core ^6.3.1` |
| `zod ^4` | `zodResolver` breaks silently (errors thrown not captured); open issues Aug–Sep 2025 | `zod ^3.24` |
| Any Jira API client library | None validated against Jira DC v10.3 + Bearer PAT + tauri-plugin-http CORS flow | Extend existing `jira.ts` |
| `DOMPurify` (full package) | Only needed if using `renderedFields` HTML path | If needed: use `dompurify` (MIT, ~14kB) or the native Sanitizer API (Chromium-based webviews) |

---

### 7. Sources (v1.2 Research)

- npm registry, live (2026-03-13): `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2, `react-hook-form` 7.71.2, `@hookform/resolvers` 5.2.2, `zod` 4.3.6 — peer deps verified via `npm info`; confidence HIGH
- GitHub: [clauderic/dnd-kit discussion #1842](https://github.com/clauderic/dnd-kit/discussions/1842) — `@dnd-kit/react` not yet production-ready confirmed (Nov 2025); confidence HIGH
- GitHub: [react-hook-form/resolvers issues #799, #813, #768](https://github.com/react-hook-form/resolvers/issues/799) — Zod v4 + zodResolver breakage confirmed open Aug–Sep 2025; confidence HIGH
- GitHub: [dixahq/simple-adf-formatter](https://github.com/dixahq/simple-adf-formatter) — JSX output confirmed, < 2kB, zero deps, Apache-2.0; confidence MEDIUM (12 stars, low adoption but correct scope and active commits)
- Atlassian community: [@atlaskit/renderer bundle size thread](https://community.developer.atlassian.com/t/is-there-anyway-to-reduce-the-bundle-size-of-atlaskit-renderer-in-my-react-custom-ui/53543) — 3.5 MB unpacked, 12 MB bundle growth confirmed; confidence HIGH
- [Jira Software Data Center REST API 9.14.0 docs](https://docs.atlassian.com/jira-software/REST/9.14.0/) — epic, backlog, sprint, board endpoints confirmed; confidence MEDIUM (9.14 docs, app targets 10.3.15; Agile API is stable across DC versions)
- [Atlassian developer: createmeta example](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — custom field schema discovery via `createmeta` confirmed; confidence HIGH

---

## v1.1 Addendum: Jira REST API v2 Field Reference

This section documents the specific Jira Data Center REST API v2 fields and endpoint patterns required for the four new v1.1 capabilities. No new npm dependencies are needed — the existing `@tauri-apps/plugin-http` fetch, TanStack Query, and the `jira.ts` service layer cover everything.

---

### 1. Story→Subtask Hierarchy

#### How subtasks are exposed on a parent issue

When fetching any issue (story, task) via `GET /rest/api/2/issue/{issueKey}` or `GET /rest/api/2/search`, the response includes a `fields.subtasks` array. Each entry contains only these fields — this is a hardcoded Jira API limitation, not a fields-parameter issue:

```json
"subtasks": [
  {
    "id": "10010",
    "key": "PROJ-5",
    "self": "https://jira.example.com/rest/api/2/issue/10010",
    "fields": {
      "summary": "Do the thing",
      "status": { "id": "1", "name": "To Do", "statusCategory": { "key": "new" } },
      "priority": { "name": "Medium" },
      "issuetype": { "name": "Sub-task", "subtask": true }
    }
  }
]
```

The `subtasks` array does NOT include `assignee`, `timetracking`, `customfield_10016` (story points), or any other fields. You cannot expand additional fields into the inline subtask objects. To get full subtask data, fetch them separately.

**Confidence:** HIGH — confirmed by Atlassian community documentation and the API description that these four fields are a "convenience for dashboard gadgets."

#### How to get the parent story from a subtask

A subtask response contains a `fields.parent` object. When you include `parent` in the `fields` query parameter, the response returns:

```json
"parent": {
  "id": "10005",
  "key": "PROJ-3",
  "self": "https://jira.example.com/rest/api/2/issue/10005",
  "fields": {
    "summary": "Parent Story Title",
    "status": { "id": "3", "name": "In Progress" },
    "priority": { "name": "High" },
    "issuetype": { "name": "Story", "subtask": false }
  }
}
```

The `parent.key` and `parent.fields.summary` are available in a single call — no second round-trip needed to display "parent story context" alongside a subtask.

**Confidence:** HIGH — confirmed by multiple Atlassian community threads; the `parent` field with nested key/summary/status is available on Jira Server/Data Center.

#### JQL pattern: fetch all subtasks in the active sprint

The existing `fetchSprintIssues` uses `openSprints()` but does not include subtasks (subtasks in Jira are not directly assigned to sprints — they inherit the sprint from their parent). To retrieve subtasks alongside sprint stories, use two JQL approaches:

**Option A — Single query including subtasks by sprint** (Data Center supports this):
```
project = PROJ AND sprint in openSprints() AND resolution = Unresolved ORDER BY updated DESC
```
This already returns subtasks IF the parent story is in the sprint and subtasks are included in JQL scope. However, on some DC configurations subtasks are excluded from sprint queries by default.

**Option B — Explicit subtask query by parent keys** (reliable, confirmed pattern):
```
issuetype in subtaskIssueTypes() AND parent in ("PROJ-1", "PROJ-2", "PROJ-3") AND resolution = Unresolved
```
Use this after fetching the sprint stories to hydrate subtask data in a second call.

**Option C — Assignee-filtered subtask query for "My Subtasks"**:
```
issuetype in subtaskIssueTypes() AND project = PROJ AND sprint in openSprints() AND assignee = currentUser() AND resolution = Unresolved
```

**Recommended integration pattern** for v1.1 (within existing TanStack Query setup):
- Keep the existing `fetchSprintIssues` call which returns all sprint issues including stories
- The stories already include their `fields.subtasks` array (with key + summary + status inline — sufficient for grouping display)
- For full subtask detail (assignee, story points, time tracking), fire a second `fetchSprintIssues`-style call with `issuetype in subtaskIssueTypes() AND sprint in openSprints()` to get complete field data
- Match subtasks to parents by `fields.parent.key`

#### Fields to add to `fields` parameter

Update the `fields` query string in `fetchSprintIssues` to include `parent,subtasks`:

```
fields=summary,status,assignee,issuetype,customfield_10016,parent,subtasks,timetracking
```

- `subtasks` — array of child subtask stubs (key, summary, status, issuetype) on parent issues
- `parent` — parent object (key, summary, status, issuetype) on subtask issues

---

### 2. Time Tracking Fields

#### Field name and structure

Time tracking data is in the `fields.timetracking` object on any issue. It is NOT a custom field — it is a built-in Jira field with the key `timetracking`. Include it by adding `timetracking` to the `fields` parameter.

**Full response structure** (confirmed for Jira Server/Data Center REST API v2):

```json
"timetracking": {
  "originalEstimate": "2d",
  "remainingEstimate": "1d 4h",
  "timeSpent": "3h 30m",
  "originalEstimateSeconds": 57600,
  "remainingEstimateSeconds": 43200,
  "timeSpentSeconds": 12600
}
```

- `originalEstimate` — string in Jira's duration format (e.g., "2d", "4h 30m")
- `remainingEstimate` — string, current remaining time
- `timeSpent` — string, total time logged (work logs sum)
- `*Seconds` variants — numeric equivalents for calculation; use these for arithmetic, display the string variants

**When the field is null:** If no time tracking has been set on an issue, `timetracking` is `null`. The `JiraIssue` type must declare it as `TimeTracking | null`.

**Configuration note:** Time tracking must be enabled in the Jira instance and the `timetracking` field must be on the issue's screen. On most Data Center installs this is already true — but if `timetracking` is missing from responses, it means the field is not on the screen, not that the API doesn't support it.

**Confidence:** HIGH — confirmed by Jira Java API class documentation (TimeTracking class), community threads, and consistent across Jira Server docs from v5 through v9.

#### TypeScript interface to add to `jira.ts`

```typescript
export interface JiraTimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}
```

Add `timetracking: JiraTimeTracking | null` to the `JiraIssue.fields` interface.

---

### 3. Fix Version Released/Unreleased Status

#### Endpoint and response fields

The existing `fetchFixVersions` uses `GET /rest/api/2/version?projectKey={key}`, which returns a paginated envelope. The `JiraFixVersion` interface already has `released: boolean` and `releaseDate?: string` — these are confirmed correct.

**Complete version object returned by Data Center REST API v2:**

```json
{
  "id": "10000",
  "self": "https://jira.example.com/rest/api/2/version/10000",
  "name": "v2.1.0",
  "description": "Sprint 14 release",
  "archived": false,
  "released": true,
  "releaseDate": "2026-02-28",
  "userReleaseDate": "28/Feb/2026",
  "overdue": false,
  "projectId": 10000
}
```

Key fields:
- `released` — boolean, `true` if the version has been marked released in Jira
- `releaseDate` — string `"YYYY-MM-DD"`, present when a release date is set; absent (field missing, not null) when no date has been configured
- `archived` — boolean; archived versions are typically hidden from active release views
- `overdue` — boolean; `true` when `released = false` and `releaseDate` is in the past
- `userReleaseDate` — locale-formatted string, use `releaseDate` for sorting/comparison

**startDate limitation — CRITICAL:** The `startDate` field does NOT appear in GET responses. It is only available as a parameter on Create/Update version calls. The `startDateSet` boolean appears in some responses indicating whether a start date was configured, but the actual date value is not returned via GET. Do not attempt to use `startDate` for sorting or display — it is unavailable without individual per-version GET calls, which would be expensive.

**Ordering for "newest→oldest" requirement:** Sort by `releaseDate` descending. For versions with no `releaseDate`, place them at the end (or top, depending on team preference). The API does not return versions in any guaranteed order.

**Confidence:** HIGH — confirmed by Atlassian community thread with Atlassian staff response explicitly stating startDate is not in GET response; version response fields confirmed by multiple sources showing the same JSON structure.

#### `JiraFixVersion` interface update

The existing interface is correct. No changes needed for `released` and `releaseDate`. Add `archived` and `overdue` for completeness:

```typescript
export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string;       // "YYYY-MM-DD" — absent when not set
  released: boolean;
  archived: boolean;          // add this
  overdue: boolean;           // add this — true when unreleased and past due
  description?: string;
}
```

---

### 4. Story Points Field

#### The field name problem

Story points are stored as a custom field in Jira. The field ID (`customfield_XXXXX`) varies per Jira instance — it depends on the order custom fields were created in that instance. There is no standardized story points field key in the REST API.

**Common IDs seen in the wild:**
- `customfield_10016` — most common default for Jira Software installations (this is what the existing codebase already uses)
- `customfield_10028` — seen on some instances where the field was added later
- `customfield_10004`, `customfield_10106` — other variants found in community reports

The existing `fetchSprintIssues` already requests `customfield_10016` (and `story_points` which is not a valid API field name — see below).

**The `story_points` field name is invalid.** The current `fields` string in `fetchSprintIssues` includes `story_points` — this is not a valid Jira REST API v2 field name and will be silently ignored. Remove it.

#### How to discover the correct field ID for a given Data Center instance

Use `GET /rest/api/2/field` which returns all fields. Filter for items where `name` equals `"Story Points"` or `"Story point estimate"`:

```
GET /rest/api/2/field
Authorization: Bearer <token>
```

Response includes objects like:
```json
{
  "id": "customfield_10016",
  "name": "Story Points",
  "custom": true,
  "orderable": true,
  "navigable": true,
  "searchable": true,
  "clauseNames": ["cf[10016]", "Story Points", "story_points"],
  "schema": {
    "type": "number",
    "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
    "customId": 10016
  }
}
```

The `schema.customId` gives you the number to use in `customfield_XXXXX`.

#### Recommended implementation pattern

Because the field ID varies between instances, implement dynamic field discovery in v1.1:

1. On first use (or settings save), call `GET /rest/api/2/field` and find the field named `"Story Points"` or `"Story point estimate"`
2. Cache the discovered field key in Zustand/local store as `storyPointsField` (e.g., `"customfield_10016"`)
3. Use that key in all subsequent JQL `fields` parameters
4. Fall back to `customfield_10016` if discovery fails (covers 90%+ of standard DC installs)

This is a small one-time call (the `/field` endpoint returns all fields as a flat array, typically ~50-200 items) and prevents the app from silently showing zero story points on instances using a non-default field ID.

**New function to add to `jira.ts`:**

```typescript
// Returns the custom field key for story points (e.g., "customfield_10016")
// Falls back to "customfield_10016" if not found
export async function discoverStoryPointsField(
  baseUrl: string,
  token: string,
): Promise<string>
```

**Confidence:** HIGH for the field discovery approach. MEDIUM for `customfield_10016` as the default fallback (it is common but not universal).

---

### 5. Fields Parameter Reference for v1.1 Queries

#### Updated `fetchSprintIssues` fields string

```
summary,status,assignee,issuetype,customfield_10016,parent,subtasks,timetracking
```

Remove `story_points` (invalid). Add `parent`, `subtasks`, `timetracking`. Replace the hardcoded `customfield_10016` with the dynamically discovered field key.

#### Subtasks-only query fields string

```
summary,status,assignee,issuetype,customfield_10016,parent,timetracking
```

Subtasks do not need the `subtasks` field (they don't have children); they need `parent` to enable grouping under the parent story.

#### Fix versions — no field changes needed

The existing `GET /rest/api/2/version?projectKey={key}` already returns `released` and `releaseDate`. Add client-side sort by `releaseDate` descending. Add `archived` filtering (exclude archived versions from the releases view).

---

### 6. What NOT to Add (v1.1)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm package for Jira API client | Existing `@tauri-apps/plugin-http` fetch + typed interfaces covers all needs | Extend `jira.ts` with new functions and updated interfaces |
| `story_points` as a field name in the API call | Not a valid REST API v2 field name — silently ignored | Use `customfield_10016` (or discovered key) |
| Reading `startDate` from version GET responses | Field is not returned in GET responses — only available on create/update | Sort by `releaseDate`; show `startDateSet` boolean if needed |
| Fetching subtask full data from within a parent's subtasks array | The array only returns 4 fields by design | Run a separate `issuetype in subtaskIssueTypes() AND sprint in openSprints()` query |
| Hardcoding `customfield_10016` without a fallback | Field ID is instance-specific | Implement `discoverStoryPointsField()` with `customfield_10016` fallback |
| `GET /rest/api/3/` (Cloud API) endpoints | This is on-premise Jira Data Center — only v2 is available | `GET /rest/api/2/` only |
| `accountId` in JQL assignee queries | Data Center uses `name` not `accountId` (Cloud-only) | `assignee = currentUser()` or `assignee = "username"` |

---

## Original v1.0 Stack (Validated)

The following stack is already validated and shipped in v1.0. Do not re-research.

### Cross-Platform Shell

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri 2 | ^2.1 | Desktop shell (macOS, Windows, Linux) | Ships a native webview — no bundled Chromium. ~10 MB installers vs ~150 MB for Electron. Tauri 2.0 (released Oct 2024) added multi-window, mobile support, and a stable plugin API. The Rust backend gives secure credential storage via OS keychain without a server. Actively maintained by CrabNebula with strong community. |

**Why not Electron:** Electron bundles a full Chromium + Node.js runtime. This matters less for an internal tool, but the 150-200 MB installer and 200-400 MB RAM overhead are unnecessary when the app has no complex native rendering requirements. Tauri 2's webview uses the OS-native engine (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) — acceptable for a dashboard app that doesn't need pixel-perfect cross-platform rendering.

**Why not a pure web app:** The project requires desktop OS notifications, local PAT storage, and optionally background polling when the window is not focused. These are possible in a web app with PWA + Notification API, but PAT security in localStorage is worse than OS keychain. Tauri gives the right capabilities with a native security model.

---

### UI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | ^19.1 | UI component framework | The dominant ecosystem choice. Tauri's own documentation and templates are React-first. TanStack Query, the most important library in this stack, has its deepest integration with React. (Note: v1.0 docs said ^18.3; actual shipped version is 19.1.) |
| TypeScript | ^5.8 | Type safety across the whole codebase | Jira API v2 and GitLab API have complex, partially-documented response shapes. TypeScript interfaces for API responses will prevent entire categories of runtime bugs. |
| Vite | ^7.x | Build tool and dev server | Tauri's official scaffolding uses Vite. Sub-second HMR in development. |

---

### Data Fetching and Server State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | ^5.x | All API calls: caching, background refetch, polling | Background polling at configurable intervals, cache invalidation when the user takes an action, stale-while-revalidate. `refetchInterval` powers the notification polling loop without any manual `setInterval` management. |

---

### UI State (Non-Server)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | ^5.0 | Global UI state: theme, active role, selected project/sprint, discovered field IDs | Minimal boilerplate, no context hell. Use it to cache the discovered story points field key between sessions. |

---

### Component Library / UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (copy-paste model via `shadcn` CLI) | Accessible component primitives | Built on `@base-ui/react ^1.2` primitives + Tailwind CSS. Components are owned by the project. |
| Tailwind CSS | v4 (via `@tailwindcss/vite` only — no postcss.config.js, no tailwind.config.js) | Utility-first styling | CSS-first v4 pipeline; no config files required. |

---

### Credential Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tauri-apps/plugin-store` | ^2.x | Persist config to disk | App-specific JSON in OS data directory. Used for non-secret config (project key, role, discovered field IDs). |
| `@tauri-apps/plugin-stronghold` | ^2.x | Encrypt secrets at rest | Jira and GitLab PATs stored here, not in localStorage. |

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^4.0 | Unit + integration tests | Vite-native test runner. |
| React Testing Library | ^16.x | Component tests | Standard for React component testing by behavior. |

---

## Alternatives Considered (v1.0)

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Desktop shell | Tauri 2 | Electron | ~15x larger installers, higher RAM, no OS keychain integration without extra packages |
| Desktop shell | Tauri 2 | Pure PWA | No OS keychain for PAT storage; background notifications unreliable on desktop |
| Server state | TanStack Query v5 | SWR | TanStack has better cache invalidation, mutation coordination, TypeScript generics |
| UI state | Zustand | Jotai | Both valid; Zustand more explicit about store shape |
| Component library | shadcn/ui + Tailwind | MUI / Ant Design | Heavy, opinionated, hard to customize |

---

## Sources

**v1.2 Jira Parity research (live, 2026-03-13):**
- npm registry (live): `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2, `react-hook-form` 7.71.2, `@hookform/resolvers` 5.2.2, `zod` 4.3.6 — peer deps verified via `npm info`
- [clauderic/dnd-kit discussion #1842](https://github.com/clauderic/dnd-kit/discussions/1842) — `@dnd-kit/react` pre-stable status (Nov 2025)
- [react-hook-form/resolvers issues #799, #813, #768](https://github.com/react-hook-form/resolvers/issues/799) — Zod v4 breakage confirmed Aug–Sep 2025
- [dixahq/simple-adf-formatter GitHub](https://github.com/dixahq/simple-adf-formatter) — JSX output, < 2kB, zero deps, Apache-2.0
- [Atlassian community: @atlaskit/renderer bundle size](https://community.developer.atlassian.com/t/is-there-anyway-to-reduce-the-bundle-size-of-atlaskit-renderer-in-my-react-custom-ui/53543) — 12 MB bundle growth confirmed
- [Jira Software Data Center REST API 9.14.0](https://docs.atlassian.com/jira-software/REST/9.14.0/) — epic, backlog, sprint endpoints
- [Atlassian: createmeta discovering metadata](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — custom field schema discovery

**v1.1 Jira API research (live, 2026-03-12):**
- [Jira REST API examples (Atlassian Server docs)](https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/) — subtask field structure, parent field
- [Can you use the JIRA REST API to show more subtask fields?](https://community.atlassian.com/forums/Jira-questions/Can-you-use-the-JIRA-REST-API-to-show-more-subtask-fields/qaq-p/816963) — confirmed subtasks array limitation (4 fields only)
- [Accessing Versions "Start Date" from Jira Software Cloud REST API](https://community.atlassian.com/forums/Jira-questions/Accessing-Versions-quot-Start-Date-quot-from-Jira-Software-Cloud/qaq-p/1041256) — confirmed startDate not in GET response (Atlassian staff answer)
- [TimeTracking (Atlassian JIRA 7.6.1 API)](https://docs.atlassian.com/software/jira/docs/api/7.6.1/com/atlassian/jira/rest/api/issue/TimeTracking.html) — confirmed timetracking field structure including timeSpentSeconds
- [Get custom field IDs for Jira and Jira Service Management](https://confluence.atlassian.com/jirakb/get-custom-field-ids-for-jira-and-jira-service-management-744522503.html) — field discovery via GET /rest/api/2/field
- [Need for a dedicated key for Story points in JIRA Rest api](https://community.atlassian.com/forums/Jira-questions/Need-for-a-dedicated-key-for-Story-points-in-JIRA-Rest-api/qaq-p/924172) — confirmed customfield ID variability per instance
- [Jira Data Center platform REST API reference 9.14.0](https://docs.atlassian.com/software/jira/docs/api/REST/9.14.0/) — version endpoint reference
- [Advanced searching - functions reference | Jira Software Data Center 11.3](https://confluence.atlassian.com/jirasoftwareserver/advanced-searching-functions-reference-939938746.html) — subtaskIssueTypes() JQL function confirmed for Data Center

**v1.0 stack (training knowledge, Aug 2025 cutoff):**
- Tauri 2.0 release: https://tauri.app/blog/tauri-2-0-0-released/
- TanStack Query v5: https://tanstack.com/query/latest
- Jira REST API v2 reference: https://docs.atlassian.com/software/jira/docs/api/REST/latest/

---

*Stack research for: Taskflow — Jira/GitLab desktop integration (Tauri 2 + React + TypeScript)*
*v1.0 researched: 2026-03-10 | v1.1 addendum: 2026-03-12 | v1.2 addendum: 2026-03-13*
