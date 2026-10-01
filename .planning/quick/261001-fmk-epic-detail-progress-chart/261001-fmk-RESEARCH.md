# Quick 261001-fmk: Epic detail progress chart - Research

**Researched:** 2026-10-01
**Domain:** Recharts v3 charts plus pure derivation over Jira epic stories (React 19 + React Compiler, Tauri/WebKit)
**Confidence:** HIGH (codebase-verified). The one MEDIUM/LOW item is the Jira DC done-date fallback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Panels (all four):** (1) Burnup: cumulative scope (stories by `created`) vs. cumulative done (stories by `resolutiondate`, done-category only). (2) Big status breakdown: segmented by status NAME, coloured by status category, with a legend showing count and SP per status. (3) Per-assignee horizontal stacked bars (done / in progress / to do), including an "Unassigned" row, sorted by remaining work descending. (4) Forecast and risk stat tiles: % done, projected finish date from recent weekly throughput, number of unestimated stories (no SP), number of unassigned not-done stories.
- **Metric:** a Count / SP toggle, default Count. It applies to every magnitude: burnup, status breakdown, assignee bars, % done and forecast.
- **Placement:** above the Stories list, inside the `isEpic` branch of `IssueDetailContent` (this covers both Sheet and View).

### Claude's Discretion
- Forecast window is the last 4 weeks of resolved items in the active metric. Show "Not enough data" when throughput is 0 or fewer than about 2 resolved items. Show no forecast at 100% done.
- Burnup x-axis runs from the epic's created date (or the earliest story) to today, with daily or weekly buckets depending on span.
- Extend `fetchEpicStories` fields with `created` and `resolutiondate`. NO per-story changelog fetches.
- Colours: use the statusStyles category colours. Follow the `components/ui/chart.tsx` and `HoursCommitsChart.tsx` patterns.
- Empty epic (0 stories): hide the section.
- Loading (`epicStories === undefined`): show a skeleton that matches the section's geometry.

### Deferred Ideas (OUT OF SCOPE)
- None listed. The list quick-peek (`EpicProgressCells.tsx`) stays unchanged.
</user_constraints>

## Summary

The data path is simple and shared. `IssueDetailSheet.tsx:106` and `IssueDetailView.tsx:132` both run `useQuery(['jira-epic-stories', issueKey, jiraBaseUrl])` → `fetchEpicStories(..., storyPointsFieldKey)` and pass `epicStories` into `IssueDetailContent`. That component already gets `storyPointsFieldKey` as a prop, and the epic's own `issue.fields.created` is typed on `JiraIssueDetail` (jira.ts:1722). So the new section only needs `epicStories`, `storyPointsFieldKey` and `issue.fields.created`. Nothing has to be wired in Sheet or View. `fetchEpicStories` swallows errors into `[]`, so a failed fetch looks like an empty epic and the section hides. That is acceptable.

The only Recharts precedent in the app is `HoursCommitsChart.tsx`, which uses `ChartContainer` from `components/ui/chart.tsx` plus Recharts v3 (`^3.8.0`). Its rules (D-14) are: `'use no memo'` at the top of the file (the React Compiler is on: `babel-plugin-react-compiler` 1.0.0), the `responsive` prop on the chart, an explicit-height outer `div` (WebKit 0x0 guard), `isAnimationActive={false}` on every series, and colours as `var(--color-blue-500)` and similar. There is no existing burnup or burndown component. The P85 burndown chart is gone and only `services/jira/greenhopper/burndown.ts` remains. Stat tiles have no shared primitive, so build them inline from `Card size="sm"` or from plain bordered divs.

**Primary recommendation:** Put all derivation in a pure `src/lib/epic-progress.ts`, keyed on string date keys (`created.slice(0,10)`), with full unit tests. Put rendering in `src/routes/dashboard/issue-detail/EpicProgressSection.tsx`. Use Recharts only for the burnup chart. Build the status bar and assignee bars as flex divs, the same way as the existing quick-peek bar.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Fetch `created`/`resolutiondate` | API service (`services/jira.ts`) | — | Extends the existing request's `fields=` list. Same JQL and order. |
| Burnup, status, assignee and forecast derivation | Pure lib (`lib/epic-progress.ts`) | — | Testable without the DOM. Takes `today` as an injected parameter. |
| Charts, tiles, toggle | Browser component | — | Presentational only. Toggle state is local `useState`. |

