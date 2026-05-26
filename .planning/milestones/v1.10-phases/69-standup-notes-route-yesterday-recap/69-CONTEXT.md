# Phase 69: Standup Notes — Route + Yesterday Recap - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the `/standup-notes` route with the full 2-column page shell (Yesterday left | Today right) plus a fully populated Yesterday recap. The Yesterday column aggregates the last working day's activity from four sources — Tempo worklogs, Jira changelog, Git commits, and GitLab MR activity — grouped by Jira issue. The Today column is built as a placeholder in this phase; its content is filled in by Phase 70.

**Requirements covered:** STAND-01, STAND-02, STAND-03, STAND-04, STAND-05, STAND-06

</domain>

<decisions>
## Implementation Decisions

### Jira activity scope (STAND-04)
- **D-01:** Scan the `activeJiraProject` only. JQL: `project = {activeJiraProject} AND updated >= {yesterdayDate}` (where `yesterdayDate` = last working day per STAND-02 logic).
- **D-02:** Fetch **both** status transitions + comments, each filtered to entries authored by `jiraUsername` on the last working day. Issues fetched with `expand=changelog` for transitions; comments fetched per issue (separate call per issue after the JQL result).
- **D-03:** Cap the JQL result at **50 issues** (maxResults=50). For a daily standup, 50 touched issues in one day is more than sufficient; avoids accidental slow fetches on large projects.

### MR activity fetch strategy (STAND-06)
- **D-04:** Use the **GitLab User Events API** — `/api/v4/users/:gitlabUserId/events` — to cover all projects in minimal API calls. Fetch two event types: `action=commented` (target_type=merge_request) and `action=approved` (target_type=merge_request), each filtered to `after={yesterdayDate}`.
- **D-05:** Merge both event types into a **single combined "MR Activity" list** in the Yesterday column. Each entry is labeled "Commented on !N" or "Approved !N" with the MR title. No sub-sections within the MR activity group.

### Page layout
- **D-06:** **Two-column layout** — Yesterday (left) | Today (right), full-page width, split roughly 50/50. Phase 69 builds the complete shell; the Today column renders as a loading placeholder or "Today section coming soon" stub so the visual structure is in place for Phase 70.
- **D-07:** Yesterday entries are **grouped by Jira issue**. Group header: `[IssueKey] [Summary] [TotalTempoHours right-aligned]`. Sub-items beneath the header show each activity event with a distinct icon per type: git commits (branch icon), status transitions (arrow icon), opened/updated MRs (MR icon), comments (chat icon).
- **D-08:** **Commit grouping fallback chain**: (1) extract Jira key from commit message (standard `[A-Z]+-\d+` pattern), (2) if not found in message, extract Jira key from the commit's source branch name, (3) if neither, put in an **"Other commits"** catch-all group at the bottom of the Yesterday column.
- **D-09:** **MRs not linked to any issue** (neither by title nor branch) appear as standalone groups in the Yesterday column, with the MR IID as the heading (e.g., `!2098 fix(cart): empty state copy + analytics`).
- **D-10:** Yesterday column has a **summary stat line** beneath the column heading: e.g., `7.5h logged across 3 stories · 7 commits · 2 MR events`. Planner derives the exact stat labels from the data returned.
- **D-11:** Page header: `Standup notes` title (large) + current date (muted) + `synced Xm ago · Refresh` status area (top right) + **Copy markdown** button (top right, primary style).
- **D-12:** **Copy markdown is in scope** — overrides the earlier v1.10 rejection. The button copies a formatted standup text to the clipboard. Format is planner's discretion (markdown with issue keys, summary, and activity sub-items).

### Git commits scope (STAND-05)
- **D-13:** Author filter: use `gitlabUsername` from auth store as the `author` param on the GitLab commits API.
- **D-14:** Project scope and branch resolution strategy: **Claude's discretion** — researcher/planner decides whether to fetch from `activeGitlabProject` only or all accessible projects, and how to resolve branch names for Jira key extraction (e.g., `/repository/commits/:sha/refs` per commit vs. branch listing).

### "Yesterday" date resolution (STAND-02)
- **D-15:** "Yesterday" = last working day. Monday → resolves to Friday. Weekends always skipped. When Tempo is enabled, additionally skip public holidays from `fetchUserSchedule()` (tempo-core/2 `/user/schedule/search`). When Tempo is disabled, weekend-skip only.

### Claude's Discretion
- Git commits project scope (D-14): researcher/planner decides `activeGitlabProject` only vs. all projects.
- Branch name → Jira key resolution strategy: whether to use per-commit `/refs` calls or batch branch listing.
- Today placeholder content in Phase 69: static text, skeleton UI, or empty state with Phase 70 note — planner decides.
- Exact icons for each activity type in sub-items — use Lucide icon names consistent with the rest of the app.
- Exact markdown format for the Copy markdown output.
- Whether the "synced Xm ago" timestamp tracks per-section or globally.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Standup Notes (STAND-01 through STAND-06) — exact acceptance criteria for this phase

### Route and sidebar registration
- `taskflow/src/routes/routes.tsx` — route registration pattern; add lazy `/standup-notes` entry here
- `taskflow/src/components/app/sidebar-items.ts` — `SIDEBAR_NAV_ITEMS` array; add new entry with id, label, path, iconName, section
- `taskflow/src/main.tsx` — `routeLabel()` function (line ~285) needs `/standup-notes` → `'Standup Notes'` entry

### Auth store (user identity)
- `taskflow/src/stores/auth.store.ts` — `jiraUsername`, `jiraUserKey`, `gitlabUserId`, `gitlabUsername`, `activeJiraProject`, `activeGitlabProject`, `jiraBaseUrl`, `gitlabBaseUrl` — all identity and connection fields needed for data fetching

