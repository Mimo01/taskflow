# Quick 261001-hsz: Epic progress iteration 3 - Research

**Researched:** 2026-10-01
**Domain:** Jira DC worklog aggregation, Recharts burnup, base-ui Tooltip
**Confidence:** HIGH for data path, estimate and burnup math. MEDIUM for the tooltip root cause: it does not reproduce in Chromium, so WKWebView is unverified.

<user_constraints>
## User Constraints (from CONTEXT.md)

All decisions are locked as written in `261001-hsz-CONTEXT.md`:
- **Estimate formula:** use subtasks if any, else the story's own estimate.
- **Logged:** `aggregatetimespent`.
- **Time burnup:** collapse model with two series, Estimate and Logged.
- **Tiles:** Estimated, Logged, Remaining (Σ open max(est − logged, 0)), and % logged.
- **Worklogs:** load lazily with their own react-query key.
- **Tooltips:** on the burnup, the epics-list quick-peek bar, the status and assignee bars, and new stories-list mini bars.
- **Layout:** no Card. Full width, border-t and border-b, py-5 / my-6, space-y-5. The skeleton must match.
- **Carried-over constraints:** existing tests stay green (update only intentional changes), pre-commit runs biome + tsc + full vitest, no `.at()`, one row = one line, `pr-0.5` on italic text that truncates.

There are no deferred ideas. The layout is at Claude's discretion and the CONTEXT already gives a concrete direction.
</user_constraints>

## Project Constraints (from CLAUDE.md / memory)

**Pre-commit hook:**
- The hook runs `biome check --staged ./src && tsc --noEmit` and then `npm run test` (the full vitest suite) [VERIFIED: .husky/pre-commit].
- Keep RED and GREEN in one commit, and never use `--no-verify`.

**Code rules from memory:**
- Edit `src/services/jira.ts`, not `jira/` modules (jira.ts dual-file gotcha). `fetchAllSearchPages`, `fetchAllSearchPagesConcurrent` and `fetchAllWorklogPages` are module-private there.
- Fetch-once page-cap pitfall: paginate fully.
- Shared fetcher cache key: add a new fetcher with a new key. Do not touch the `fetchEpicStories` JQL or fields order beyond the agreed field addition.
- Don't nest interactive elements. A trigger inside a `<button>` row must render a non-button element.

---

## 1. Worklog data path

