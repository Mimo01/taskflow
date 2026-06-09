---
# Quick Task 260609-g7c: wiki renderer should render {{{TEST}}} in tt tags - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Task Boundary

{{{TEXT}}} in Jira wiki markup should render as `<tt>TEXT</tt>` (monospace/teletype). Currently the renderer outputs the text as-is, stripping the triple-brace markers without applying any formatting.

</domain>

<decisions>
## Implementation Decisions

### Which Renderer Layer
- Claude's discretion — cover whichever layer(s) are actually broken. At minimum fix the display/preview renderer where the visual regression is observed. If the parse/serialize path is also broken, fix the full round-trip.

### HTML Element Choice
- Use `<tt>` literally — match Jira's own spec so display output mirrors Jira's renderer exactly.

### Nesting & Escaping
- Claude's discretion — apply whatever is consistent with how other inline marks in the same renderer handle nesting. Literal-only is acceptable and simplest.

### Claude's Discretion
- Which specific files to edit (jiraToTiptap, jiraWikiSerializer, display renderer — whichever are broken)
- Whether nesting inside {{{...}}} is supported (match existing inline mark behaviour)

</decisions>

<specifics>
## Specific Ideas

No specific references — fix the renderer so `{{{TEXT}}}` produces `<tt>TEXT</tt>` in output.

</specifics>
