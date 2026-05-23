# Quick Task 1: Restructure navigation: move Dashboard header nav to sidebar, keep Dashboard as overview page - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Task Boundary

Move the role-based tab navigation (currently in the Dashboard header) into the sidebar as individual nav links. Each tab becomes its own route. The Dashboard page becomes a general overview/summary page. Settings remains unchanged.

Current sidebar: Dashboard, Settings
Current Dashboard: role-based tabs (PM: Sprint Progress, Workload, Releases / Dev: My Tasks, Sprint Board, MR Attention)

Target sidebar: Dashboard, [role-specific pages as flat links], Settings
Target Dashboard: role-aware summary with most useful at-a-glance info

</domain>

<decisions>
## Implementation Decisions

### Dashboard overview content
- Show role-aware summary cards with the most useful at-a-glance info
- Suggested for Developer: active sprint tasks count, open MR count, upcoming deadlines
- Suggested for PM: sprint completion %, team workload summary, next release date
- Keep it extensible — use a cards/widgets layout so more content can be added later

### Route architecture
- Each former tab becomes its own route (separate routes, not state within /dashboard)
- PM routes: /sprint-progress, /workload, /releases
- Dev routes: /my-tasks, /sprint-board, /mr-attention
- /dashboard remains as the overview page

### Sidebar grouping
- Flat list: Dashboard → [role-specific pages] → Settings
- No section headers or grouping

### Claude's Discretion
- Exact card design and data shown on Dashboard overview (keep it simple and consistent with existing UI style)
- Whether role-specific sidebar links show/hide based on current role (likely yes)
- Icon choices for new sidebar items

</decisions>

<specifics>
## Specific Ideas

- Role-specific nav items in sidebar should respect the existing role detection logic (developer/pm)
- Maintain existing active/hover styles from current sidebar nav items
- The TopBar can remain as-is (or simplified if it currently shows tab labels)

</specifics>
