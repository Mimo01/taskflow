# Project Research Summary

**Project:** Taskflow v1.13 Personal Workspace
**Domain:** My Tasks command center + graph-driven Dashboard redesign + first charting library
**Researched:** 2026-06-14
**Confidence:** HIGH

## Executive Summary

v1.13 introduces the app's first charting dependency and two new major surfaces: a My Tasks page (personal command center) and a redesigned Dashboard (stat tiles + charts + MR review queue). The research converges strongly on Recharts v3 via the shadcn/ui `chart` primitive as the charting foundation. The `--chart-1..5` OKLCH tokens are already in `index.css`, the shadcn `ChartContainer` wires them automatically, and Recharts v3.3+'s `responsive` prop fully resolves the only known React Compiler conflict (the `ResponsiveContainer` displayName-stripping bug). No other charting library clears the combined bar of React 19 peer dep, React Compiler safety, Tailwind v4 CSS-var theming, and React 19 compatibility. The install is two packages (`recharts` + `react-is`) plus `npx shadcn@latest add chart`.

My Tasks is predominantly a composition of existing primitives — `fetchMyTasksHierarchy` (jira.ts:483) already handles the sprint-scope data, StatusPopover handles inline transitions, and the subtask-under-parent grouping from Standup Today covers the "By Sprint & Parent" mode. The only genuinely new data fetch is the "all assigned" scope (`assignee = currentUser() AND statusCategory != Done`), which must use `fetchAllSearchPages` to avoid the recurring fetch-once page-cap pitfall. Dashboard redesign is similarly additive: stat tiles and the sprint health chart derive from the already-warm sprint board cache; the weekly hours chart reuses the Tempo worklogs service; the MR review queue reads the existing `gitlab-mrs` cache. The charting library must be installed first because it is a hard dependency for every chart-bearing dashboard section.

The principal open risk is the burndown vs. velocity split. Features research argues that a live burndown via GreenHopper `scopechangeburndownchart` is in scope (daily-use value, current sprint only) and feasible on Jira DC. Architecture research disagrees: it calls the endpoint unofficial, references the PROJECT.md "historical analytics out of scope" exclusion, and recommends achieving velocity through official REST endpoints only. Both researchers agree that personal velocity from official REST is achievable but requires a probe to confirm closed-sprint SP field availability, a p-limit(3) concurrency cap across N sprint fetches, and product-owner sign-off on the N-call cost. The correct resolution is to gate both features as CONDITIONAL: do not commit implementation to either until a probe phase validates the endpoint and the product owner approves the API cost budget.

## Key Findings

### Recommended Stack

The charting stack decision is fully settled by research: **Recharts v3.8+ via the shadcn/ui `chart` component**. The shadcn `ChartContainer` reads `var(--chart-*)` CSS tokens automatically, requires zero manual theme plumbing, and the copy-paste ownership model means there is no version lock-in. The `responsive` prop (v3.3+) on each chart component replaces `ResponsiveContainer` entirely, eliminating the sole React Compiler conflict point. The existing stack (Tauri 2, React 19, TypeScript, Zustand, TanStack Query, shadcn/ui, Tailwind v4, Vitest, Biome) is unchanged.

**Core technologies (additions only):**
- `recharts ^3.8.1`: SVG chart engine — the only library that clears React 19 peer dep, React Compiler safe, Tailwind v4 CSS-var theming, and all required chart types (donut, stacked bar, area/line, sparkline)
- `react-is ^19.1.0`: required Recharts peer dep for React 19; must match the React version in use
- `src/components/ui/chart.tsx` (shadcn copy-paste): `ChartContainer`, `ChartTooltip`, `ChartLegend` wrappers — not an npm package; added via `npx shadcn@latest add chart`

