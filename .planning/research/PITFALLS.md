# Pitfalls Research

**Domain:** Charting library integration + My Tasks page + graph-driven Dashboard in Tauri 2 / React 19 / React Compiler / Tailwind v4 / TanStack Query
**Researched:** 2026-06-14
**Confidence:** HIGH (codebase-verified against taskflow/src) / MEDIUM (chart library specifics — verified via Context7 + official docs) / LOW where noted

---

## Critical Pitfalls

### Pitfall 1: Chart renders at 0 × 0 — ResponsiveContainer / ResizeObserver inside flex/overflow-hidden container

**What goes wrong:**
A chart wrapped in `ResponsiveContainer` (Recharts) or equivalent "fill available space" sizing measures its parent via a `ResizeObserver`. If the parent has no intrinsic size at the time the observer fires — which happens inside `flex-1`, `overflow-hidden`, `position: absolute`, or `@tanstack/react-virtual` rows — the observed width is 0 and the SVG renders at 0 × 0. On WebKit (macOS/Linux Tauri webview) the timing is different from Chrome: the observer can fire before the flex layout has resolved, so the chart collapses even when the parent visually has width. This is the exact same failure class as the virtualized table 0-width column bug (memory: project_virtualized_table_zero_width_col).

**Why it happens:**
`ResponsiveContainer` observes the immediate parent DOM node. If that parent is a flex child with `min-width: 0` but no `width` set, WebKit reports `clientWidth = 0` on first observation. The SVG is created at that size. A second observation fires once layout settles, but Recharts only re-renders if the observed size changes — and 0→0 is no change, so the chart stays invisible.

The Dashboard widget containers are likely `flex-1 overflow-hidden` (the existing "Panels receive props from thin index.tsx" pattern). If a chart is dropped directly into such a container without an explicit height, the same collapse occurs.

