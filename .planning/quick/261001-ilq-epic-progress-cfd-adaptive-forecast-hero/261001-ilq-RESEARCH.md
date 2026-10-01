# Quick 261001-ilq: Epic progress CFD, adaptive forecast, hero, unified tooltips - Research

**Researched:** 2026-10-01
**Domain:** Jira DC changelog fetch, throughput forecasting, Recharts 3 composition, in-app UI consistency
**Confidence:** HIGH for codebase facts and Recharts behaviour (checked in node_modules). MEDIUM for Jira DC changelog limits. The forecast maths is a design recommendation and is not tied to any external source.

<user_constraints>
## User Constraints (from CONTEXT.md)
See `261001-ilq-CONTEXT.md` `<decisions>`. Those decisions are locked: CFD + Remaining + forecast with a range band; adaptive-window forecast with states done / too early / stalled / not converging / ok; Hero + stat strip; Jira-like users; status-coloured count chips; one tooltip style; status-category colours everywhere; lazy changelog with its own key; EpicDetailSheet text-collision rule; one commit per task; no `.at`. Do not fix the fetchAllSearchPages 200-step bug.
</user_constraints>

## Summary
1. **Forecasting does not need the changelog.** Done dates (`resolutiondate` / `statuscategorychangedate`, via the existing `doneDateKey`) and scope-add dates (`created`) already come in the cheap `fetchEpicStories` payload. Only the CFD's In-Progress band needs real status history. Recommendation: compute hero, Finish, and the forecast from the cheap data, so the hero is stable and never waits on a lazy query. Use the changelog only for the CFD area shapes.
2. **The changelog can be truncated.** Jira **Cloud** caps embedded `expand=changelog` at 100 histories per issue (newest first). Jira **DC** returns `changelog.{startAt,maxResults,total,histories}` with no documented cap. Code defensively: sort histories ascending, and if `total > histories.length`, re-fetch that issue via `/rest/api/2/issue/{key}?expand=changelog&fields=status`. Even if the data is still truncated, the oldest retained transition's `fromString` / `from` tells you the status before it.
3. **Forecast design:** use an analytic normal-approximation band instead of Monte Carlo. It is deterministic, has a closed form, and is easy to test. Measure the rate **per working day**, with an EWMA whose window is `clamp(age, 3, 30)` working days. This fixes the user's complaint: the old code divided ~1 week of throughput by 4 weeks.

## Architectural Responsibility Map
| Capability | Tier | Notes |
|---|---|---|
| Status history fetch | services/jira.ts (new `fetchEpicStatusHistory`) | chunked `key in (...)`, bounded concurrency |
| Status → category map | services (reuse `fetchAllJiraStatuses`, query key `['jira-statuses']`) | already session-cached in greenhopper/transitions.ts:198 with `staleTime/gcTime: Infinity` |
| CFD series, forecast, range, states | `lib/epic-progress.ts` (pure, injected `today`) | no React, no Date.now |
| Colours | `lib/statusStyles.ts` | add a CSS-var map next to DOT_STYLES |
| Tooltip surface | new `components/ui/tooltip-body.tsx` | used by base-ui TooltipContent children and the custom chart tooltip |
| Rendering | EpicProgressSection / EpicTimeBurnup / EpicProgressCells / IssueDetailContent | |

## 1. Status history fetch

