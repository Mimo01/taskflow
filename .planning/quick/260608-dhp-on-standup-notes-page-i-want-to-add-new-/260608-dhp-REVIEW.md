---
phase: 260608-dhp
reviewed: 2026-06-08T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
  - taskflow/src/services/jira.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 260608-dhp: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Review focused on the "created issues" feature: the `fetchYesterdayCreatedIssues` service function, the new `jiraCreatedQuery` in `StandupNotesPage`, and how `buildGroups` seeds those results as `issue-created` sub-items in `YesterdayColumn`.

No hardcoded secrets, dangerous functions, empty catch blocks, or debug artifacts were found. The implementation is generally sound but has four correctness/quality gaps.

---

## Warnings

### WR-01: Full-column "Nothing to recap" empty state can flash while `jiraCreatedQuery` is loading

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:687-705`

**Issue:** The full-column empty state guard checks `!tempoQuery.isLoading`, `!jiraActivityQuery.isLoading`, `!commitsQuery.isLoading`, and `!mrEventsQuery.isLoading` — but **not** `!jiraCreatedQuery.isLoading`. If all four existing queries return empty quickly and `jiraCreatedQuery` is still in-flight, the "Nothing to recap" empty state renders prematurely, then disappears when created issues arrive. The same guard omits `!jiraCreatedQuery.isError`, so an error in the new query does not suppress the empty state either.

**Fix:**
```tsx
{!hasAnyData &&
  !tempoQuery.isLoading &&
  !jiraActivityQuery.isLoading &&
  !commitsQuery.isLoading &&
  !mrEventsQuery.isLoading &&
  !jiraCreatedQuery.isLoading &&      // add this
  !tempoQuery.isError &&
  !jiraActivityQuery.isError &&
  !commitsQuery.isError &&
  !mrEventsQuery.isError &&
  !jiraCreatedQuery.isError && (      // add this
```

---

### WR-02: `allIntegrationsDisabledOrEmpty` ignores `jiraCreatedQuery`, producing wrong subtitle text

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:632-639`

**Issue:** `allIntegrationsDisabledOrEmpty` is used to choose between two empty-state subtitles: "No integrations enabled" vs "All integrations returned empty results". The expression does not test `jiraCreatedQuery.data?.length` or `jiraCreatedQuery.isLoading`. If only the new query has data (or is loading) while the others are idle/empty, the subtitle may incorrectly read "No integrations enabled" even though the Jira integration is active and returning results.

**Fix:**
```ts
const allIntegrationsDisabledOrEmpty =
  !tempoEnabled &&
  !jiraActivityQuery.data?.length &&
  !jiraCreatedQuery.data?.length &&   // add
  !commitsQuery.data?.length &&
  !mrEventsQuery.data?.length &&
  !jiraActivityQuery.isLoading &&
  !jiraCreatedQuery.isLoading &&      // add
  !commitsQuery.isLoading &&
  !mrEventsQuery.isLoading;
```

---

### WR-03: Created-only issue groups appear under the "Worked On" section header — semantically incorrect

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:713-715`

**Issue:** All `issueGroups` — regardless of whether they contain actual work (worklogs, commits, transitions) or only an `issue-created` sub-item — are rendered under a single `StandupSectionHeader` labelled "Worked On". An issue that was created yesterday but not yet touched appears in "Worked On", which is misleading to the reader and to the standup audience.

Additionally the stat line is driven by `storyCount = issueGroups.filter(g => g.totalSeconds > 0)`. A created-only issue counts in `issueGroups.length` (shown in the section header badge) but not in `storyCount` (shown in the stat line text), creating a numeric mismatch between the two counts visible on screen.

**Fix (two options):**
- Partition `issueGroups` into `workedOnGroups` (has any subItem that is not `issue-created`) and `createdOnlyGroups`, then render each under its own section header ("Worked On" / "Created").
- Or rename the section header to "Activity" to be inclusive of both kinds.

---

### WR-04: `fetchYesterdayCreatedIssues` — `jiraUsername` is inserted into JQL without escaping

**File:** `taskflow/src/services/jira.ts:835`

**Issue:** The JQL string is:
```
reporter = "${jiraUsername}" AND created >= ...
```
`jiraUsername` comes from the Jira `/myself` response (`data.name ?? data.emailAddress`) and is stored verbatim in the auth store without sanitisation. A username that contains a double-quote character (legal in email addresses per RFC 5321, and possible in Jira display configurations) would produce malformed JQL:

```
reporter = "foo"bar" AND created >= ...
```

The same pattern exists in `fetchYesterdayJiraActivity` (line 704, `status CHANGED BY "${jiraUsername}"`), which is pre-existing, but the new function introduces an additional instance.

**Fix:** Escape internal double-quotes in the username before JQL interpolation:
```ts
const safeUsername = jiraUsername.replace(/"/g, '\\"');
const jql = encodeURIComponent(
  `project = ${projectKey} AND reporter = "${safeUsername}" AND created >= "${date}" AND created < "${nextDay}" ORDER BY created ASC`,
);
```
Apply the same fix to `fetchYesterdayJiraActivity` line 704.

---

## Info

### IN-01: `maxResults=50` cap in `fetchYesterdayCreatedIssues` with no pagination

**File:** `taskflow/src/services/jira.ts:837`

**Issue:** The query fetches at most 50 issues created in a single day by the reporter. For a project manager or lead who creates many tickets during sprint planning, this cap could silently truncate results without any indication to the user. The total result count from the Jira response (`data.total`) is never checked against `data.issues.length`. The same cap exists in `fetchYesterdayJiraActivity` (line 706); the pattern is consistent but worth noting for the new function.

**Fix:** Either check `data.total > data.issues.length` and surface a warning, or increase the cap to a safer value (e.g. 100). Full pagination is likely overkill for a standup use-case but silent truncation is worse than a documented limit.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
