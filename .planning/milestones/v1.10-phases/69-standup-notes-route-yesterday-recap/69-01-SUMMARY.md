---
phase: 69-standup-notes-route-yesterday-recap
plan: "01"
subsystem: services/lib
tags: [standup, jira, date-utils, tdd]
dependency_graph:
  requires: []
  provides:
    - taskflow/src/lib/standup-date.ts (resolveYesterdayDate, getScheduleLookbackRange, extractJiraKeyFromMessage, extractJiraKeyFromBranch)
    - taskflow/src/services/jira.ts (fetchYesterdayJiraActivity, JiraActivityItem)
  affects:
    - taskflow/src/lib/standup-date.test.ts
    - taskflow/src/services/jira-standup.test.ts
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN with Vitest
    - Non-global regex for lastIndex-safe Jira key extraction
    - Per-issue try/catch for graceful comment-fetch degradation
    - .slice(0,10) ISO date comparison (Phase 62 rule, never toLocaleDateString)
key_files:
  created:
    - taskflow/src/lib/standup-date.ts
    - taskflow/src/lib/standup-date.test.ts
    - taskflow/src/services/jira-standup.test.ts
  modified:
    - taskflow/src/services/jira.ts
decisions:
  - "Non-global JIRA_KEY_REGEX avoids lastIndex state across repeated calls — .match() on a non-global regex always starts at position 0"
  - "Per-issue comment fetch wrapped in try/catch so a single slow/failing issue cannot abort the full standup load (D-03 requirement)"
  - "JQL date filter is a pre-filter only; actual author+date filtering is client-side via .slice(0,10) === date (avoids relying on JQL timezone semantics)"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 69 Plan 01: Standup Data Foundations Summary

Pure-data foundations for the Yesterday recap: `standup-date.ts` utility (weekend + Tempo holiday date resolution, Jira key extraction) and `fetchYesterdayJiraActivity()` service function (JQL search + per-issue changelog/comment filtering by author and date).

## Tasks Completed

| # | Task | Commit (RED) | Commit (GREEN) | Tests |
|---|------|-------------|----------------|-------|
| 1 | standup-date.ts utility | c699fd41 | 6d5fe48f | 24 passing |
| 2 | fetchYesterdayJiraActivity() in jira.ts | 7e934bab | 1ab6b66b | 10 passing |

## What Was Built

### `taskflow/src/lib/standup-date.ts`

Exports four functions:

- **`resolveYesterdayDate(tempoSchedule?)`** — starts at today-1, skips Saturday/Sunday (dow 0 or 6), then skips days where `tempoSchedule.get(dateStr) === 'HOLIDAY'`. 14-iteration safety cap. Returns `YYYY-MM-DD` string always using `.toISOString().slice(0, 10)`.
- **`getScheduleLookbackRange()`** — returns `{ from, to }` covering 14 days before today to today, for fetching the Tempo schedule wide enough to cover long holiday stretches.
- **`extractJiraKeyFromMessage(message)`** — uses non-global `/[A-Z][A-Z0-9]+-\d+/` regex via `.match()`. Returns first match or null. No lastIndex drift.
- **`extractJiraKeyFromBranch(branchName)`** — same regex applied to branch name strings.

### `taskflow/src/services/jira.ts` additions

- **`JiraActivityItem` interface** — `{ issueKey, summary, transitions: [{fromStatus, toStatus, at}], comments: [{body, at}] }`.
- **`fetchYesterdayJiraActivity(baseUrl, token, projectKey, date, jiraUsername)`** — JQL `project = X AND updated >= "date"` with `expand=changelog&maxResults=50&fields=summary,status,issuetype`. Client-side filters changelog histories to `author.name === jiraUsername && created.slice(0,10) === date && items.some(i => i.field === 'status')`. Per-issue comment fetch in `try/catch` (graceful degradation). Throws `ApiError(source='jira')` on 401/403.

## Verification

- `npm run test -- standup-date`: 24 passing (STAND-02 weekend+holiday skip, STAND-05 key extraction, no-lastIndex-drift)
- `npm run test -- jira-standup`: 10 passing (STAND-04 author+date filtering, graceful degradation, ApiError on 401/403)
- `npx tsc --noEmit`: exits 0, no type regressions

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED | c699fd41 | PASS — tests failed before implementation |
| Task 1 GREEN | 6d5fe48f | PASS — 24 tests pass |
| Task 2 RED | 7e934bab | PASS — tests failed before implementation |
| Task 2 GREEN | 1ab6b66b | PASS — 10 tests pass |

## Known Stubs

None — both files are pure data functions with no UI rendering, no hardcoded empty values that flow to the UI, and no placeholder text.

## Threat Flags

No new threat surface beyond what was documented in the plan's `<threat_model>`:
- `date` param in `fetchYesterdayJiraActivity` is always internally computed via `resolveYesterdayDate()` (never user-typed); the JQL value is quoted and `encodeURIComponent`-encoded (T-69-01 mitigated).
- Token never appears in any returned object or logged (T-69-02 mitigated).

## Self-Check: PASSED

All created files confirmed on disk. All task commits confirmed in git log.

| Item | Status |
|------|--------|
| taskflow/src/lib/standup-date.ts | FOUND |
| taskflow/src/lib/standup-date.test.ts | FOUND |
| taskflow/src/services/jira-standup.test.ts | FOUND |
| .planning/phases/69-standup-notes-route-yesterday-recap/69-01-SUMMARY.md | FOUND |
| Commit c699fd41 (test RED standup-date) | FOUND |
| Commit 6d5fe48f (feat GREEN standup-date) | FOUND |
| Commit 7e934bab (test RED jira-standup) | FOUND |
| Commit 1ab6b66b (feat GREEN jira.ts) | FOUND |
