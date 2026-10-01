---
phase: quick-261001-fmk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/services/jira.test.ts
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: false
requirements: [QUICK-261001-fmk]

must_haves:
  truths:
    - "Opening an epic (Sheet or full View) shows an 'Epic progress' region directly above the Stories list"
    - "The burnup chart plots cumulative scope (by story created) and cumulative done (done-category stories, by resolutiondate -> statuscategorychangedate -> updated -> today), with a muted footnote saying scope is by story creation date"
    - "A large status bar is segmented by status NAME, coloured by status category, with a legend showing count and SP per status"
    - "Per-assignee horizontal stacked bars (done / in progress / to do) include an 'Unassigned' row and are sorted by remaining work descending"
    - "Four stat tiles show % done, projected finish (or 'Not enough data' / no forecast at 100%), unestimated story count, unassigned not-done count"
    - "A Count / SP toggle (default Count) switches burnup, status bar, assignee bars, % done and forecast between count and story points"
    - "While stories load a geometry-matched skeleton shows; an epic with 0 stories shows no progress section"
    - "Existing EpicDetailSheet tests and the epic list quick-peek remain unchanged and passing"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "Pure derivation: catOf, weightOf, doneDateKey, deriveBurnup, deriveStatusBuckets, deriveAssigneeBuckets, deriveForecast"
      exports: ["catOf", "weightOf", "doneDateKey", "deriveBurnup", "deriveStatusBuckets", "deriveAssigneeBuckets", "deriveForecast"]
    - path: "taskflow/src/lib/epic-progress.test.ts"
      provides: "Unit tests for all derive functions with injected today"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      provides: "Toggle + burnup + status bar + assignee bars + tiles + skeleton"
      contains: "use no memo"
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchEpicStories requests created, resolutiondate, updated, statuscategorychangedate"
      contains: "resolutiondate"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "EpicProgressSection"
      via: "rendered in isEpic branch above Stories section"
      pattern: "<EpicProgressSection"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "taskflow/src/lib/epic-progress.ts"
      via: "derive* imports"
      pattern: "from '@/lib/epic-progress'"
    - from: "taskflow/src/services/jira.ts fetchEpicStories"
      to: "Jira search fields="
      via: "extended fields list (JQL + ORDER BY rank ASC unchanged)"
      pattern: "statuscategorychangedate"
---

<objective>
Add a detailed "Epic progress" section to the epic detail view (isEpic branch of IssueDetailContent, which covers both IssueDetailSheet and IssueDetailView), placed above the Stories list. Four panels per CONTEXT decisions: burnup over time, big status breakdown, per-assignee breakdown, forecast + risk stat tiles, all driven by a Count / SP toggle (default Count).

Purpose: the epic list quick-peek (EpicProgressCells.tsx, unchanged) only shows a 3-segment bar; the detail view needs trend, distribution, ownership and forecast insight.
Output: pure lib `epic-progress.ts` (+ tests), `EpicProgressSection.tsx` (+ test), additive field extension of `fetchEpicStories`, wiring in IssueDetailContent.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261001-fmk-epic-detail-progress-chart/261001-fmk-CONTEXT.md
@.planning/quick/261001-fmk-epic-detail-progress-chart/261001-fmk-RESEARCH.md

Source anchors (read these, not more):
- taskflow/src/services/jira.ts:149-193 (JiraIssue type), 2676-2702 (fetchEpicStories), 2655-2664 (statusCategory default-to-new in fetchEpicEnrichmentMap)
- taskflow/src/services/jira.test.ts:1685-1720 (EPIC-03 fetchEpicStories tests)
- taskflow/src/routes/dashboard/IssueDetailContent.tsx:40-60 (props), 248 (isEpic), 304-330 (Stories section)
- taskflow/src/routes/dashboard/HoursCommitsChart.tsx ('use no memo', ChartContainer, addDays at ~89, chart config at ~173)
- taskflow/src/components/ui/chart.tsx, taskflow/src/components/ui/card.tsx, taskflow/src/components/ui/skeleton.tsx
- taskflow/src/lib/statusStyles.ts (statusCategoryDotClass), taskflow/src/lib/local-date.ts (toLocalDateString)
- taskflow/src/routes/dashboard/EpicProgressCells.tsx (quick-peek bar pattern, do NOT modify)
- taskflow/src/routes/dashboard/issue-detail/TimelineFilterChips.tsx (aria-pressed toggle pattern)
- taskflow/src/routes/dashboard/EpicDetailSheet.test.tsx (existing assertions that must keep passing)

