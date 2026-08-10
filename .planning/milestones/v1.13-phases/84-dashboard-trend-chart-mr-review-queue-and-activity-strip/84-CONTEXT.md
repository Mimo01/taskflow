# Phase 84: Dashboard Trend Chart, MR Review Queue, and Activity Strip - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add **three new independently-degrading sections** to the Dashboard, on top of Phase 83's stat tiles + sprint-health section:

1. **Weekly logged-hours trend chart** — a Mon–Fri bar chart of logged hours this week, Tempo-gated (`tempoEnabled`), with a fixed 8h/day target marker.
2. **MR review queue** — derived client-side from the warm `gitlab-mrs` cache: MRs awaiting my review + my open MRs with health badges. No new polling/fetch.
3. **Activity strip** — a compact recent-activity feed reusing the Standup Notes "Yesterday" query caches (Jira activity + GitLab commits), co-located with the existing next-release countdown.

WHAT this phase delivers is locked by ROADMAP §Phase 84's 4 success criteria and requirements DASH-04, DASH-05, DASH-06, DASH-07. This discussion captured only the HOW/UX/content decisions left open inside that scope. No new capabilities — new ideas go to other phases.

</domain>

<decisions>
## Implementation Decisions

### Weekly Trend Chart (DASH-04, criterion 1)
- **D-01:** Chart shows **logged-hours bars + a fixed 8h/day target marker** (reference line). NOT a logged-vs-scheduled overlay — `fetchUserSchedule` is NOT used this phase. DASH-04's "vs schedule" wording is satisfied by the static 8h target instead of a per-user Tempo capacity fetch. (Schedule overlay deferred — see Deferred.)
- **D-02:** The 8h target is a **single hardcoded named constant** (e.g. `DAILY_TARGET_HOURS = 8`) — no settings plumbing, no new settings UI. Can be lifted to a setting in a later phase if desired.
- **D-03:** **Buckets = Mon–Fri of the current week, zero-filled.** Always render all 5 weekday buckets; days with no worklogs (including future days this week) render as an empty/0 bar. Matches ROADMAP criterion 1 ("Mon–Fri, current week") literally.
- **D-04:** **Date bucketing uses the worklog `dateStarted` field (already normalized to `YYYY-MM-DD`) — never `new Date(...).toISOString()`.** This is the locked timezone-safe pattern (criterion 1 + [[project_fetch_once_pagecap_pitfall]] sibling memory on UTC date shift). The mandated unit test: a worklog with `started: "2026-06-14T23:00:00"` must bucket to `2026-06-14`, not `2026-06-15`. NOTE for planner: `fetchWorklogs` returns `dateStarted` already sliced to `YYYY-MM-DD` (see `services/tempo/worklogs.ts:53`); the test must assert the bucketing is timezone-safe end-to-end (against raw `started`-style input), per the criterion.
- **D-05:** **The trend chart is the ONE section permitted a new fetch.** The warm Standup tempo cache (`['standup','tempo',...]`) is scoped to *yesterday only*, so it cannot supply a Mon–today week range. Fire a **dedicated `useQuery`** (e.g. `['dashboard','tempo-week', jiraBaseUrl, weekStartDate, jiraUsername]`) calling `fetchWorklogs` for Mon→today when `tempoEnabled` is true. Standard `staleTime`, own loading/error state. (Scout confirmed no existing week-range Tempo cache.)
- **D-06:** When `tempoEnabled` is false, render a graceful **"Tempo not connected" empty state** (criterion 1) — not an error.