**Facts (codebase, VERIFIED):**
- The 15 s timeout applies to every `apiFetch` call (lib/apiFetch.ts:30). The standup lesson (jira.ts:939-948) is that `expand=changelog` serialises each issue's **whole** history, so the issue set must stay small. Here the set is only this epic's stories.
- `fetchEpicWorklogs` is the template to copy: key regex filter, chunks of `SUBTASK_CHUNK_SIZE=50`, `fetchAllSearchPagesConcurrent` (which steps by the server's real `maxResults`).
- `ChangelogHistory.items` (jira-changelog.ts) types only `field/fromString/toString`. Jira status items also carry `from`/`to` **status IDs** [ASSUMED, standard Jira payload]. Add `from?: string | null; to?: string | null` as optional fields. Also add `changelog?: { total?: number; maxResults?: number; histories }` to the response type.
- `fetchAllJiraStatuses` (`GET /rest/api/2/status`, returns id/name/statusCategory) is already cached under `['jira-statuses']` (JiraStatus[], session-long). Reuse that exact key and queryFn shape, since the data shape is identical. This is the cheapest reliable map: one request, already warm whenever the board or backlog has loaded.

**Recommended fetcher** `fetchEpicStatusHistory(baseUrl, token, storyKeys): Promise<Map<string, StatusTransition[]>>`:
- Filter keys with `/^[A-Z][A-Z0-9_]*-\d+$/`. Use chunks of **25** keys (half the worklog chunk, because changelog payloads are heavier). URL: `search?jql=key in (...)&fields=status,created&expand=changelog`. Run chunks through a bounded worker pool (PAGE_CONCURRENCY = 6, same pattern as the worklog top-ups), not a sequential `for await`.
- Per issue, keep only items where `field === 'status'` and map them to `{ at: created(ISO), fromId, fromName, toId, toName }`. Also keep `field === 'Epic Link'` items whose `toString` contains the epic key, as `joinedAt` (cheap, optional; see below).
- If `changelog.total > histories.length`, do a per-issue top-up through the same worker pool with `/rest/api/2/issue/{key}?expand=changelog&fields=status`. Do **not** use `/issue/{key}/changelog`: that endpoint is Cloud-only, and community reports say it errors on Server. [CITED: community.atlassian.com] (MEDIUM)
- Fail closed on search errors so the query reports isError and the UI shows the fallback. Fail open on a top-up error (keep the embedded histories).

**Category resolution** (pure function `categoryOfStatus(id, name, maps)`), in this order:
1. statusId → `['jira-statuses']` map.
2. Name → the same list.
3. Name → the current stories' `fields.status`, which carries `statusCategory` (covers the case where the status list is unavailable).
4. Default `'new'`.

**Per-story timeline:**
- `segments = [(enterDay, cat0), (t1Day, cat1), ...]`. The initial category is the category of the first transition's `from`. With no transitions, use the current category.
- Enter day = `created` (or `joinedAt` if present and later), clamped to `≤ today`.
- Convert transition timestamps with `toLocalDateString(new Date(at))` so they match the local `today`. `.slice(0,10)` would give the server-offset day; existing code uses slice for worklogs, so either pick one convention or document the choice.

**CFD sweep** (`deriveCfd(stories, history|null, metric, spKey, epicCreated, today) → {date, done, inProgress, todo, remaining}[]`):
- Axis start = `epicCreated` when valid and ≤ today, else the earliest `created`. A story created before the axis start (moved into the epic later) enters on the axis start, in whatever category its history says it had that day. This stops one ancient backlog story from stretching the axis back years. **Note:** this differs from `deriveBurnup`, which uses min(created, epicCreated). Planner: decide whether the fallback keeps old behaviour or adopts this. Recommend adopting it for both.
- Axis: daily up to 120 days. Beyond that, use step = `ceil(span/120)` days and always include today, so the axis stays at ~120-150 points.
- For each date, each story contributes `weightOf(story, metric)` (its **current** weight, a known limitation: SP edits are not replayed) to the category of its last segment with `enterDay ≤ date`. Complexity is O(stories × (segments + days)), which is trivial.
- **Fallback (history loading, error, or disabled):** created → todo; indeterminate stories → inProgress from `statuscategorychangedate`; done stories → done from `doneDateKey` (no In-Progress period). Show the note "Approximate — status history loading/unavailable".
- **Epic Link limitations (accept and document):** stories removed from the epic are invisible, because the JQL only returns current members. `joinedAt` from the `Epic Link` changelog item is a cheap improvement [ASSUMED: toString holds the epic key on DC; verify on a live instance, and skip it if not].

## 2. Forecast algorithm (pure, `lib/epic-forecast.ts` or inside epic-progress.ts)

**Input:** a per-day series built from the **cheap data**:
- `doneAdded[d]`: sum of the weights of stories whose `doneDateKey == d`.
- `scopeAdded[d]`: sum of the weights of stories whose enter day is `d`.
- `R` = total − done (remaining in the active metric).
- Time mode: `logged[d]` = daily worklog seconds, and `R = deriveTimeTotals().remaining`.

**Constants:** `MIN_WINDOW=3`, `MAX_WINDOW=30` working days (6 weeks), `STALL_WD=10` working days, `Z=1.28` (80 % band), `MIN_EVENTS=2`.

Steps:
1. **done:** all stories are in the done category (count mode). If `R ≤ 0` but open stories are unestimated in SP mode, return `ok` with finish = today plus a "Remaining unestimated" note.
2. `firstActivity` = the earliest of: first done date, earliest `statuscategorychangedate` of indeterminate stories, first worklog (time mode). If there is none → **too-early** ("No work started yet").
3. `age` = working days in [firstActivity, today]. `W = clamp(age, MIN_WINDOW, MAX_WINDOW)`. The window is the last W working days ending today. Weekend completions are added to the following working day's sample.
4. **Weights:** EWMA with half-life `h = max(2, W/3)` working days. Day i (0 = today) gets `w_i = 0.5^(i/h)`.
   - `μ_d = Σ w_i·done_i / Σ w_i`
   - `μ_s = Σ w_i·scopeAfter_i / Σ w_i`. Here `scopeAfter_i` counts only additions **after** the firstActivity day, and is set to 0 when `age < 5`, so initial grooming in a 3-day-old epic is not mistaken for growth.
   - Net series: `y_i = done_i − scopeAfter_i`, with `μ = μ_d − μ_s`.
   - `σ² = Σ w_i (y_i − μ)² / Σ w_i`.
   - Small-sample inflation: `σ ← σ·(1 + 2/W)`, plus a floor `σ ≥ 0.15·μ` so the band never collapses.
5. **too-early:** fewer than `MIN_EVENTS` completions (or worklog days in time mode) since firstActivity, **and** `age < STALL_WD`.
6. **stalled:** working days since the last completion (last worklog in time mode) ≥ `STALL_WD`, **and** `age ≥ STALL_WD`. This is checked before not-converging.
7. **not-converging:** `μ ≤ 0`, or `μ < 0.1·μ_d`. Explanation text: "Scope grew X/wk vs Y/wk done".
8. **ok:**
   - Likely `n = R/μ` working days.
   - Pessimistic and optimistic `n` solve `nμ ∓ Zσ√n = R` with `s = √n`: `s± = (±Zσ + √(Z²σ² + 4μR)) / (2μ)`. `n_pess = s₊²`, `n_opt = s₋²`.
   - Finish dates = `addWorkingDays(today, ceil(n))`.
9. **Confidence:**
   - high: `W ≥ 20` and completions ≥ 8 and `(n_pess − n_opt)/n ≤ 0.5`
   - medium: `W ≥ 10` and completions ≥ 4
   - otherwise low.
10. **Output:** `{ state, likely, optimistic, pessimistic, ratePerWeek: μ·5, scopeRatePerWeek, windowDays: W, confidence, explanation }`. The forecast tooltip uses `explanation`, e.g. "Based on the last 12 working days (recent days weigh more): 3.1 done/wk, scope +0.4/wk."

**Required test cases** (today fixed to a Wednesday, count mode):
| Case | Setup | Expected |
|---|---|---|
| 1-week-old | firstActivity 5 wd ago, 2 done, 10 open | W=5, μ≈0.4/wd, likely ≈ 25 wd out, **ok, low**. The old code gave ~20 weeks, which is the bug. |
| 3-day high velocity | 3 wd old, 6 done, 6 open | W=3, μ≈2/wd, likely ≈ 3 wd, **ok, low** (not too-early) |
| steady long-running | 1 done/wd for 60 wd, 20 open | W=30, likely ≈ 20 wd, **high**, band narrow |
| stalled | last done 15 wd ago, age 40 | **stalled**, no finish, no projection |
| scope growth | 1 done/wd, 1.5 added/wd after start, age 20 | **not-converging** |
| too early | 1 day old, 1 done | **too-early** |
| done | all done | **done** |
| time mode | 2 h/wd logged, 20 h remaining | likely 10 wd |

Also unit-test `addWorkingDays` and `workingDaysBetween` across weekends.

## 3. Recharts (3.8.0 installed, VERIFIED in node_modules)
- **Range band:** a non-stacked `<Area dataKey="band">` whose value is `[low, high]` renders a range. `computeArea` sets `isRange` when the value is an array (lib/cartesian/Area.js:694-706). It must **not** have a `stackId`.
- **Stacked CFD:** three `<Area stackId="cfd" type="stepAfter">` in order done → inProgress → todo. A `null` value is a break point (Area.js:710), so future points with `done: null` draw nothing.
- **Remaining:** `<Line dataKey="remaining">`, solid, `var(--foreground)`. **Forecast:** `<Line dataKey="forecast" strokeDasharray="4 4" connectNulls>` with values only at today and the future points. **Band:** `band: [low, high]`, computed per future point as `low = max(0, R − μ_opt·wd)` and `high = max(0, R − μ_pess·wd)`, where `μ_opt = R/n_opt` and `μ_pess = R/n_pess`.
- **Use a numeric time axis:** `XAxis type="number" dataKey="t" scale="time" domain={['dataMin','dataMax']}` with `t` = UTC ms of the date key, and a tickFormatter based on `formatDateKey`. A category axis spaces points by index, so sparse future points (today, optimistic, likely, pessimistic) would be drawn wrongly. Future points needed: today, plus one point each at the optimistic, likely, and pessimistic dates. The lines are linear, so no daily future points are needed.
- **Axis cap:** extend the axis to `min(pessimistic, today + max(60 days, historySpan))`. If the pessimistic date falls beyond the cap, clip the band and add "pessimistic after {date}" to the tooltip.
- Keep the existing conventions: `'use no memo'`, explicit-height wrapper, `isAnimationActive={false}`. About 150 points with 6 series is fine.
- **Tooltip:** do not rely on `ChartTooltipContent`'s per-item formatter. Pass `content={(p) => <EpicChartTooltip {...p} />}` and render rows from `payload[0].payload` (the datum), so order is fixed and future points can show "Forecast / range" rows. Range array values never reach a formatter. Stacked-area payload values are the raw values, but reading the datum avoids that question entirely.
- **Legend:** do **not** use recharts `<Legend>`; build your own (see pitfall 1).

## 4. Tooltip unification
**Current divergence:**
- base-ui `TooltipContent`: `rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10`, `max-w-xs`.
- `ChartTooltipContent`: `rounded-lg border border-border/50 … grid min-w-32 gap-1.5` (border, not ring).
- Content inside each varies: `space-y-0.5` plain lines, "done: 2" lowercase-colon text, swatches only in some places.

**Proposal: `components/ui/tooltip-body.tsx`** (presentational, no portal):
```tsx
export const TOOLTIP_SURFACE = 'rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10';
export function TooltipBody({ title, children, note }: { title?: ReactNode; children: ReactNode; note?: ReactNode })
  // grid gap-1 min-w-36; title = font-medium; note = text-muted-foreground border-t border-border/50 pt-1 mt-0.5
export function TooltipRow({ color, label, value, sub, dashed }: { color?: string /* CSS colour */; label: ReactNode; value: ReactNode; sub?: ReactNode; dashed?: boolean })
  // flex items-center gap-2: swatch size-2 rounded-[2px] (dashed → border-dashed outline) · label text-muted-foreground · ml-auto pl-3 font-mono tabular-nums font-medium value · optional sub muted
```
- `TooltipContent` keeps its surface. Export `TOOLTIP_SURFACE` and have TooltipContent use it, so both share one string.
- `EpicChartTooltip` wraps `<div className={TOOLTIP_SURFACE}><TooltipBody …/></div>`.
- Leave `chart.tsx` alone. HoursCommitsChart and others use it, and a global change is out of scope. Optionally swap its `border border-border/50` for the ring later.
- Convert: statusBarTip, assigneeTip, Tile tips, quick-peek (EpicProgressCells.tsx:104-111), story mini bar (IssueDetailContent.tsx:384-400), and both chart tooltips.

## 5. Status colours
- `statusCategoryDotClass`: `new → bg-gray-400`, `indeterminate → bg-blue-500`, `done → bg-green-500`. Badge versions: `bg-*/15 text-*-600`.
- Add to statusStyles.ts:
  ```ts
  export const STATUS_CATEGORY_COLOR = {
    new: 'var(--color-gray-400)',
    indeterminate: 'var(--color-blue-500)',
    done: 'var(--color-green-500)',
  } as const;
  export function statusCategoryColor(cat?: string): string
  ```
  Use **literal** strings, because Tailwind v4 only emits theme variables it detects in source. They are safe today because the `bg-*` classes exist [CITED: tailwindcss.com/docs/theme]. Add a unit test asserting `DOT_STYLES[k] === 'bg-' + color name`.
- **Ad-hoc colours to replace:**
  - EpicProgressSection.tsx:46-49 (`scope: gray-400`, `done: green-500`). Replace with the CFD config keyed `done` / `inProgress` / `todo` from the map.
  - EpicTimeBurnup.tsx:22-25. Mapping: estimate → `new` grey, logged → `done` green, remaining → `indeterminate` blue.
  - Story mini bar overrun `bg-red-500` (IssueDetailContent.tsx:378). Keep it: red collides with none of gray/blue/green, and the decision allows a distinct warning colour.
  - EpicProgressCells is already consistent.
- **Forecast/remaining** are not statuses. Use `var(--foreground)` for the Remaining line, `var(--muted-foreground)` dashed for the forecast, and `fillOpacity≈0.12` for the band, so they never collide with a status colour.
- **Chips:** `statusCategoryBadgeClass(cat)` (the same tint as status pills).

## 6. Jira-like users
- `CachedAvatar` is a circle with sizes 16-40. The app uses **size 20** next to `text-xs` names (Stories rows, subtasks: IssueDetailContent.tsx:133/349) and 24 in MyTaskRow.
- Built-in Unassigned placeholder: when `url` is null **and** `name === 'Unassigned'` (case-insensitive), it renders a dashed circle with a lucide `User` icon (cached-avatar.tsx:30, 77-90). This matches Jira's grey silhouette.
- Recommendation: `<CachedAvatar url={a.avatarUrl ?? null} name={a.name} size={20}/>` + truncated name. This needs `avatarUrl: a?.avatarUrls?.['48x48'] ?? null` added to `AssigneeBucket` (it is currently missing). Bucket name for unassigned is already the string `'Unassigned'`.
- Rows stay one line: `w-40 flex-none flex items-center gap-1.5 min-w-0`, with `truncate pr-0.5` on the name.

## 7. Count chips
Always render three fixed slots (done / in progress / to do), each `min-w-[2.25rem] text-center tabular-nums rounded px-1 text-[11px]` plus the badge tint. A zero value uses `opacity-40`, not hidden, so columns align. In time mode use logged (done tint) and estimate (new tint) slots of `min-w-[3.5rem]`. Chip text is **numbers only**. Put the category word in `aria-label`, never as a text node.

## Common Pitfalls
1. **EpicDetailSheet.test text collisions (VERIFIED, test lines 125/153/158):**
   - `getByText(/Stories/)` throws on **multiple** matches, so no "Stories" (capital S) text anywhere in the section.
   - `getByText('In Progress')` and `getByText('Done')` are exact and case-sensitive, so no standalone text nodes with exactly those strings. Hero copy "14 of 23 done · 4 in progress" in **one** text node is safe. Legend labels must be single nodes like `Done · 5`, not `<span>Done</span><span>5</span>`.
   - Recharts `<Legend>` renders text in jsdom, because setup.ts mocks ResizeObserver to 600×400. Avoid it.
   - Finish tile copy: the existing EpicProgressSection.test asserts 'Not enough data' and 'Complete'. These change intentionally to the new state texts, so list them as changed expectations.
2. **That test has `jiraConnected: true`**, so the new changelog and status queries are enabled in EpicDetailSheet.test. The fallback CFD must render during loading **and** error (never a skeleton or error box that replaces the chart). Also mock `fetchEpicStatusHistory` / `fetchAllJiraStatuses` in both test files (EpicProgressSection.test already partially mocks `@/services/jira`).
3. **Disabled query = pending forever** (prior WR-02). Branch on `!data && !isFetching` rather than `isLoading` alone. Query key: `['jira-epic-status-history', epicKey, jiraBaseUrl, sortedKeys.join(',')]`. Never reuse a shared fetcher key (memory: shared fetcher cache key).
4. **Time-mode hero needs worklogs.** Lift the worklog `useQuery` (same key `['jira-epic-worklogs', …]`) to the section and enable it only when `metric==='time'`. EpicTimeBurnup then reads the same cache. Otherwise the Finish tile in time mode cannot forecast.
5. **Changelog order differs:** Cloud is newest-first, DC is oldest-first [CITED: developer.atlassian.com community]. Always sort ascending by `created`.
6. **Weekend bias:** a calendar-day rate over a 3-day window that contains a weekend understates velocity by ~40 %. Hence working days.
7. **Recharts in jsdom:** the SVG renders but tooltips don't (no pointer events). Test series via the pure derive functions, not DOM paths. Assert only containers and testids in component tests.
8. **No `Array.prototype.at`** (tsc target), and biome + full vitest run on commit.

## Package Legitimacy Audit
No new packages. Recharts 3.8.0, @base-ui/react ^1.2.0, Tailwind ^4.2.1 are already installed. Monte Carlo and seeded RNG are not needed.

## Environment Availability
Step 2.6: SKIPPED (code-only. Jira DC is reached at runtime through the existing apiFetch).

## Validation Architecture
| Property | Value |
|---|---|
| Framework | vitest (jsdom), `taskflow/src/test/setup.ts` |
| Quick | `cd taskflow && npx vitest run src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx` |
| Full | `cd taskflow && npm run check && npm test` |

Wave 0:
- Add a forecast test block for the 8 cases above, using an injected Wednesday `today`.
- Add `deriveCfd` tests: history vs fallback; story created before the axis start; truncated changelog using `from`; unmapped status → name map → 'new'.
- Add `fetchEpicStatusHistory` tests: chunking, key-regex filter, top-up when `total > histories.length`.
- Add a statusStyles colour-map consistency test.

## Security Domain
V5 input validation: the story-key regex runs before keys are interpolated into JQL/URL (copy the WR-05 fix) and `encodeURIComponent`. No auth, crypto, or session changes.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Jira DC embedded search changelog is not capped at 100 | Low. The top-up path handles a cap, and `from` anchors the earlier state |
| A2 | Status changelog items carry `from`/`to` status IDs on DC | Low. Falls back to name mapping |
| A3 | `Epic Link` changelog `toString` contains the epic key | Low. Skip `joinedAt` if not, and fall back to `created` |
| A4 | Thresholds (STALL 10 wd, window 3-30 wd, Z=1.28, 0.1 convergence ratio) | Tuning only. Exposed as named constants |

## Sources
- Codebase: jira.ts:285-420, 939-1010, 2687-2800; jira/statuses.ts; greenhopper/transitions.ts:192-208; recharts/lib/cartesian/Area.js:690-725; chart.tsx; tooltip.tsx; statusStyles.ts; cached-avatar.tsx; EpicDetailSheet.test.tsx; test/setup.ts
- [Rest API limiting changelog.history to 100](https://community.atlassian.com/forums/Jira-questions/Rest-API-limiting-changelog-history-results-to-100-even-if/qaq-p/1466525)
- [Changelogs sorting/limitation REST API (Cloud)](https://community.developer.atlassian.com/t/changelogs-sorting-limitation-rest-api/8620)
- [How to get changelog by API from Jira Server](https://community.atlassian.com/t5/Jira-questions/How-to-get-changelog-by-API-calls-from-JIRA-server/qaq-p/1562332)
- [Tailwind v4 theme variables](https://tailwindcss.com/docs/theme)

**Valid until:** 2026-10-31