Orchestrator-locked resolutions:
- R1: also request `updated` and `statuscategorychangedate` in fetchEpicStories fields (same request). Done date fallback: resolutiondate -> statuscategorychangedate -> updated -> today. Done-ness is by status category ONLY.
- R2: scope line based on story `created`; render a small muted footnote under the burnup ("Scope by story creation date"). No changelog fetches.

Project constraints (memory):
- Pre-commit hook runs the full vitest suite: each tdd task is ONE commit containing tests + implementation (no separate RED commit).
- Biome: gate on "no NEW files flagged" by `npx biome check` on touched files, never an absolute diagnostic count.
- Card primitive is rounded-xl ring-1, role-less; never wrap a non-bare ChartWrapper in Card; skeleton must match section geometry.
- One row = one line at every density; italic text inside `truncate` needs `pr-0.5`; statusPillClass needs a flex parent (if used).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend fetchEpicStories fields and build pure epic-progress derivation lib</name>
  <files>taskflow/src/services/jira.ts, taskflow/src/services/jira.test.ts, taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts</files>
  <behavior>
    - jira.test.ts (EPIC-03 block): fetchEpicStories request URL `fields=` segment contains created, resolutiondate, updated, statuscategorychangedate; existing JQL substring assertions still pass.
    - doneDateKey: returns null for non-done category even when resolutiondate is set (reopened); done story uses resolutiondate.slice(0,10); falls back to statuscategorychangedate, then updated, then the injected today.
    - catOf: missing statusCategory -> 'new'.
    - weightOf: count -> 1; sp -> numeric value of fields[spKey], null/undefined/non-number -> 0.
    - deriveBurnup: span <= 31 days -> one point per day from start to today inclusive; span > 31 -> weekly points with a final point exactly at today; scope/done cumulative; done clamped to <= scope; stories without created skipped for scope; no dated stories -> empty array; start = min(epicCreated day, earliest story created day).
    - deriveBurnup sp metric uses SP weights.
    - deriveStatusBuckets: groups by status name, carries cat, count, points (SP sum) and value (by metric); ordered by cat (done, indeterminate, new) then value desc.
    - deriveAssigneeBuckets: null assignee -> 'Unassigned' row; done/inProgress/todo per metric; remaining = inProgress + todo; sorted by remaining desc (tie: name asc).
    - deriveForecast: all done -> reason 'done', finishDate null; fewer than 2 done items in (today-28d, today] or throughput 0 -> 'insufficient'; otherwise 'ok' with finishDate = today + ceil(remaining / (windowDone/4) * 7) days; pctDone rounded integer per metric; unestimated = stories with no numeric SP (any status); unassignedOpen = not-done stories with null assignee; SP mode with unestimated stories counts them as 0.
  </behavior>
  <action>
In jira.ts: add optional typed fields to JiraIssue.fields — `created?: string`, `resolutiondate?: string | null`, `updated?: string`, `statuscategorychangedate?: string | null` (optional so all fixtures still compile). In fetchEpicStories add 'created', 'resolutiondate', 'updated', 'statuscategorychangedate' to the Set-deduped fields list (per R1). Do NOT touch the JQL, `ORDER BY rank ASC`, or the `.catch` fallback. Add one assertion test in the EPIC-03 describe block checking the fields segment.

