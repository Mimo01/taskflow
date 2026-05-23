# Phase 62: Tempo Worklog Viewer UI - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Tempo worklog viewer UI: a day-column table accessible from the sidebar when `tempoEnabled` is true. The table shows hours logged per person per day, with a people filter (single-person autocomplete) and a date preset bar (This Week default through custom date range). Totals column (sum per person) and totals row (sum per day) are always visible.

Phase 62 covers TEMPO-01, TEMPO-02, TEMPO-03, TEMPO-07 only. Saved filter persistence (TEMPO-04, TEMPO-05) is Phase 63.

</domain>

<decisions>
## Implementation Decisions

### People Filter
- **D-01:** Single-person filter — only one person can be selected at a time (not multi-select, despite TEMPO-03 originally saying multi-select; user decision). Empty selection = all people shown.
- **D-02:** People list is populated from `author.displayName` values extracted from the initial worklog fetch (the default "This Week" load). No separate Jira API call for team members.
- **D-03:** UI: text input with autocomplete dropdown, similar to the `MultiFilterCombobox` pattern in `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` but single-select. Selecting a name replaces the previous selection and triggers a re-fetch.

### Sidebar
- **D-04:** Add a "Worklogs" link to the existing `tracking` section (alongside Sprint Progress and Releases). Do NOT create a new section.
- **D-05:** Sidebar item definition: `{ id: 'worklogs', label: 'Worklogs', path: '/worklogs', iconName: 'Clock', section: 'tracking' }`.
- **D-06:** Gating: the link is hidden when `tempoEnabled` is false. Implement the same gating pattern used for the AIO `testing` section in `Sidebar.tsx` (line 289: `!(nav.section === 'testing' && (!aioEnabled || !selectedAioProjectKey))`). For Tempo: hide if `nav.id === 'worklogs' && !tempoEnabled`.

### Cell Format
- **D-07:** Hours displayed as `Xh Ym` format — e.g. "7h 30m", "1h", "30m". Use the same format for totals row and totals column.
- **D-08:** Zero-hour cells are blank (empty string, no text). This makes non-zero cells stand out and keeps the table visually quiet.

### Custom Date Range
- **Claude's Discretion:** When the user selects "Custom" preset in the date bar, show two inline `<input type="date">` fields in the filter bar. Simple, no extra components. Selecting both dates triggers the worklog fetch.

### Data Fetching
- **D-09:** Use `fetchWorklogs` from `taskflow/src/services/tempo/worklogs.ts` directly. No pagination loop needed — v3 API returns a plain array for the full date range (Phase 61 probe confirmed, no pagination wrapper).
- **D-10:** Default date range on mount: "This Week" (Monday–Sunday of the current week, ISO Monday per locale — use `date-fns` or manual Sunday/Monday calculation consistent with the codebase).
- **D-11:** The `username` query param accepted by the Tempo API is `author.name` (Jira username, not displayName). The people filter stores and sends `author.name` to `fetchWorklogs`; displayName is used only for display in the dropdown and table rows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Tempo Worklog Viewer" — TEMPO-01, TEMPO-02, TEMPO-03, TEMPO-07 (the 4 requirements this phase covers)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 62: Tempo Worklog Viewer UI" — goal, 5 success criteria, dependencies

### Prior Phase Context
- `.planning/phases/61-tempo-probe-service-layer/61-CONTEXT.md` — service module structure, probe decisions locked in Phase 61
- `.planning/phases/61-tempo-probe-service-layer/61-PROBE-RESULT.md` — confirmed API shape (`author.name`, `dateStarted`, plain array response, no pagination)

### Tempo Service (built in Phase 61)
- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs(baseUrl, token, usernames, from, to)` implementation
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` type (fields: `author.name`, `author.displayName`, `dateStarted` as YYYY-MM-DD, `timeSpentSeconds`)
- `taskflow/src/services/tempo/index.ts` — barrel exports

### Sidebar Patterns
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_NAV_ITEMS`, `SIDEBAR_SECTIONS`, `getDefaultSidebarItems` — add 'worklogs' item to tracking section
- `taskflow/src/components/app/Sidebar.tsx` — AIO gating pattern at line 289; apply same pattern for tempoEnabled
- `taskflow/src/components/app/Sidebar.test.tsx` — extend with tempoEnabled gating tests

### UI Patterns to Mirror
- `taskflow/src/routes/dashboard/BacklogFilterBar.tsx` — `MultiFilterCombobox` component (text-input-with-dropdown pattern; adapt to single-select for people filter)
- `taskflow/src/routes/settings/IntegrationsSection.tsx` — tempoEnabled/setTempoEnabled import pattern from useSettingsStore

### Settings Store
- `taskflow/src/stores/settings.store.ts` — v20 store; `tempoEnabled` at line 106, `setTempoEnabled` at line 225

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchWorklogs` in `taskflow/src/services/tempo/worklogs.ts` — ready to use; accepts `usernames: string[]`, `from`/`to` as YYYY-MM-DD strings; returns `TempoWorklog[]` with normalized `dateStarted`
- `MultiFilterCombobox` (local to `BacklogFilterBar.tsx`) — text-input-with-autocomplete-dropdown; adapt to single-select for the people filter
- `useSettingsStore` — `tempoEnabled` field ready; import `jiraBaseUrl` from `useAuthStore` (same pattern as AIO pages)
- `readSecret('jira-pat')` — same Jira PAT token pattern used everywhere

### Established Patterns
- **TanStack Query**: use `useQuery` with a key like `['tempo', 'worklogs', jiraBaseUrl, from, to, username]`; `enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled`
- **Auth guard**: read `jiraToken` via `readSecret('jira-pat')` in a `useEffect` + `useState`, same as AIO pages
- **Route**: register at `/worklogs` in `taskflow/src/routes/routes.tsx` using `withLazy()` wrapper
- **Date math**: prefer explicit Monday/Sunday calculation over `date-fns` unless already imported; check if `date-fns` is in package.json first
- **Timezone bucketing**: already done in the service layer (`dateStarted.slice(0, 10)`) — UI just reads `worklog.dateStarted` as a string date key

### Integration Points
- `taskflow/src/components/app/sidebar-items.ts` — add 'worklogs' item
- `taskflow/src/components/app/Sidebar.tsx` — add tempoEnabled gate (line ~289)
- `taskflow/src/routes/routes.tsx` — register `/worklogs` route with lazy import
- New file: `taskflow/src/routes/worklogs/index.tsx` (or `WorklogsPage.tsx`) — the worklog viewer page

</code_context>

<specifics>
## Specific Ideas

- Cell display: convert `timeSpentSeconds` to hours and minutes — `Math.floor(s / 3600)h ${Math.floor((s % 3600) / 60)}m`, strip leading "0h" or trailing "0m" for cleanliness (e.g., "1h" not "1h 0m", "30m" not "0h 30m")
- People filter shows `author.displayName` in the dropdown but sends `author.name` (Jira username) to `fetchWorklogs`
- Totals column header: "Total"; totals row label: "Total" in the name column
- Date preset bar: pill/tab style buttons ("This Week" | "Last Week" | "This Month" | "Last Month" | "Last Working Day" | "Custom") — when Custom is active, show two `<input type="date">` fields inline
- "Last Working Day" = most recent Mon–Fri before today (skip Sat/Sun)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 62-Tempo Worklog Viewer UI*
*Context gathered: 2026-05-21*