**Search embedding [CITED: pycontribs/jira#363, elastic/connectors#2634, atlassian-mcp-server#180]**
- `/rest/api/2/search?fields=worklog` embeds `fields.worklog = { startAt, maxResults: 20, total, worklogs[] }` per issue.
- The request's `maxResults` controls issues per page, not worklogs. It cannot raise the cap of 20.
- If `worklog.total > worklog.worklogs.length`, top up with `GET /rest/api/2/issue/{key}/worklog`. Silent undercount is the main risk.

**Existing code [VERIFIED: grep jira.ts, types.ts]**
- `fetchAllWorklogPages(url, headers)` (jira.ts:440) appends `?maxResults=200&startAt=` itself, so pass a URL with no query string.
- It returns a partial or `[]` on any failure and never throws.
- Its declared element type is `{ author?: { displayName? } }`. Widen it to a generic `<T>` or to `JiraWorklog`. The only other caller is `fetchIssueWorklogs`, which reads `author.displayName`, so widening is safe.
- `JiraWorklog` (services/jira/types.ts:265) already has `started`, `timeSpentSeconds` and `author`.
- `started` looks like `"2026-09-30T23:30:00.000+0200"`, so `.slice(0,10)` gives the author's local day. `validKey()` in epic-progress.ts already does this.

**Recommended fetcher:** `fetchEpicWorklogs(baseUrl, token, storyKeys)` in jira.ts.
- **Input:** the story keys from the already-loaded `epicStories`. Do not re-run the Epic Link search.
- **Chunking:** split the keys into `SUBTASK_CHUNK_SIZE` (50) chunks, the same limit the sprint subtask query uses ("~6000 chars JQL max").
- **JQL per chunk:** `key in (c) OR parent in (c)`. One search returns each story and its subtasks, using `fields=worklog,parent,issuetype`. URL length is about 50×2×~10 chars, which is fine.
- **Paging:** use `fetchAllSearchPagesConcurrent`, not `fetchAllSearchPages`.
  - It steps by the server-returned `maxResults`. The sequential helper steps by a fixed 200, which skips issues if the instance caps lower (an existing latent bug).
  - It is fail-closed, which is what the chart wants: show an error with retry rather than a silently low Logged line.
- **Top-up:** for each issue where `total > worklogs.length`, call `fetchAllWorklogPages(`${base}/rest/api/2/issue/${key}/worklog`)`.
  - Keep the embedded list if the top-up returns fewer entries, because a top-up failure returns `[]`.
  - Run with bounded concurrency, about 6 like `PAGE_CONCURRENCY`.
- **Return shape:** `Map<storyKey, Array<{ day: string; seconds: number }>>`.
  - Roll subtask logs into `fields.parent.key`. A story's own logs go under its own key.
- **Call count for a typical epic** (30 stories, ~100 subtasks): 1 chunk × 1 page, plus top-ups only for issues with more than 20 logs (usually 0–5). That is about 1–6 requests.
- **Payload:** each worklog carries author/avatar/comment, so 130 issues × ≤20 logs is about 0.5–2 MB. That's acceptable when loaded lazily [ASSUMED size].

**React-query wiring**
- Key: `['jira-epic-worklogs', epicKey, jiraBaseUrl]`. It is new and distinct from `jira-epic-stories`.
- The query must be lazy, and the metric state lives in `EpicProgressSection`. Put the `useQuery` in a **child component that mounts only in Time mode**, for example `<TimeBurnup>` (or a `useEpicWorklogs` hook called by it).
- The child reads `jiraBaseUrl` and `jiraConnected` from the settings store and the token via `readSecret('jira-pat')`, mirroring IssueDetailSheet.tsx:106.
- Set `enabled` only when `stories.length > 0` and the base URL and connection are present. Use `staleTime: 60_000`.
- Pass `epicKey` as a new prop to the section. IssueDetailContent already has `issueKey`.
- Why a child component:
  - Count/SP tests and `EpicDetailSheet.test.tsx` never mount it, so they need no QueryClient or settings mock changes. `EpicDetailSheet.test` mocks `@/stores/settings.store`.
  - Section tests that switch to Time must wrap in a `QueryClientProvider` and `vi.mock` the fetcher.
- **Invalidation:** consider adding `['jira-epic-worklogs']` next to the existing `jira-epic-stories` invalidations in FieldsSection.tsx:384 and SprintBoardTab.tsx:1387. A transition changes the done date, which matters for the collapse. Worklogs themselves change rarely, so this is optional.
- **States:**
  - Loading: chart-height skeleton.
  - Error: an inline "Couldn't load worklogs" with a Retry `<button>` that calls `refetch`. Tiles keep using aggregates.

## 2. Estimate formula

**Validity of the derivation**
- `aggregatetimeoriginalestimate` = own original estimate + Σ subtask original estimates. It is null when every one of them is null [ASSUMED from Jira field semantics; consistent with TimeTrackingSummary usage].
- So `subSum = max(0, (aggOE ?? 0) − (ownOE ?? 0))` is valid.
- Add `timeoriginalestimate` to the `fetchEpicStories` fields. This is a field add, not a JQL change, so the shared key is safe.
- `estimateOf(s) = subSum > 0 ? subSum : (ownOE ?? 0)`. "≥1 subtask with estimate > 0" is the same as `subSum > 0`.

**Single source:** use the aggregate derivation everywhere, not the worklog search.
- It is available in Count, SP and Time modes without extra calls. The tiles, status bar, assignee bars, story mini bars and the burnup Estimate series all need the same number before or without worklogs.
- Implement it as `estimateOf` in epic-progress.ts. Make `weightOf(s,'time')` return it, and `deriveStatusBuckets.seconds`, `deriveAssigneeBuckets.estimate` and `deriveTimeTotals.estimated` use it.
- `loggedOf(s) = aggregatetimespent ?? 0`.
- **Intentional test change:** the existing time-mode fixtures set only `est` (aggregate). With `ownOE` undefined, `subSum = aggOE`, so the old expectations still hold. Good. Add fixtures with own + subtask estimates to prove the rule.

**Remaining tile:** `Σ over non-done stories of max(estimateOf − loggedOf, 0)`. This equals the burnup's final gap (proof in §3). The tooltip should say it replaces Jira's remaining estimate.

## 3. Burnup algorithm (collapse model)

**Inputs**
- `stories` and `logs: Map<key, {day, seconds}[]>`.
- `createdDay(s)`, clamped to today.
- `doneDay(s)`, from the existing `doneDateKey` (null if not currently done).
- `estimateOf(s)`.

**Per story**
- Sort logs by day.
- Clamp a future day to `today` (CONTEXT). Drop logs with an invalid `validKey`.
- `startDay(s) = min(createdDay, firstLogDay)`. This handles backdated logs before creation. Without it, Logged can exceed Estimate.

**Date axis:** reuse the existing axis builder (daily up to 31 days, otherwise weekly plus today). The start is `min(epicCreated, all startDays)`. Refactor the axis code in `deriveBurnup` into a shared helper.

**Per sample date d**
```
L_s(d) = Σ seconds of s's logs with day ≤ d                         (running pointer per story)
Logged(d)   = Σ_s L_s(d)
Estimate(d) = Σ_{s : startDay(s) ≤ d}  ( doneDay(s) !== null && doneDay(s) ≤ d
                                           ? L_s(d)
                                           : max(estimateOf(s), L_s(d)) )
```

**Complexity:** O(W log W + D·S). D ≤ ~60 points and S ~ hundreds, so this is trivial.

**Invariants (test them)**
- `Estimate(d) ≥ Logged(d)` holds when `startDay` includes the first log.
- Final gap = `Σ_open max(est − L, 0)` = the Remaining tile, as long as the worklog sums equal `aggregatetimespent`.

**Edge cases**

| Case | Behaviour |
|------|-----------|
| Logs after the done date | The story stays collapsed. Estimate and Logged rise together. |
| Done with zero logs | Its estimate drops to 0 at the done date, so the Estimate line steps down. This is the model's honest consequence; document it in the series tooltip. |
| No estimate, open, with logs | `max(0, L) = L` adds no gap. |
| Reopened story | `doneDateKey` is null, so it is treated as open all along. That's accepted. |
| Worklog totals ≠ `aggregatetimespent` (partial top-up, or a deleted parent link) | The chart's final Logged can differ from the tile. Show "Logged (from worklogs)" in the chart tooltip. Optionally render a muted note when \|Σ worklogs − Σ aggregatetimespent\| > 60s. |
| Timezone | `started` carries the author's offset. `.slice(0,10)` gives their calendar day, which matches existing `validKey` usage. Clamp to local today. |
| Subtask whose parent is not in the story set | Ignore it. It can't happen with `parent in (storyKeys)`. |

**Output:** `TimeBurnupPoint { date, label, estimate, logged }` in seconds. Convert to hours for plotting, as the current code does with `HOUR`.

## 4. Tooltip bug: status and assignee segments

**Source read: `@base-ui/react` 1.3.0, `TooltipTrigger.js` and `useHoverReferenceInteraction.js`**
- Hover opening is `mouseOnly: true`. The pointer type is captured by React `onPointerEnter`.
- The open path is a **rest timer**: `restMs = delay` (150), restarted on every `onMouseMove` with movement ≥ ~1.4px.
- Native `mouseenter` and `mouseleave` listeners are attached in an effect.
- Nothing is button-specific, and `render={<div/>}` gets the same handlers. The trigger needs no focusability or size beyond being hit-testable.

**Reproduction attempt [VERIFIED: scratch harness]**
- I built the same structure: a base-ui Root/Trigger with `render={<div/>}` segments in a `flex h-3 gap-px overflow-hidden` bar, inside a modal base-ui Dialog like the Sheet.
- Driven with real mouse moves in headless **Chromium**, the tile button and both segments opened their popups correctly.
- So it is **not** a base-ui logic bug, and `overflow-hidden` does not clip the portaled popup.
- WebKit/WKWebView could not be tested because no Playwright webkit is installed.

**Likely real-app causes, in ranked order [ASSUMED]**
1. **Tiny or invisible hit targets.**
   - Segments are 12px tall.
   - The assignee track is `bg-background`, so it is invisible against the page. Segments are scaled to `maxAssignee`, so most of the visible "bar" width for small assignees is not a trigger.
   - Small status buckets are 1–3px slivers with 1px gaps.
2. **The rest-timer semantics.** The tooltip only opens after the pointer *stops* for 150ms inside one segment. Sweeping along the bar crosses segment boundaries, and each one is a separate Root, so the timer keeps resetting.
3. **WKWebView** hover differences. Native `title` is also unreliable on macOS, see electron#49843, which is relevant to the quick-peek `title`. This is unverified.

**Fix: one tooltip per whole bar**
- Make the trigger the **bar wrapper**: `TooltipTrigger render={<div/>}` with `className="py-1.5 -my-1.5"` around the `h-3` track. That gives a ~24px hit area with no layout change.
- The segments become plain child `div`s.
- Content: the full per-segment breakdown, one line per segment with a dot, name, value and %.
- Use `<Tooltip trackCursorAxis="x">` (supported Root prop; the trigger reads `trackCursorAxis` from the store) so the popup follows the cursor along the bar.
- Use `delay={0}` or `100` for bars.
- Give each bar `tabIndex={0}` and an `aria-label` summary, so there is one tab stop per bar. This addresses the earlier review's WR-03 and WR-04.
- Give the assignee track a visible `bg-muted`, so the whole visible track is the trigger.
- Legend items and assignee name triggers can then become non-focusable spans, or be dropped, to cut tab stops.

**Quick-peek (`EpicProgressCell`)**
- Wrap the `h-1.5 w-16` bar in a `TooltipTrigger render={<div/>}` with `py-1` padding. Remove `title`.
- The row is a `div onClick`, not an overlay button (EpicsPage.tsx:53), so hover reaches the cell. Trigger clicks bubble to the row, which is fine.
- **Intentional test change:** `EpicProgressCells.test.tsx` EPIC-05 asserts `toHaveAttribute('title', …)`. Replace it with `await user.hover(getByTestId('epic-progress-bar'))` and `findByText`.
  - Keep the `epic-progress-bar` testid on the trigger element.
  - Keep the segment testids, and the retry button `title`, which is asserted at lines 61 and 100.

**Stories-list mini bar (inside a row `<button>`)**
- Use `TooltipTrigger render={<span/>}` with `className="inline-flex w-16 flex-none h-1.5 …"`.
- It must be a span: a div is invalid inside a button, and the default trigger renders a `<button>`, which would nest interactive elements.
- No `tabIndex`, because the row button is the tab stop.
- Place it before the status pill. The pill is already a flex child of the row button, so the flex-parent memory is satisfied.
- **Overrun:** clamp the fill at 100% and colour it red/amber when `logged > estimate`.
- **No estimate:** render a muted empty track. The tooltip says "No estimate".

## 5. Recharts burnup hover (recharts 3.8.0, shadcn `chart.tsx`) [VERIFIED: node_modules]

- **Cursor:** use `<ChartTooltip cursor={{ stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }} …>`.
  - A ComposedChart cursor is a vertical line, and the `[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border` default is too faint.
  - Recharts has no built-in horizontal crosshair. A vertical guide plus `activeDot` (the default on Line and Area) is the standard pattern.
- **Remaining row:** `ChartTooltipContent`'s `formatter(value, name, item, index, payload)` receives the full data point (chart.tsx:194). The item container is `flex flex-wrap`.
  - For `name === 'logged'`, return a fragment: the logged row plus a `w-full` "Remaining" row computed from `(payload.estimate − payload.logged) * HOUR`.
  - Don't add a hidden series: it would pollute the legend and payload.
- **Label:** keep the existing `labelFormatter`, which shows `MMM d, yyyy`.
- **Config:** add a time-mode `chartConfig`: `estimate` (gray area) and `logged` (green or blue line).
  - The Area/Line `dataKey`s differ by mode, so pick the config by `timeMode`.
  - Keep the "use no memo", explicit height and `isAnimationActive={false}` conventions.

## 6. Test collision pitfalls

- **`EpicDetailSheet.test.tsx`** uses `getByText(/Stories/)` (a case-sensitive regex, which must match exactly one element), `getByText('In Progress')`, `getByText('Done')` and `getByText('Stories (2)')`.
  - Avoid any *visible* text node containing "Stories" (capital S), such as an "Estimated stories" label.
  - Avoid visible exact "Done" and "In Progress" in the section or the mini bars. Tooltip content is fine, because it isn't rendered until opened.
  - Mini bars must not render visible text, or should use lowercase.
- **Time mode in section tests** now mounts the worklog child. Wrap those renders in a `QueryClientProvider` (`retry: false`).
  - `vi.mock('@/services/jira', async (orig) => ({ ...(await orig()), fetchEpicWorklogs: vi.fn() }))`.
  - Also mock `@/stores/settings.store` and `readSecret`, or inject a `loadWorklogs` prop for testability.
- **Segment-hover tests** at section.test:233 hover `epic-status-segment`. Update them to hover the bar trigger. This is an intentional change: keep the `epic-status-segment` testids on the children so the count tests at :90 and :283 still pass.
- **No `Array.prototype.at`.** tsc fails it.
- **Skeleton:** `epic-progress-skeleton` testid stays. Drop the Card from it to match the new geometry.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest + @testing-library/react + user-event (jsdom) |
| Quick run | `cd taskflow && npx vitest run src/lib/epic-progress src/routes/dashboard/issue-detail/EpicProgressSection src/routes/dashboard/EpicProgressCells src/routes/dashboard/EpicDetailSheet` |
| Full suite | `cd taskflow && npm run test` (also run by pre-commit) |

**Tests to add**
- **`epic-progress.test.ts`:**
  - `estimateOf`: subtask sum vs own vs null.
  - `deriveTimeBurnup`: intermediate logs raise Logged, done collapses, overrun raises Estimate, a backdated log before creation, a future log clamped, done with zero logs, and final gap = Remaining.
  - `deriveTimeTotals.remaining` uses the new formula.
- **`jira` fetcher test** (mock `apiFetch`):
  - Chunking at 50.
  - Top-up only when `total > embedded`.
  - Keep embedded if the top-up is shorter.
  - Subtask logs rolled up to the parent.
- **Section:** Time mode shows a loading skeleton, then a chart; error shows retry; hovering the bar wrapper shows the breakdown; the Estimated tile tooltip carries the formula text.
- **Manual (UAT):** hover the bars in the real Tauri/WKWebView app. jsdom and Chromium cannot prove WebKit hover.

## Security Domain

- Reads only, with the existing Bearer PAT via `apiFetch`. Story keys come from the Jira response and are placed in JQL inside `encodeURIComponent`, the same as the existing subtask chunk query.
- All tooltip content is rendered as text with no `dangerouslySetInnerHTML`.
- No new packages, so no package audit is needed.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `aggregatetimeoriginalestimate` = own + Σ subtask OE, null when all null | The subtask-sum derivation is off. Verify against one live epic in UAT. |
| A2 | The real-app tooltip failure is hit-target / rest-timer / WebKit related, not a library bug | The whole-bar fix may still fail in WKWebView. Needs manual UAT in Tauri. |
| A3 | Worklog payload size of about 0.5–2 MB for a typical epic | Slow Time-mode load on huge epics. The lazy query isolates it. |

## Sources

- Code read: `@base-ui/react` 1.3.0 `tooltip/trigger/TooltipTrigger.js`, `floating-ui-react/hooks/useHoverReferenceInteraction.js`; `taskflow/src/services/jira.ts` (lines 289–466, 530–560, 1641–1666, 2685–2718); `components/ui/chart.tsx`; recharts 3.8.0.
- Chromium harness: base-ui tooltip div triggers inside a modal Dialog open correctly (scratchpad, not committed).
- [pycontribs/jira#363](https://github.com/pycontribs/jira/issues/363), [elastic/connectors#2634](https://github.com/elastic/connectors/issues/2634), [atlassian-mcp-server#180](https://github.com/atlassian/atlassian-mcp-server/issues/180), [Atlassian dev community: worklog maxResults](https://community.developer.atlassian.com/t/failed-to-get-more-than-the-maxresults-limit-for-worklogs-for-an-issue-through-rest-api/78720): the embedded worklog cap of 20.
- [electron#49843](https://github.com/electron/electron/issues/49843): unreliable native `title` tooltips on macOS 26. This is a reason to drop `title` on the quick-peek bar.
