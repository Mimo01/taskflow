# Phase 70: Standup Notes — Today Section - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `TodayColumnPlaceholder` stub in the right 50% of the existing `/standup-notes` page with a real, data-driven Today column. The page shell, header (date + synced/refresh + Copy markdown), and the entire Yesterday recap already shipped in Phase 69 — this phase only builds the Today column and wires it into `StandupNotesPage.tsx`.

The Today column surfaces what the user needs at standup for *today*: their open sprint work (split In Progress / Up Next), MRs awaiting their review, and their pinned items — with a per-row affordance to log time.

**Requirements covered:** STAND-07, STAND-08, STAND-09

</domain>

<decisions>
## Implementation Decisions

### Today column section makeup & order (STAND-07/08/09 + scope addition)
- **D-01:** Today column renders up to **four sections in fixed order**: (1) **In Progress**, (2) **Up Next**, (3) **MRs Awaiting You**, (4) **Pinned**. No separate "Worklog Targets" section — logging is a per-row affordance (see D-06).
- **D-02:** **"MRs Awaiting You" is a scope addition beyond STAND-07/08/09.** It comes from the user's mockup and the user's explicit "I want most info possible" directive. Planner should treat STAND-07/08/09 as the locked acceptance criteria and "MRs Awaiting You" as an in-scope-by-user-decision extra. If it must be cut for time, cut it before the three locked requirements.
- **D-03:** **Empty/error behavior:** hide a section entirely when it has no items; show an **inline error + retry** for a section whose fetch fails (don't hide errors silently). When *all* sections are empty, render one overall column empty state. Mirror the Yesterday column's per-section degradation style where practical.

### My sprint work — In Progress / Up Next (STAND-07)
- **D-04:** **Issue scope = leaf-level work items assigned to me.** Include subtasks AND standalone tasks/stories/bugs that have no children of their own. **Exclude** parent stories that have subtasks (those are coordinated, not directly worked). Assignee match = the current user (reuse the `DashboardInProgressCard` pattern: `assignee?.displayName === jiraUserDisplayName`, or `assignedToMe=true` JQL variant — planner's choice, must stay consistent with the shared sprint-board cache).
- **D-05:** **Status split by Jira status category:** In Progress = `statusCategory.key === 'indeterminate'`; Up Next = `statusCategory.key === 'new'` (To Do). **Done is excluded** ("open" = not done). **Flat list of issue rows** in each section (no nesting under parent), matching the mockup. Each row shows: issue-type icon, issue key, summary, story points, and logged time where available.

### Worklog targets (STAND-09)
- **D-06:** **No separate section.** Each row in **both In Progress and Up Next** gets a **"Log Work" button/icon** that opens the existing `LogWorkPopover` pre-filled with `initialDate = today` and `issueKey = that issue`. All my open sprint work is loggable. Targets list source = my in-progress + up-next sprint items (same query as STAND-07).
- **D-07:** Row primary click → `onIssueClick(key)` (full-page issue detail via outlet context). The Log Work button is a secondary action on the row — must not trigger navigation (stop propagation).

### Pinned (STAND-08)
- **D-08:** **Read-only — no pin/unpin controls** on this page (no toggle, no remove).
- **D-09:** Show **both Jira issues and AIO cycle pins** from `usePinnedTabsStore`. Distinguish by `pinnedCycleMeta`: keys present in `pinnedCycleMeta` are AIO cycles (render from stored `{ name, projectKey }`, click → AIO cycle detail page — reuse the existing cycle-tab navigation); all other `pinnedKeys` are Jira issues (resolve via `fetchIssueMeta`, click → `onIssueClick`).

### MRs Awaiting You (scope addition)
- **D-10:** Source = `fetchReviewerMRs(gitlabBaseUrl, token, gitlabUserId)` — open MRs where I'm a reviewer. Show MR title/IID and review state (e.g. "awaiting review" / "changes requested") consistent with the app's existing MR review-health logic, matching the mockup. Gated on GitLab connection; hidden when empty, error+retry on failure (per D-03).

### Claude's Discretion
- **Status-split + grouping** (D-05): user said "you decide" — locked to status-category flat list per the mockup; planner may refine row layout (badges, truncation, icon choices) using app conventions.
- Exact `LogWorkPopover` trigger styling/placement per row (icon-only vs labeled button); whether it reuses the popover's built-in trigger or a custom trigger element.
- Whether to query my sprint work via `fetchSprintIssues(..., assignedToMe=true, ...)` or fetch the shared sprint-board set and filter client-side by displayName (D-04) — planner picks based on cache reuse.
- Whether "MRs Awaiting You" review-state badge derives from existing review-health util or a lightweight inline computation.
- Whether the Today column extends the page's "Copy markdown" output (Phase 69 markdown is Yesterday-only today) — **not required** by STAND-07/08/09; planner may include if cheap, otherwise defer.
- Story-points field key resolution (reuse `storyPointsFieldKey` plumbing already used by dashboard sprint cards).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Standup Notes (STAND-07, STAND-08, STAND-09) — exact acceptance criteria for this phase

### Prior phase context (the page this phase completes)
- `.planning/phases/69-standup-notes-route-yesterday-recap/69-CONTEXT.md` — page shell, two-column layout, Yesterday recap decisions, established patterns (tokens-not-in-queryKey, `.slice(0,10)` dates, fine-grained settings selectors)

### Page to modify
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — renders `<TodayColumnPlaceholder />` in the right 50% (line ~323); `onIssueClick` comes from `useOutletContext`. Replace placeholder with the real Today column.
- `taskflow/src/routes/standup-notes/TodayColumnPlaceholder.tsx` — current stub to replace; shows the heading + date + "coming soon" empty state.
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — reference for per-section rendering, empty-state, and markdown patterns to mirror in the Today column.

### STAND-07 (my sprint work)
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — canonical filter pattern: `issuetype.subtask && status.statusCategory.key === 'indeterminate' && assignee.displayName === jiraUserDisplayName`; shared cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`.
- `taskflow/src/services/jira.ts` — `fetchSprintIssues(baseUrl, token, project, assignedToMe, storyPointsFieldKey)` (returns `JiraIssue[]`); `fetchSprintSubtasks` (two-query strategy). `assignedToMe=true` adds `AND assignee = currentUser()`.

### STAND-09 (log work)
- `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` — accepts `issueKey`, `jiraBaseUrl`, `onSuccess?`, `initialDate?` (defaults to today). Uses `createWorklog` (Jira worklog API). Built-in "Log Work" trigger button.

### STAND-08 (pinned)
- `taskflow/src/stores/pinned-tabs.store.ts` — `pinnedKeys: string[]`, `pinnedCycleMeta: Record<key,{name,projectKey}>`, `isPinned`. Jira issues vs AIO cycles distinguished by presence in `pinnedCycleMeta`.
- `taskflow/src/services/jira.ts` — `fetchIssueMeta(baseUrl, token, keys[])` (already imported in `StandupNotesPage.tsx`) — resolves type/summary for pinned Jira keys.

### MRs Awaiting You (scope addition)
- `taskflow/src/services/gitlab.ts` — `fetchReviewerMRs(baseUrl, token, userId)` (line ~362) returns open MRs where user is reviewer (`reviewer_id`, `state=opened`). Reference `MrRow.tsx` for review-health/state rendering.

### Auth & settings
- `taskflow/src/stores/auth.store.ts` — `jiraBaseUrl`, `gitlabBaseUrl`, `activeJiraProject`, `jiraUsername`, `gitlabUserId`, `jiraUserKey` — identity/connection fields.
- `taskflow/src/stores/settings.store.ts` — fine-grained selectors only (`useSettingsStore((s) => s.tempoEnabled)`); no whole-store destructure.

### Design reference
- `/Users/mimo/Downloads/Screenshot 2026-05-24 at 7.47.07 PM.png` — user's mockup. Today column shows IN PROGRESS (issue rows with SP + logged time), MRs AWAITING YOU (with "awaiting review" / "changes requested" states), UP NEXT (SP badges). **Read before implementing the UI.**

### Build verification
- `.planning/STATE.md` — verify with `npm run build`, not just `tsc` (Phase 59 standing rule).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardInProgressCard` filter + grouping logic — lift the leaf-item / status-category filter directly (adapt to include standalone tasks per D-04).
- `fetchSprintIssues(..., assignedToMe, storyPointsFieldKey)` — single call returns my sprint issues; shares warm cache with sprint board / dashboard cards.
- `LogWorkPopover` — already supports `initialDate` + `issueKey`; STAND-09 is wiring, not new UI.
- `usePinnedTabsStore()` — `pinnedKeys` + `pinnedCycleMeta` already persisted via Tauri Store.
- `fetchIssueMeta(baseUrl, token, keys)` — already imported in `StandupNotesPage.tsx` for issue-type resolution; reuse for pinned Jira keys.
- `fetchReviewerMRs(baseUrl, token, userId)` — ready for MRs Awaiting You.
- `IssueTypeIcon`, `EmptyState`, `useDelayedLoading` — shared UI primitives used by the dashboard cards.
- `onIssueClick` from `useOutletContext` in `StandupNotesPage` — full-page issue detail navigation.

### Established Patterns
- **Tokens NEVER in queryKey** (T-62-06) — read via `readSecret()` inside the queryFn closure.
- **Independent `useQuery` per data source** with graceful per-section degradation (Phase 69 pattern) — In Progress/Up Next share one sprint-issues query; MRs and Pinned-issue-meta are separate queries.
- **Date strings via explicit formatting / `.slice(0,10)`**, never `toLocaleDateString()` for comparisons (Phase 62).
- **Fine-grained `useSettingsStore` selectors** per field (Phase 68).
- **`useDelayedLoading`** for skeleton flicker prevention.

### Integration Points
- `StandupNotesPage.tsx` line ~321-324 — swap `<TodayColumnPlaceholder />` for the new `<TodayColumn />`; pass `onIssueClick` and the auth/connection values (or have TodayColumn read the stores directly, consistent with the rest of the page).
- New component(s) under `taskflow/src/routes/standup-notes/` (e.g. `TodayColumn.tsx` + per-section subcomponents), mirroring the Yesterday column's file layout.
- Sprint-issues query must reuse the shared cache key to avoid a duplicate fetch when the dashboard/sprint board is warm.

</code_context>

<specifics>
## Specific Ideas

- **Mockup (canonical):** `/Users/mimo/Downloads/Screenshot 2026-05-24 at 7.47.07 PM.png`. Today column header = "Today" + current date (already in the placeholder). Sub-section headers are small uppercase muted labels ("IN PROGRESS", "MRS AWAITING YOU", "UP NEXT"). In Progress rows show issue-type icon + summary + key + story-points badge + logged-time chip (e.g. "4h"). MRs Awaiting You rows show MR title + a right-aligned state label ("awaiting review" muted, "changes requested" in amber/red). Up Next rows show SP badges.
- **"I want most info possible"** — user's explicit directive driving the decision to keep all mockup sections (incl. the non-required MRs Awaiting You) rather than trimming to the three locked requirements.
- Row interaction: whole row click → issue/cycle detail; per-row Log Work is a secondary control that must not navigate.

</specifics>

<deferred>
## Deferred Ideas

- **Manual curated worklog-targets list** (own persisted store with add/remove UI) — considered for STAND-09 but rejected in favor of auto-deriving targets from in-progress + up-next sprint work. Could revisit if users want to log against issues outside their sprint.
- **Extending the page's "Copy markdown" to include the Today section** — Phase 69's markdown is Yesterday-only. Not required by STAND-07/08/09; planner may include if trivial, otherwise a future enhancement.
- **Grouping sprint subtasks under parent story in the Today column** — considered (matches dashboard/sprint board) but rejected in favor of the mockup's flat list. Revisit only if flat lists get noisy.

</deferred>

---

*Phase: 70-Standup Notes — Today Section*
*Context gathered: 2026-05-25*