## Standard Stack

No new packages. Use what is already installed:

| Library | Version | Use |
|---|---|---|
| recharts | ^3.8.0 (package.json) | Burnup `ComposedChart`/`AreaChart` + `Area`/`Line`, `XAxis`, `YAxis`, `ChartTooltip` |
| `@/components/ui/chart` | shadcn wrapper | `ChartContainer` + `ChartConfig` (injects `--color-<key>` CSS vars per theme) |
| `@/components/ui/card`, `skeleton` | local | Tiles and skeleton |
| `@/lib/statusStyles` | local | `statusCategoryDotClass(cat)` → `bg-gray-400` / `bg-blue-500` / `bg-green-500` |
| `@/lib/local-date` | local | `toLocalDateString(new Date())` for "today" |

**Package Legitimacy Audit:** not applicable. This task installs no packages.

## Architecture Patterns

### Module split
```
src/lib/epic-progress.ts            # pure: types + derive* functions (no React)
src/lib/epic-progress.test.ts       # unit tests (fixed `today`, string dates)
src/routes/dashboard/issue-detail/EpicProgressSection.tsx       # 'use no memo'; toggle + 4 panels + skeleton
src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx  # render smoke + toggle
```
`IssueDetailContent.tsx` renders `<EpicProgressSection stories={epicStories} storyPointsFieldKey={...} epicCreated={issue.fields.created} />` directly above the Stories `<section>` in the `isEpic` branch (~line 305).

### Lib API (suggested)
```ts
export type Metric = 'count' | 'sp';
export type Cat = 'new' | 'indeterminate' | 'done';
export function catOf(s: JiraIssue): Cat                     // statusCategory?.key ?? 'new' (mirror fetchEpicEnrichmentMap: unknown → todo)
export function weightOf(s: JiraIssue, metric: Metric, spKey: string): number  // count→1; sp→ (fields[spKey] as number|null) ?? 0
export function doneDateKey(s: JiraIssue): string | null     // done-cat only; resolutiondate → statuscategorychangedate → updated, .slice(0,10)
export function deriveBurnup(stories, metric, spKey, epicCreated: string|undefined, today: string): {date,label,scope,done}[]
export function deriveStatusBuckets(stories, metric, spKey): {name,cat,count,points,value}[]   // ordered by cat (done, indeterminate, new) then value desc
export function deriveAssigneeBuckets(stories, metric, spKey): {name,done,inProgress,todo,remaining}[]  // 'Unassigned' row; sort remaining desc
export function deriveForecast(stories, metric, spKey, today): {pctDone, finishDate|null, reason: 'done'|'insufficient'|'ok', unestimated, unassignedOpen}
```

