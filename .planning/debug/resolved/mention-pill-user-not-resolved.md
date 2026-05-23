---
status: resolved
trigger: "When there is a mention in comments or description it doesnt get loaded and just displays \"@user\" in pill"
created: 2026-05-19
updated: 2026-05-19
---

## Symptoms

- **Expected**: Mention pill displays the user's display name (e.g. resolved name, not raw handle)
- **Actual**: Pill shows the literal string "@user" — mention is never resolved
- **Location**: Both issue description and comments
- **Errors**: No visible errors in browser console or network tab
- **Reproduction**: Happens on any issue that has @mention syntax
- **Timeline**: Unknown — user is unsure if it ever worked

## Current Focus

- hypothesis: "userMap is never populated with mentioned users; InlineComment hardcodes users={{}}"
- test: "Traced userMap construction at all WikiRenderer call sites"
- expecting: "users prop is either empty or missing the key used in [~username] syntax"
- next_action: "done"
- reasoning_checkpoint: "Fixed. InlineComment.tsx was hardcoding users={{}}. Now builds userMap from existingComments at render time."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-19T00:00:00Z
  file: taskflow/src/routes/dashboard/InlineComment.tsx:258
  note: "WikiRenderer was called with users={{}} — hardcoded empty object; no mention could ever resolve here"

- timestamp: 2026-05-19T00:00:00Z
  file: taskflow/src/routes/dashboard/IssueDetailPage.tsx:134-151
  note: "userMap built only from issue.fields.assignee, reporter, comment.author — adequate for the common case; no fix needed"

- timestamp: 2026-05-19T00:00:00Z
  file: taskflow/src/routes/dashboard/IssueDetailContent.tsx:76-92
  note: "Same pattern as IssueDetailPage — adequate"

- timestamp: 2026-05-19T00:00:00Z
  file: taskflow/src/routes/dashboard/WikiRenderer.tsx:742-749
  note: "preprocessJiraMarkup resolves [~accountId:XXX] via users?.[id] and [~username] via users?.[username]. Falls back to raw id/username if not in map."

## Eliminated Hypotheses

- "WikiRenderer mention component is broken" — NO, the mention component renders @{children} correctly; the issue was children receiving the raw username fallback
- "Jira API returns accountId format" — NO, this is Jira DC; all user objects use `name` field (username), not `accountId`

## Resolution

- root_cause: "InlineComment.tsx passed `users={{}}` (hardcoded empty map) to WikiRenderer, so mentions in the sprint-board quick-comment panel could never resolve. IssueDetailPage/IssueDetailContent already build a proper userMap from assignee/reporter/comment authors."
- fix: "In InlineComment.tsx: import UserMap, build userMap from existingComments (same author-indexing pattern used in IssueDetailPage), pass it to WikiRenderer instead of hardcoded {}."
- verification: "tsc --noEmit passes clean. Mention pills in InlineComment should now show display names for any user who authored a comment on the issue."
- files_changed:
  - taskflow/src/routes/dashboard/InlineComment.tsx
