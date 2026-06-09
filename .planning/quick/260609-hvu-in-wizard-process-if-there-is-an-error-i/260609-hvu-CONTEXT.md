# Quick Task 260609-hvu: Wizard Advanced Error Log - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Task Boundary

In wizard process, if there is an error it prints error message. But I want to be able to see advanced error with full log of what has happened

</domain>

<decisions>
## Implementation Decisions

### Error Display Format
- Expandable inline section: a toggle below the error message expands a scrollable log panel — no modal, stays in context

### Log Content Scope
- Claude's Discretion: include all wizard step results/progress, validation output, and the full error with stack trace — comprehensive but not raw API dumps unless they caused the failure

### Trigger Mechanism
- "Show details" button (or similar secondary CTA) rendered below the error message, always visible when an error occurs

### Claude's Discretion
- Log content scope (see above)
- Exact styling of the expanded log panel (monospace text, scrollable, subtle background)
- Whether to include a "Copy to clipboard" affordance for the log content

</decisions>

<specifics>
## Specific Ideas

- The expandable section should feel like a "dev details" area — monospace font, muted colors, clearly secondary to the main error message
- Log should capture what happened step by step through the wizard, not just the final exception

</specifics>
