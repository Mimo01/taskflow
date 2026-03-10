# Phase 1: Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A working Tauri 2 desktop app where users can securely store Jira and GitLab credentials (PATs) in the OS keychain, connect to both services, select their active project and group, choose a role (Developer or PM), and toggle dark/light mode. No feature dashboards — this is the launchpad every other phase builds on.

</domain>

<decisions>
## Implementation Decisions

### Onboarding structure
- Step-by-step wizard (not single page, not tabbed)
- Sequence: Welcome → Jira → GitLab → Role → Done (5 steps)
- Project/group selection happens inline within each credential step — after token validates on the Jira step, the project dropdown appears on the same screen; same for GitLab group on the GitLab step
- Back navigation is allowed and all entered data is preserved (URL, token, project selection) — no clearing on back

### Token validation UX
- Validation fires on explicit 'Test & Continue' button click — not on blur, not as-you-type
- Button shows spinner + 'Connecting...' label during validation; button is disabled while in progress
- Error messages are specific per error type:
  - 401 → "Invalid token or token has expired"
  - Network/DNS error → "Cannot reach [URL] — check the base URL"
  - 403 → "Token valid but lacks required permissions"
- Success state: green checkmark badge on the step in the wizard progress indicator; project dropdown appears inline after success (no separate success banner)

### Launch state (return visits)
- On launch when onboarding is complete: route directly to the user's dashboard (no splash, no status screen) — fetch data in the background with loading skeletons
- If one token has expired at launch: show dashboard with a sticky (non-dismissible) re-auth banner — "Jira token expired — update it in Settings" — app remains usable for the working service
- If network is unavailable at launch: show dashboard with offline indicator + cached data if available + retry button — app remains navigable

### Settings structure
- Settings accessible via gear icon in sidebar or top bar — persistent, always one click away
- All config is editable from settings without re-running onboarding: tokens, base URLs, active project/group, role, and theme
- Onboarding is first-run only; settings covers all subsequent changes
- Tokens displayed as masked (***...***) with eye icon reveal toggle + 'Update token' button — tokens are never shown in plaintext by default
- Switching active Jira project clears all cached data and triggers a fresh reload

### Claude's Discretion
- Exact visual design of the wizard progress indicator (step dots, numbered steps, etc.)
- Loading skeleton design for the dashboard on first data fetch
- Exact offline indicator visual treatment
- Animation/transition between wizard steps

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. Tech stack locked in roadmap: Tauri 2, React 18 + TypeScript, shadcn/ui, Tailwind v3, Zustand, TanStack Query.

### Established Patterns
- No prior patterns — this phase establishes them. Plan 01-01 scaffolds the base architecture including a dev/Tauri abstraction layer.

### Integration Points
- Tauri Stronghold plugin: PAT storage — must be initialized before the onboarding form is usable
- Tauri Store plugin: dark/light mode preference persistence
- Jira REST v2 API: validation call on onboarding (GET /rest/api/2/myself)
- GitLab REST API: validation call on onboarding (GET /api/v4/user)

</code_context>

<specifics>
## Specific Ideas

- Wizard mockup: `[ Welcome ] → [ Jira ] → [ GitLab ] → [ Role ] → [ Done ]` with a step progress indicator at the top
- Jira step: URL field + token field + 'Test & Continue' button → on success, project dropdown appears on the same step → user selects project → step completes
- Re-auth banner on expired token: persistent, non-dismissible, links directly to the relevant settings section

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-10*