**Explicitly rejected:** visx (2-year-old stable release, react-spring + lodash weight, unaudited against React Compiler), Tremor (React ^18 peer dep only, wraps Recharts adding an abstraction layer), Nivo (React 19 peer dep conflicts, `--legacy-peer-deps` required), `date-fns`/`dayjs`/`luxon` (date utilities covered by existing `standup-date.ts` + `Intl.DateTimeFormat`).

### Expected Features

**Must have (My Tasks — table stakes):**
- Flat list of sprint-assigned issues (`assignee = currentUser()`) with status, priority, type icon, due date, SP, timeInColumn badge, MR health badge, blocked indicator
- Three grouping modes: My Day smart-sort (overdue → in-progress → blocked → due-today → other sprint → other assigned → done) / By Status / By Sprint & Parent
- Scope toggle: current sprint (existing `fetchMyTasksHierarchy`) vs all assigned (new paginated fetch via `fetchAllSearchPages`)
- Inline status transition via StatusPopover; row body → peek; issue key → full page

**Must have (Dashboard — table stakes):**
- Personal stat tiles: Open / In Progress / Done counts for current sprint (derived from warm sprint board cache, subtasks excluded from SP sums)
- Sprint points-by-status stacked bar or donut chart (Recharts via shadcn chart; same warm cache)
- MR review queue (open MRs awaiting my review; existing `gitlab-mrs` cache, no new fetch)
- Next release countdown (retained from current Dashboard — removing it is a regression)
- Weekly hours logged tile + Mon–Fri bar chart (Tempo worklogs; existing service)
- Aging WIP count tile (timeInColumn per issue, already in GH allData from v1.11)
- Sprint goal / sprint name header

**Should have (differentiators):**
- My Tasks: summary filter chips (status category + issue type), Log Work quick action (row context menu, reuses LogWorkPopover), time tracking mini-bar
- Dashboard: activity feed (recent changelog, reuses `fetchYesterdayJiraActivity`), sprint burndown chart (CONDITIONAL — GH endpoint probe required), personal velocity trend (CONDITIONAL — probe + product-owner sign-off required)

**Defer (v2+):**
- Cross-project My Tasks (blocked by single-project constraint)
- Team velocity / team analytics (PM-facing sprint report surface)
- Cumulative Flow Diagram (explicitly out of scope in PROJECT.md — needs daily snapshot store)
- Configurable widget grid (removed in v1.9 Phase 59; do not reintroduce `react-grid-layout`)

### Architecture Approach

v1.13 adds two new lazy-loaded route modules (`routes/my-tasks/`, extended `routes/dashboard/`) and one new infrastructure folder (`components/charts/`). All new pages follow the established outlet-context pattern for peek and navigation (`useOutletContext()` for `onIssueClick`/`onOpenIssue`), the D-16 single-token-load pattern (PAT loaded once at page root, passed as props to child components), and the Zustand + Tauri Store persistence pattern for UI prefs (`my-tasks.store.ts` with `createTauriStorage('my-tasks.json')`). New fetchers (`fetchMyAssignedIssues`, `fetchClosedSprints`, `fetchSprintIssuesBySprintId`) are added to `services/jira.ts` and `services/jira/sprints.ts` and re-exported via the barrel. New queries for My Tasks must never borrow the `'sprint-board'` cache key — `['jira-issues','my-tasks',...]` is the correct existing key, and `['jira-issues','my-tasks-all',...]` is the new key for the all-assigned scope.

**Major components:**
1. `components/charts/ChartWrapper.tsx` — explicit-height wrapper enforcing `style={{ height }}` on an outer div; uses `'use no memo'` React Compiler escape hatch; passes CSS-var strings (`var(--chart-1)` etc.) to chart children; uses Recharts `responsive` prop, never `ResponsiveContainer`
2. `routes/my-tasks/MyTasksPage.tsx` — loads `fetchMyTasksHierarchy` (sprint scope) or `fetchMyAssignedIssues` (all scope) based on `useMyTasksStore().scope`; owns group-mode state; passes `onIssueClick` from outlet context to `MyTasksGroupedList`
3. `routes/dashboard/index.tsx` (modified) — retains gradient hero; replaces 3-card grid with `DashboardStatTiles` + `DashboardSprintChart` + `DashboardTrendChart` + `DashboardMrReviewQueue` + optional `DashboardVelocityChart`; loads PAT once, passes to all child sections
4. `stores/my-tasks.store.ts` — persists `groupMode: 'day' | 'status' | 'sprint'` and `scope: 'sprint' | 'all'` via Tauri Store; settings store version (v26) does NOT change

