# Quick Task 260316-q9b: Better rich text rendering in issue detail - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Better rich text rendering in issue detail pages (epic/story/subtask). Images should render inline. User mentions should render as styled badges. Comments should render consistently with description. Fix all rendering gaps (raw markup, missing elements, inconsistent styling).

</domain>

<decisions>
## Implementation Decisions

### Image Rendering
- Display images inline, constrained to container width (max-width)
- Click to open full-size in a lightbox/modal
- Handle both Jira attachment images and external URLs

### User Mentions
- Render `[~username]` as styled pill/badge with @ prefix
- Visually distinct (like Slack/GitHub mention badges)
- No click-to-profile needed for now

### Rendering Gaps
- Fix raw wiki markup showing as plain text (bold, italic, code, etc.)
- Add support for missing Jira-specific elements: tables, panels, colored text, info/warning/note panels
- Ensure description and comments use identical rendering pipeline with consistent styling

### Claude's Discretion
- Choice of lightbox library or implementation approach
- Specific color/styling for mention badges (should fit dark theme)
- How to handle edge cases like broken image URLs

</decisions>

<specifics>
## Specific Ideas

- Current pipeline: Jira wiki markup -> jira2md -> react-markdown -> HTML
- WikiRenderer already exists at `taskflow/src/routes/dashboard/WikiRenderer.tsx`
- Both description and comments use WikiRenderer, but there may be gaps in jira2md conversion
- Jira wiki mention syntax: `[~username]` or `[~accountId:xxx]`
- Jira panels: `{panel:title=My Title}content{panel}`, `{info}`, `{warning}`, `{note}`
- Jira images: `!filename.png!` or `!http://url/image.png!`

</specifics>