### Activity Strip (DASH-05, criterion 2)
- **D-07:** **Sources = Jira activity (`['standup','jira',...]`) + GitLab commits (`['standup','commits',...]`).** NOT jira-created, NOT mr-events. Jira activity is the core "recent Jira mentions and changelog activity" (criterion 2); commits add a dev-activity signal. mr-events excluded (redundant with the dedicated MR queue section); jira-created excluded as lower-signal.
- **D-08:** **Reuse the EXACT Standup query keys** so warm caches are shared — no duplicate network request when both Dashboard and Standup Notes have been visited in the same session (criterion 2 hard requirement).
- **D-09:** **Fetch-on-demand via shared keys.** The strip mounts its own `useQuery` with the same keys: warm → instant from cache (no request), cold → it fetches. This lets the strip work on a fresh Dashboard load while still satisfying criterion 2's "no duplicate request when both visited" (the key is shared, so a warm Standup cache is reused, not re-fetched). NOT the `enabled:false` reactive cache-read pattern — the strip must not be blank on a cold Dashboard.
- **D-10:** **Ordering = merged, newest-first.** Interleave Jira activity + commits into one timeline sorted by timestamp, most recent at top — reads as a single activity feed.
- **D-11:** **Density = compact, capped list (~5–7 items)** with a small "+N more" overflow indicator. "Strip" = tight and scannable, not a scrollable full feed. Uses the yesterday window the Standup caches already cover.