### Critical Pitfalls

1. **Chart 0x0 sizing on WebKit (Tauri webview)** — `ResponsiveContainer` observes its parent via ResizeObserver; if the parent is a `flex-1` or `overflow-hidden` container, WebKit reports `clientWidth = 0` on the first observation and the SVG stays invisible. This is the same failure class as the virtualized table 0-width column bug (memory: `project_virtualized_table_zero_width_col`). Prevention: always wrap charts in `<div className="w-full" style={{ height: 260 }}>` — never use `height="100%"` in a flex parent. Use the `responsive` prop on the chart component itself (Recharts v3.3+) and skip `ResponsiveContainer` entirely. Gate: required before the first chart renders in the charting foundation phase; must be verified in a real macOS Tauri build, not just the browser dev server.

2. **Fetch-once page-cap on My Tasks "all assigned" scope** — the recurring bug (memory: `project_fetch_once_pagecap_pitfall`). A single JQL call with `maxResults=50` silently truncates users with >50 assigned issues. Prevention: all My Tasks JQL fetches must use `fetchAllSearchPages` (`PAGE_SIZE=200`, loops until `startAt >= total`). Two separate named functions (`fetchMyCurrentSprintIssues` / `fetchAllMyOpenIssues`) prevent the temptation to "just filter the sprint result client-side." Gate: mandatory unit test with `total: 250, firstPage: 50 items` asserting 250 results returned.

3. **SP double-counting in stat tiles and sprint health chart** — GH `allData.json` returns both stories and subtasks; summing `estimateStatistic.statFieldValue.value` without filtering by `!issuetype.subtask` inflates sprint velocity by 20-40%. This was correctly handled in v1.1 Workload (now removed) and must be re-implemented for the Dashboard. Prevention: filter `!issue.fields.issuetype.subtask` before any SP aggregation. Gate: unit test with parent(5 SP) + 2 subtasks(2 SP each) asserting total = 5, not 9.

4. **Local-date bucketing for Tempo chart data** — `new Date(tempo.started).toISOString().slice(0, 10)` shifts the calendar date for users in UTC+ timezones (standing rule in `standup-date.ts`). Prevention: use `tempo.started.slice(0, 10)` directly — Tempo timestamps are already local-time ISO strings; constructing a Date object and re-serializing breaks timezone correctness. Gate: unit test with `started: "2026-06-14T23:00:00"` asserting bucket = `2026-06-14`, not `2026-06-13`.

5. **React Compiler incompatibility with `ResponsiveContainer`** — confirmed bug: `babel-plugin-react-compiler` strips `displayName` in production, breaking Recharts' internal `isChart()` check when `ResponsiveContainer` is used (issues #4590, #5173). Prevention: use the `responsive` prop on every chart component (`<AreaChart responsive ...>`) and never use `ResponsiveContainer`. If `ResponsiveContainer` is ever needed, add `sources: (filename) => !filename.includes('node_modules/recharts')` exclusion to `vite.config.ts`. Gate: verify chart data prop changes re-render correctly in a production build, not just dev server.

## Implications for Roadmap

Based on research, the phase structure follows a strict dependency order: charting infrastructure must precede any chart-bearing Dashboard section; My Tasks data layer is independent and can proceed in parallel; Dashboard is built section-by-section from stat tiles (cheapest, warm cache) to velocity chart (most complex, conditional probe).

### Phase 1: Charting Foundation

