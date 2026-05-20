# Phase 60: Static Dashboard / Welcome Screen - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the empty `<div />` stub in `taskflow/src/routes/dashboard/index.tsx` with a minimal 3-card static welcome screen: a hero section with personalized greeting, a sprint health card, a "My In Progress" subtasks card, and a next release countdown card. No configuration, no drag handles, no resize grips — pure static layout with visual warmth.

</domain>

<decisions>
## Implementation Decisions

### Layout & Visual Structure
- **D-01:** Hero section at the top spanning full width, containing the greeting prominently centered ("Welcome back, [displayName]") and today's date. The 3 cards sit below in a row (3-column grid on desktop).
- **D-02:** Hero uses a subtle gradient background (soft tinted surface, e.g., from primary/brand color at low opacity) with large greeting text in a warm tone. No illustrations on the hero itself.
- **D-03:** Greeting is always "Welcome back, [displayName]" — no time-of-day variant. `jiraUserDisplayName` from `useAuthStore` is the source.
- **D-04:** Each card has a small colored icon accent in the card header area (distinct color per card: e.g., orange/amber for sprint, green for tasks, blue for release). Card body uses the standard `rounded-lg border border-border bg-card` style.

### Sprint Health Card (DASH-02)
- **D-05:** Write a new `DashboardSprintCard` component — do NOT adapt `SprintHealthPanel` in place (that component has its own tests and may be reused elsewhere). The new card reuses the same query keys so the cache is shared with `SprintBoardTab`/`SprintProgressTab` when those routes have been visited.
- **D-06:** Card shows: sprint name, days remaining, and a % complete progress bar. Claude has discretion on whether to include story point counts (e.g., "18 / 42 pts") alongside the bar if it reads naturally without clutter.
- **D-07:** When there is no active sprint: card stays visible with an empty state message — "No active sprint".

### My In Progress Card (DASH-03)
- **D-08:** "In progress" means `issuetype.subtask === true && fields.assignee.name === jiraUsername && fields.status.statusCategory.key === 'indeterminate'`. Only sprint subtasks (status category `indeterminate`, not `new` or `done`).
- **D-09:** Data source: `fetchSprintIssues` with the existing 4-element sprint-board cache key (`['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`). Filter client-side — zero extra API calls when sprint board cache is warm.
- **D-10:** Clicking a subtask navigates to `/issue/:key` (full-page route). Consistent with the v1.4 decision to use full-page issue detail over slide-over sheets.
- **D-11:** Empty state when no in-progress subtasks: "No subtasks in progress — nice work!"
- **D-12:** Show up to 3 subtasks per DASH-03. If more exist, show the count ("and 2 more") but no navigation — dashboard is a summary, not a list.

### Next Release Countdown Card (DASH-04)
- **D-13:** Jira fix versions only — no GitLab token required. Reuse `fetchFixVersions` from `src/services/jira`. "Soonest unreleased" = first version where `released === false` and `releaseDate` is set, sorted ascending by `releaseDate`.
- **D-14:** Empty state when no unreleased fix version with a `releaseDate` exists: card stays visible with "No upcoming releases".
- **D-15:** When the soonest release is today: show "Today" with a badge. When overdue (releaseDate in the past): show "X days overdue" in amber/red. When future: show "X days away".

### Token Loading Pattern
- **D-16:** Thin `index.tsx` pattern (established in Phase 59 CONTEXT): `index.tsx` loads the Jira PAT via `readSecret('jira-pat')` in a `useEffect`, reads `jiraBaseUrl`, `activeJiraProject`, `jiraUsername`, `jiraUserDisplayName` from stores, then passes all as props to the three card sub-components. No card component reads Stronghold directly.

### Claude's Discretion
- **Illustrations:** Claude picks tasteful, inline SVG decorative elements that fit the existing shadcn/ui + Tailwind v4 style. Can be subtle background illustrations in the hero, or small decorative icons per card. Professional but welcoming.
- **Sprint card extra data:** Claude decides whether to show story point counts alongside the % progress bar (add only if it reads cleanly).
- **Responsive behavior:** Claude decides breakpoints for the 3-card row (collapse to single column on narrow viewports).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Dashboard Redesign — DASH-01, DASH-02, DASH-03, DASH-04, DASH-05 (all 5 requirements this phase covers)

