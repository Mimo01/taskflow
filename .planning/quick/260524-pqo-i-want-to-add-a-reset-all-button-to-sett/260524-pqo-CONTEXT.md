# Quick Task 260524-pqo: I want to add a 'reset all' button to settings - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Task Boundary

Add a reset capability to the Settings page in the Taskflow Tauri app. Settings are persisted via Zustand + Tauri LazyStore (`settings.json`). The current store has ~60 settings across 8 sections with no user-initiated reset mechanism.

</domain>

<decisions>
## Implementation Decisions

### Scope of reset
Three distinct reset options (not one monolithic button):
1. **Reset onboarding wizard** — resets only `onboardingComplete` so the wizard re-runs
2. **Reset preferences** — resets appearance, notifications, workflow, sidebar, integrations, updates settings; keeps Jira/GitLab credentials (URLs, tokens, custom field keys) intact
3. **Reset all** — full wipe including credentials and all preferences

### Button placement
Inside the **Advanced / Debug section** (`DebugModeSection.tsx`) — grouped with existing advanced actions like "Clear notification cache". The three options appear as separate action rows in that section.

### Confirmation UX
A confirm **dialog** that lists the affected categories before the action fires. Each of the three reset options opens its own dialog scoped to what it will change (e.g., "Reset preferences" dialog lists: Appearance, Sidebar, Notifications, Workflow, Integrations, Updates). Cancel / Reset buttons.

### Claude's Discretion
- Exact wording of dialog content and button labels
- Whether to show success toast after reset completes
- Which Zustand state fields map to each of the three reset scopes
- Whether to use existing dialog component patterns already in the codebase

</decisions>

<specifics>
## Specific Ideas

- Three separate action rows inside `DebugModeSection.tsx`, each with its own confirm dialog
- "Reset preferences" excludes: `jiraBaseUrl`, `jiraToken`, `gitlabBaseUrl`, `gitlabToken`, custom field keys (`storyPointsFieldKey`, `epicLinkFieldKey`, `epicNameFieldKey`, `sprintFieldKey`, `epicColorFieldKey`, `flaggedFieldKey`, `accountFieldKey`)
- "Reset onboarding wizard" only touches `onboardingComplete` (sets to `false`)
- "Reset all" resets the entire Zustand store to its initial state

</specifics>

<canonical_refs>
## Canonical References

- Settings store: `taskflow/src/stores/settings.store.ts` (version 22, Zustand + Tauri LazyStore)
- Debug/Advanced section: `taskflow/src/routes/settings/DebugModeSection.tsx`
- Existing confirm dialog pattern: reference the "Clear notification cache" dialog already in `DebugModeSection.tsx` (lines 182–229) for consistent UX

</canonical_refs>
