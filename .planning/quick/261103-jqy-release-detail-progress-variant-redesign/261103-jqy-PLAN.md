---
phase: quick-261103-jqy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/releaseTrain.ts
  - taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
autonomous: true
requirements: [QUICK-261103-jqy]

must_haves:
  truths:
    - "For a future release whose window has not opened, the Progress slot shows a track from TODAY (filled dot, left) to RELEASE (hollow ring, right, captioned RELEASE + version name)"
    - "Every unreleased dated fix version dated strictly between today and the release date is a proportionally placed tick on the track; the immediate previous version's tick is captioned 'window opens'"
    - "The window segment (window start -> RELEASE) is visibly emphasised; the part before it is muted"
    - "One muted line under the track reads 'N release(s) ahead · window X d · in Y d', omitting unknown or zero parts"
    - "TODAY is never clamped onto the window start when today precedes the window (the old bug)"
    - "When the window is already open (today >= window start) TODAY sits inside the window on the track and there are no releases ahead"
    - "Released / past-due / undated fallbacks keep the existing track rendering"
    - "Track fits the compact 120px body and ~220px widths: labels never wrap, colliding names are dropped while tick marks stay"
    - "The burnup chart branch is unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/releaseTrain.ts"
      provides: "Pure deriveReleaseTrain + placeTrainLabels + formatTrainSummary"
      exports: ["deriveReleaseTrain", "placeTrainLabels", "formatTrainSummary", "ReleaseTrain"]
    - path: "taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts"
      provides: "Unit tests for the train derivation, summary line and label layout"
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx"
      provides: "Release-train render (data-testid release-graph-burnup-thin kept)"
  key_links:
    - from: "useReleaseDetail.ts"
      to: "deriveReleaseTrain"
      via: "fixVersions + version + today, returned as releaseTrain"
      pattern: "deriveReleaseTrain\\("
    - from: "ReleaseDetailPage.tsx timelineSummary"
      to: "ReleaseTimeline"
      via: "TimelineSummary.train field threaded through ReleaseBurnup summary prop"
      pattern: "train:"
---

<objective>
Redesign the Progress slot's thin-history variant (ReleaseTimeline, shown by ReleaseBurnup when `!enough || !axis`) as the user-locked "Release train": TODAY -> ticks for releases ahead -> RELEASE, with the release's own window emphasised and a one-line muted summary. Fixes TODAY being clamped onto the window start when today precedes the window.

Locked design (user picked "Release train"):

```
PROGRESS                    after R-11-17

 TODAY        R-11-17      R-12-01
  ●━━━━━━━━━━━━━━|━━━━━━━━━━━━━━━◯
               window opens   RELEASE
  1 release ahead · window 14 d · in 28 d
```

Output: pure `releaseTrain.ts` (+ tests), rewired ReleaseTimeline (+ tests), train threaded from useReleaseDetail through the page's timelineSummary.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/sketch-findings-taskflow/SKILL.md
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx
@taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts

Repo layout: `.planning` and git live at /Users/mimo/Documents/Projects/taskflow; npm, vitest, biome and `src` live in the inner `taskflow/` dir. Run all npm/vitest/biome/tsc commands from /Users/mimo/Documents/Projects/taskflow/taskflow.

Relevant facts (already extracted, do not re-explore):
- `JiraFixVersion` = `{ id, name, releaseDate?: 'YYYY-MM-DD', released: boolean, description? }` (services/jira.ts:219).
- `previousVersion(fixVersions, version)` in releaseBurnup.ts = dated version with the latest date strictly before this one's (released or not). The train MUST use it for the window start so it matches the burnup axis start.
- `dateKeyMs(key)` (lib/epic-progress.ts) returns UTC ms, so day diff = `(dateKeyMs(b) - dateKeyMs(a)) / 86_400_000` (exact integer; still wrap in Math.round).
- useReleaseDetail.ts ~line 712: `today`, `prevVersion`, `burnupAxis` are derived; `fixVersions` is the query data from ~line 102; the return object ends with `today`.
- ReleaseDetailPage.tsx ~line 309: `const timelineSummary = { done, total, today, releaseDate, released, versionName }` passed as `summary` to `<ReleaseBurnup ... compact />`.
- ReleaseBurnup.tsx: `aside` (~line 192) is the GraphSlot header right ("since {previousName}"); the timeline renders at ~line 262 `<ReleaseTimeline axis={axis} summary={summary} className="my-auto" />`; body height is `COMPACT_BODY_H` = 120px. DO NOT touch anything inside the chart branch (the `<div ref={setPlotEl}>` subtree) nor the axis/ticks/labels computations above it.
- ReleaseBurnup.test.tsx:88 relies on `data-testid="release-graph-burnup-thin"` and asserts no "days left" text. Keep the testid on the ReleaseTimeline root; the new summary says "in Y d", never "days left".

