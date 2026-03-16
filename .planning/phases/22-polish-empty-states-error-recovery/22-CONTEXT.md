# Phase 22: Polish — Empty States + Error Recovery - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Every data view communicates clearly when it has no content or has failed to load, and gives users a direct path to recover. Covers all list/data views: My Tasks, Sprint Board, Sprint Progress, Backlog, MR Attention, Workload, Releases, Epics, Notifications, and Search results. No new features — this is a polish pass over existing views.

</domain>

<decisions>
## Implementation Decisions

### Empty state visuals
- Large muted Lucide icon (48-64px) above headline text — no custom SVG illustrations
- Each view gets a unique contextual icon:
  - My Tasks: ClipboardList
  - Sprint Board: Columns3
  - Backlog: Inbox
  - MR Attention: GitMerge
  - Notifications: Bell
  - Releases: Package
  - Epics: Layers
  - Search: SearchX
  - Workload: Users
  - Sprint Progress: BarChart3
- Friendly casual tone for headlines ("You're all caught up!", "No notifications yet")
- Contextual subtitle below headline explaining WHY it's empty or what to expect
- Contextual CTA buttons where actionable:
  - Backlog → "Create Issue" button
  - Epics → "Create Epic" button
  - MR Attention with no GitLab token → "Connect GitLab" button
  - Other views → no CTA (nothing actionable)

### Error state design
- Inline alert using shadcn Alert component — icon + plain-language message + Retry button
- Plain language only — never expose raw API errors to users (console for debugging)
- Error messages are view-specific: "Couldn't load tasks", "Couldn't load merge requests", etc.
- When TanStack Query has stale cached data and a refetch fails: show a dismissible warning banner above the stale data ("Refresh failed" + Retry), keep stale content visible
- When no cached data exists and fetch fails: show the full inline alert error state

### Auth error recovery (POLISH-03)
- Auth errors detected via HTTP status code: 401/403 → auth error path
- Auth error state shows: "Session expired — your {Jira/GitLab} token may have been revoked"
- CTA is "Reconnect" button that navigates to /settings with Connections section active
- The failed service (Jira or GitLab) should be highlighted/expanded on arrival
- Non-auth errors (500, network, timeout) → generic "Couldn't load {view}" + Retry button

### Shared components
- Create `<EmptyState icon={...} title={...} subtitle={...} action={...} />` component in src/components/ui/
- Create `<ErrorState error={...} onRetry={...} viewName={...} />` component in src/components/ui/
- ErrorState auto-detects auth errors (401/403) and shows "Reconnect" CTA instead of "Retry"
- All 10+ views use these shared components — no inline empty/error JSX

### Claude's Discretion
- Exact icon sizes, spacing, and color tokens for empty/error states
- Banner component design for stale-data-with-error scenario
- How to pass auth error context (which service failed) through TanStack Query errors
- Whether ErrorState needs a `variant` prop or auto-detects everything from the error object
- Exact Lucide icon choices if the ones listed don't exist or feel wrong at implementation time

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md (POLISH-01, POLISH-02, POLISH-03).

### Requirements
- `.planning/REQUIREMENTS.md` — POLISH-01 (empty states), POLISH-02 (error states), POLISH-03 (auth reconnect CTA)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `taskflow/src/components/ui/alert.tsx` — shadcn Alert component, use for error states
- `taskflow/src/components/ui/button.tsx` — for Retry/Reconnect CTAs
- `taskflow/src/components/ui/skeleton.tsx` — existing loading skeleton pattern
- Lucide icons already imported across the app (lucide-react)

### Established Patterns
- All data views use TanStack Query with `isLoading`, `isError`, `data` triple
- Current empty states: plain `<div className="text-muted-foreground">` with text — no icons, no CTAs
- Current error states: `<div className="border-destructive/30 bg-destructive/10">` with raw error text — no retry button in most views
- Views already have `refetch` from useQuery — ready to wire to Retry buttons
- Theme tokens: `text-muted-foreground`, `text-destructive`, `bg-destructive/10` already in use

### Integration Points
- Each data view (MyTasksTab, SprintBoardTab, BacklogPage, etc.) needs its `isError`/empty blocks replaced
- Settings navigation: `useNavigate()` to `/settings` with Connections section — ConnectionsSection.tsx already exists
- NotificationPopover already has "No notifications yet" text to replace
- Search results in CommandPalette may need empty result state

</code_context>

<specifics>
## Specific Ideas

- Linear-style empty states: clean, icon-centric, no clutter
- Stale data should remain visible when a background refresh fails — users can still work with cached data
- Auth reconnect flow should feel seamless: one click from error to the exact settings section that needs fixing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-polish-empty-states-error-recovery*
*Context gathered: 2026-03-16*