Create taskflow/src/lib/epic-progress.ts (no React imports). Exports: types `Metric = 'count' | 'sp'`, `Cat = 'new' | 'indeterminate' | 'done'`, `BurnupPoint {date: string; label: string; scope: number; done: number}`, `StatusBucket {name; cat; count; points; value}`, `AssigneeBucket {name; done; inProgress; todo; remaining}`, `Forecast {pctDone: number; finishDate: string | null; reason: 'done' | 'insufficient' | 'ok'; unestimated: number; unassignedOpen: number; total: number; doneTotal: number}`; functions `catOf(s)`, `weightOf(s, metric, spKey)`, `doneDateKey(s, today)`, `deriveBurnup(stories, metric, spKey, epicCreated: string | undefined, today: string)`, `deriveStatusBuckets(stories, metric, spKey)`, `deriveAssigneeBuckets(stories, metric, spKey)`, `deriveForecast(stories, metric, spKey, today)`. All dates are 'YYYY-MM-DD' string keys via `.slice(0,10)` (no Date parsing of Jira timestamps — DST-safe, matches jira.ts:992). Date arithmetic via a local addDays helper using Date.UTC in / toISOString().slice(0,10) out (HoursCommitsChart pattern). Never call `new Date()` inside derive functions — `today` is always injected. Burnup weekly mode: bucket ends at start+6, start+13, ... and always a final point at today; label is a short "MMM d" style string (format from the key via a fixed month-name array, not locale-dependent). catOf mirrors fetchEpicEnrichmentMap: unknown/missing -> 'new'. Forecast window = 4 weeks (per CONTEXT discretion), "insufficient" threshold = fewer than 2 resolved items in window. Done-ness is status category only (R1).

Single commit containing tests + implementation (pre-commit hook runs full suite).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts src/services/jira.test.ts && npx tsc --noEmit && npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts src/services/jira.ts</automated>
  </verify>
  <done>All behavior cases pass; jira.test.ts green; tsc clean; biome reports no diagnostics on the new lib files and no new diagnostics in jira.ts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: EpicProgressSection component and wiring above the Stories list</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx</files>
  <behavior>
    - stories undefined -> renders skeleton (data-testid="epic-progress-skeleton"), no region content.
    - stories [] -> renders nothing (container empty).
    - stories present -> role="region" with aria-label "Epic progress"; contains burnup container (data-testid="epic-burnup"), status bar (data-testid="epic-status-bar") with one segment per status name, assignee rows (data-testid="epic-assignee-row") including an "Unassigned" row, 4 tiles (data-testid="epic-stat-tile").
    - Count is default (Count button aria-pressed=true); clicking SP flips aria-pressed and the % done tile changes from the count-based to the SP-based percentage for a fixture where they differ.
    - Burnup footnote text "Scope by story creation date" is present; with no story having created, burnup shows "No timeline data" instead of a chart.
    - Forecast tile shows "Not enough data" for insufficient throughput, and no projected date when 100% done.
    - EpicDetailSheet.test.tsx continues to pass unchanged.
  </behavior>
  <action>
Create EpicProgressSection.tsx with `'use no memo'` as the first line (React Compiler + Recharts, per HoursCommitsChart). Props: `stories: JiraIssue[] | undefined`, `storyPointsFieldKey: string`, `epicCreated: string | undefined`. Local `useState<Metric>('count')` (default Count per CONTEXT Metric decision). Compute `today = toLocalDateString(new Date())` in the component and pass to derive functions.

Layout (top to bottom, inside `<section role="region" aria-label="Epic progress">`): header row with an h3 "Progress" (do NOT use the word "Stories" anywhere in section text — collides with getByText(/Stories/)) and a two-button Count / SP toggle with aria-pressed (TimelineFilterChips pattern); 4 stat tiles in a grid (grid-cols-2 sm:grid-cols-4, plain bordered/ring divs or Card size="sm"): "% done", "Projected finish" (date / "Not enough data" / "Complete"), "Unestimated" (count), "Unassigned open" (count); burnup chart: outer `<div style={{height: 220}}>` (WebKit 0x0 guard) → ChartContainer with className "aspect-auto h-full w-full" and config `{scope: {label:'Scope', color:'var(--color-gray-400)'}, done: {label:'Done', color:'var(--color-green-500)'}}` → ComposedChart with `responsive`, XAxis dataKey "label", YAxis allowDecimals false, ChartTooltip with ChartTooltipContent, Area dataKey "scope" (stroke/fill var(--color-scope), fillOpacity 0.15), Line dataKey "done" (stroke var(--color-done), dot false); every series isAnimationActive={false}. Show "No timeline data" text when deriveBurnup returns []. Under it a muted text-xs footnote "Scope by story creation date" (per R2). Do NOT wrap ChartContainer in a Card. Status breakdown: h-3 w-full rounded flex bar, one segment per status bucket with width = value/total %, colour from statusCategoryDotClass(cat), 1px gap (gap-px with bg-background parent) so same-category statuses stay distinguishable; legend below as flex-wrap items, each item a single span like "Code Review · 3 · 5 SP" (keeping status names merged with numbers in ONE text node avoids exact-match collisions with getByText('In Progress') / getByText('Done')). Per-assignee: one row per bucket, single line: flex-none fixed-width truncate name column, flex-1 min-w-0 track containing done/inProgress/todo segments (category colours) scaled to the largest assignee total, flex-none right-aligned remaining number. Hide segments with zero value. Skeleton: Skeleton blocks reproducing the same heights (toggle row, 4 tiles row, 220px chart + footnote line, h-3 bar + legend line, 3 assignee rows).