Project rules that apply (memory/skill):
- Colour = status only: neutral `foreground` / `muted-foreground` / `muted` tokens; no legends; the done figure lives in the header done bar (no figures/issue counts here).
- One row = one line: every label `whitespace-nowrap` + `truncate`; never wrap at narrow widths.
- Pre-commit hook runs full vitest + biome + tsc: one commit per task containing test + impl; never `--no-verify`. If a hook fails, the files stay staged — commit with explicit `-- <paths>` and check `git log -1 --stat`.
- No `biome --write` on all of src; format only touched files. Gate lint on "no new files flagged", not an absolute count.
- Use placeholder version names in tests/fixtures (e.g. "R-11-17", "Release B"), no customer data.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure release-train derivation, summary line and label layout</name>
  <files>taskflow/src/routes/dashboard/release-detail/releaseTrain.ts, taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts</files>
  <behavior>
    deriveReleaseTrain({ version, fixVersions, today }) -> ReleaseTrain | null
    - Returns null (caller keeps the existing track) when: version has no valid releaseDate, version.released, or releaseDate < today (past due).
    - Upcoming, window not open (prev date > today): start = today, end = releaseDate, windowOpen = false, todayF = 0; ticks = every fix version other than this one that is NOT released, has a valid date d with today < d < releaseDate, plus the previous version (from previousVersion()) if its date is in that open interval even when released; deduped by id, sorted by date then name; each tick { id, name, date, f, windowStart } with f = proportional position on [start,end], windowStart true only for the previous version. aheadCount = number of unreleased ticks.
      Example: today 2026-11-03, prev R-11-17 (2026-11-17, unreleased), this R-12-01 (2026-12-01) -> 1 tick f=0.5 windowStart=true, aheadCount 1, windowDays 14, daysToRelease 28.
    - Two ahead (R-11-10 unreleased, R-11-17 prev) -> 2 ticks in date order, only R-11-17 windowStart, aheadCount 2.
    - Versions dated on/before today, on/after releaseDate, undated, or this version itself are never ticks.
    - Window already open (prev date <= today): start = prev date, end = releaseDate, windowOpen = true, todayF = frac(today), ticks = [the prev version at f=0 with windowStart=true], aheadCount 0. This is the case that used to clamp TODAY; assert todayF > 0 when prev < today.
    - No previous version: start = today, end = releaseDate, windowOpen = false, windowStartF = null, windowDays = null, ticks from ahead versions only.
    - releaseDate === today: daysToRelease 0, start = end; all f values 0 (no NaN).
    - Output fields: start, end, todayF, windowStartF (number|null), windowOpen, ticks, aheadCount, windowDays (prev->release, null without prev), daysToRelease (today->release), releaseName (version.name), previousName (string|null).
    formatTrainSummary(train) -> string
    - "1 release ahead · window 14 d · in 28 d"; "2 releases ahead · ..."; aheadCount 0 -> part omitted ("window 14 d · in 28 d"); windowDays null -> omitted ("1 release ahead · in 28 d"); daysToRelease 0 -> "due today". Separator is " · ".
    placeTrainLabels(items, trackPx) -> placed items
    - items: { key, f, text, priority (higher wins), maxPx }; estimated width = min(maxPx, text.length * 6.5 + 4).
    - Each item gets an anchor: f < 0.12 -> left-aligned at the tick, f > 0.88 -> right-aligned at the tick, else centred (same rule as the current `anchor()` helper), and its pixel interval is clamped inside [0, trackPx].
    - Items are kept in priority order; an item whose interval overlaps (with a 6px gap) any already-kept item is dropped (returned with visible:false so the caller still draws its tick). Output order = input order.
    - Test: at trackPx 220 with TODAY (f 0, priority 3), release name (f 1, priority 3) and a name at f 0.05 (priority 1) -> the f 0.05 name is dropped; at trackPx 420 with a name at f 0.5 it is kept.
  </behavior>
  <action>
    Create `releaseTrain.ts` next to releaseBurnup.ts implementing exactly the behaviour block above (per user decision "Release train": TODAY left, RELEASE right, proportional ahead ticks, "window opens" on the previous version, summary line, label collision handling). Export the `ReleaseTrain` and `TrainTick` types, `deriveReleaseTrain`, `formatTrainSummary`, `placeTrainLabels`. Reuse `previousVersion` from `./releaseBurnup` for the window start (keeps it identical to the burnup axis start) and `dateKeyMs` from `@/lib/epic-progress` for day math; validate dates with the same `YYYY-MM-DD` slice/regex approach as releaseBurnup's private `dayKey` (copy it locally, do not export from releaseBurnup to avoid touching that file). Guard every fraction against span <= 0 (return 0) and clamp to [0,1]. Keep the module free of React. Write `releaseTrain.test.ts` first with all cases in the behaviour block (vitest, plain fixtures `{ id, name, releaseDate, released }` with placeholder names), then implement until green.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/releaseTrain.test.ts && npx biome check src/routes/dashboard/release-detail/releaseTrain.ts src/routes/dashboard/release-detail/releaseTrain.test.ts</automated>
  </verify>
  <done>All behaviour cases pass; biome clean on both files; committed as one commit (test + impl) `feat(quick-261103-jqy): release train derivation`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Render the release train in ReleaseTimeline and thread it from useReleaseDetail</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx, taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx</files>
  <behavior>
    - With summary.train for the locked example (today 2026-11-03, R-11-17 prev, this R-12-01): root testid release-graph-burnup-thin contains "Today", "R-11-17", "R-12-01", "window opens", "Release", and the summary "1 release ahead · window 14 d · in 28 d"; contains no "issues done" / "days left".
    - Tick for R-11-17 is a testid `train-tick` element with style left 50%; window segment (testid `train-window`) starts at left 50% and spans to the right end; TODAY dot (testid `train-today`) at left 0%.
    - Window-open train (prev 2026-10-28, today 2026-11-03, release 2026-11-10): train-today left is > 0% (not clamped), no "releases ahead" text, summary "window 13 d · in 7 d", "window opens" caption present at the left end.
    - summary.train null/undefined: the existing track rendering is used unchanged (keep the current "omits the Release marker without an axis release date" style assertions for the fallback, including testids timeline-previous-name / timeline-version-name).
    - A name dropped by placeTrainLabels still renders its tick (count train-tick elements === ticks.length) and carries the name in the tick's `title`.
  </behavior>
  <action>
    Per the locked "Release train" decision:
    (a) ReleaseTimeline.tsx: add optional `train?: ReleaseTrain | null` to `TimelineSummary`. Keep the existing render as the fallback branch when `!summary.train` (released / past-due / undated keep existing behaviour). When a train exists, render inside the same root `<div data-testid="release-graph-burnup-thin" className={className}>`: a `relative` label/track block of three stacked layers sized to fit well under COMPACT_BODY_H (120px) — top label row ~14px (text-[10px] uppercase tracking-wide labels: "Today" in text-foreground at todayF; tick version names in text-xs text-muted-foreground at their f; the release's version name at f=1 in text-foreground), the track (~12px: full-width `bg-muted` rounded rail, the window segment from windowStartF (0 when windowOpen, the whole rail when windowStartF is null is NOT emphasised — only emphasise when a window start exists) to 1 as `bg-foreground/25`, and when windowOpen the elapsed part windowStart->today as `bg-foreground/50`; 1px x 8px tick marks `bg-muted-foreground/60`, the window-start tick `bg-foreground/60` and slightly taller; TODAY `size-3 rounded-full bg-foreground`; RELEASE `size-3 rounded-full border-2 border-foreground bg-background`), then a bottom caption row ~14px (text-[10px] uppercase muted: "window opens" under the window-start tick, "Release" under the right end). Below the block, one `truncate whitespace-nowrap text-xs text-muted-foreground` line with `formatTrainSummary(train)`. Measure the track width with a callback ref + ResizeObserver (same pattern as ReleaseBurnup's plotEl, fallback 300 when 0) and run `placeTrainLabels` separately for the top row (TODAY + release name priority 3, tick names priority 1, maxPx 96) and the caption row ("Release" priority 3, "window opens" priority 2); render only visible labels, positioned with the anchor from placeTrainLabels; every label `whitespace-nowrap truncate` with the maxPx as max-width; each tick gets `title={name}`. Add testids `train-today`, `train-tick`, `train-window`, `train-summary`. Keep the visual block `aria-hidden` and give the root an `aria-label` built from the summary line. Neutral tokens only, no legend, no counts.
    (b) useReleaseDetail.ts: import `deriveReleaseTrain`; next to `burnupAxis` compute `const releaseTrain = version ? deriveReleaseTrain({ version, fixVersions, today }) : null;` and add `releaseTrain` to the returned object. Not used in any query key.
    (c) ReleaseDetailPage.tsx: destructure `releaseTrain` from the hook result alongside the other fields and add `train: releaseTrain` to `timelineSummary`.
    (d) ReleaseBurnup.tsx — header aside only (mockup shows "after R-11-17"): when `summary.train && !summary.train.windowOpen && axis?.previousName`, the aside's leading word is "after" instead of "since" (same span structure and title tooltip pattern, title reads `after {previousName} · {date}`). No other change in this file; the chart branch and its computations stay byte-identical.
    Rewrite ReleaseTimeline.test.tsx: keep the fallback-branch tests (adapted to `train` absent) and add the behaviour cases above, building trains via `deriveReleaseTrain` with placeholder fixtures. Add one ReleaseBurnup.test.tsx-free assertion only if needed — prefer not editing ReleaseBurnup.test.tsx; just make sure it still passes.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.ts src/routes/dashboard/ReleaseDetailPage.tsx src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx</automated>
  </verify>
  <done>Release-detail tests (incl. ReleaseBurnup.test.tsx and useReleaseDetail.test.tsx) pass, tsc clean, biome clean on touched files; `git diff` of ReleaseBurnup.tsx touches only the aside; committed as one commit `feat(quick-261103-jqy): release train progress variant`.</done>
