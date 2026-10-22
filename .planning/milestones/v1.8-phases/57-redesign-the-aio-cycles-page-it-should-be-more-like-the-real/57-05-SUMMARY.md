---
plan: 57-05
phase: 57
status: complete
wave: 3
completed: 2026-05-15
subsystem: aio-uat
tags: [aio, uat, human-verification, approved]
requires: [57-04]
provides: [57-UAT.md]
key_files_modified:
  - .planning/phases/57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real/57-UAT.md
decisions:
  - "UAT verdict: approved — all 13 checks pass after inline fixes"
  - "7 inline fixes applied during UAT session before final approval"
---

# Plan 57-05 Summary — Live UAT

**Verdict:** approved
**Checks:** 13/13 PASS
**Gaps:** none

## Inline fixes applied during UAT

All fixes were committed with tests green before approval:

| Fix | Commit | Description |
|-----|--------|-------------|
| Wrong project ID | a0de4960 | Added `fetchJiraProjectNumericId` — AIO folder endpoints need Jira numeric ID not AIO-internal ID |
| 405 on paged (GET→POST) | 2e1d5eaa | `/testcycle/paged` and `/testcycle/summary/paged` require POST |
| POST body format | dfd744cf | Correct body shapes: paged=`{columns,sortingData,folderID}`, summaries=`[...ids]` |
| User key param | 5323bd4c | `?username=` → `?key=` for JIRAUSER* keys |
| Status ID map wrong | b417924a | Corrected 51/53/54; then made dynamic via `/config` |
| Folder click no-op | 60c95b10 | Query keyed by `selectedFolderID`; POST body includes subtree folder filter |
| Dynamic status map | 67e671fd | `fetchAioProjectConfig` → `buildStatusMap` from `statusType` strings |

## Recommended next command

```
/gsd-complete-milestone v1.8
```