**Rationale:** Every chart on the Dashboard depends on Recharts + `chart.tsx`. Installing the library and verifying `ChartWrapper` renders correctly with dark/light theming in the actual Tauri WebKit build is a gate for all subsequent chart work. Doing this first prevents discovering WebKit sizing bugs after charts are implemented across multiple components.

**Delivers:** `recharts` + `react-is` installed; `chart.tsx` added via shadcn; `ChartWrapper.tsx` at `src/components/charts/` with explicit-height wrapper, `'use no memo'` directive, and `responsive` prop pattern; `isAnimationActive={false}` established as default; dark/light theme verified with a smoke-test chart on `/dashboard`; `rollup-plugin-visualizer` confirms chart library is in the Dashboard chunk, not `vendor/main`.

**Addresses:** Stack selection (Recharts consensus), charting infrastructure for all Dashboard charts.

**Avoids:** Chart 0x0 on WebKit (explicit-height wrapper from day one), React Compiler incompatibility (`responsive` prop pattern enforced), bundle bloat (lazy-route placement verified before any chart component), SVG animation jank (`isAnimationActive={false}` default).

**Research flag:** SKIP — settled decision with explicit install instructions confirmed.

### Phase 2: My Tasks Page

**Rationale:** My Tasks has no chart dependency. It can build in parallel with or immediately after Phase 1. The sprint-scope data layer (`fetchMyTasksHierarchy`) already exists at jira.ts:483; the "all assigned" scope adds one new paginated fetcher. Building My Tasks before the full Dashboard redesign validates the `MyTaskRow` component and grouping logic before potential reuse in Dashboard issue lists.

**Delivers:** `/my-tasks` lazy route + sidebar entry; `stores/my-tasks.store.ts`; `fetchMyAssignedIssues` in `services/jira.ts` using `fetchAllSearchPages`; `MyTasksPage`, `MyTasksHeader`, `MyTasksControls`, `MyTasksGroupedList`, `MyTaskRow`; all three grouping modes (My Day, By Status, By Sprint & Parent); scope toggle (sprint / all assigned); inline StatusPopover transitions; peek via outlet context; summary filter chips.

**Addresses:** My Tasks table-stakes features (flat list, grouping, transitions, peek, scope toggle), differentiators (My Day smart-sort, MR health badge, aging badge, due-date highlight, blocked indicator).

**Avoids:** Fetch-once page-cap (`fetchAllSearchPages` mandatory from first commit), N+1 per-row queries (MR health derived client-side from existing `gitlab-mrs` cache, same as sprint board), cross-sprint scope bugs (JQL scope definition reviewed before implementation — `sprint in openSprints() OR sprint is EMPTY`), stale-while-revalidate re-sort flicker (`staleTime: 2min`, scroll-position-aware resort deferral).

**Research flag:** SKIP for core list and grouping — all components are reused primitives.

### Phase 3: Dashboard Stat Tiles + Sprint Health Chart

**Rationale:** The simplest Dashboard changes with the highest user value. Stat tiles and the sprint health chart both read from the warm sprint board cache — zero new API calls. This phase establishes the new Dashboard layout (replacing the 3-card grid) and validates `ChartWrapper` in production Dashboard context before more complex chart sections are added.

**Delivers:** `DashboardStatTiles` (Open / In Progress / Done counts, SP-subtask-excluded, from `['jira-issues','sprint-board',...]` warm cache); `DashboardSprintChart` (points-by-status stacked bar, Recharts via ChartWrapper); gradient hero + sprint goal header retained; next release countdown retained; old `DashboardSprintCard` and `DashboardInProgressCard` replaced.

**Addresses:** Dashboard table-stakes (stat tiles, sprint health chart, release countdown, sprint goal).

**Avoids:** SP double-counting (unit-tested aggregation with `!issuetype.subtask` filter), polling overload (stat tiles + sprint chart share one query with TanStack `select`), Dashboard data derivation in parent body (use `select` on TanStack Query for aggregation to enable React Compiler memo boundaries).