### Phase Details
- `.planning/ROADMAP.md` §"Phase 60: Static Dashboard / Welcome Screen" — goal statement and 5 success criteria

### Existing Components to Understand (not to change)
- `taskflow/src/routes/dashboard/SprintHealthPanel.tsx` — existing sprint query patterns and cache key (`['jira-issues', 'sprint-board', ...]` + `['jira-active-sprint', ...]`); do NOT modify this file
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — `fetchFixVersions` usage and timing logic (`TimingLabel` type, overdue/today/future cases); reference for release countdown logic
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — token loading pattern (`readSecret` in `useEffect`) and `jiraUsername` usage for assignee filtering

### Stores
- `taskflow/src/stores/auth.store.ts` — `jiraUserDisplayName`, `jiraUsername`, `jiraBaseUrl`, `activeJiraProject` (all needed by dashboard index.tsx)
- `taskflow/src/stores/settings.store.ts` — `storyPointsFieldKey` (needed for sprint-board cache key)

### Services
- `taskflow/src/services/jira.ts` — `fetchActiveSprint`, `fetchSprintIssues`, `fetchFixVersions`

### File to Overwrite
- `taskflow/src/routes/dashboard/index.tsx` — current stub `export default function Dashboard() { return <div />; }` — Phase 60 replaces this entirely

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchActiveSprint(jiraBaseUrl, jiraToken, activeJiraProject)` — returns sprint with `.name` and `.endDate`; already used in SprintHealthPanel
- `fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey)` — returns `JiraIssue[]` including subtasks; filter by `issuetype.subtask + assignee.name + statusCategory.key`
- `fetchFixVersions(jiraBaseUrl, jiraToken, activeJiraProject)` — returns `JiraFixVersion[]` with `.released`, `.releaseDate`, `.name` fields
- `useAuthStore` — `jiraUserDisplayName`, `jiraUsername`, `jiraBaseUrl`, `activeJiraProject`
- `useSettingsStore` — `storyPointsFieldKey`
- `useDelayedLoading` hook (200ms threshold) — use on each card to prevent skeleton flash on cache hits

### Established Patterns
- Token loading: `readSecret('jira-pat')` in `useEffect` keyed on `jiraBaseUrl`; token stored in local state; passed as prop to children
- Cache key for sprint board: `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` — MUST match this exactly to share cache with SprintBoardTab
- Cache key for active sprint: `['jira-active-sprint', activeJiraProject]`
- Progress bar: use shadcn/ui `Progress` component (already in codebase)
- `staleTime: 30_000` for sprint issues; `staleTime: 5 * 60_000` for active sprint (matching SprintHealthPanel)
- `enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject` guard on all queries
- `navigate('/issue/${key}')` (react-router-dom `useNavigate`) for the subtask click-through

### Integration Points
- `taskflow/src/routes/dashboard/index.tsx` — the entry point; overwritten by this phase
- `taskflow/src/routes/routes.tsx` — dashboard route already wired; no changes needed
- `taskflow/src/lib/query-constants.ts` — `POLL_INTERVAL_MS`, `STALE_TIME_MS` constants available if needed

</code_context>

<specifics>
## Specific Ideas

- "Welcome back, [name]" — exact greeting string (no "Good morning/afternoon/evening")
- Hero section: gradient background, large name, today's date formatted as e.g. "Wednesday, 20 May 2026"
- Cards: each with a distinct colored icon accent in the header (sprint → orange/amber, subtasks → green, release → blue)
- Release overdue: amber/red warning badge — matches existing badge color conventions in `ReleasesTab`
- "No subtasks in progress — nice work!" — exact empty state copy for My In Progress card

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 60-Static Dashboard / Welcome Screen*
*Context gathered: 2026-05-20*
