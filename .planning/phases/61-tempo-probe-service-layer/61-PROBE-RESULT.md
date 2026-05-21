# Phase 61 — Tempo Probe Result

Run date: 2026-05-21

## Probe Attempts

| API Path | HTTP Status | Outcome |
|----------|-------------|---------|
| `/rest/tempo-timesheets/4/worklogs` | 405 Method Not Allowed | Not supported on this DC instance — servlet exists but GET method is not permitted |
| `/rest/tempo-timesheets/3/worklogs` | 200 OK | Full JSON array of worklogs returned |

## Working API Path

```
TEMPO_API_PATH = '/rest/tempo-timesheets/3'
```

Note: v4 returned 405 (not 401/404) — the endpoint exists at the servlet level but GET is not permitted. v3 is the authoritative path for worklog reads on this Jira DC instance.

## Response Envelope Shape

v3 returns a **plain JSON array** (not a paginated envelope object):

```json
[
  {
    "timeSpentSeconds": 3600,
    "dateStarted": "2026-05-01T09:00:00.000+0000",
    "dateCreated": "2026-05-02T08:00:00.000+0000",
    "dateUpdated": "2026-05-02T08:00:00.000+0000",
    "comment": "<worklog text>",
    "author": {
      "name": "<username>",
      "key": "JIRAUSER<redacted>",
      "displayName": "<displayName>"
    },
    "issue": {
      "key": "<PROJECT-NNNNN>",
      "id": "<id>",
      "projectId": "<projectId>",
      "summary": "<issue summary>",
      "issueType": { "name": "<type>" }
    },
    "worklogAttributes": [...],
    "workAttributeValues": [
      {
        "workAttribute": { "name": "<attr name>" },
        "value": "<value>"
      }
    ]
  }
]
```

**Item array field name:** The response is a top-level array — no wrapper object, no `worklogs`/`results`/`items` key. Pagination sentinel: N/A — v3 returns all matching worklogs in a single array for the given date range and username filter.

**Query param confirmed:** `username=<jira-username>` works for filtering by user. `dateFrom`/`dateTo` params accepted.

**Date field name:** `dateStarted` (not `startDate` as assumed from Cloud docs). Contains ISO 8601 datetime string with timezone offset. Slice to `YYYY-MM-DD` with `.slice(0, 10)`.

## author Field Shape

`author` is an **object** with three fields:

```json
{
  "name": "<jira-username>",
  "key": "JIRAUSER<redacted>",
  "displayName": "<Full Name>"
}
```

**Resolves Assumption A1:** `author` is NOT a plain string — it is an object. Use `author.name` to get the Jira username (matches D-08 `usernames: string[]` filter axis). D-09 spec `author.name` is confirmed correct.

## username Query Param

**Confirmed:** `username=<jira-username>` is the correct query param for user filtering on v3.

**Resolves Assumption A2:** `username=` works. Not `accountId=`, not `userKey=`, not `worker=`.

## Pagination Sentinel

**Resolves Assumption A3:** v3 does NOT use pagination — it returns a flat array of all matching worklogs for the given date range and username list in a single response. No `isLast`, no `metadata`, no `offset`/`limit` sentinel. The `fetchWorklogs` implementation should handle a plain array response (no pagination loop needed for v3; defensive limit can be omitted or the design can use a single fetch).

## GO/NO-GO Decision for Wave 1

**GO**

v3 returned HTTP 200 with a full worklog array. Wave 1 proceeds.

**Resolved assumptions:**
| Assumption | Resolution |
|------------|------------|
| A1: author shape | Object `{ name, key, displayName }` — use `author.name` |
| A2: username param | `username=` confirmed |
| A3: pagination sentinel | No pagination — v3 returns flat array |
| A4: Bearer PAT auth | Confirmed working on v3 |

**Type definition adjustments for Wave 1 (61-02):**

1. `TEMPO_API_PATH = '/rest/tempo-timesheets/3'` (not v4)
2. `dateStarted: string` field (not `startDate`) — `dateStarted.slice(0, 10)` for date bucketing
3. `author: { name: string; key: string; displayName: string }` (object, not string)
4. `TempoPaginatedResponse` wrapper not needed — v3 returns `TempoWorklog[]` directly
5. `fetchWorklogs` needs a single fetch (no pagination loop) — or a defensive loop that works with a flat array return
