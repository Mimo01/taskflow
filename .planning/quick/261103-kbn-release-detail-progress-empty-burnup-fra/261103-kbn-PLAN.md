---
phase: quick-261103-kbn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts
  - taskflow/src/routes/dashboard/release-detail/releaseBurnup.test.ts
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx
  - taskflow/src/routes/dashboard/release-detail/releaseTrain.ts
  - taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts
  - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
autonomous: true
requirements: [QUICK-261103-kbn]

must_haves:
  truths:
    - "An upcoming release whose window has not opened shows an empty burnup frame (same axes, ticks, margins and RELEASE marker as the real chart), a dashed flat scope line at today's issue count, a faint ideal diagonal from 0 to scope, and one muted line 'opens in N d' under the plot"
    - "An upcoming release whose window is open but has <2 days of history shows the same frame with the TODAY line and the today-to-release band, and no caption"
    - "The frame plots no done series, no end dots, no tooltip, no legend"
    - "The real burnup (>=2 points) renders exactly as before"
    - "Released, past-due, undated, or axis-less releases still get the ReleaseTimeline fallback (data-testid release-graph-burnup-thin)"
    - "The release train is gone: no releaseTrain module, no train branch, no releaseTrain in the hook, no train in timelineSummary"
    - "The header aside reads 'after <prev>' while the window has not opened, 'since <prev>' otherwise"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts"
      provides: "deriveBurnupFrame pure helper"
      exports: ["deriveBurnupFrame", "BurnupFrame", "BurnupFramePoint"]
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx"
      provides: "frame mode on the existing chart branch"
      contains: "release-graph-burnup-frame"
  key_links:
    - from: "ReleaseBurnup.tsx"
      to: "deriveBurnupFrame"
      via: "called with axis + summary.total + summary.today + summary.released"
      pattern: "deriveBurnupFrame\\("
---

<objective>
Replace the rejected "release train" Progress variant (261103-jqy) with an empty burnup frame, per the user's locked choice. The frame is the real burnup chart drawn with a frame series. Once history arrives, the slot fills in and stays visually continuous.

Output: a `deriveBurnupFrame` helper with tests, a frame mode inside the existing ReleaseBurnup chart branch, and the train removed everywhere. Screenshots are verified by the executor.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261103-jqy-release-detail-progress-variant-redesign/261103-jqy-SUMMARY.md
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
@taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts

Paths: the repo root (.planning, git) is /Users/mimo/Documents/Projects/taskflow. Run npm, vitest, biome and tsc from the inner app dir /Users/mimo/Documents/Projects/taskflow/taskflow.

Facts established while planning (do not re-derive them):
- For a release whose window has not opened, `releaseBurnupAxis` gives start = previous release date (future), end = releaseDate, seriesEnd = today < start. As a result showToday = false, showRelease = true, and `deriveReleaseBurnup` returns `[]`. With the window open and one day of history, points.length is 1, showToday is true, and seriesEnd is today.
- Past due and unreleased: axis.end = today and releaseDate < today. Released: summary.released is true. Undated: releaseDate is null. Each of these keeps the ReleaseTimeline fallback.
- The jqy commits 843129a1 and 37a4b9ff are the ONLY src changes since `843129a1~1`. `git diff 843129a1~1 HEAD -- taskflow/src` shows 7 files. So the train can be removed with a clean `git checkout 843129a1~1 -- <file>` for ReleaseTimeline.tsx, ReleaseTimeline.test.tsx, useReleaseDetail.ts and ReleaseDetailPage.tsx. Re-run that diff first to confirm nothing else has landed. If anything has, hand-edit instead.
- The P94 design reference says "No forecast or ideal line (D-04)" for the real chart. The user's locked decision adds a faint ideal diagonal to the frame ONLY. Honor the user. The real chart still gets no ideal line.
- Memory: the pre-commit hook runs the full vitest suite plus biome plus tsc. Use one commit per task (test and implementation together) and never `--no-verify`. Run biome --write only on touched files. After a failed hook, commit with `git commit -- <paths>` and check `git log -1 --stat`.
- Memory: the app uses React Compiler, but ReleaseBurnup.tsx is `'use no memo'`. Keep it that way.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: deriveBurnupFrame pure helper</name>
  <files>taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts, taskflow/src/routes/dashboard/release-detail/releaseBurnup.test.ts</files>
  <behavior>
    Fixture axis for a window not yet open: start '2026-11-17', end '2026-12-01', seriesEnd '2026-11-03', releaseDate '2026-12-01', showToday false, showRelease true, previousName 'R-11-17'. today '2026-11-03', scope 12.
    - Window not open: returns points [{t: dateKeyMs('2026-11-17'), scope: 12, ideal: 0}, {t: dateKeyMs('2026-12-01') + 86_400_000, scope: 12, ideal: 12}] and opensInDays 14.
    - Window open (start '2026-10-27', today '2026-11-03', showToday true, seriesEnd '2026-11-03'): opensInDays null, and the points span start to dayEnd(release).
    - Returns null when the axis is null, released is true, releaseDate is null, showRelease is false, or the release is past due (releaseDate < today, or axis.end !== axis.releaseDate).
    - scope 0 still returns a frame (points with scope 0 and ideal 0→0). The caller decides emptiness through state.
    - opensInDays across a DST boundary (today '2026-10-20', start '2026-11-03') is the integer 14 (Math.round of the ms diff / DAY_MS).
  </behavior>
  <action>