</task>

<task type="auto">
  <name>Task 3: Screenshot the train at narrow and wide widths (not committed)</name>
  <files>taskflow/src/__preview/train.tsx (throwaway, deleted), taskflow/preview-train.html (throwaway, deleted)</files>
  <action>
    Must-have visual check (constraint from orchestrator). Create a throwaway vite entry: `taskflow/preview-train.html` importing `/src/index.css` and `/src/__preview/train.tsx`, which renders `<ReleaseBurnup compact state="ready" axis={...} points={[]} showStoryPoints={false} summary={{...,train}} />` (the real slot, so header + aside + 120px body are included) for three trains — (1) locked example: 1 ahead, window not open; (2) 3 releases ahead with two close together (forces label dropping); (3) window open — each inside fixed-width boxes of 260px and 420px, in both light and `.dark` wrappers. Start `npx vite --port 5299` in the background from the inner app dir, then screenshot with the cached Playwright Chromium (`~/Library/Caches/ms-playwright/chromium-1223/.../Chromium --headless=new --screenshot=<scratchpad>/train.png --window-size=1000,1400 http://localhost:5299/preview-train.html`) into the session scratchpad dir. Read the PNG and check: nothing wraps or overflows the slot, TODAY is at the left with no clamp, ticks proportional, window segment visibly emphasised, summary is one line, labels do not overlap. Fix ReleaseTimeline (amend via a new commit `fix(quick-261103-jqy): ...` with tests still passing) if anything is off. Then stop vite and delete both throwaway files; confirm `git status` shows them gone. Report the screenshot path(s) in the SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && test ! -e taskflow/preview-train.html && test ! -e taskflow/src/__preview/train.tsx && git status --porcelain | grep -c preview || true</automated>
  </verify>
  <done>Screenshots at 260px and 420px (light + dark) inspected and saved in the scratchpad; any layout issue fixed and committed; throwaway files removed; working tree clean apart from the SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API -> UI | fix version names/dates rendered as text |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jqy-01 | Tampering | version names in ReleaseTimeline | accept | Rendered as React text children / title attributes only (auto-escaped), no dangerouslySetInnerHTML |
| T-jqy-02 | Denial of service | malformed releaseDate | mitigate | regex-validated date keys; span <= 0 guarded to avoid NaN positions |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/release-detail` green; tsc clean; biome clean on touched files.
- `git diff HEAD~2 -- taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx` shows only the aside change.
- Screenshot reviewed at 260px and 420px.
</verification>

<success_criteria>
- Future, not-yet-open releases show the TODAY -> ticks -> RELEASE train with "window opens", emphasised window and the summary line, per the locked mockup.
- TODAY is no longer clamped to the window start.
- Fallback cases (released / past due / undated) render as before; the burnup chart is untouched.
- Fits 120px body and ~220-260px widths on one line per row.
</success_criteria>

<output>
Create `.planning/quick/261103-jqy-release-detail-progress-variant-redesign/261103-jqy-SUMMARY.md` when done
</output>
