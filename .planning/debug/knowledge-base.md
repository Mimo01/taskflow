# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## time-logging-500 — Jira worklog API rejects ISO dates with Z suffix
- **Date:** 2026-03-23
- **Error patterns:** 500, Error parsing time, toISOString, Z, worklog, started
- **Root cause:** `LogWorkPopover.tsx` uses `new Date().toISOString()` which produces `Z`-suffixed UTC timestamps. Jira Server/DC worklog API cannot parse `Z` as a timezone designator and returns HTTP 500. It requires `+0000` offset format.
- **Fix:** Append `.replace('Z', '+0000')` to `.toISOString()` calls in both LogWorkPopover (create) and IssueDetailPage (update fallback).
- **Files changed:** taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx, taskflow/src/routes/dashboard/IssueDetailPage.tsx
---
