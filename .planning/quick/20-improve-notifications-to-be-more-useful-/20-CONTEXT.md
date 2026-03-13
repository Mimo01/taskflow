# Quick Task 20: Improve notifications to be more useful and informative - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Task Boundary

Make notifications richer and more actionable. Currently notifications show minimal info (entity title, author, body preview, timestamp) with no links, no type context, and no metadata. The goal is to make each notification immediately useful without having to open a separate app.

</domain>

<decisions>
## Implementation Decisions

### Clickable Links
- Entity titles and/or a dedicated "Open" action should open the Jira issue or GitLab MR in the default browser
- Use Tauri's shell/opener plugin (`open` command) to launch URLs
- URLs already available: Jira issue URL is `{baseUrl}/browse/{issueKey}`, GitLab MR URL available from API

### Metadata Display
- Show both a notification type label AND status/priority info alongside each notification
- Type labels: "Comment mention", "Issue update", "MR note" — quick at-a-glance context
- Status/priority: Jira issue priority + labels; GitLab MR state (open/merged/closed)
- These must be captured at fetch time and stored in NotificationItem

### Body Text Rendering
- Linkify URLs only — plain text but HTTP/HTTPS URLs become clickable anchor tags
- No full markdown render (risk of breaking content)
- Apply to both body preview (row) and full body (detail panel)

### Claude's Discretion
- Exact visual placement of type label and metadata in the row/detail UI
- Whether to add a dedicated "Open" button vs. making the title itself clickable
- Which fields to add to NotificationItem to carry new data
- How many characters of body preview to show (currently ~80)

</decisions>

<specifics>
## Specific Ideas

- The `NotificationItem` interface will need new optional fields: `url?`, `notificationType?`, `priority?`, `labels?`, `entityState?`
- Jira issue updates already fetch status — can extend to also capture priority and labels from the issues API response
- GitLab MR notes have access to MR state (open/merged/closed) via the MRs already fetched
- Linkify function: simple regex replace on `https?://[^\s]+` → `<a href="..." target="_blank">`
- Tauri open: `import { open } from '@tauri-apps/plugin-shell'` (already used elsewhere in codebase likely)

</specifics>
