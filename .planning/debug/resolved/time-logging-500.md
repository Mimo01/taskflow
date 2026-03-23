---
status: awaiting_human_verify
trigger: "Jira API returns 500 'Error parsing time: 2026-03-23T11:00:00.000Z' when logging time on issue detail page"
created: 2026-03-23T12:00:00Z
updated: 2026-03-23T12:00:00Z
---

## Current Focus

hypothesis: LogWorkPopover.tsx line 74 formats the `started` field using `.toISOString()` which produces a `Z`-suffixed UTC string. Jira worklog API rejects this format and expects `+0000` timezone offset notation.
test: Change date formatting to use `+0000` offset instead of `Z`
expecting: Jira API accepts the worklog without 500 error
next_action: Apply fix to LogWorkPopover.tsx

## Symptoms

expected: User can log time/worklog on an issue detail page successfully
actual: Jira API returns HTTP 500 with XML response containing "Error parsing time: 2026-03-23T11:00:00.000Z"
errors: 500 error from Jira when parsing ISO 8601 date format with Z suffix
reproduction: Log time on any issue in the issue detail view
started: Never worked

## Eliminated

## Evidence

- timestamp: 2026-03-23T12:00:00Z
  checked: LogWorkPopover.tsx handleSubmit function (line 74)
  found: `const started = new Date(\`${date}T12:00:00\`).toISOString();` produces dates like `2026-03-23T11:00:00.000Z` (note: local noon gets converted to UTC, hence 11:00 not 12:00)
  implication: The `Z` suffix is the direct cause of the Jira 500 error. Jira Server/DC worklog API requires `+0000` offset format, not `Z`.

- timestamp: 2026-03-23T12:00:00Z
  checked: worklogs.ts createWorklog function
  found: The `started` string from the caller is passed directly into `JSON.stringify(params)` with no transformation. No date formatting layer exists in the service.
  implication: The fix must be in the caller (LogWorkPopover) where the date is constructed, or we add formatting in the service layer.

## Resolution

root_cause: `LogWorkPopover.tsx` line 74 uses `new Date(...).toISOString()` which produces `Z`-suffixed UTC timestamps. Jira's worklog REST API (v2) cannot parse `Z` as a timezone designator and returns HTTP 500. It requires the `+0000` offset format instead.
fix: Append `.replace('Z', '+0000')` to `.toISOString()` calls in both LogWorkPopover (create) and IssueDetailPage (update fallback) so the `started` field uses Jira-compatible timezone offset format
verification: All 8 worklog service tests pass. No regressions in related test files.
files_changed: [taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx, taskflow/src/routes/dashboard/IssueDetailPage.tsx]
