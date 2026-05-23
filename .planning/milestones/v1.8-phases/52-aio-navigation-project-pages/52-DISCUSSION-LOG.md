# Phase 52: AIO Navigation + Project Pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 52-AIO Navigation + Project Pages
**Areas discussed:** Sidebar gating, Project list content, Cycle stats on overview, Route path shape

---

## Sidebar gating

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add to customization | AIO item added to SIDEBAR_NAV_ITEMS + sidebarItems store. Rendered only when aioEnabled AND visible. Consistent with all other nav items. | ✓ |
| No — always visible when aioEnabled | AIO section rendered directly in Sidebar.tsx behind aioEnabled check, bypassing customization. | |

**User's choice:** Yes — add to customization

| Option | Description | Selected |
|--------|-------------|----------|
| "Testing" — new section after Tracking | Adds 5th SIDEBAR_SECTION {id: 'testing', label: 'Testing'} after 'Tracking'. | ✓ |
| "Testing" — fold into Tracking section | AIO item goes in 'Tracking' alongside Sprint Progress, Workload, Releases. | |

**User's choice:** "Testing" — new section after Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| "Test Projects" | Descriptive — makes clear it leads to AIO test project list. | |
| "Projects" (under Testing section) | Shorter, relies on section header 'Testing' for context. | |
| "AIO Projects" | Explicit branding — useful if more AIO items are added later. | ✓ |

**User's choice:** "AIO Projects"

---

## Project list content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + project key only | No extra API calls. Lists all projects with name and key from fetchAioProjects. | ✓ |
| Name + key + cycle count | Requires N+1 fetches. With 80 projects, 80 parallel requests. | |
| Name + key + status badge | Requires fetching cycles per project. | |

**User's choice:** Name + project key only

| Option | Description | Selected |
|--------|-------------|----------|
| Table rows — like EpicsPage | Consistent with EpicsPage, BacklogPage. No new layout component. | ✓ |
| Card grid | 2-3 column grid. New layout pattern. | |
| Flat list — like My Tasks | Simpler than a table for 2 data points. | |

**User's choice:** Table rows — like EpicsPage

---

## Cycle stats on overview

| Option | Description | Selected |
|--------|-------------|----------|
| Cycle name + status only (defer stats to Phase 53) | No extra fetches. Pass/fail deferred — cycle detail (Phase 53) surfaces that data anyway. | ✓ |
| Yes — fetch cycle detail per cycle (N+1) | Call GET /testcycle/{cycleKey}/detail per cycle. Adds N requests on page load. | |
| You decide | Claude picks simpler approach. | |

**User's choice:** Cycle name + status only (defer stats to Phase 53)

| Option | Description | Selected |
|--------|-------------|----------|
| Table rows — same as project list | Cycle key + name + status badge columns. Consistent. | ✓ |
| Card list | One card per cycle. New layout pattern. | |

**User's choice:** Table rows — same as project list

---

## Route path shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat: /aio-projects + /aio-project/:projectKey | Matches existing convention (/merge-requests + /mr/:id). | ✓ |
| Prefixed: /aio/projects + /aio/project/:projectKey | Namespace via /aio/ prefix. Deviates from current flat convention. | |

**User's choice:** Flat: /aio-projects + /aio-project/:projectKey

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /aio-cycle/:projectKey/:cycleKey (Phase 53 route) | Links render now but 404 until Phase 53. Clean intent. | ✓ |
| Links disabled until Phase 53 | Cycle rows not clickable. No broken navigation. | |

**User's choice:** Navigate to /aio-cycle/:projectKey/:cycleKey (Phase 53 route, not yet built)

---

## Claude's Discretion

- Icon selection for "AIO Projects" nav item — `FlaskConical` from lucide-react suggested. Not explicitly specified by user; planner should pick an appropriate icon.
- Whether to add a stub `/aio-cycle/:projectKey/:cycleKey` route in Phase 52 or leave it for Phase 53 — planner's call.

## Deferred Ideas

- Per-cycle pass/fail counts on project overview — explicitly deferred to Phase 53 where the cycle detail endpoint is already being used.
