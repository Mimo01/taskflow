# Quick Task 261112-dai: Condense desktop notification content so it is clear what each notification is about - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

In-app notifications (popover, banners) are fine — variable heights — and are OUT of scope.
Desktop (OS) notifications are too messy: condense their content and make it obvious what each one is about.

Current state: `formatOsNotification` in `taskflow/src/lib/notification-dispatch-log.ts` builds
- title: `Jira — PROJ-123: <full summary>` (source prefix eats the space, summary gets truncated)
- body: `<author>: <bodyPreview>` — issue updates dump every change line joined with `\n`; comments are the first 80 chars of raw Jira wiki / GitLab Markdown.
Dispatched one-per-new-item from `taskflow/src/hooks/useNotificationPolling.ts` (~line 240) via `tryDispatchOsNotification(title, body)` in `src/services/notifications.ts`. The Developer Tools Notifications tab (261112-cmy) logs the same `formatOsNotification` output and previews it as a macOS banner — it must keep reflecting what is actually sent.

</domain>

<decisions>
## Implementation Decisions

### Layout — Item-led
- Title = the item: `PROJ-123 · <summary>` (Jira) / `!<iid> · <MR title>` (GitLab). No "Jira —"/"GitLab —" source prefix.
- Body = one condensed line: `<author>: <what happened>`.
- Examples:
  - `PROJ-123 · Fix login redirect loop on SSO` / `Alex: Status → In Review (+2 more)`
  - `PROJ-123 · Fix login redirect loop on SSO` / `Maria: Can you check the staging logs first? I think the…`
  - `!482 · Add SSO retry` / `Pipeline failed on feature/sso-retry`

### Multi-change issue updates — Headline + count
- Body shows the single most important change (priority: status > assignee > other fields) as `Field → new value` (status may show just `Status → In Review`), followed by `(+N more)` when there are other changes.

### Bursts — Group above a threshold
- One poll with up to ~3 genuinely new items: one banner per item (as now).
- Above the threshold: a single summary banner, e.g. `7 new notifications` / `4 Jira · 3 GitLab`.
- The Developer Tools dispatch log must still record what was actually sent (summary banner included) — exact shape of the log entry for the grouped case is Claude's discretion.

### Comment / mention text — Cleaned plain text
- Strip Jira wiki markup and GitLab Markdown, turn `[~user]` mentions into names, collapse whitespace/newlines to single spaces; let the OS truncate (may also hard-cap with an ellipsis).

### Claude's Discretion
- Exact threshold value (~3), wording of non-comment event types (approval, due date, assignment, pipeline, MR system notes), separator glyph, whether the cleanup reuses existing wiki/markdown helpers, how the grouped summary is represented in the dev-tools log.

</decisions>

<specifics>
## Specific Ideas

- Keep `formatOsNotification` (or its successor) as the single source of truth shared by the poller and Developer Tools tab.
- Body must be a single line (no `\n`).

</specifics>

<canonical_refs>
## Canonical References

- Quick task 261112-cmy (Developer Tools notification dispatch log + banner preview)
- Memory: notification design (in-app Ledger/stacks) — in-app unaffected

</canonical_refs>