### Burnup bucketing
- Day keys come from `created.slice(0,10)`. Jira returns `2026-03-01T10:15:30.000+0100`, and slicing gives the server-offset calendar day without parsing, which is DST-safe. The codebase already does this (`jira.ts:992`, `h.created.slice(0,10) === date`). Do date arithmetic with the `addDays` pattern from `HoursCommitsChart.tsx:89` (`Date.UTC` in, `toISOString().slice(0,10)` out).
- Start = min(`epicCreated` day, earliest story created). End = `today` (local, `toLocalDateString`). If the span is 31 days or less, use daily buckets. Otherwise use weekly buckets (each bucket's value = cumulative at the bucket end, and always include a final point at today).
- Cumulative scope = number of stories (or SP) with `createdKey <= bucketEnd`. Done = done-category stories with `doneDateKey <= bucketEnd`. Clamp done to be at most scope at each point.

### Forecast
- Throughput = done weight with `doneDateKey` in `(today-28d, today]`, divided by 4, giving units per week. remaining = total - done. If remaining is 0, `reason:'done'`. If throughput is 0 or fewer than 2 resolved items in the window, `reason:'insufficient'`. Otherwise finish = today + ceil(remaining / throughput × 7) days.
- In SP mode, an unestimated story adds 0. Show the "Unestimated" tile next to the forecast so the user can see that SP figures understate the work.

### Rendering
- Burnup: the outer `<div style={{height: 220}}>`, then `<ChartContainer config className="h-full w-full aspect-auto">` (override the default `aspect-video`), then `<ComposedChart data responsive>`. Inside it: `<Area dataKey="scope" stroke=var(--color-scope) fill-opacity .15 isAnimationActive={false}/>` and `<Line dataKey="done" ... dot={false} isAnimationActive={false}/>`. Colours: scope = `var(--color-gray-400)` (muted, the "new" category), done = `var(--color-green-500)`.
- Status bar: a flex bar like `EpicProgressCell`, but `h-3 w-full`, one segment per status name, each with `statusCategoryDotClass(cat)`. Statuses in the same category share a colour, so add `opacity` steps or a 1px `bg-background` gap between segments so they stay distinguishable. The legend lists name, count and SP for every status.
- Assignee bars: rows built as flex divs (`flex-none` name column of fixed width, `flex-1 min-w-0` bar). Scale each bar to the largest assignee total. Build them from divs, not Recharts, to avoid vertical-layout sizing problems and to get one row per line (see memory notes).
- Toggle: two small buttons with `aria-pressed` (the pattern is in `issue-detail/TimelineFilterChips.tsx` and `WatcherToggle.tsx`), or `radio-group`. Hold it in local `useState<Metric>('count')`.

## Don't Hand-Roll
| Problem | Use instead |
|---|---|
| Chart theme colours / CSS vars | `ChartContainer` + `ChartConfig` (`color: 'var(--color-green-500)'`) |
| Status category colour | `statusCategoryDotClass` (do not copy the hex/class values) |
| Local "today" string | `toLocalDateString(new Date())` from `lib/local-date` |
| Story points read | `issue.fields[storyPointsFieldKey]`. `JiraIssue.fields` has a `[key: string]: unknown` index signature (jira.ts:191). |

## Common Pitfalls

1. **Existing tests break on text collisions (HIGH, verified).** `EpicDetailSheet.test.tsx` renders the epic branch with stories and asserts `getByText('In Progress')`, `getByText('Done')` and `getByText(/Stories/)`. The new legend (status names), "Done"/"In progress" labels and tiles such as "Unestimated stories" would cause multiple-match errors. Fixes: avoid the bare words "Done"/"In Progress" as standalone text nodes (put them in the same span as the count, e.g. "In Progress · 1"), and avoid the word "Stories" in section text (say "Progress" or "unestimated"). Alternatively, scope the old assertions with `within(...)`. Run that test file after wiring.
2. **Test fixtures lack the new fields.** `makeStory` in `EpicDetailSheet.test.tsx` and `jira.test.ts:1686` have no `created`, `resolutiondate` or `assignee.name`. All derivation must tolerate `created` being undefined: skip the story in the burnup but still count it in status, assignee and tiles. Burnup with no dated stories should render "No timeline data" and must not crash.
3. **`resolutiondate` is null on done issues** when the workflow never sets a resolution. Done-category `resolutiondate`s are reliable only on resolution-setting workflows. The opposite also happens: a reopened issue can keep a stale `resolutiondate`, so gate on `statusCategory === 'done'` and never on the presence of `resolutiondate`. Fallback chain: `resolutiondate` → `statuscategorychangedate` (a Jira Cloud field. On this Jira DC instance it is probably absent, but it is harmless to request: missing fields are simply omitted) → `updated` (cheap and additive, a close-enough proxy for done items) → place in today's bucket. This means adding `updated` and `statuscategorychangedate` to the fields list too. It is additive, but goes slightly beyond CONTEXT's "created + resolutiondate", so confirm it.
4. **Scope reflects story `created`, not when the story was linked to the epic.** A story created long ago and then moved into the epic shows as old scope. Without changelogs (out of scope) this is inherent. Add a footnote or tooltip "Scope by story creation date".
5. **Recharts + React Compiler.** Put `'use no memo'` at the top of the file, as in `HoursCommitsChart.tsx`. Otherwise the compiler memoises Recharts children badly.
6. **WebKit 0x0 / jsdom.** Wrap the chart in an explicit-height outer div. `ChartContainer` defaults to `aspect-video`, so override it with `aspect-auto h-full`. In tests, `src/test/setup.ts:53` already mocks `ResizeObserver` (600x400), so charts mount in jsdom without `vi.mock('recharts')`. Assert on your own `data-testid`s and text, not on SVG internals.
7. **Card primitive** (memory): `Card` is `rounded-xl ring-1` with token padding and is role-less. Never wrap a non-bare chart wrapper in another Card. Give the section `role="region" aria-label="Epic progress"`. The skeleton must reproduce the same block heights (toggle row + 220px chart + bar + assignee rows + 4 tiles) so nothing jumps.
8. **Missing `statusCategory`.** It is optional on `JiraIssue.status`. Default to `'new'`, exactly like `fetchEpicEnrichmentMap` (jira.ts:2655-2664), so the counts match the list quick-peek.
9. **Assignee identity.** `JiraIssue.assignee` is typed `{displayName, avatarUrls}` only. Key buckets by `displayName`. A collision between two people with the same name is accepted.
10. **Shared fetcher.** `fetchEpicStories` has a single caller pair (Sheet and View, the same key). Adding fields is safe. Do not touch the JQL or `ORDER BY rank ASC`. The `jira.test.ts` assertions only check the JQL substrings, so they keep passing.
11. **Dark mode.** Use only `var(--color-*-500)` and `--muted-foreground`/`--border` tokens. `ChartContainer` already restyles the axis tick fill to `muted-foreground`.

## Code Examples

Type extension (jira.ts `JiraIssue.fields`, optional so fixtures still compile):
```ts
created?: string;
resolutiondate?: string | null;
updated?: string;
```
Fields list:
```ts
const fields = [...new Set(['summary','status','assignee','issuetype','created','resolutiondate','updated', storyPointsFieldKey,'customfield_10016'])].join(',');
```
Chart config (pattern from HoursCommitsChart.tsx:173):
```ts
const burnupConfig = {
  scope: { label: 'Scope', color: 'var(--color-gray-400)' },
  done:  { label: 'Done',  color: 'var(--color-green-500)' },
} satisfies ChartConfig;
```

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `statuscategorychangedate` is absent on this Jira DC instance (Cloud field) | None: it is only a fallback link and is omitted when missing |
| A2 | `updated` is an acceptable done-date proxy when `resolutiondate` is null | The burnup done line could show a late step. Worth a UAT check on a real epic. |
| A3 | `--color-gray-400` is exposed as a CSS var by Tailwind v4 (like `--color-blue-500`, which is used today) | Scope line renders without colour. Fallback: `var(--muted-foreground)`. |

## Validation Architecture
- Framework: vitest ^4.0.18 (`npm test` = `vitest run`, run from `taskflow/`). The pre-commit hook runs the full suite (memory: combine RED and GREEN into one commit).
- Quick run: `cd taskflow && npx vitest run src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/services/jira.test.ts`
- Lib tests (`epic-progress.test.ts`, new):
  - Burnup daily vs. weekly switch, cumulative values and the clamp.
  - Done falls back to `updated` when `resolutiondate` is null.
  - A reopened issue (not done, with `resolutiondate` set) is not counted as done.
  - Missing `created` is skipped.
  - Status buckets group by name and default missing categories to new.
  - Assignee "Unassigned" row and remaining-desc sort.
  - Forecast `done`/`insufficient`/`ok` cases and SP mode with unestimated stories.
  - Inject `today` and never call `new Date()` inside derive functions.
- Component test: renders the region; the toggle flips the displayed % from count to SP; skeleton when `stories` is undefined; nothing when `[]`.
- Also: add a `fields=` assertion in `jira.test.ts` (url contains `created`, `resolutiondate`).

## Security Domain
Read-only display of data already fetched with the user's PAT. No new inputs, endpoints or secrets, and the token is never put in a query key. No ASVS controls change.

## Sources
- Codebase (verified): `services/jira.ts` (149-193, 1681-1722, 2600-2702), `IssueDetailSheet.tsx:106`, `IssueDetailView.tsx:132`, `IssueDetailContent.tsx:40-80,248,305`, `HoursCommitsChart.tsx`, `components/ui/chart.tsx`, `components/ui/card.tsx`, `lib/statusStyles.ts`, `lib/local-date.ts`, `test/setup.ts:48-61`, `EpicDetailSheet.test.tsx`, `jira.test.ts:1685`.
- [Atlassian KB: statusCategoryChangedDate (Cloud only)](https://support.atlassian.com/jira/kb/how-to-search-using-statuscategory-statuscategorychangeddate-function-with-jql/) (MEDIUM)
- [Atlassian dev community: statuscategorychangedate field](https://community.developer.atlassian.com/t/jira-issue-statuscategorychangedate-field-indicates-when-issue-status-was-updated/29152) (LOW)