Tooltips/labels for the metric: in SP mode suffix values with "SP"; use rounded integers for % done.

Wire into IssueDetailContent.tsx: inside the existing `isEpic` branch, render `<EpicProgressSection stories={epicStories} storyPointsFieldKey={storyPointsFieldKey} epicCreated={issue.fields.created} />` immediately ABOVE the existing Stories `<section>` (placement decision; both Sheet and View use this component). Do not modify the Stories list markup or EpicProgressCells.tsx.

Write EpicProgressSection.test.tsx with fixtures that include created/resolutiondate/assignee/SP (test/setup.ts already mocks ResizeObserver; do not vi.mock recharts; assert on data-testids and text, not SVG internals). Then run EpicDetailSheet.test.tsx; if a multiple-match error appears, fix the section's text (merge nodes / rename), not the old test, unless unavoidable — then scope the old assertion with within() on the Stories section and note it in the SUMMARY.

Single commit containing tests + implementation.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/EpicProgressSection.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/IssueDetailContent.tsx && npm test</automated>
  </verify>
  <done>Section renders all four panels with toggle; skeleton/empty states behave; EpicDetailSheet tests pass unchanged; full vitest suite green; tsc clean; no new biome diagnostics in touched files.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual UAT of epic progress section</name>
  <what-built>Epic progress section (burnup, status bar, assignee bars, 4 tiles, Count/SP toggle) above the Stories list in epic detail Sheet and full View.</what-built>
  <how-to-verify>
    1. From taskflow/, run `npm run tauri dev` (or the usual dev command) and open the Epics list.
    2. Open an epic with several stories in the side Sheet: confirm the "Progress" region sits above the Stories list, loading shows a skeleton without layout jump.
    3. Check burnup: scope area and done line look plausible; footnote "Scope by story creation date" visible. Note any late step in the done line (A2: `updated` fallback when resolutiondate is null).
    4. Check status bar segments match status names in the legend with count + SP; assignee rows include "Unassigned" when applicable, sorted by remaining desc, one line each.
    5. Toggle Count / SP: all panels and % done / forecast update.
    6. Open the same epic in full View; verify identical section. Check dark mode colours.
    7. Open an epic with 0 stories: no progress section, "No stories in this epic" still shown.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API -> client | Story fields (names, dates, SP) rendered as text; already-fetched data with user's PAT |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fmk-01 | Tampering/XSS | EpicProgressSection legend/assignee names | mitigate | Render status and assignee names only as React text children (no dangerouslySetInnerHTML) |
| T-fmk-02 | Denial of Service | epic-progress derive on malformed dates/SP | mitigate | Tolerate missing/invalid created, non-numeric SP (weight 0), empty input; never throw (covered by unit tests) |
| T-fmk-03 | Information Disclosure | fetchEpicStories | accept | Additive fields on existing authenticated request; token never placed in query keys or URLs |
</threat_model>

<verification>
- `cd taskflow && npm test` green (full suite).
- `npx tsc --noEmit` clean.
- biome: no new diagnostics in touched files.
- grep: `grep -n "<EpicProgressSection" taskflow/src/routes/dashboard/IssueDetailContent.tsx` appears before the Stories `<section>`; `git diff taskflow/src/routes/dashboard/EpicProgressCells.tsx` empty; fetchEpicStories JQL line unchanged.
</verification>

<success_criteria>
- Epic detail shows the four-panel progress section above the Stories list in both Sheet and View.
- Count/SP toggle (default Count) drives all magnitude panels.
- Forecast follows the 4-week throughput rule with "Not enough data" and 100% handling.
- Burnup uses the R1 done-date fallback chain and R2 creation-date footnote.
- Human UAT approved.
</success_criteria>

<output>
Create `.planning/quick/261001-fmk-epic-detail-progress-chart/261001-fmk-SUMMARY.md` when done
</output>
