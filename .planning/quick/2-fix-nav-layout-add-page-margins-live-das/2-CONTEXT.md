# Quick Task 2: Fix nav layout: add page margins, live dashboard data, and sidebar grouping - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Task Boundary

Three follow-up fixes from quick task 1 (navigation restructure):

1. **Page margins** — The new route pages (MyTasksTab, SprintBoardTab, MrAttentionTab, SprintProgressTab, WorkloadTab, ReleasesTab) render directly into `<main className="flex-1 overflow-auto">` with no padding. They need consistent margins matching the rest of the app (Dashboard uses `p-4`, Settings uses `py-8 px-4`).

2. **Dashboard live data** — The dashboard overview cards currently show static `"—"` placeholders. They need real data fetched fresh on dashboard load.

3. **Sidebar grouping** — The sidebar currently shows all links in a flat list. They should be split into groups: Dashboard alone at the top, role-specific pages in a "Work" section with a label, Settings at the bottom.

</domain>

<decisions>
## Implementation Decisions

### Page margins
- Add `p-4` padding wrapper to each of the 6 new route tab components (MyTasksTab, SprintBoardTab, MrAttentionTab, SprintProgressTab, WorkloadTab, ReleasesTab)
- Match Dashboard's existing `p-4` pattern — do NOT change AppLayout's `<main>` (would affect Settings too)
- WorkloadTab already has `pt-2` — replace with consistent `p-4`

### Dashboard data source
- Fresh fetch on dashboard load (not cache-only)
- Developer cards: Active Sprint Tasks count (Jira sprint issues assigned to user), Open MRs count (GitLab MRs authored by user, state=opened), MRs Needing Attention count (MRs where user is reviewer with pending review)
- PM cards: Sprint Completion % (closed issues / total sprint issues), Team Workload (count of in-progress issues), Next Release (nearest fixVersion release date)
- Use existing service functions (jira.ts, gitlab.ts) and React Query — same patterns as the tab components
- Show loading state and error state on cards (consistent with existing tab patterns)

### Sidebar grouping
- Structure: Dashboard (no label) → "Work" section label → role-specific pages → Settings (no label, bottom)
- Section label styling: small uppercase muted text, consistent with existing Tailwind patterns in the app
- Role-specific pages remain conditional on role (developer/pm)

### Claude's Discretion
- Exact section label text ("Work" or similar)
- Whether to add a divider line between sections or just spacing + label

</decisions>

<specifics>
## Specific Ideas

- Dashboard data queries should use the same query keys as the tab components where possible to benefit from cache warming
- The `useSettingsStore` already provides `jiraBaseUrl`, `gitlabBaseUrl`, `role` — use these as query guards (enabled: !!jiraBaseUrl etc.)
- Cards should show a spinner or "—" while loading, and a muted error message if fetch fails

</specifics>