**Research flag:** SKIP — data is already fetched, chart type is standard Recharts bar/donut, no new API.

### Phase 4: Dashboard Trend Chart + MR Review Queue + Activity Strip

**Rationale:** The second tier of Dashboard content. Trend chart (weekly logged hours) reuses the existing Tempo worklogs service and is gated on `tempoEnabled`. MR review queue reads the existing `gitlab-mrs` cache — no new fetch. Activity strip reuses `fetchYesterdayJiraActivity` with a matching query key to get free Standup Notes cache sharing. All three sections load and degrade independently.

**Delivers:** `DashboardTrendChart` (Mon–Fri logged hours bar chart, Tempo-gated, graceful empty state when disabled); `DashboardMrReviewQueue` (open MRs awaiting my review, client-side filtered from existing `gitlab-mrs` cache); `DashboardActivityStrip` (recent Jira activity, reuses standup query key for cache sharing); weekly hours logged tile (Tempo sum for current week using `tempo.started.slice(0, 10)` bucketing).

**Addresses:** Dashboard differentiators (trend chart, MR review queue, activity).

**Avoids:** Timezone date bucket bug (use `tempo.started.slice(0, 10)`, not `toISOString()`), N+1 per-MR queries (client-side filter on existing list cache), polling overload (MR queue and activity read from existing caches, no new polling intervals), Dashboard re-render storms (per-section independent queries with `select` aggregation).

**Research flag:** SKIP for MR queue and activity. Confirm Tempo worklog query scoped to current week returns expected shape before implementing chart aggregation.

### Phase 5: Dashboard Velocity Chart (CONDITIONAL)

**Rationale:** The most complex Dashboard section with the most open questions. Requires new fetchers, a concurrency cap (`p-limit(3)`), `staleTime: Infinity` for closed-sprint data, and a product-owner decision on API cost. The researchers DISAGREE on burndown: Features says `scopechangeburndownchart` is feasible and in scope (live current-sprint chart, not historical analytics); Architecture says it is unofficial and out of scope. This phase begins only after a probe of the relevant endpoints in the dev environment, with the product owner resolving the burndown question. The velocity widget must be an independent section that cannot block the rest of the Dashboard if it fails.

**Delivers (conditional on probe success):** `fetchClosedSprints` + `fetchSprintIssuesBySprintId` in `services/jira/sprints.ts` + barrel; `DashboardVelocityChart` (last N completed sprints, committed vs completed SP, `p-limit(3)` concurrency, `staleTime: Infinity`); renders only when >= 3 closed sprints are available; independent loading and error state.

**Addresses:** Dashboard velocity differentiator (personal throughput trend over time).

**Avoids:** Dashboard-blocking velocity waterfall (renders as the last independently-loading section), closed-sprint SP unavailability (probe verifies field presence; descopes to story count if SP missing), velocity chart with insufficient history (gate on >= 3 closed sprints before rendering).

**Research flag:** PROBE REQUIRED at phase kickoff before any code. (1) `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed&maxResults=5` — verify sprint objects with `startDate`/`endDate`. (2) `GET /rest/agile/1.0/sprint/{sprintId}/issue?fields=customfield_10016,status` — verify SP field (`customfield_10016`) is populated on closed-sprint issues on this specific DC instance. (3) Product-owner decision on N sequential fetch cost. (4) Product-owner decision on burndown via GreenHopper `scopechangeburndownchart` — if approved, add as Phase 5b; if not, velocity via official REST is the v1.13 scope ceiling.

### Phase Ordering Rationale

