---
status: resolved
trigger: "I think there is a bug in our notifications: The groupping of multiple changes on one card. I see sprint change twice but when i look at real changes only one change is there and some other change is there (adding a flag)"
created: 2026-11-12
updated: 2026-11-12
---

## Symptoms
- Expected: merged notification card lists each real change once (Sprint carry-over + flag).
- Actual: card shows the same Sprint change twice; the flag (untracked field) is absent.

## Evidence
- Persisted store (`~/Library/Application Support/com.taskflow.app/notifications.json`): ESHOP-22595 has 3 issue-update items
  (ids `…21:34:45`, `…21:35:30`, `…08:48:02`), all with body `Sprint: Eshop 194 … → Eshop 194 …, Eshop 195 …`.
- `mergeChanges` only chains `prev.to === c.from`; an identical A→B diff opens a second line → duplicate rows.
- Item id = `jira-issue-{key}-{fields.updated}`; any later edit (flag, untracked) bumps `updated` → new id, and the item
  re-collects every changelog history with `created > cursor`.
- Cursor = item createdAt = `fields.updated` (Jira Server: second precision, `.000`), while history `created` has ms →
  `…:30.250 > …:30.000`, so the entry it came from is re-read on the next poll that sees the issue.
- Secondary: `advanceCursors` set cursor to the batch max without comparing to the prior cursor; edited comments
  (selected by `updated`, createdAt = older `created`) could regress it.

## Resolution
- root_cause: issue-update createdAt (cursor source) taken from second-precision `fields.updated`, below the ms
  changelog time, so the same Sprint history was re-emitted into each later item; merge didn't dedupe identical diffs.
- fix:
  - services/notifications.ts: createdAt = max(updated, newest changelog entry read this poll).
  - hooks/useNotificationPolling.ts: per-source cursors are monotonic (never move backwards).
  - routes/notifications/notification-view.ts: mergeChanges drops an exact repeat (same field/from/to) of an open diff
    (also cleans up already-persisted duplicates).
- verification: 3 new regression tests fail on HEAD, pass with fix; full suite 4876 passed; biome + tsc clean.
- files_changed: the three above + their tests.

## Follow-ups (same session, UAT approved)
- Flag changes: `Flagged` added to TRACKED_FIELDS; parsed to phrase lines `flagged` / `removed flag`
  (action `flag`, amber Flag icon); mergeChanges nets flag/unflag within a card.
- Assignment duplicate: an assignee change to the current user emitted both the `jira-assign-*` card and an
  `Assignee: X → me` line on the `jira-issue-*` update; the line is now omitted when the assign card is emitted.
