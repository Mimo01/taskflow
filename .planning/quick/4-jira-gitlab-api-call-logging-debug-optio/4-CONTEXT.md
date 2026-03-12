# Quick Task 4: Jira & GitLab api call logging, debug option toggle in settings and new UI page for displaying the logs - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Task Boundary

Add API call logging for Jira and GitLab integrations. Provide a debug toggle in the settings UI to enable/disable logging. Add a new UI page to display the captured logs.

</domain>

<decisions>
## Implementation Decisions

### Log Storage & Retention
- Claude's discretion — choose the most appropriate storage strategy for this app's architecture

### Log UI Layout & Density
- Claude's discretion — choose the most appropriate layout and field display

### Debug Toggle Scope
- When debug mode is enabled: capture full request + response (method, URL, headers, request body, response body, HTTP status, duration)
- Logging is controlled by the debug toggle in settings

### Claude's Discretion
- Log storage strategy (in-memory vs persisted)
- Log page layout and density
- Max log retention count/policy

</decisions>

<specifics>
## Specific Ideas

- Debug toggle lives in the existing Settings page/panel
- New dedicated UI page for browsing logs
- Covers both Jira API calls and GitLab API calls

</specifics>
