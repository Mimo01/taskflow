---
status: advisory
blockers: 0
warnings: 2
info: 2
range: e3c75937..cf9464cd
---

# Code Review — 260929-h2q (quick depth)

## Targeted questions
- **Worklogs enrichMap** includes enrichQuery + parentEnrichQuery + grandparentEnrichQuery data; parentEnrichQuery requests `subtasks`, so story order is available. No bug.
- **fetchIssueMeta follow-up**: at most one extra request, only for parents not already requested; try/catch + ok-check; failure → numeric fallback.
- **Standup placement invariant**: `_placementStatusKey` still reads the unsorted `mySubtasksForParent[0]`; only the display `subtasks` field is ordered.

## Warnings
- **WR-01** `services/jira.ts` ~1187 — follow-up writes partial `StandupIssueMeta` entries (only `subtaskKeys`) for parent keys never requested. Safe for YesterdayColumn (keyed `?.` lookups only); would matter if a future consumer enumerates the map.
- **WR-02** `services/jira.ts` ~1135/~1172 — `maxResults=keys.length` without chunking; very large parent sets could be truncated by the server cap → numeric fallback only.

## Info
- **IN-01** `compareIssueKeysNumeric`: `Number('')` is 0, so `ABC-` counts as integer 0. Harmless.
- **IN-02** `orderSubtasksWithinParents`: empty-string parent key groups parentless items together; callers should return `undefined`.