### MR Review Queue (DASH-06, criterion 3)
- **D-12:** **Two labelled groups: "Awaiting my review"** (I'm a reviewer, not author) **then "My open MRs"** (I'm the author). Matches ROADMAP §84 criterion 3 wording directly. Derived client-side from the warm `['gitlab-mrs', gitlabBaseUrl, gitlabUserId]` cache (`{ filtered, merged }` payload) — **no new polling interval or fetch** (criterion 3). Current GitLab user = `gitlabUserId` from auth store.
- **D-13:** **Health badge = the `mr-health` review status** (`needs_review` / `approved` / `changes_requested`) from the existing `['mr-health', project_id, iid]` cache — the same signal `MrHealthPanel` already shows. Reuse the warm cache; do NOT fetch pipeline/CI status or approval counts (those aren't in the current cache shape and would require new fetches — out of scope for "no new fetch").
- **D-14:** **MR rows show: title + author/project + health badge; clicking opens `web_url` in the external browser** (existing GitLab-open pattern). Compact and actionable.
- **D-15:** **Context-aware empty states** (per DASH-07, independent): empty queue (no MRs) → friendly "No MRs awaiting review" EmptyState; GitLab not configured → "GitLab not connected" state (mirrors the trend chart's "Tempo not connected").

### Layout & Releases (DASH-05)
- **D-16:** **Co-locate the activity strip with the next-release countdown** into one "Activity & Releases" section/row, literally matching DASH-05's "activity & releases section" framing. This relocates the next-release countdown element that Phase 83 retained (Phase 83 D-01) into this combined section. Reuse `DashboardReleaseCard`'s fix-versions countdown logic (`['jira-fix-versions',...]` cache).
- **D-17:** **Independent degradation for all sections** (DASH-07, criterion 4): each of the three new sections — plus Phase 83's stat tiles and sprint chart — has its own `Skeleton` / `ErrorState` / `EmptyState`. The Dashboard never goes fully blank because one section fails. Reuse shared `components/ui/` state primitives + `ChartWrapper`'s built-in state handling.

### Claude's Discretion
- **Overall section ordering / responsive layout** of the Dashboard (tiles → sprint-health → trend chart → MR queue → activity & releases). A sensible coherent default is expected (e.g. pairing charts and pairing lists on wide screens), within DASH-07 independent-degradation. User explicitly delegated this.
- Exact visual treatment of the trend-chart bars + 8h marker line (color tokens must be `var(--chart-N)` per Phase 81).
- Exact compact-row markup for activity items and MR rows.
- Component decomposition (new `WeeklyTrendChart`, `MrReviewQueue`, `ActivityStrip` components vs inline) — reuse/adapt over net-new where sensible.
- Exact "+N more" overflow affordance for the activity strip (D-11).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — DASH-04, DASH-05, DASH-06, DASH-07 (lines 38–41). NOTE: DASH-04 says "hours per day this week **vs schedule**" — per D-01 the "vs schedule" is satisfied by a fixed 8h target marker, NOT a `fetchUserSchedule` overlay (deferred). DASH-05 says "activity & releases section — recent notifications/mentions + next-release countdown" — satisfied by D-16 co-locating the activity strip with the release countdown.
- `.planning/ROADMAP.md` §Phase 84 — goal + 4 success criteria (the acceptance bar): criterion 1 mandates the timezone-safe `dateStarted`/`slice(0,10)` bucketing unit test + "Tempo not connected" empty state; criterion 2 mandates reusing the Standup Yesterday query key (no duplicate request); criterion 3 mandates client-side MR queue from `gitlab-mrs` with no new polling/fetch; criterion 4 mandates independent section degradation (DASH-07).

### Prior phase context (locked — do not re-litigate)
- `.planning/phases/83-dashboard-stat-tiles-and-sprint-health-chart/83-CONTEXT.md` — the Phase 83 Dashboard rewrite this phase extends: retained hero + release countdown (D-01), `StatTile` + `SprintHealthSection` components, warm-sprint-board cache reuse, per-section degradation (D-11). NOTE: Phase 84 D-16 relocates the release countdown that Phase 83 retained.
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — D-01..D-08: Recharts v3 + shadcn `chart` primitive, `responsive` prop (never `ResponsiveContainer`), explicit-height outer div (WebKit 0×0 guard), `isAnimationActive={false}`, `var(--chart-N)` CSS-var colors, `ChartWrapper` status-prop card API. The weekly trend chart's BarChart follows these.
- `.planning/research/STACK.md` / `.planning/research/PITFALLS.md` §1–3 — charting versions + 0×0 collapse / React Compiler / theme-token pitfalls.

### Codebase anchors — sections to extend
- `taskflow/src/routes/dashboard/index.tsx` — Dashboard root; hero (117–145), stat tiles (147–194), `SprintHealthSection` mount (196–205), `DashboardReleaseCard` mount (207–214). The three new sections are added here; the release countdown is relocated into the combined Activity & Releases section (D-16).
- `taskflow/src/routes/dashboard/StatTile.tsx` / `SprintHealthSection.tsx` — Phase 83 components (composition reference for new sections).
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — next-release fix-versions countdown (`['jira-fix-versions',activeJiraProject]` cache) to co-locate with the activity strip (D-16).
- `taskflow/src/routes/dashboard/MrHealthPanel.tsx` — existing MR summary (counts) reading `['gitlab-mrs',...]` + `['mr-health', project_id, iid]`; reference for cache shape + health-status mapping (D-12, D-13).

### Codebase anchors — data sources
- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs(baseUrl, token, usernames[], from, to)` → `TempoWorklog[]` with normalized `dateStarted` (`YYYY-MM-DD`, line 53) and `timeSpentSeconds`. Source for the weekly trend query (D-05).
- `taskflow/src/services/tempo/types.ts` — `TempoWorklog` shape (D-04).
- `taskflow/src/stores/settings.store.ts` — `tempoEnabled` (line 56, default false; selector `useSettingsStore((s) => s.tempoEnabled)`) — gates the trend chart (D-01, D-06).
- `taskflow/src/services/gitlab.ts` — `fetchReviewerMRs` (reviewer = "awaiting my review"), `fetchAuthoredMRs` (author = "my open MRs"), `GitLabMR` shape (id/iid/project_id/title/author/reviewers/state/web_url). The MR queue derives groups from the warm cache (D-12, D-14).
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — EXACT activity-strip query keys to reuse (D-07, D-08):
  - Jira activity: `['standup','jira', jiraBaseUrl, activeJiraProject, yesterdayDate, jiraUsername ?? '']` (lines 308–331)
  - GitLab commits: `['standup','commits', gitlabBaseUrl, activeGitlabProject, yesterdayDate, resolvedAccountsKey || gitlabUsername || gitlabName || '']` (lines 358–403)
  - (Tempo yesterday key for reference: `['standup','tempo', jiraBaseUrl, yesterdayDate, jiraUsername ?? '']`)
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — how these sources are shaped/rendered (compact-row reference for D-10, D-11).
- `taskflow/src/stores/auth.store.ts` — `gitlabUserId` (MR user matching), `jiraUserDisplayName`/`jiraUsername`.

### Codebase anchors — assets to reuse
- `taskflow/src/components/chart-wrapper.tsx` + `taskflow/src/components/ui/chart.tsx` — `ChartWrapper` (isLoading/error/isEmpty + explicit height) for the BarChart (D-17).
- `taskflow/src/components/ui/{skeleton,error-state,empty-state}.tsx` — per-section states (D-15, D-17).
- `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens + `--color-chart-*` aliases (both themes) for bar colors (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChartWrapper` + shadcn `chart.tsx`: weekly BarChart renders inside `ChartWrapper` with built-in loading/error/empty states + explicit height — no per-chart state boilerplate (Phase 81).
- `MrHealthPanel`: already reads `['gitlab-mrs',...]` + `['mr-health',...]` and maps the three health statuses — lift the cache-read + status logic, render as a grouped queue instead of counts (D-12, D-13).
- Standup Yesterday queries (`StandupNotesPage`): exact keys + `fetchYesterdayJiraActivity` / `fetchUserCommits` already exist — the strip reuses the keys (D-07, D-08).
- `DashboardReleaseCard`: fix-versions countdown to co-locate (D-16).
- Shared `Skeleton`/`ErrorState`/`EmptyState` primitives + `--chart-N` tokens (D-15, D-17).

### Established Patterns
- Warm-cache reuse via shared TanStack Query keys — the project's standard against redundant fetching and the fetch-once page-cap pitfall ([[project_fetch_once_pagecap_pitfall]], [[project_reactive_cache_read_badge]]). The activity strip + MR queue both follow this; the trend chart is the explicit, justified exception (D-05).
- Tempo date bucketing via `dateStarted` / `slice(0,10)`, never `toISOString()` — UTC-shift guard (standup-date pattern; criterion 1 unit test).
- Recharts: `responsive` prop + explicit-height div + `'use no memo'` in `ChartWrapper` (Phase 81; relates to [[project_virtualized_table_zero_width_col]] 0-size class).
- Per-section independent degradation (DASH-07), first applied Phase 82 D-11, continued Phase 83 D-11.

### Integration Points
- `src/routes/dashboard/index.tsx` extended with three new sections; the release countdown is relocated into a combined "Activity & Releases" section (D-16).
- New components likely under `src/routes/dashboard/` (e.g. `WeeklyTrendChart`, `MrReviewQueue`, `ActivityStrip`).
- New weekly-Tempo query (`['dashboard','tempo-week',...]`) is the only added network call (D-05).

</code_context>

<specifics>
## Specific Ideas

- Criterion 1's timezone-safe bucketing unit test is the single most test-worthy piece — write it explicitly (`started: "2026-06-14T23:00:00"` ⇒ bucket `2026-06-14`).
- Criterion 2's "no duplicate network request" is verifiable: with the strip's keys identical to Standup's, visiting Standup then Dashboard (same session) must fire zero new Jira-activity/commits requests.
- The trend chart is deliberately the ONLY section allowed a new fetch — keep the MR queue and activity strip strictly cache-derived/shared-key.
- Bar + activity colors MUST be `var(--chart-N)` tokens, not hardcoded hex.

</specifics>

<deferred>
## Deferred Ideas

- **Logged-vs-scheduled overlay** for the trend chart — DASH-04's "vs schedule" via `fetchUserSchedule` (Tempo capacity per day). Dropped this phase in favor of a fixed 8h marker (D-01). To enable later: add a second Tempo schedule query and render daily required-hours as a reference line/ghost bar.
- **Configurable daily target** — lift the hardcoded 8h constant (D-02) to a user setting with settings UI.
- **jira-created issues + MR events in the activity strip** — considered and excluded (D-07) as redundant/lower-signal; could be added if the strip feels thin.
- **Pipeline/CI status or approval-count MR badges** — excluded (D-13) because they'd require new fetches beyond the warm cache. Revisit if richer MR health is wanted (would be its own fetch/phase).
- **Internally-scrollable full activity feed** — chose compact capped list instead (D-11).

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip*
*Context gathered: 2026-06-15*