In releaseBurnup.ts, add and export these interfaces: `BurnupFramePoint { t: number; scope: number; ideal: number }` and `BurnupFrame { points: BurnupFramePoint[]; opensInDays: number | null }`.

Add and export `deriveBurnupFrame(args: { axis: BurnupAxis | null; scope: number; today: string; released: boolean }): BurnupFrame | null`. It implements the behavior above. Use a local DAY_MS = 86_400_000 and the existing `dateKeyMs` import. The end point sits at the release day's END (dateKeyMs(releaseDate) + DAY_MS), which is the same x as the real chart's RELEASE ReferenceLine and the XAxis domain end, so the diagonal meets the marker exactly.

The frame uses the issue count for scope (per the user's decision: same unit as the burnup scope series, no story points). Add a short doc comment that calls this the empty-frame stand-in for the burnup before history exists (261103-kbn).

Append the tests to the existing releaseBurnup.test.ts, following its style. Run them red, then implement. Make ONE commit containing test and implementation, because the hook blocks red commits: `feat(quick-261103-kbn): burnup frame derivation`. Run biome --write only on these two files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/releaseBurnup.test.ts</automated>
  </verify>
  <done>deriveBurnupFrame is exported, every behavior case passes, and the change is committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frame mode in ReleaseBurnup's chart branch; remove the release train</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.test.tsx, taskflow/src/routes/dashboard/release-detail/releaseTrain.ts, taskflow/src/routes/dashboard/release-detail/releaseTrain.test.ts, taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts, taskflow/src/routes/dashboard/ReleaseDetailPage.tsx</files>
  <behavior>
    These go in ReleaseBurnup.test.tsx. Reuse the existing `axis`/`summary`/`points` fixtures. The existing fixture axis is window-open with a future release, so a 1-point series now gives the frame.
    - Window open, 1-point series: `release-graph-burnup-frame` is present; `release-graph-burnup-thin` is absent; no `burnup-end-dot`; no 'opens in' text; role img with a name matching /burnup frame/i.
    - Window not open (axis start '2026-10-15', end '2026-10-20', seriesEnd '2026-10-10', showToday false, points []; summary today '2026-10-10', total 5): frame present; text 'opens in 5 d'; aside title 'after v1.2 · Oct 15' and text /^after\s+v1\.2$/.
    - Released (summary.released true, 1 point): `release-graph-burnup-thin` present, frame absent.
    - Past due (axis end = seriesEnd = today '2026-10-25', releaseDate '2026-10-20', 1 point): thin present, frame absent.
    - Real chart (2 points): no `release-graph-burnup-frame` testid. The existing aria-label 'Release burnup: 5 scope, 2 done' still passes, and the aside still reads 'since v1.2'.
    - Update the existing test 'shows the countdown timeline instead of a chart for a 1-point series' to reflect the new reality: it becomes the window-open frame case above. Keep its `days left` absence assertion.
  </behavior>
  <action>
**Remove the train (per the user decision).** First confirm with `git diff --stat 843129a1~1 HEAD -- taskflow/src` that only the 7 jqy files have changed. Then run `git checkout 843129a1~1 -- ` on the four files ReleaseTimeline.tsx, ReleaseTimeline.test.tsx, useReleaseDetail.ts and ReleaseDetailPage.tsx. This restores the pre-train plain track (keeping data-testid release-graph-burnup-thin), drops `releaseTrain` from the hook and its return, and drops `train` from timelineSummary. Then `git rm` releaseTrain.ts and releaseTrain.test.ts. Update the ReleaseTimeline doc comment so it says the timeline is the fallback only where no frame can be drawn (no axis, no release date, released, or past due). Afterwards, `grep -rn "releaseTrain\|summary.train\|TrainTrack" src` must return nothing.

**ReleaseBurnup.tsx frame mode (one component path, per the user decision).**
- Compute `frame = deriveBurnupFrame({ axis, scope: summary.total, today: summary.today, released: summary.released })`. Set `showFrame = state === 'ready' && !enough && !!frame && !!axis`.
- The body condition becomes: when neither `enough` nor `showFrame` holds, render ReleaseTimeline (unchanged). Otherwise render the SAME plot div, ChartContainer and ComposedChart.
- In frame mode:
  - The data is `frame.points` and not `plotted`.
  - The Y scale is `burnupYScale(frame.points[0].scope)`, not maxScope of points.
  - The plot div gets `data-testid="release-graph-burnup-frame"`. The attribute is undefined for the real chart, so the real DOM is unchanged.
  - aria-label: `Release burnup frame: ${scope} scope, opens in N d` when the window has not opened, otherwise `Release burnup frame: ${scope} scope`.
  - The ChartTooltip, the done Area and the done Line are NOT rendered.
  - The scope Line keeps its exact props (MUTED, 1.5, dash 4 3, stepAfter) but uses `dot={false}`.
  - Add one ideal Line, dataKey 'ideal', type 'linear', stroke MUTED, strokeOpacity 0.35, strokeWidth 1, solid (so it reads apart from the dashed scope), dot false, activeDot false, isAnimationActive false.
- XAxis, YAxis, ticks (yearAwareTicks/timeTicks), margin/labels (layoutBurnupLabels with the RELEASE marker), the ReferenceArea today band and the TODAY/RELEASE ReferenceLines stay shared and unconditional. They are already axis-driven, so the TODAY line and band appear exactly when axis.showToday is true, which is the window-open case.
- The `labels` IIFE currently returns null when `!last`. It must also lay out labels in frame mode (points may be []). Gate it on axis plus (last or showFrame), so the RELEASE label renders in the not-yet-open frame.
- Real-chart branches (enough === true) must produce identical JSX to today. Keep each frame difference a ternary or conditional on `showFrame`, and do not reorder the existing children.
- Caption: when showFrame and frame.opensInDays !== null, render after the plot div, inside release-burnup-body, `<p data-testid="release-burnup-opens">` with classes `flex-none truncate text-xs leading-4 text-muted-foreground` and text `opens in {n} d`. In compact mode the plot div is `relative min-h-0 flex-1`, so it shrinks to make room and the body stays COMPACT_BODY_H. One line that truncates and never wraps (one row = one line). Colour is neutral: muted tokens only, nothing green in the frame.
- Aside: replace the jqy `summary.train` lead with `const lead = axis?.previousName && summary.today < axis.start ? 'after' : 'since';`. Keep the existing title/markup that uses `lead`.
- Comment that the frame deliberately has an ideal line while the real chart does not (user decision 261103-kbn, which overrides P94 D-04 for the frame only).

**Tests.** Write the behavior cases in ReleaseBurnup.test.tsx. ReleaseTimeline.test.tsx is restored to its pre-train version and needs no train cases. Grep `release-graph-burnup-thin` across src and fix any other test that assumed thin for a future window-open or not-yet-open release.

Run `npx biome check --write` on the touched files only, then `npx tsc --noEmit`, then vitest on src/routes/dashboard/release-detail and src/routes/dashboard/ReleaseDetailPage. Make one commit: `feat(quick-261103-kbn): empty burnup frame replaces release train`. Stage the deletions as well, then check `git log -1 --stat`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit && npx vitest run src/routes/dashboard/release-detail src/routes/dashboard/ReleaseDetailPage && ! grep -rn "releaseTrain\|summary\.train\|TrainTrack" src</automated>
  </verify>
  <done>Not-yet-open and window-open releases render the frame. Released, past-due and undated releases render the thin timeline. The real chart's assertions are unchanged. The train files are deleted. tsc and tests are green. Committed.</done>
</task>

<task type="auto">
  <name>Task 3: Screenshot verification (frame not-yet-open, frame window-open, real chart) at 260/420px, light and dark</name>
  <files>(throwaway only: taskflow/preview-kbn.html, taskflow/src/preview-kbn.tsx, scratchpad shot script; all deleted at the end)</files>
  <action>
Build a throwaway vite page. Create `taskflow/preview-kbn.html`, which imports `/src/index.css` (or whatever main.tsx imports for Tailwind; check main.tsx) and `/src/preview-kbn.tsx`.

The tsx renders a grid. There is one row per case:
- (a) not-yet-open: axis start 2026-11-17, end 2026-12-01, showToday false, points [], summary today 2026-11-03, total 12, previousName 'R-11-17'.
- (b) window open: axis start 2026-10-27, end 2026-11-20, seriesEnd 2026-11-03, showToday true, 1 point with scope 12 / done 0.
- (c) real chart: same window as (b), with about 8 daily points rising to scope 12 / done 5.

Each case is shown at container widths 260px and 420px, in a light column and a `.dark` column (wrapper div with class `dark` and `bg-background text-foreground`). Wrap each slot in `@container/page` like the page does, and render `ReleaseBurnup` with `compact` and `state="ready"`.

Start `npx vite --port 5191 --strictPort` in the background from the inner app dir. Capture with the cached headless shell:
`/Users/mimo/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell --headless --hide-scrollbars --window-size=1000,1100 --virtual-time-budget=4000 --screenshot=/private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/f1187303-433b-4a01-9d0b-72d61962703b/scratchpad/kbn-frame.png http://localhost:5191/preview-kbn.html`

Increase the window size if the grid gets clipped, or split it into two shots. jqy notes that the full Chromium binary does not launch in this sandbox, so use the headless shell.

Read the PNG and check each of these:
- The frame has the same axes, ticks, margins and RELEASE label position as the real chart at the same width.
- The scope line is dashed and flat at 12, and the Y ticks are 0/5/10/15.
- The ideal diagonal is faint and ends where the RELEASE line is.
- (a) has no TODAY line and shows 'opens in 14 d' on one line, with the body no taller than the real chart.
- (b) shows the TODAY line and the band.
- No green and no dots appear in the frame.
- (c) looks the same as before. No baseline render is needed (and do not git stash); instead, `git diff HEAD~2 -- <ReleaseBurnup.tsx>` must show only showFrame-gated additions on the real path.
- Nothing wraps in either theme.

Fix any issue with a follow-up commit (`fix(quick-261103-kbn): ...`) and re-shoot. Finally, kill vite and delete preview-kbn.html, src/preview-kbn.tsx and any script. `git status` must be clean apart from .planning files.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && test -f /private/tmp/claude-501/-Users-mimo-Documents-Projects-taskflow/f1187303-433b-4a01-9d0b-72d61962703b/scratchpad/kbn-frame.png && ! ls taskflow/preview-kbn.html taskflow/src/preview-kbn.tsx 2>/dev/null && git status --porcelain -- taskflow | wc -l | grep -q '^ *0$'</automated>
  </verify>
  <done>The screenshot(s) exist in the scratchpad and the executor has Read them and found no defects, or fixed and re-shot them. The throwaway files are deleted and the app tree is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → render | Version names and dates are rendered as text by React (escaped) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kbn-01 | Tampering | ReleaseBurnup frame | accept | Display-only derivation from data already fetched; React escapes text; no new requests or packages |
</threat_model>

<verification>
- `npx tsc --noEmit` is clean. biome is clean on the touched files. The release-detail and ReleaseDetailPage vitest runs are green, and the full suite passes through the hook.
- `grep -rn "releaseTrain\|summary\.train\|TrainTrack" taskflow/src` is empty.
- The ReleaseBurnup.tsx diff for the real-data path consists only of `showFrame`-gated additions. Existing children are not reordered and existing props are not changed.
</verification>

<success_criteria>
- Future releases (window not open) show the empty burnup frame with the 'opens in N d' caption. A window-open release with thin history shows the frame plus the TODAY line. The real chart is visually unchanged. Released, past-due and undated releases keep the thin timeline. The train is fully removed.
</success_criteria>

<output>
Create `.planning/quick/261103-kbn-release-detail-progress-empty-burnup-fra/261103-kbn-SUMMARY.md` when done.
</output>
