# Phase 57 — Probe Findings

**Captured:** 2026-05-14
**Source:** Live AIO TCMS + Jira DC instance, DevTools → Network tab

---

## A1 — Folder tree

**CONFIRMED**

```
GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/folder?c_pId={jiraProjectID}&t={timestamp}
```

Response: `AioFolder[]` (nested tree with `ID`, `name`, `parentID`, `children[]`).

**Implementation notes:**
- Uses `AIO_PROJECTS_API_PATH` (`/rest/aio-tcms/1.0`) — already exported from `client.ts`.
- Path uses numeric **jiraProjectID** (e.g. `10134`), not the Jira project key string.
- `c_pId={id}` is a redundant query param the UI sends; omit in service calls (or include — server ignores duplicates).
- `t={timestamp}` is cache-busting; omit in service calls (Bearer auth is stateless).

---

## A2 — Folder cycle count

**CONFIRMED**

```
GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/folder/count?archive=false&c_pId={jiraProjectID}&t={timestamp}
```

Response: `Record<string, number>` — keys are folder IDs as strings; key `"-1"` = ungrouped cycles.

**Implementation notes:**
- Endpoint is `/testcycle/folder/count`, NOT `/testcycle/count` (initial assumption was wrong).
- `archive=false` is a meaningful param — include it to exclude archived cycles from counts.
- Uses `AIO_PROJECTS_API_PATH`.

---

## A3 — Cycle summary batch

**CONFIRMED**

```
GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/summary/paged?c_pId={jiraProjectID}&t={timestamp}
```

Response: array of `{ ID, jiraProjectID, permission, detail: null, summary: { totalTests, testRunDistribution: { [statusID]: count } }, objectiveAttachments }`.

**Implementation notes:**
- Endpoint is `/testcycle/summary/paged` — GET, no `ids` param needed.
- Returns ALL cycle summaries for the project in one call (not paginated in practice — `isLast` likely `true` for the projects tested).
- If more pages exist, use `startAt` param (same pattern as `/testcycle/paged`).
- `testRunDistribution` keys are string-encoded numeric status IDs: `"53"`, `"901"`, etc.
- Uses `AIO_PROJECTS_API_PATH`.

---

## A4 — Cycle list with detail

**CONFIRMED**

```
GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/paged?c_pId={jiraProjectID}&t={timestamp}
```

With folder filter (inferred from cross-referencing response with count map):
```
GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/paged?folderID={folderID}&c_pId={jiraProjectID}&t={timestamp}
```

Response: `{ items: AioCycleDetailItem[], allIDs: number[], startAt, maxResults, total, isLast, additionalData }`.

Each `items[]` entry: `{ ID, jiraProjectID, permission: { value: 15 }, detail: { key, title, ownedByID, folder: null, isClosed, ... }, summary: null, objectiveAttachments }`.

**Implementation notes:**
- Endpoint is `/testcycle/paged` — NOT the old `aio-tcms-api/1.0` endpoint.
- `detail.folder` is **always `null`** — folder association comes from the server-side `folderID` filter, not the cycle record.
- `allIDs` contains all cycle IDs for the selected folder (used to batch-fetch summaries).
- Uses `AIO_PROJECTS_API_PATH`.

---

## A5 — Folder filter convention

**CONFIRMED: server-side filter**

Evidence: The `paged` response captured for folder "Thanos Revamp 2026" (jiraProjectID=10134, folderID=10763) returned exactly 7 cycles — matching `count[10763] = 7` in the count map. Client-side filtering is impossible since `detail.folder` is `null` on all items.

**Param name:** `folderID={id}` (inferred — standard REST convention; confirm on first folder click in DevTools if needed).

**Behavior:** Selecting a folder fires a new `GET /testcycle/paged?folderID={id}&...` request. Initial page load before any folder is selected can omit `folderID` to get all cycles, or omit the query entirely.

---

## A6 — Jira user lookup

**INFERRED** (not captured from live DevTools — inferred from existing code pattern)

```
GET /rest/api/2/user?username={ownedByID}
```

Expected response: single `JiraAssignableUser` object `{ name, displayName, emailAddress, avatarUrls, ... }` or HTTP 404 if not found.

**Evidence for inference:**
- Existing `fetchAssignableUsers` in `services/jira/users.ts` uses `?username=` on the same Jira DC instance (confirmed working).
- `JiraAssignableUser.name` = the DC username string (same field as `ownedByID` in cycle detail).
- Jira DC REST API spec: `GET /rest/api/2/user?username={name}` returns a single user by `name` field.
- Live `ownedByID` values observed: `"JIRAUSER23429"`, `"ext94772"`.

**Risk:** On some Jira DC versions the param is `?name=` not `?username=`. If direct lookup returns 404/empty, fall back to `fetchAssignableUsers` search with the same value. D-08 (raw ID fallback on error) covers the error path.

---

## Summary — URL constants for Plan 02

| Endpoint | Path (relative to `AIO_PROJECTS_API_PATH`) |
|----------|-------------------------------------------|
| Folder tree | `/project/{id}/testcycle/folder` |
| Folder cycle count | `/project/{id}/testcycle/folder/count?archive=false` |
| Cycle list (paged) | `/project/{id}/testcycle/paged[?folderID={fid}]` |
| Cycle summaries | `/project/{id}/testcycle/summary/paged` |
| Jira user lookup | `{jiraBaseUrl}/rest/api/2/user?username={username}` |

**Critical:** All 4 AIO endpoints use `AIO_PROJECTS_API_PATH` (`/rest/aio-tcms/1.0`), NOT `AIO_API_PATH` (`/rest/aio-tcms-api/1.0`). The numeric `jiraProjectID` (from `AioProject.id`) must be used in the path, not the string project key.