### Settings store (integration flags)
- `taskflow/src/stores/settings.store.ts` — `tempoEnabled`, `aioEnabled` — check `tempoEnabled` before calling Tempo APIs; graceful section degradation when disabled

### Tempo services (STAND-02, STAND-03)
- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs()` — fetch worklogs by username and date range
- `taskflow/src/services/tempo/schedule.ts` — `fetchUserSchedule()` — fetch user schedule to identify holidays; used for "last working day" resolution when Tempo is enabled

### GitLab service (STAND-05, STAND-06)
- `taskflow/src/services/gitlab.ts` — existing MR/user functions; a new `fetchUserCommits()` function (or similar) needs to be added here for STAND-05; a new `fetchUserMREvents()` function needed for STAND-06 (Events API)

### Jira service (STAND-04)
- `taskflow/src/services/jira.ts` — JQL search and issue fetch (expand=changelog) used for Jira changelog activity; researcher should identify the correct function (or add one) for `project = X AND updated >= date` + comment/changelog filter by author

### Design reference
- `/Users/mimo/Downloads/Screenshot 2026-05-24 at 7.47.07 PM.png` — user's mockup showing the exact page layout: 2-column, task-grouped Yesterday, Today sub-sections. **Read this before implementing the UI.**

### Build verification
- `.planning/STATE.md` — use `npm run build`, not just `tsc` (Phase 59 standing rule)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchWorklogs(baseUrl, token, usernames, from, to)` in `tempo/worklogs.ts` — ready to use; pass `[jiraUsername]` and `[yesterdayDate, yesterdayDate]` as range
- `fetchUserSchedule(baseUrl, token, from, to, userKey)` in `tempo/schedule.ts` — for holiday detection; pass `jiraUserKey` as the userKey param
- `useAuthStore()` — `jiraUsername`, `jiraUserKey`, `gitlabUserId`, `gitlabUsername`, `activeJiraProject`, `activeGitlabProject`, `jiraBaseUrl`, `gitlabBaseUrl` — all available
- `useSettingsStore((s) => s.tempoEnabled)` — fine-grained selector pattern for Tempo gating
- `readSecret('jira-pat')` via Stronghold — existing pattern for PAT retrieval; used for all Jira + Tempo calls
- Route lazy pattern in `routes.tsx`: `const StandupNotesPage = lazy(() => import('./standup-notes/StandupNotesPage'))` + `withLazy(StandupNotesPage)`

### Established Patterns
- Fine-grained `useSettingsStore` selectors per field (from Phase 68): `useSettingsStore((s) => s.tempoEnabled)` — not `useSettingsStore()` wholesale
- Worklog date bucketing via `.slice(0, 10)` (Phase 62): never `toLocaleDateString()` for date comparison
- Tempo pagination: `fetchWorklogs` returns all worklogs for the range without a pagination wrapper (Phase 61 probe finding)
- `withLazy(Component)` wrapper in `routes.tsx` for code-split route components
- Independent data source loading: requirements say each section degrades gracefully when its integration is disabled or unreachable — use separate `useQuery` per source, don't block rendering on a single combined fetch

### Integration Points
- `sidebar-items.ts` — add new `{ id: 'standup-notes', label: 'Standup Notes', path: '/standup-notes', iconName: '...', section: 'main' }` entry; `section: 'main'` places it with Dashboard and My Tasks
- `routes.tsx` — add lazy-imported `StandupNotesPage` route
- `main.tsx` `routeLabel()` — add `/standup-notes` case
- Settings store migration: no version bump needed (adding a route doesn't change persisted state); but verify `getDefaultSidebarItems()` includes the new item by default (it maps over `SIDEBAR_NAV_ITEMS`, so adding to that array auto-includes it)
- New service functions needed in `gitlab.ts`: user commits by date + range, and user MR events (Events API); researcher should check if any partial implementation exists before writing from scratch

</code_context>

<specifics>
## Specific Ideas

- **Mockup layout (canonical reference):** The user provided a mockup at `/Users/mimo/Downloads/Screenshot 2026-05-24 at 7.47.07 PM.png`. Key observations: Yesterday column header is bold large + muted date + summary stat line. Each issue group has a green/colored icon on the left (likely the Jira issue type icon), issue key (small caps), bold summary, right-aligned Tempo hours. Sub-items use smaller muted text with distinct icons (git branch icon for commits, arrow for transitions, MR icon for opened/reviewed MRs, chat bubble for comments). MR standalone groups use the MR icon at the same level as issue icons.
- **Summary stat format:** `7.5h logged across 3 stories · 7 commits · 2 MR events` — dot-separated stat line in muted text beneath the "Yesterday · [date]" heading.
- **Today placeholder:** Render the Today column with a visual stub (the column header + date) so the 2-column layout is visible. Content (IN PROGRESS, MRs AWAITING YOU, UP NEXT) comes in Phase 70.
- **Copy markdown button:** Black/primary style button in the top-right of the page header. Clipboard write using the Tauri clipboard API (same pattern as other copy actions in the app, if any exist).

</specifics>

<deferred>
## Deferred Ideas

- **"Copy markdown" was previously rejected** but user overrode during this discussion — it is now in scope for Phase 69.
- **Today column content** (STAND-07, STAND-08, STAND-09) — Phase 70 scope; the Today column shell is built in Phase 69 but content deferred.

</deferred>

---

*Phase: 69-Standup Notes — Route + Yesterday Recap*
*Context gathered: 2026-05-24*