**How to avoid:**
1. Wrap every chart in an explicit-size container: `<div className="w-full" style={{ height: 260 }}>`. Never rely on `height="100%"` or `ResponsiveContainer height="100%"` inside a flex parent without a fixed-height ancestor.
2. For Dashboard widget boxes where the height is dynamic, set `min-height` (e.g., `min-h-[220px]`) on the widget wrapper so the ResizeObserver always sees a non-zero box.
3. Prefer chart libraries that accept explicit `width` + `height` props without `ResponsiveContainer` (Recharts supports this — pass numeric `width` and `height` instead of `"100%"`). Measure width via a `useLayoutEffect` + `ref.current.offsetWidth` (same pattern used in `IssueDetailView.tsx`'s `measuredInitialWidth`). This removes the ResizeObserver from the critical render path.
4. Do not place chart components inside `@tanstack/react-virtual` rows. Charts inside virtualized rows are unmounted when scrolled out of view; re-mounting fires a fresh ResizeObserver observation at 0 before the DOM layout settles.

**Warning signs:**
- Chart area renders but SVG is invisible or the container collapses
- `getBoundingClientRect()` on the chart parent returns `{ width: 0, height: 0 }` in DevTools
- Only reproducible in macOS/Linux Tauri build, not in `npm run dev` in Chrome

**Phase to address:**
Charting foundation phase (first chart integrated). The explicit-size wrapper must be a named requirement before any chart component is written.

---

### Pitfall 2: React Compiler incompatibility with chart libraries that rely on refs / imperative animation

**What goes wrong:**
`babel-plugin-react-compiler` auto-memoizes at the IR level and prohibits all manual `useMemo`, `useCallback`, and `React.memo`. Chart libraries that internally use `useRef` + imperative animation loops (e.g., D3-backed libraries like `nivo` or `visx` which call `selection.transition().duration()`) may conflict. The compiler infers that a `ref` value never changes and elides re-renders that the library expects. The chart renders once and never updates when data changes.

Less critically: any consumer component that passes a callback prop (e.g., `onMouseEnter` for tooltip) must not wrap it in `useCallback` — the compiler handles that. But if a library's internal implementation relies on `useCallback` stability for its own memoization, the compiler may produce behavior the library does not expect.

**Why it happens:**
React Compiler treats `useRef` reads as stable. Libraries that use refs as mutable containers for animation state may see the compiler "see through" their imperative model. Framer Motion is explicitly banned (STACK.md: "Framer Motion conflicts with React Compiler auto-memo"). Libraries using similar animation patterns carry the same risk.

**How to avoid:**
1. Choose a library that is pure React-rendered SVG (Recharts, Tremor) rather than D3-imperative (visx, nivo raw). Pure React SVG = compiler sees props→render = safe.
2. For whichever library is chosen, run the full React Compiler diagnostic: `REACT_COMPILER_MODULE_NAMES=<lib-package-name> npx react-compiler-healthcheck` in CI.
3. Avoid libraries that use `useLayoutEffect` with DOM mutation (not just DOM read) for their core rendering — these are the most likely to conflict.
4. If a specific chart type from the chosen library misbehaves, `"use no memo"` directive can opt that one component out of compilation as a last resort (but never as a default).

**Warning signs:**
- Chart renders correctly on first mount but does not update when the data prop changes
- Console warning: `[ReactCompilerRuntime] React Compiler: ...` about unexpected mutation
- Removing `babel-plugin-react-compiler` from vite.config fixes the chart update issue

**Phase to address:**
Charting foundation phase. Run the compiler healthcheck before committing to the library. This is a gate — do not proceed to dashboard charts without passing it.

---

### Pitfall 3: Theme / color tokens not followed on dark mode switch — chart colors hardcoded

**What goes wrong:**
Chart libraries expose colors as prop arrays (e.g., `colors={['#6366f1', '#10b981']}` or `fill="var(--color-primary)"`). A chart implemented with hardcoded hex values renders correct colors in light mode and switches to an incorrect palette in dark mode — the chart does not listen to the Tailwind v4 CSS token layer. Dark mode in Taskflow is implemented via `dark:` variants and CSS custom properties in the Tailwind v4 config; there is no `document.documentElement.classList.contains('dark')` API that chart libraries can consume directly.

**Why it happens:**
Chart libraries cannot read Tailwind CSS custom properties from computed style on their own. The consumer is responsible for passing semantic color values that adapt to the current theme. If the consumer hardcodes hex or uses a library's built-in theme that does not match Taskflow's design tokens, charts look inconsistent or invisible (e.g., white text on white background in light mode, dark line on dark background).

**How to avoid:**
1. Define a shared `useChartColors()` hook that reads the current theme from the Zustand `useSettingsStore` (`theme: 'light' | 'dark' | 'system'`) and returns a typed object of semantic chart colors (e.g., `{ primary, success, warning, danger, muted, background, grid }`). The hook resolves `'system'` to `window.matchMedia('(prefers-color-scheme: dark)').matches`.
2. Pass only values from `useChartColors()` to chart components — never hardcode hex.
3. For SVG text (axis labels, tick values) use `fill: currentColor` and inherit from the parent `<div className="text-foreground">` — this picks up the Tailwind `--color-foreground` token automatically.
4. For grid lines use `stroke="var(--color-border)"` — the Tailwind v4 token name; this renders correctly in both themes without JavaScript.

**Warning signs:**
- Chart renders correctly in light mode but axis labels are invisible in dark mode
- Bar/line color does not match the surrounding UI accent color
- Chart background is white when dark mode is active (chart ignores CSS background token)

**Phase to address:**
Charting foundation phase. The `useChartColors()` hook must exist before any chart that uses colors is implemented.

---

### Pitfall 4: SVG performance degradation with many data points — no data decimation

**What goes wrong:**
A trend chart ("weekly logged hours over last N weeks" or "burndown over sprint days") renders one SVG `<circle>` or `<path>` point per data value. If the chart is animated and the dataset grows (e.g., burndown at 1-hour granularity over a 2-week sprint = 160 data points), each re-render triggers a full SVG reconciliation. In Tauri's WebKit webview, CSS transitions on many SVG elements are significantly slower than in Chrome — this manifests as janky animation on initial mount and on data refresh.

**Why it happens:**
SVG elements are DOM nodes. React reconciles them on every render. A chart with 200 circles + a smooth animation on mount performs 200 DOM insertions with transition applied to each. WebKit's compositing layer does not accelerate SVG transforms as aggressively as Chrome's Skia backend.

**How to avoid:**
1. Disable chart entry animations in Tauri builds. Use `isAnimationActive={false}` (Recharts prop) unconditionally. The animation is a cosmetic nicety that causes jank in the webview — the data is always available immediately from the cache.
2. Apply data decimation for high-frequency data: for a 14-day burndown with hourly data, sample to one point per day. The `reduceDataPoints(data, maxPoints: number)` utility (Largest-Triangle-Three-Buckets algorithm) is worth implementing once and using for all trend charts.
3. Prefer `<Line>` with `dot={false}` over `<Scatter>` — rendering a path without per-point circles is dramatically faster.
4. Keep total SVG element count per chart below 150. If a dataset would exceed this, apply decimation before passing to the chart component.

**Warning signs:**
- Chart entry animation stutters on macOS Tauri but not in browser dev server
- Profiler shows >16ms render for the chart component on mount
- CPU usage spikes to 100% briefly when navigating to the Dashboard page

**Phase to address:**
Dashboard redesign phase (when trend/burndown charts are implemented). Animations disabled by default from the first chart — retrofitting this after user complaints is harder.

---

### Pitfall 5: Bundle bloat from importing full chart library — no tree-shaking

**What goes wrong:**
Chart libraries are large. Recharts is ~350 KB pre-gzip; nivo is modular but its peer dependency D3 adds another ~200 KB. A naive import (`import { LineChart, BarChart, ... } from 'recharts'`) pulls in the entire library even if only two chart types are used, because chart libraries often have imperfect tree-shaking (shared internal `Recharts` class for all chart types). For Taskflow (portable desktop app with bundle-size sensitivity), adding ~300 KB to the main bundle is unacceptable.

**Why it happens:**
Chart libraries commonly put multiple chart type classes in a single module. Even if only `LineChart` is imported, the bundler cannot statically analyze that `BarChart` is unused when they share an internal `RechartsChart` base class.

**How to avoid:**
1. Import charts only via the route chunk — the Dashboard route is already lazy-loaded (`v1.7` route-level code splitting). Any chart component that lives inside `src/routes/dashboard/` is already in the Dashboard chunk and not in the main bundle. Verify this with `rollup-plugin-visualizer` (already installed per PROJECT.md) after adding the library.
2. Never import a chart component from a shared `components/ui/` file that is imported by the main bundle.
3. Choose Recharts over nivo for this reason: Recharts ships as a single package with good-enough tree-shaking for 2 chart types; nivo requires installing `@nivo/line`, `@nivo/bar` etc. separately but pulls D3 as a peer dep which is large. Recharts gzip size for 2 chart types is ~70–90 KB — acceptable for the Dashboard-only chunk.
4. Run `npm run build && npx rollup-plugin-visualizer --open` after installing to verify the chart library is not in the vendor/main chunk.

**Warning signs:**
- `rollup-plugin-visualizer` shows chart library in `vendor` or `main` chunk (not dashboard chunk)
- Initial app load time increases
- The `src/components/ui/` directory has a chart component import

**Phase to address:**
Charting foundation phase. Verify chunk placement before implementing the first chart, not after the Dashboard is complete.

---

### Pitfall 6: Fetch-once page-cap for "My Tasks = all my assigned issues" — the known recurring bug

**What goes wrong:**
The recurring "fetch-once page-cap" pattern (memory: project_fetch_once_pagecap_pitfall): a single JQL search with `maxResults=50` (or whatever default) is fired, the first page is returned, and client-side filtering is applied to produce "my tasks". Users with more than 50 assigned issues see a truncated list silently. There is no indication that the list is incomplete.

"My Tasks" is a prime candidate to repeat this mistake because the temptation is to reuse the existing `fetchSprintIssues(projectKey, assignedToMe=true)` (which already paginates correctly via `fetchAllSearchPages`), but scope the results to just the current sprint. A developer might instead write a simpler, non-paginated call with `sprint in openSprints() AND assignee = currentUser()` and `maxResults=50` and call it done.

**Why it happens:**
`fetchAllSearchPages` exists in `jira.ts` and loops until `startAt >= total` with `PAGE_SIZE = 200`. But new code for "all assigned issues" across sprints (the scope toggle: "current sprint vs all assigned") may not use this helper. The `all assigned` scope requires a JQL like `project = X AND assignee = currentUser() AND statusCategory != Done` with no sprint filter — and that query can return hundreds of issues for an active developer.

**How to avoid:**
1. All new JQL searches for My Tasks must go through `fetchAllSearchPages` — no single-page `maxResults` call.
2. The "all assigned" scope must use a proper server-side JQL: `project = ${projectKey} AND assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`. Do not fetch a capped page of "all sprint issues" and filter client-side for the current user.
3. For the scope toggle (current sprint / all assigned): implement as two separate named query functions (`fetchMyCurrentSprintIssues` / `fetchAllMyOpenIssues`), each calling `fetchAllSearchPages`, so there is no temptation to "just filter the sprint result client-side".
4. Add a pagination assertion test: given a mock `total: 250, issues: [50 items]`, the fetch function must loop and return all 250 items.

**Warning signs:**
- My Tasks page shows exactly 50 issues regardless of how many are assigned
- Issues assigned before the current sprint do not appear in "all assigned" scope
- `total` in the network response is larger than the `issues` array length on first page

**Phase to address:**
My Tasks page phase. The `fetchAllMyOpenIssues` function must be written with `fetchAllSearchPages` from the first commit — not retrofitted.

---

### Pitfall 7: N+1 fetches for per-task MR health / time tracking / flags in My Tasks rows

**What goes wrong:**
My Tasks rows display rich data: MR health badge (linked MR from GitLab), time tracking bar (Tempo worklogs), and flag status. A naive implementation fetches this per-row data individually: one `useQuery` per issue for its MR, one for its worklogs, one for its flags. With 30 issues in My Tasks, this is 90 concurrent queries on page load. The GitLab API and Tempo API have rate limits; Jira's network overhead is non-trivial on a slow on-premise instance.

This mirrors the AIO defect N+1 problem solved in v1.8 Phase 58 (`per-defect-key useQuery dedup eliminating N+1 Jira fetches`).

**Why it happens:**
Row components that own their own data fetching are architecturally clean but produce N requests. The existing sprint board has the same architecture — but the sprint board only shows current-sprint issues (bounded to ~20-40) and MR linking is done via cached GitLab MR list, not per-issue fetch.

**How to avoid:**
1. **MR health**: reuse the existing `useGitLabMRs` query (already a list-level query) and derive per-issue MR health client-side by matching on `PROJ-XXX` in MR titles — no per-row fetch. This is how the sprint board already works.
2. **Time tracking**: Tempo worklogs per-issue should be pre-loaded at the page level for all issue keys in My Tasks, not per-row. Use a single `fetchWorklogs` call with the full list of issue keys. The existing `WorklogsPage` fetch already does this for a date range.
3. **Flags**: flag status is available in the Jira issue `fields` from the main My Tasks JQL search (the `flagged` field on `GhIssue` is returned by allData, and REST v2 returns `customfield_10021` for flag). No extra fetch needed if the field is included in the JQL `fields=` parameter.
4. Add TanStack Query `enabled: false` for any per-row data that is not yet needed (outside viewport). The virtualizer can signal which rows are visible; only enable queries for visible rows.

**Warning signs:**
- DevTools network tab shows 30+ simultaneous API calls on My Tasks page load
- Tempo API returns 429 Too Many Requests
- My Tasks page load time is proportional to the number of assigned issues

**Phase to address:**
My Tasks page phase. Define the data loading architecture (page-level vs row-level queries) before implementing the row component.

---

### Pitfall 8: Subtasks vs stories double-counting in stat tiles and sprint health chart

**What goes wrong:**
The Dashboard stat tiles ("stories completed this sprint", "story points done") and the sprint health chart (points by status) must count either stories or subtasks — not both. Jira DC GreenHopper `allData.json` returns all issue types in `issuesData.issues`. If the stat code iterates all issues and sums `estimateStatistic.statFieldValue.value`, subtask story points are added on top of their parent story's story points, inflating the count. A story with 5 SP and 3 subtasks of 1 SP each would count as 8 SP instead of 5.

This is a known pattern: v1.1 specifically notes "Workload correctly counts story points per assignee (subtasks excluded)" and Phase 59/v1.9 removed the Workload page that had this logic. The new Dashboard charts must re-implement it correctly.

**Why it happens:**
The GH `allData.json` issue list does not distinguish stories from subtasks at the top level — both have an `estimateStatistic`. Code that sums SP without checking `parentId` (null for stories, present for subtasks) double-counts. The adapter in `adapter.ts` produces `JiraIssue` with `fields.issuetype.subtask: boolean` — using this boolean to exclude is the correct filter.

**How to avoid:**
1. All SP aggregation for Dashboard metrics must filter to `!issue.fields.issuetype.subtask` (or `!issue.parentId` in GH types) before summing.
2. For "stories completed this sprint": count only issues where `issuetype.subtask === false && done === true`.
3. For the points-by-status chart (e.g., "In Progress: 13 SP, Done: 21 SP"): group by `statusId` from the entity map, exclude subtasks from SP sum, but do include subtask count separately if a "subtask count" metric is desired.
4. Write a unit test with a fixture that includes a parent story with SP=5 and two subtasks with SP=2 each; assert the total is 5, not 9.

**Warning signs:**
- Sprint health chart shows more story points than the sprint velocity report in Jira itself
- "Points done" stat tile is 40% higher than expected
- Adding subtasks to a story increases the dashboard SP count without any story changes

**Phase to address:**
Dashboard redesign phase (stat tiles + sprint health chart). The anti-double-count filter must be in the aggregation function, tested before the chart is wired up.

---

### Pitfall 9: Timezone bug in "this week" / day bucketing for trend charts and logged-hours

**What goes wrong:**
A "weekly logged hours" trend chart groups Tempo worklog entries by calendar week. If bucketing uses `new Date(worklog.started).toISOString().slice(0, 10)` to get the date key, the conversion to UTC shifts the calendar day for users east of UTC (e.g., UTC+2: a worklog logged at 23:00 local time becomes 21:00 UTC the previous day, landing in the wrong week bucket). A developer in Bratislava logging work on Monday evening would see it attributed to Sunday's bucket.

This is the exact pattern Taskflow already documents and solves: `standup-date.ts` explicitly says "NEVER use toISOString() ... use local calendar components", and Phase 62/v1.9's `WorklogsPage` uses `.slice(0, 10)` on the API timestamp string (which is already a local-date string from Tempo: `2026-06-14T09:00:00`).

**Why it happens:**
New charting code written without awareness of the standing rule (documented in `standup-date.ts` but not enforced at the linter level). The instinct is to normalize to UTC for comparison, but Tempo returns worklog `started` as a local-timezone ISO string. Calling `toISOString()` on `new Date(tempo_started)` converts to UTC and shifts the date.

**How to avoid:**
1. For any date bucketing in chart aggregation functions, always use `tempo_started_string.slice(0, 10)` (Tempo timestamps are `YYYY-MM-DDTHH:mm:ss` in the user's local time — slicing is safe). Do not construct a `new Date()` from the string and then re-serialize.
2. For "this week" bucketing: compute the week start using local year/month/day components via `toLocalDateString()` from `standup-date.ts`. Do not use `startOfWeek(new Date(...), { weekStartsOn: 1 })` from a date library if it internally uses UTC normalization.
3. Import `toLocalDateString` from `standup-date.ts` (or a shared `lib/date-utils.ts`) into any new chart aggregation function. Make the dependency explicit.
4. Add a unit test: a worklog with `started: "2026-06-14T23:00:00"` must bucket to week of `2026-06-14`, not `2026-06-13`.

**Warning signs:**
- A worklog logged "today" appears in "yesterday's" week bucket for team members in UTC+1 or later
- The "hours this week" stat shows fewer hours on Monday than expected (Monday evening hours shifted to last week)
- Tests pass (jsdom defaults to UTC) but the Tauri build shows wrong buckets

**Phase to address:**
Dashboard redesign phase (trend/logged-hours chart). The rule must be in the aggregation function's code comments, and the unit test must exist before the function is considered done.

---

### Pitfall 10: Velocity trend promises historical sprint data Jira DC cannot cheaply provide

**What goes wrong:**
A "personal velocity trend — points over last N sprints" chart requires knowing: (a) which sprints have completed, (b) which issues were completed in each, and (c) their SP values. The GreenHopper API's `allData.json` returns **current-sprint** issues only. There is no confirmed endpoint in Taskflow's existing service layer that returns closed-sprint issues with SP. The Jira DC REST API has `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed` to list closed sprints, and `GET /rest/agile/1.0/sprint/{sprintId}/issue` to get issues per sprint — but `fetchAllSearchPages` on `sprint = SPRINT_ID AND assignee = currentUser()` for N past sprints is N serial requests (one per sprint), each potentially returning 50-200 issues.

PROJECT.md explicitly lists "Historical analytics / burndown charts — no daily-use value; complex data pipeline; LinearB/Swarmia exist for this" as Out of Scope. A "velocity trend" is in scope, but must be honest about what data it can show.

**Why it happens:**
The feature is listed as "personal velocity trend (points over last N sprints)" in the Dashboard goal. Without verifying what data is available cheaply, an implementation may hit endpoints that require N=5 closed-sprint queries on Dashboard load — a 5-second waterfall on page mount. Alternatively, it may discover that closed-sprint issues do not carry SP in the GH response and need a second REST v2 enrichment.

**How to avoid:**
1. Before implementing velocity charts, probe the actual Jira DC endpoints in the dev environment: `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed&maxResults=5` — verify it returns sprint objects with `startDate`/`endDate`; then `GET /rest/agile/1.0/sprint/{sprintId}/issue?maxResults=50&fields=customfield_10016,issuetype,status` — verify SP field is present.
2. Limit to last 5 completed sprints maximum. Five serial requests at ~400ms each = 2 seconds max. Pre-fetch in the background (not in the Dashboard component's critical path) using TanStack Query `staleTime: 5min` so repeat Dashboard visits are instant.
3. If closed-sprint SP data is unavailable or unreliable (e.g., issues moved between sprints lose their sprint association), scope down to "completed stories count per sprint" instead of SP — this data is still valuable and always available.
4. Make the velocity widget an independently-loading section (same pattern as Standup Notes: each section loads and degrades independently). If the closed-sprint fetch fails or times out, show "Velocity data unavailable" rather than blocking the entire Dashboard.

**Warning signs:**
- Dashboard page takes >3s to load because velocity fetch is awaited before render
- Closed-sprint issues return empty SP fields (SP is only set on open-sprint issues in some DC configs)
- The velocity endpoint requires a `boardId` that is not available in the existing auth store

**Phase to address:**
Dashboard redesign phase. The probe of closed-sprint endpoints must happen at phase kickoff (before any velocity chart code is written). Descope to "count of completed stories" if the probe fails.

---

### Pitfall 11: Stale-while-revalidate flicker on My Tasks — visible re-layout when data arrives

**What goes wrong:**
My Tasks has three groupings behind a toggle (My Day / By Status / By Sprint & Parent). With `gcTime: Infinity` and `staleTime` tuned for session persistence (v1.7 pattern), navigating back to My Tasks shows cached data instantly, then re-fetches in the background. When the new data arrives, the list may regroup (e.g., a status changed since last visit), causing a visible re-layout — rows jump position mid-view. This is more jarring on My Tasks than on a sprint board because the user may have scrolled to a specific row.

**Why it happens:**
`staleTime: Infinity` means the background refetch fires and updates the cache, which triggers a re-render of the grouped list. Unlike a sprint board (cards in columns, easier to scan post-reflow), My Tasks is a flat-ish sorted list where row position changes feel disorienting.

**How to avoid:**
1. Use `staleTime: 2 * 60 * 1000` (2 minutes) for the My Tasks query rather than `Infinity`. 2 minutes is recent enough to feel live without constant background churn.
2. On background revalidation, sort-stabilize the list: only re-sort visible rows when the user has not scrolled or has scrolled back to top. Use a ref to track scroll position; if the user is mid-list, defer the sort-resort until they scroll back to top or explicitly refresh.
3. Show a "Refreshed" badge (similar to `StaleDataBanner` pattern in existing views) rather than silently re-sorting under the user's cursor.
4. For the "My Day" smart-sort grouping (the most complex sort), ensure the sort key is deterministic: if two issues have the same priority, use `key` (alphabetic) as a tiebreaker. Non-deterministic sort causes different order each refresh even if no data changed.

**Warning signs:**
- Rows visibly shuffle positions on returning to My Tasks
- An issue the user was looking at disappears from view after a background refresh
- "My Day" sort order differs between page loads with identical data

**Phase to address:**
My Tasks page phase. The sort-stabilization strategy must be defined before the grouping/sorting logic is implemented.

---

### Pitfall 12: Cross-sprint scope correctness — "all assigned" includes wrong-sprint issues

**What goes wrong:**
The My Tasks scope toggle includes "current sprint vs all assigned". The "all assigned" JQL (`assignee = currentUser() AND statusCategory != Done`) correctly returns all open assigned issues. But My Tasks rows display "Sprint & Parent" grouping. When an issue is assigned to the current user but belongs to a different (future) sprint, it appears in My Tasks under its sprint name — which may confuse users expecting to see only their work.

A subtler bug: `sprint in openSprints()` in Jira DC returns only the **active** sprint, not future sprints. An issue added to a future sprint is not in `openSprints()`. If the "current sprint" scope uses `sprint in openSprints()` but "all assigned" uses a different JQL, the two scopes will have different data shapes (one has a sprint field, one may not).

**Why it happens:**
`sprint in openSprints()` is Jira DC's way of querying the active sprint. Future-sprint issues have a sprint ID but it is not "open". The JQL `assignee = currentUser() AND statusCategory != Done` returns future-sprint issues too, but they have `sprint.state = "future"`. The grouping logic that reads `sprint.name` to bucket issues will create separate buckets for future sprints, which may not be intended.

**How to avoid:**
1. For the "all assigned" scope, explicitly decide: include future-sprint issues or not. The recommendation is to exclude them (add `AND sprint in openSprints() OR sprint is EMPTY` to the JQL) to avoid showing issues the user will not work on imminently.
2. For the "By Sprint & Parent" grouping, handle missing/null sprint gracefully: issues with no sprint should bucket into "No Sprint / Backlog" rather than crashing.
3. Document the scope definition in a code comment: "all assigned = `project = X AND assignee = currentUser() AND statusCategory != Done AND (sprint in openSprints() OR sprint is EMPTY)`". This makes the intent explicit and prevents future modifications from drifting.

**Warning signs:**
- "By Sprint & Parent" grouping shows 3-4 sprint buckets when user expects 1
- Issues in future sprints appear in "current sprint" scope after a sprint advances
- `sprint is EMPTY` issues throw when the grouping code accesses `issue.sprint.name`

**Phase to address:**
My Tasks page phase. The JQL scope definition for each toggle state must be written and reviewed before the fetch function is implemented.

---

### Pitfall 13: Polling cost — multiple Dashboard widgets all refetching on short intervals

**What goes wrong:**
The Dashboard redesign has stat tiles, a sprint health chart, a trend graph, MR review queue, and activity/releases — potentially 5-7 independent `useQuery` hooks. If each uses the default polling interval (60s for dashboard-level queries per v1.7), or worse, its own polling interval, the Dashboard route fires 5-7 Jira/GitLab/Tempo requests every 60 seconds. On a slow on-premise Jira, each request takes 400-1200ms; 7 concurrent requests per minute is heavy.

The existing v1.9 minimal Dashboard (gradient hero + 3 cards) was deliberately minimal to avoid this. The new Dashboard is heavier.

**Why it happens:**
Each `useQuery` with `refetchInterval` runs its own timer. Multiple widgets that each own their fetch queries fire independently. The v1.7 "single poll coordinator (TanStack Query)" pattern works when queries share the same key, but different widget queries have different keys.

**How to avoid:**
1. Consolidate Dashboard data: the sprint health chart and stat tiles both read from the same `['gh-all-data', boardId]` GreenHopper query. One `useQuery` at the Dashboard level fetches `allData.json` once; widgets derive their views from the same result. No per-widget fetch for sprint data.
2. MR review queue reads from the existing GitLab MRs query (already session-cached). No new polling.
3. Activity/releases reads from fix versions (existing `fetchFixVersions` query, `staleTime: 5min`).
4. Tempo logged hours reads from the Tempo worklogs query, already used in `WorklogsPage`.
5. Use `useIsActiveRoute` (existing hook, v1.7) to pause all Dashboard polling when the user is on a different route.
6. Net result: Dashboard should add at most 1-2 new queries beyond what is already cached.

**Warning signs:**
- Network waterfall on Dashboard shows 6+ parallel API calls every 60 seconds
- CPU usage elevated (polling timers firing) when user is not on the Dashboard tab
- On-premise Jira Tempo API returns 429 (rate limit) after a few minutes on the Dashboard

**Phase to address:**
Dashboard redesign phase. Define the query consolidation plan (which widgets share which queries) before implementing any widget.

---

### Pitfall 14: React Compiler + dense Dashboard page — unexpected re-render storms on metrics updates

**What goes wrong:**
A Dashboard with 5-7 widgets, each receiving data props from a parent query, can trigger a re-render storm: when one query invalidates (e.g., sprint data refreshes), all widgets that receive derived data from that query re-render simultaneously. React Compiler auto-memoizes at the IR level, but if the dashboard parent component re-derives all widget props in a single render pass (e.g., filtering + grouping + sorting inside the component body), the compiler's memo boundaries may not prevent expensive re-computation in children.

The Compiler handles pure value derivation well, but if a widget component performs a non-trivial transform (e.g., chart data aggregation with subtask exclusion, SP summing, date bucketing), and that transform receives a new object reference each time the parent re-renders (even if the values are identical), the compiler cannot optimize across the parent-child boundary.

**Why it happens:**
React Compiler's memoization is intra-component. If the parent passes `sprintIssues.filter(...).map(...)` as a prop on every render, the child receives a new array reference every time — and without `React.memo` (which the compiler replaces with its own mechanism), the child re-renders regardless of structural equality. The compiler's generated memo only memoizes values that are provably stable at the IR level.

**How to avoid:**
1. Move data derivation (aggregation, SP summing, date bucketing) into each widget component's own scope, not the Dashboard parent. The compiler can then memo the derivation independently.
2. Alternatively, move derivation to the query selector: `useQuery({ ..., select: (data) => aggregateForStatTiles(data) })`. The `select` function result is memoized by TanStack Query structurally (using `shallowEqual`), so the widget only re-renders when the selected shape changes.
3. For the chart data derivation specifically (the most expensive): use TanStack Query `select` to pre-aggregate before the chart component receives it.
4. Test Dashboard render count: with React DevTools Profiler, verify that refreshing the sprint data query triggers at most one re-render per widget, not cascading re-renders.

**Warning signs:**
- React Profiler shows 8-10 component re-renders on a single query cache update
- Dashboard becomes sluggish when sprint data is first loaded
- Profiler "flame chart" shows the Dashboard parent re-rendering children serially

**Phase to address:**
Dashboard redesign phase. Use `select` on data-heavy queries from the first Dashboard widget. Verify with Profiler before marking the phase complete.

---

### Pitfall 15: Chart accessibility — SVG has no keyboard navigation or screen reader data

**What goes wrong:**
Charts rendered as pure SVG are invisible to screen readers (an `<svg>` with no `role` or `<title>` reads as nothing, or as a meaningless stream of text). A bar chart showing "sprint points by status" has no accessible alternative for users with visual impairments. While Taskflow's team is small, this becomes a problem if the chart is the only representation of the data — a user who cannot distinguish bar heights by color has no fallback.

**Why it happens:**
Chart libraries produce SVG without ARIA by default. Developers add chart visuals but skip the accessibility layer because the visual looks complete.

**How to avoid:**
1. Every chart must have a `<title>` element inside the `<svg>`: `<title>Sprint points by status: To Do 8 SP, In Progress 13 SP, Done 21 SP</title>`. Recharts supports `customized` prop for injecting SVG children.
2. Supplement every chart with a data table (visually hidden with `sr-only` or collapsible) that presents the same data in tabular form. This is the WCAG 1.1.1 non-text content requirement.
3. Add `role="img"` and `aria-label` on the `<svg>` element.
4. Color-blind users: ensure chart palettes use both color AND shape/pattern differentiation (e.g., dashed vs solid lines, filled vs unfilled bars). Never use red/green as the only differentiator for "done vs blocked".

**Warning signs:**
- VoiceOver (macOS) reads the Dashboard chart area as "group" with no label
- Color is the only visual differentiator between chart series
- No tabular fallback for chart data

**Phase to address:**
Charting foundation phase. The `<title>` + `aria-label` pattern must be in the base chart wrapper. Tabular fallback can be deferred to a polish pass, but must be noted as a known gap.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode hex colors in chart props | Simplest first pass | Charts ignore dark/light token switch; must be audited every theme change | Never — use `useChartColors()` hook from day one |
| Use `ResponsiveContainer height="100%"` in a flex parent | Feels natural, matches docs | Renders at 0×0 in WebKit; silent invisible chart | Never — always set explicit pixel height on wrapper |
| Skip `isAnimationActive={false}` | Charts look polished | Animation jank in WebKit webview; CPU spike on Dashboard mount | Never in Tauri build — animations never add value here |
| Import all chart types at route root | Simple import | Chart library in main bundle not Dashboard chunk; ~300 KB bundle regression | Never — chart imports must stay inside lazy-loaded route files |
| Single `useQuery` for all My Tasks data then filter client-side | Less code | Fetch-once page-cap; silently truncated results for users with >200 issues | Never — all My Tasks queries must use `fetchAllSearchPages` |
| Sum SP across all issue types for stat tiles | One line of code | Subtask + story double-counting inflates velocity metric by 20-40% | Never — always filter `!issuetype.subtask` before summing |
| Use `toISOString().slice(0, 10)` for date bucketing | Familiar JS pattern | Off-by-one date error for users in UTC+ timezones | Never — use local calendar components (`standup-date.ts` pattern) |
| Implement velocity trend without probing closed-sprint endpoints | Looks complete | Endpoint may not exist or may be slow; Dashboard blocks on a 5-request waterfall | Never — probe endpoint before implementing the chart |
| One polling interval per widget | Simple per-widget architecture | 6+ Jira requests per minute on Dashboard; rate limits | Never — consolidate to shared parent queries |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira DC JQL / My Tasks | Using `sprint in openSprints()` + `maxResults=50` once, filtering client-side | Separate `fetchAllMyOpenIssues` + `fetchAllSearchPages`; proper `statusCategory != Done` JQL |
| Jira DC JQL / subtask scope | Including subtasks in SP sum for Dashboard metrics | Filter `fields.issuetype.subtask === false` before any SP aggregation |
| Jira DC JQL / sprint scope | `sprint in openSprints()` returns only active sprint; future sprints excluded | Explicitly decide scope: add `OR sprint is EMPTY` or exclude future sprints from "all assigned" |
| GreenHopper allData.json / velocity | Assuming it contains past-sprint history | `allData.json` is current sprint only; closed-sprint data requires `GET /rest/agile/1.0/sprint/{id}/issue` — probe before implementing |
| Tempo worklogs / date bucketing | `new Date(tempo.started).toISOString().slice(0, 10)` | `tempo.started.slice(0, 10)` — Tempo timestamps are local-time ISO strings; skip the Date constructor |
| Chart library / WebKit | `ResponsiveContainer` with `height="100%"` in flex parent | Explicit `<div style={{ height: 260 }}>` wrapper; measure width with `useLayoutEffect` + `offsetWidth` |
| Chart library / React Compiler | Libraries using D3 imperative animation (`selection.transition()`) | Use pure React SVG chart library (Recharts); run compiler healthcheck before committing to the library |
| Chart library / dark mode | Hardcoded hex color props | `useChartColors()` hook reading theme from settings store; SVG text uses `fill: currentColor` |
| GitLab / MR health in My Tasks rows | Per-row `useQuery` for MR data | Derive MR health client-side from existing page-level `useGitLabMRs` cache (same as sprint board) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Chart entry animations in WebKit | Jank on Dashboard mount; CPU spike | `isAnimationActive={false}` unconditionally in Tauri builds | Every chart render on WebKit |
| SVG with 150+ elements (no decimation) | >16ms render in Profiler; visible stutter | Decimate to ≤100 points; use `dot={false}` on line charts | Any trend chart with hourly Tempo data |
| 5-7 independent polling `useQuery` on Dashboard | 5+ Jira requests per 60s | Share `allData.json` query; use `select` for derived views | Dashboard with any background data refresh |
| `fetchAllMyOpenIssues` without `fetchAllSearchPages` | 50-issue cap; silent truncation | Always use `fetchAllSearchPages` (PAGE_SIZE=200) | Users with >50 assigned open issues |
| Per-row MR/Tempo queries in My Tasks (N+1) | 30+ simultaneous API calls on load | Page-level data fetch + client-side derivation per row | My Tasks with ≥10 rows |
| Chart library not in Dashboard lazy chunk | +300 KB main bundle size | Verify with `rollup-plugin-visualizer` after install | First time chart library is imported outside a lazy route |
| Dashboard data derivation in parent component body | Compiler cannot memo across parent-child boundary; re-render storm | Move aggregation into `select` on TanStack Query; or into child component scope | Any Dashboard query cache update |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| My Tasks list re-sorts under scrolled cursor on background refresh | User loses context mid-list; disorienting | Defer re-sort until user returns to top; show "Refreshed" badge |
| Stat tile shows inflated SP (subtask double-count) | User sees wrong sprint velocity; distrust of data | Filter `!issuetype.subtask` before summing; add unit test with double-count fixture |
| Velocity chart shows "no data" because endpoint probe was skipped | Feature looks broken on first launch | Probe closed-sprint endpoint at phase kickoff; degrade to "N/A" with explanation |
| Empty chart containers on first load (height=0 before resize) | Chart area appears broken; no loading state | Use skeleton placeholder at explicit height while query is loading |
| Chart tooltip shows raw SP values without units | "13" means 13 SP but users see a bare number | Tooltips always include unit label: "13 SP", "2h 30m" |
| "All assigned" scope shows future-sprint issues | User confused by issues they won't work on soon | Scope JQL to `sprint in openSprints() OR sprint is EMPTY` |
| MR health badge missing on most My Tasks rows | Users assume MRs exist and are failing | Only render MR badge when a linked MR is confirmed; show nothing (not a broken icon) when no MR |

---

## "Looks Done But Isn't" Checklist

- [ ] **Charting foundation:** `rollup-plugin-visualizer` confirms chart library is in the Dashboard chunk, not vendor/main
- [ ] **Charting foundation:** React Compiler healthcheck passes for the chosen library — no warning in CI
- [ ] **Charting foundation:** `useChartColors()` hook exists and is used for all chart color props; no hardcoded hex
- [ ] **Charting foundation:** All chart wrappers have explicit pixel height; `height="100%"` is not used
- [ ] **Charting foundation:** `isAnimationActive={false}` is set on all chart components
- [ ] **My Tasks / pagination:** `fetchAllMyOpenIssues` uses `fetchAllSearchPages`; test with `total: 250, firstPageSize: 50` fixture asserts 250 results
- [ ] **My Tasks / N+1:** DevTools network tab on page load shows ≤3 API requests, not one per row
- [ ] **My Tasks / scope:** "All assigned" JQL does not include future-sprint issues (or explicitly includes them by product decision — documented in code)
- [ ] **Dashboard / subtask counting:** SP aggregation unit test: story(5 SP) + 2 subtasks(2 SP each) = 5 SP total, not 9
- [ ] **Dashboard / date bucketing:** Unit test: Tempo worklog `started: "2026-06-14T23:00:00"` buckets to `2026-06-14`, not `2026-06-13`
- [ ] **Dashboard / velocity:** Closed-sprint endpoint probed in dev environment before chart is implemented; probe results documented
- [ ] **Dashboard / polling:** `useIsActiveRoute` hook applied to Dashboard; network tab shows zero requests when user is on Backlog or Sprint Board route
- [ ] **Dashboard / accessibility:** Every chart SVG has `role="img"`, `aria-label`, and a `<title>` element with text summary of the data
- [ ] **WebKit sizing:** Chart renders correctly in macOS Tauri build (not just in browser dev server) — manual smoke test on real Tauri window

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Chart library fails React Compiler healthcheck | HIGH — library swap required | Switch to Recharts (pure React SVG); rewrite chart components; 1-2 days |
| Chart renders at 0×0 on WebKit | MEDIUM | Add explicit-height wrapper div; replace `ResponsiveContainer height="100%"` with `useLayoutEffect` width measurement; ~2 hours per chart |
| Hardcoded hex colors (theme not followed) | MEDIUM | Introduce `useChartColors()` hook; replace all hardcoded props; ~4 hours |
| Subtask SP double-counting in stat tiles | LOW | Add `.filter(i => !i.issuetype.subtask)` in aggregation; 30-minute fix; but requires re-testing all SP metrics |
| My Tasks page-cap (50-issue truncation) | MEDIUM | Swap fetch function to use `fetchAllSearchPages`; existing helper is tested; ~1 hour code + UX notice of "Showing all N issues" |
| Timezone date bucket bug | MEDIUM | Replace `toISOString().slice(0, 10)` with `slice(0, 10)` on the raw Tempo string; test all chart aggregations; ~2 hours |
| Velocity chart built before endpoint probe — endpoint unavailable | HIGH | Descope velocity chart to "stories completed count" per sprint; or remove widget from v1.13; cannot be fixed without data |
| 6+ polling queries per Dashboard | MEDIUM | Consolidate to shared `allData.json` parent query + widget `select` derivation; 3-4 hour refactor |
| Chart library in main bundle (not Dashboard chunk) | LOW | Move import to inside lazy-loaded route file; ~30-minute fix + verify with visualizer |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Chart 0×0 sizing on WebKit | Charting foundation | Manual smoke test in macOS Tauri build; DevTools confirms chart SVG has non-zero width/height |
| React Compiler incompatibility | Charting foundation | `npx react-compiler-healthcheck` passes with the chosen library; data prop change triggers chart re-render |
| Dark/light theme not followed | Charting foundation | Toggle theme in settings; chart colors update immediately without page reload |
| SVG animation jank on WebKit | Charting foundation | `isAnimationActive={false}` present in code review; no animation visible on Dashboard mount |
| Bundle bloat | Charting foundation | `rollup-plugin-visualizer` output reviewed; chart library absent from main/vendor chunks |
| Fetch-once page-cap on My Tasks | My Tasks phase | Unit test with `total: 250` mock; manual test with developer with >50 issues assigned |
| N+1 fetches per My Tasks row | My Tasks phase | Network tab shows ≤3 requests on page load with 30+ issues |
| Subtask SP double-counting | Dashboard redesign phase | Unit test with parent+subtasks fixture; stat tile SP matches Jira sprint report |
| Timezone date bucket bug | Dashboard redesign phase | Unit test with UTC+2 locale and late-evening `started` timestamp; bucket lands on correct local date |
| Velocity chart without data proof | Dashboard redesign phase | Probe results documented; chart only implemented if endpoint returns usable data; else descoped |
| Stale-while-revalidate re-sort flicker | My Tasks phase | Navigate away and back; confirm list row order is stable; scroll position preserved |
| Cross-sprint scope bugs | My Tasks phase | "All assigned" scope: future-sprint issues confirmed absent (or present per decision, documented) |
| Dashboard polling overload | Dashboard redesign phase | Network tab shows ≤2 requests per 60s on Dashboard; `useIsActiveRoute` verified in profiler |
| React Compiler re-render storm | Dashboard redesign phase | React DevTools Profiler: ≤1 re-render per widget on sprint data cache update |
| Accessibility gaps | Charting foundation | VoiceOver reads chart `<title>` content; no "group" with no label announced |

---

## Sources

- Taskflow codebase: `src/services/jira.ts` — `fetchAllSearchPages` (line 267), `PAGE_SIZE = 200` (line 262), `fetchSprintIssuesForCurrentUser` (line 500), `fetchMySprintIssuesWithTeam` (line 471)
- Taskflow codebase: `src/lib/standup-date.ts` — `toLocalDateString()` standing rule; `toISOString()` UTC shift warning (documented in file header)
- Taskflow codebase: `src/routes/dashboard/IssueDetailView.tsx` — `useLayoutEffect` + `offsetWidth` width measurement pattern (line 334)
- Taskflow codebase: `src/routes/dashboard/SprintBoardTab.tsx` — `ResizeObserver` guard pattern (line 313)
- Taskflow PROJECT.md: "Historical analytics / burndown charts — no daily-use value" (Out of Scope); v1.7 bundle analysis tooling; v1.9 date bucketing `.slice(0, 10)` decision
- Memory: `project_fetch_once_pagecap_pitfall` — recurring bug class; assignee-missing-users prior case
- Memory: `project_virtualized_table_zero_width_col` — WebKit 0-width column in `position: absolute` rows; explicit-px sizing fix
- Memory: `project_reactive_cache_read_badge` — `getQueryData()` non-reactive in render
- React Compiler documentation: `babel-plugin-react-compiler` incompatibility with imperative animation (Framer Motion explicitly noted in STACK.md)
- Recharts: `isAnimationActive`, `ResponsiveContainer` props — verified via Context7 `/recharts/recharts`
- Tailwind v4 dark mode: CSS custom property token system; no `tailwind.config.js` — v4 CSS pipeline only (PROJECT.md)
- Jira DC REST API v2: `GET /rest/agile/1.0/board/{boardId}/sprint?state=closed` (sprint history); `GET /rest/agile/1.0/sprint/{id}/issue` (per-sprint issue list)
- TanStack Query: `select` option for structural memoization of derived data

---
*Pitfalls research for: v1.13 Personal Workspace — charting foundation, My Tasks page, Dashboard redesign in Tauri 2 / React 19 / React Compiler / Tailwind v4 / TanStack Query*
*Researched: 2026-06-14*