- Phase 1 must precede Phases 3, 4, 5: `ChartWrapper` is a hard dependency for all chart-bearing Dashboard sections. WebKit sizing bugs must be resolved in isolation before charts are composed into the full Dashboard layout.
- Phase 2 is independent: My Tasks has no chart dependency and `fetchMyTasksHierarchy` already exists. Can run immediately after or in parallel with Phase 1.
- Phase 3 must precede Phase 4: Phase 3 establishes the new Dashboard layout structure (replacing the 3-card grid). Phase 4 adds sections into that established layout.
- Phase 4 must precede Phase 5: Phase 5 (velocity) is the lowest-priority, highest-risk, most-conditional section. It should be added last so it cannot block or delay higher-value sections.
- Phase 5 is conditional: If the probe fails (SP field unavailable on closed sprints, or product owner declines the API cost), Phase 5 is descoped to "story count completed per sprint" or dropped from v1.13 entirely. The rest of the milestone is unaffected.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (Velocity/Burndown):** PROBE REQUIRED. `GET /rest/agile/1.0/sprint/{sprintId}/issue` must be run against the real DC instance to verify SP field presence on closed sprints. Product owner must decide: (a) API cost budget for N sequential sprint fetches, (b) whether burndown via unofficial `scopechangeburndownchart` is approved. Document probe results in Phase 5's context file before writing any chart code.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Charting Foundation):** Decision settled; install instructions explicit; no novel API.
- **Phase 2 (My Tasks):** All primitives reused; `fetchMyTasksHierarchy` exists; grouping logic is client-side; `fetchAllSearchPages` is the established pattern.
- **Phase 3 (Stat Tiles + Sprint Chart):** Data already fetched; chart type is standard Recharts; no new API.
- **Phase 4 (Trend + MR Queue + Activity):** MR queue and activity reuse existing caches; Tempo trend is the existing worklogs service with a date-range scope.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (Recharts decision) | HIGH | All four researchers converged independently on Recharts v3 via shadcn chart. Version confirmed via npm. React Compiler conflict resolved and documented (issues #4590, #5173 + v3.3.0 release notes). `--chart-1..5` tokens verified in `index.css` source. |
| Features (My Tasks) | HIGH | Feature set grounded in Linear My Issues, Jira Your Work, GitHub assigned-to-me. All data dependencies verified against existing GH allData fields. Only the "all assigned" scope requires a new fetch; all other fields confirmed in existing cache. |
| Features (Dashboard charts) | HIGH for tiles/sprint/hours chart; MEDIUM for burndown/velocity | Stat tiles and sprint chart: zero new API, derived from warm cache. Logged hours: existing Tempo service. Burndown and velocity: CONDITIONAL — endpoint availability unconfirmed on the specific DC instance. |
| Architecture | HIGH | Grounded in direct codebase reading (jira.ts line references, store version numbers, route patterns, outlet context shape). All new components follow confirmed existing patterns. |
| Pitfalls | HIGH | Critical pitfalls (WebKit 0x0 sizing, page-cap, SP double-count, date bucketing, React Compiler) all grounded in prior bugs in this codebase (memory entries) or confirmed GitHub issues against Recharts. |

**Overall confidence:** HIGH for Phases 1-4. MEDIUM for Phase 5 (conditional on probe).

### Gaps to Address

- **Burndown vs. velocity decision:** Features and Architecture researchers disagree. Resolution requires a product-owner conversation and a live endpoint probe. If `scopechangeburndownchart` is approved: burndown is a live single-sprint chart (not historical analytics) and should be treated as a Phase 5b sub-feature, not as "historical analytics." If not approved: velocity via official REST is the correct path. Document the probe results in Phase 5's context file before writing any chart code.

- **Status-color aliases for charts:** The `--chart-1..5` tokens are a blue-to-indigo sequential palette. Status-semantic colors (Done = green, Blocked = red, In Progress = blue) for the sprint health chart likely need named semantic aliases in `index.css` (e.g., `--chart-status-done`, `--chart-status-active`, `--chart-status-todo`) rather than repurposing the numbered tokens. Decide during Phase 3 when the sprint health chart is implemented; do not hardcode hex values.

- **Velocity SP field availability:** Architecture research specifies `customfield_10016` for SP retrieval on closed-sprint issues. Confirm this field is populated on closed-sprint issues on the team's specific DC instance (SP field ID is dynamic, per `discoverStoryPointsField()` precedent). If absent, velocity must fall back to story count.

- **`isAnimationActive` in Tauri vs. dev server:** All chart components should set `isAnimationActive={false}`. If animations are desired in the browser dev server for development, use `const IS_TAURI = '__TAURI_INTERNALS__' in window` as a guard. Decide once and apply consistently in `ChartWrapper` so all charts inherit the setting.

## Sources

### Primary (HIGH confidence)

- Taskflow `src/services/jira.ts` — `fetchMyTasksHierarchy` (line 483), `fetchAllSearchPages` (line 267), `PAGE_SIZE = 200` (line 262)
- Taskflow `src/index.css` — `--chart-1..5` OKLCH values confirmed in both `:root` and `.dark`
- Taskflow `src/stores/settings.store.ts` — persist version 26; `createTauriStorage` pattern
- Taskflow `src/routes/dashboard/index.tsx` + `DashboardInProgressCard.tsx` + `DashboardSprintCard.tsx` — existing dashboard structure and patterns
- Taskflow `src/routes/standup-notes/TodayColumn.tsx` — subtask-under-parent grouping pattern reusable for My Tasks
- Taskflow `vite.config.ts` — React Compiler invoked with no exclusions; basis for `responsive` prop requirement
- Taskflow `package.json` — React 19.1.0; no chart lib present; `p-limit` already a dependency
- Taskflow `PROJECT.md` — Out of Scope list; Key Decisions table; D-16 PAT pattern
- [recharts/recharts GitHub](https://github.com/recharts/recharts) — v3.8.1 confirmed latest; `responsive` prop introduced in v3.3.0
- [recharts/recharts #4590](https://github.com/recharts/recharts/issues/4590) + [#5173](https://github.com/recharts/recharts/issues/5173) — React Compiler + `ResponsiveContainer` confirmed bug
- [shadcn/ui chart docs](https://ui.shadcn.com/docs/components/radix/chart) — `ChartContainer`, `ChartConfig`, CSS var theming for Recharts v3 + React 19
- [Jira Agile DC REST API 9.14.0](https://docs.atlassian.com/jira-software/REST/9.14.0/) — closed sprint endpoints confirmed via official reference
- Memory: `project_fetch_once_pagecap_pitfall` — recurring bug pattern; prevention strategy confirmed across two prior cases

### Secondary (MEDIUM confidence)

- [GreenHopper `scopechangeburndownchart` community thread](https://community.atlassian.com/forums/Jira-questions/How-do-I-fetch-Sprint-Burndown-data-via-API-calls-or-otherwise/qaq-p/2623047) — endpoint confirmed on Jira DC, but unofficial and undocumented
- [GreenHopper `sprintreport` community thread](https://community.developer.atlassian.com/t/agile-api-equivalent-for-a-greenhopper-sprintreport-url/3997) — endpoint exists; N-call cost unconfirmed on target instance
- [Linear My Issues docs](https://linear.app/docs/my-issues) — My Day grouping inspiration; Focus sections model
- [shadcn/ui React 19 guide](https://ui.shadcn.com/docs/react-19) — `react-is` peer dep requirement
- [bundlephobia recharts](https://bundlephobia.com/package/recharts) — ~50 kB gzip
- [PkgPulse Recharts v3 vs Tremor vs Nivo 2026](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026) — bundle comparison

### Tertiary (LOW confidence)

- [Sprint velocity anti-patterns](https://www.parabol.co/blog/sprint-velocity/) — velocity chart design recommendations; not DC-specific
- [Dashboard design best practices](https://www.domo.com/learn/article/dashboard-design-examples-best-practices) — layout principles only

---
*Research completed: 2026-06-14*
*Ready for roadmap: yes*
