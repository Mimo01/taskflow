# Research Summary: Taskflow v1.9

**Milestone:** Tempo Timesheets + Dashboard Redesign & Cleanup
**Synthesized:** 2026-05-20
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

Three interlocking workstreams: (1) net-new Tempo Timesheets worklog viewer, (2) replacement of widget dashboard with a static 3-card layout, (3) removal of react-grid-layout + workload route. The v1.8 stack is fully sufficient — zero new packages needed, two removed (`react-grid-layout`, `@types/react-grid-layout`).

**Highest-risk item:** Tempo auth is contested across researchers. Architecture researcher says Jira PAT works (citing existing `/rest/tempo-accounts/1/account/search` in `fields.ts`). Stack/Pitfalls researchers say a separate Tempo API Integration Token may be required for DC installs. **Resolution: probe required before writing any Tempo service code.**

---

## Stack Additions

| Action | Item | Reason |
|--------|------|--------|
| REMOVE | `react-grid-layout` | Widget dashboard deleted; only 2 files import it |
| REMOVE | `@types/react-grid-layout` | Removed with above |
| ADD | None | All Tempo needs covered by existing apiFetch/Stronghold/TanStack Query |

No new runtime libraries. Native Date API for date math. Existing `@tanstack/react-virtual` for rows. No `@tanstack/react-table` — bespoke table is the established pattern.

---

## Key Feature Findings

### Tempo Worklog Viewer — Table Stakes
| Feature | Complexity | Notes |
|---------|------------|-------|
| Day-column grid (user rows × day columns) | MEDIUM | CSS sticky columns; sum `timeSpentSeconds` per cell |
| Date presets (This Week, Last Week, This Month, Last Month, custom) | LOW | Native Date arithmetic |
| "Last working day" smart preset | LOW | `getDay()` check, skip weekends |
| People filter multi-select | LOW | Reuse existing project member list from Jira |
| Total row + total column | LOW | Derived client-side |
| Saved filter (name + people + date preset) | LOW | LazyStore persistence — same pattern as pinned tabs |
| Loading/error/empty states | LOW | Established skeleton/error patterns |

### Static Dashboard — 3 Cards (agreed scope)
| Card | Complexity | Data Source |
|------|------------|-------------|
| Sprint health (name, days left, % done bar) | LOW | Existing `SprintHealthPanel` — zero changes |
| My In Progress subtasks (top 3) | LOW | Sprint issues query filtered to currentUser + In Progress |
| Next release countdown | LOW | `fetchFixVersions` (soonest unreleased fix version) |

**Zero new API calls on warm cache.** All data already fetched by existing pages.

---

## Deferred Features

| Feature | Reason |
|---------|--------|
| Epic/story/subtask row hierarchy | HIGH complexity — N+1 Jira enrichment per worklog, defer to v1.9.x |
| Timesheet approval workflow | Tempo-native feature, out of scope |
| CSV export | Low value for daily use case |
| Billable/non-billable split | Not used by Orange team |

---

## Architecture

### New Files
- `src/services/tempo/` (7 files) — `client.ts`, `worklogs.ts`, `users.ts`, `types.ts`, `index.ts` + 2 test files
- `src/routes/dashboard/TempoPage.tsx` — worklog viewer route
- `src/routes/dashboard/TempoTable.tsx` — day-column table, flat user rows, CSS sticky
- `src/routes/dashboard/TempoFilterBar.tsx` — people picker + date presets + saved filters
- `src/routes/dashboard/MyInProgressPanel.tsx` — dashboard card (~80 lines)
- `src/routes/dashboard/NextReleasePanel.tsx` — dashboard card (~80 lines)

### Modified Files
- `src/routes/dashboard/index.tsx` — replaced with static 3-panel layout
- `src/stores/settings.store.ts` — adds `tempoEnabled`, `savedTempoFilters[]`; removes all widget state; bumps to version 19
- `src/routes/routes.tsx` — add `/tempo`, remove `/workload`
- `src/components/app/Sidebar.tsx` + `sidebar-items.ts` — add Tempo link, remove Workload

### Deleted Files (~17 files)
- Widget system: `WidgetCard.tsx`, `WidgetGrid.tsx`, `WidgetPicker.tsx`, entire `src/routes/dashboard/widgets/` folder (~14 files)
- Workload: `WorkloadTab.tsx`, `WorkloadSkeleton.tsx`, `WorkloadTab.test.tsx`

### Query Keys
```
['tempo', jiraBaseUrl, 'worklogs', from, to, ...usernames]
```
Same isolation pattern as `['aio', ...]`.

---

## Top Pitfalls

1. **Tempo auth is unverified** — Probe before writing any service code. First task of Tempo phase: fire a raw API call and confirm 200 vs 401.

2. **`settings.store.ts` hard-imports `registry.ts`** — Deleting the registry without updating the store causes immediate build failure. Must be one atomic commit (delete registry files + update store + delete `settings.store.test.ts` widget describe block).

3. **react-grid-layout CSS imports break `vite build` after uninstall** — TypeScript won't catch it. Always run `npm run build` (not just `tsc`) as verification.

4. **Worklog timestamp timezone bucketing** — Use `.slice(0, 10)` on string timestamps; never `toLocaleDateString()`. Write timezone fixtures before rendering logic.

5. **Tempo pagination defaults to 50 records** — Must paginate to exhaustion or pass appropriate limit param. Write a service test fixture with exactly 50 items + `total: 73` to catch this.

6. **11 tests in `settings.store.test.ts` import `WIDGET_REGISTRY`** — Must be deleted atomically with the registry file.

---

## Suggested Phase Order

| Phase | Name | Rationale |
|-------|------|-----------|
| 59 | Dashboard Cleanup + Dependency Removal | Clear widget system before building replacement; store/registry coupling makes deletion first mandatory |
| 60 | Static Dashboard | Assembly of existing query cache; zero new API calls; fast win after cleanup |
| 61 | Tempo Probe + Service Layer | Auth + endpoint verification gates all UI work; service types must exist before UI imports |
| 62 | Tempo Worklog Viewer UI | Depends on Phase 61 confirmed service; flat user-row table, day columns, presets, saved filters |
| 63 | Test Pass + Code Cleanup | settings.store.test.ts v19 migration, dead code sweep, remaining test fixes |

---

## Watch Out For

- **Tempo auth:** Probe `Authorization: Bearer <jira-pat>` against live Tempo endpoint — if 401, a Tempo API Integration Token is needed (new credential in Stronghold)
- **`settings.store.ts` → `registry.ts`:** Compile-time import must be severed atomically with registry deletion
- **react-grid-layout CSS:** Verify cleanup with `npm run build` not just `tsc`
- **Epic hierarchy:** Confirmed HIGH complexity, deferred to v1.9.x — do not scope into these phases

---

*Research completed: 2026-05-20 | 4 parallel researchers*
