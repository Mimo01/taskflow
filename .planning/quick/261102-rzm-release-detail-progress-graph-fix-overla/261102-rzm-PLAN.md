---
phase: quick-261102-rzm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts
  - taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.test.ts
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
  - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
  - .planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/
autonomous: true
requirements: [QUICK-261102-rzm]

must_haves:
  truths:
    - "On the release detail Progress graph, the TODAY and RELEASE labels never overlap each other, including when the two dates are the same day or a few days apart"
    - "Marker labels never get clipped at the left or right edge of the plot"
    - "The scope and done end labels never overlap each other, a marker label, the y-axis tick column or the x-axis tick row, and never leave the chart box"
    - "End-label placement uses the real measured plot height (compact band height stretches; 110px is only the minimum), not a hardcoded 110px"
    - "x-axis ticks stay readable (no colliding tick labels) from 280px to 1100px wide and from 1-day to 1-year ranges"
    - "Visual language is unchanged: no legend, same colours (green done, muted scope, dashed release marker), same 11px labels"
    - "Before and after contact sheets exist in the quick dir so the user can review every scenario"
  artifacts:
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts"
      provides: "Pure label layout: marker label placement + end label placement from plot geometry, returns non-overlapping in-bounds boxes"
      exports: ["layoutBurnupLabels"]
    - path: "taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.test.ts"
      provides: "Example cases + property-style loops asserting no box intersections and in-bounds"
    - path: ".planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/"
      provides: "before-light.png, before-dark.png, after-light.png, after-dark.png contact sheets"
  key_links:
    - from: "ReleaseBurnup.tsx"
      to: "layoutBurnupLabels"
      via: "called with measured plot width AND height, marker x px, last scope/done y px"
      pattern: "layoutBurnupLabels\\("
    - from: "ReleaseBurnup.tsx ResizeObserver"
      to: "measured height"
      via: "contentRect.height stored alongside width"
      pattern: "contentRect\\.height"
---

<objective>
Fix the legibility of the release detail "Progress" burnup graph: TODAY / RELEASE marker labels and the scope / done end labels can overlap each other, the lines, the axes, or clip at the chart edges. Replace the ad-hoc offsets (hardcoded `PLOT_PX = 110`, `position: 'top'` marker labels, fixed `flip` rule) with one pure, tested layout function driven by the real measured plot geometry, and prove it visually across a large scenario matrix.

Purpose: user report — "in some cases it can become hard to read, its data overlap… do a lot of variations to test how it looks in different scenarios and make sure it always looks nice". The visual matrix is a core deliverable, not optional.
Output: `burnupLabelLayout.ts` (+ tests), updated `ReleaseBurnup.tsx`, before/after contact sheets in the quick dir.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/CLAUDE.md
@.claude/skills/sketch-findings-taskflow/references/release-detail-page.md
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
@taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.width.test.tsx
@taskflow/src/routes/dashboard/release-detail/releaseBurnup.ts
@taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx

Facts established while planning (do not re-derive):
- Repo layout: `.planning` + git at outer `taskflow/`; src, npm, vitest, biome, tsc run in inner `taskflow/taskflow/`.
- ReleaseDetailPage ALWAYS mounts `<ReleaseBurnup compact />` (line ~322). In compact mode the plot div is `relative min-h-[110px] flex-1` and stretches to the band row height, so real plot height varies (110px up to ~200px+). Non-compact (`h-[196px]`, 160px ≤640px) still exists — keep it working, but compact is the priority.
- Chart geometry today: `ComposedChart margin={{ ...PLOT_MARGIN, top: 16, right: 40 }}` where PLOT_MARGIN = {top 8, right 8, left 0, bottom 0}; YAxis width `Y_AXIS_WIDTH` = 40; recharts XAxis default height 30. So inner plot = x in [40, W-40], y in [16, H-30].
- `timeTicks(start, end, widthPx)` (lib/epic-progress.ts) targets `floor(widthPx / 72)` ticks; it is passed the whole container width, not the inner plot width.
- `burnupYScale` gives ≤4 ticks; `domainTop` adds half a step of headroom when maxScope > 80% of top.
- End labels: `endLabel()` draws a background rect + haloed text, width estimated at `CHAR_W = 5.9` per char (11px). Marker labels are `uppercase tracking-wide` 11px — wider per char (~7.5px); measure in the browser to calibrate.
- `flip = axis.seriesEnd === axis.end` (labels go left of last point only when the series reaches the axis end). With right margin 40 a right-side "123 scope · done" (~95px) overflows.
- File starts with `'use no memo'` (React Compiler app). Keep it.
- Cached Chromium: `~/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/` (find the binary inside the .app). Playwright is NOT in node_modules — do NOT install it; drive Chrome directly with `--headless=new --screenshot=<png> --window-size=W,H --virtual-time-budget=5000 --hide-scrollbars <url>`.
- Pre-commit hook runs full vitest + biome + tsc: one commit per task with tests + implementation together.
- User dashboard prefs: no legends, colour = status only, ≤4-row tooltips. No customer data anywhere — placeholder fixtures only (versions like "v1.2", no real names).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scenario matrix preview page + BEFORE contact sheets</name>
  <files>taskflow/src/__preview/burnup-matrix.tsx (throwaway, never committed), taskflow/preview-burnup.html (throwaway, never committed), .planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/before-light.png, .planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/before-dark.png</files>
  <action>
Build a throwaway Vite preview that renders the REAL `ReleaseBurnup` component with the app's real CSS, as a single tall grid page that doubles as the contact sheet.

1. Create `taskflow/preview-burnup.html` (root of the inner app, next to index.html) that imports `/src/index.css` (check index.html / main.tsx for the actual stylesheet entry) and mounts `src/__preview/burnup-matrix.tsx`. Wrap in a QueryClientProvider / TooltipProvider only if ReleaseBurnup needs them (it should not). Theme from `?theme=dark` → add `dark` class on `<html>` and set body `bg-background text-foreground`.
2. In `burnup-matrix.tsx`, define 30-40 scenarios as `{ id, title, axis: BurnupAxis, points: BurnupPoint[] }` built by a small helper (generate daily or sparse points between start and seriesEnd, `t = dateKeyMs(day)`). Cover at least:
   - TODAY and RELEASE same day; 1, 2, 3, 5 days apart; release before today (released late); only TODAY; only RELEASE; neither.
   - TODAY at the very left edge (series of 2 points, axis start = yesterday); RELEASE at the very right edge; TODAY at the right edge (series reaches axis end, flip case).
   - Series ending well before axis end (future release 60 days out) and series reaching axis end.
   - scope == done (merged label) with small and large values; done 0; done 1 with scope 2; done = scope - 1; scope 1; scope near top tick (headroom case) and exactly on a tick; scope 450 / done 3; scope 999 / done 998; scope dropping mid-series.
   - Ranges: 1 day (2 points), 2 days, 2 weeks, 3 months, 1 year, crossing a year boundary.
   - With TODAY/RELEASE near the last point so marker labels meet the end labels near the top.
3. Render every scenario in each mode: compact at band heights 110px, 140px and 200px (wrap in a `flex flex-col` container with that explicit height so the `flex-1` plot stretches like the band), plus non-compact; at container widths 280, 400, 560, 760, 1100. Use a labelled CSS grid (scenario title + mode/size caption above each cell, small muted text) so one screenshot is a contact sheet. If one page gets too tall for a single Chrome screenshot (keep each PNG below ~16000px tall), split by `?part=1..N` and produce numbered PNGs.
4. Start the dev server from `taskflow/taskflow`: `npx vite --port 5199 --strictPort` in the background (Tauri config may pin another port; override it). Screenshot `http://localhost:5199/preview-burnup.html?theme=light` and `?theme=dark` with the cached Chromium binary (see context) into `screenshots/before-light*.png` / `before-dark*.png`. Ensure ReleaseBurnup actually renders the chart (state 'ready', ≥2 points) and that ResizeObserver widths settled (virtual-time-budget).
5. Read every PNG and write a short findings list (scenario id + what overlaps/clips) into the SUMMARY draft notes — this is the bug catalogue Task 2 must fix. Confirm or refute the suspected issues: marker label collision, marker label clipping at edges, end label vs marker label, end label overflow past right edge / into y-axis, wrong dy at tall compact heights (hardcoded PLOT_PX = 110), done label on the x tick row, crowded x ticks at 280px.
Do NOT `git add` the preview files; leave them for Task 3 and delete them at the end.
  </action>
  <verify>
    <automated>ls /Users/mimo/Documents/Projects/taskflow/.planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/ | grep -c '^before-' | awk '{exit !($1>=2)}'</automated>
  </verify>
  <done>Before contact sheets (light + dark) exist covering 30+ scenarios × modes × widths; the executor has viewed them and recorded a concrete list of overlap/clip failures by scenario id.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pure label layout function (tested) wired into ReleaseBurnup</name>
  <files>taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts, taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.test.ts, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx, taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx</files>
  <behavior>
    - Two markers at the same x → one merged label "TODAY · RELEASE" (or the release label alone if the line is drawn once) — never two stacked texts on top of each other.
    - Two markers closer than their combined half-widths + gap → labels anchored apart (left one `end` anchored to its line, right one `start` anchored) or merged when even that collides; result boxes do not intersect.
    - A marker label whose centered box would cross the chart's left/right edge is anchored `start`/`end` against its line instead, staying fully inside [0, chartWidth].
    - scope == done → one merged end label; otherwise two labels whose boxes never intersect, with scope above done in reading order.
    - End labels go to the right of the last point only if the box fits inside chartWidth; otherwise flipped left of the point (never over the y-axis column x < Y_AXIS_WIDTH).
    - End label boxes never intersect marker label boxes, never go above y = 0, never enter the x tick row (y > plotBottom), for plot heights 80..260.
    - Uses the supplied plot height for pixel gaps (regression: the old 110px constant gave wrong spacing on a 200px compact plot).
    - Property loops: for every combination of chartWidth in {280,400,560,760,1100}, chartHeight in {110,140,160,196,240}, scope in {1,2,5,9,10,49,50,123,450,999}, done in a spread from 0..scope (incl. 0,1,scope-1,scope), today/release x positions across the plot incl. both edges and equal/near-equal pairs → no pairwise box intersection and every box inside the chart.
  </behavior>
  <action>
Create `burnupLabelLayout.ts` exporting `layoutBurnupLabels(input)` plus its types. Input (all pixels in chart SVG coordinates): `chartWidth`, `chartHeight`, `plot: { left, right, top, bottom }` (derived from the margin/Y_AXIS_WIDTH/XAxis height constants — export a `burnupPlotBox(width, height)` helper so the component and tests share it), `markers: { kind: 'today' | 'release'; x: number }[]`, `end: { x, scopeY, doneY, scope, done }`. Output: `markers: { text, x, y, anchor: 'start' | 'middle' | 'end' }[]` and `ends: { text, x, y, anchor: 'start' | 'end', color: 'scope' | 'done' }[]`, plus a `box` (x, y, w, h) on every item so tests can assert geometry. Text widths from per-style char-width constants (end labels 11px ≈ 5.9px/char as today; uppercase tracked marker labels calibrated from Task 1 screenshots, ~7.5px/char) plus padding — keep a small safety margin so estimation errors do not create overlaps.

Algorithm (Claude's discretion on details; must satisfy every behavior bullet): place marker labels in the top margin band above the plot (as today); merge or split-anchor near markers; edge-anchor at chart edges. Then place end labels: start from the current visual intent (scope label just above its line, done label just below its line, merged when equal), pick right-of-point if it fits else left; then resolve collisions in order — against the x tick row (move done above scope), against each other (push apart by label height + gap), against marker label boxes (push the end label down below the marker band, or flip side) — clamping into the chart. Replace and delete `burnupEndLabelDy`, `PLOT_PX`, `LABEL_GAP` and the `flip` rule; migrate their existing tests in ReleaseBurnup.test.tsx to the new function (keep the merged / differ-by-1 / done-on-axis cases as examples).

Wire into `ReleaseBurnup.tsx`: extend the existing callback-ref ResizeObserver to also store `contentRect.height` (initial from getBoundingClientRect; fallback height = 110 compact / BURNUP_HEIGHT otherwise) — keep the WR-01 callback-ref behaviour so ReleaseBurnup.width.test.tsx still passes. Compute marker and last-point pixel positions with the same linear maps recharts uses (x: time domain [start,end] → [plot.left, plot.right]; y: [0, domainTop] → [plot.bottom, plot.top]). Render marker labels via the ReferenceLine `label` as a render function/element (or a plain SVG `<text>` layer via a recharts `Customized`/label-content render) using the layout's x/anchor; merged markers render the label once. Render end labels via the existing `endLabel` rect+halo drawing, but taking x/y/anchor from the layout (still only at `index === last`). Also pass the inner plot width (chart width minus Y_AXIS_WIDTH and right margin) to `timeTicks` if Task 1 showed crowded ticks; if long tick labels such as "Dec 2026" still collide at 280px, cap the tick count accordingly. If an end label needs more right room than 40px, it flips (layout) — do not just widen the margin unless screenshots show a flip is worse.

Keep: no legend, colours, 11px font, dashed scope/release, tooltip, aria-label, `'use no memo'`. Do not touch ReleaseTimeline or other graphs.

Run in `taskflow/taskflow`: `npx vitest run src/routes/dashboard/release-detail`, `npx tsc --noEmit`, `npx biome check` on the four changed files only (never `biome --write` on all of src). Commit tests + implementation together (pre-commit runs the full suite): `fix(quick-261102-rzm): non-overlapping burnup marker and end labels`. Make sure the throwaway preview files are NOT staged.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/release-detail/graphs && npx tsc --noEmit</automated>
  </verify>
  <done>layoutBurnupLabels exists with example + property-loop tests that pass; ReleaseBurnup uses it with measured width and height; burnupEndLabelDy/PLOT_PX removed; all release-detail tests, tsc and biome (changed files) pass; committed without preview files.</done>
</task>

<task type="auto">
  <name>Task 3: AFTER contact sheets, iterate until clean, clean up</name>
  <files>.planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/after-light.png, .planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/after-dark.png, taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts (only if iteration needs it), taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx (only if iteration needs it)</files>
  <action>
Re-run the Task 1 preview (same scenarios, same sizes, both themes) against the fixed component and screenshot to `screenshots/after-light*.png` / `after-dark*.png`. Read every PNG cell by cell against the Task 1 failure list AND scan for new problems (labels hugging lines, label over the done area fill, ticks colliding, label halo hiding a line ending, text too far from the line it names). If anything still overlaps, clips, or looks off: add the failing configuration to the property tests first, fix the layout, re-screenshot. Repeat until every cell is clean in both themes. Add 3-5 extra adversarial scenarios discovered during review to the matrix before the final shot.

Final: ensure the after sheets are the final state; keep before sheets for comparison. Delete `taskflow/src/__preview/` and `taskflow/preview-burnup.html`, stop the vite server, confirm `git status` shows no preview files. If iteration changed source, re-run vitest (release-detail dir) + tsc + biome on changed files and commit as `fix(quick-261102-rzm): burnup label layout polish from visual matrix`. Commit the screenshots (placeholder data only) with the SUMMARY via the normal quick-task docs commit. In the SUMMARY list: scenarios covered, failures found before, how each was resolved, and any trade-off made (e.g. merged "TODAY · RELEASE" label, flipped end labels).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && ls .planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/screenshots/ | grep -c '^after-' | awk '{exit !($1>=2)}' && test ! -e taskflow/src/__preview && test ! -e taskflow/preview-burnup.html && cd taskflow && npx vitest run src/routes/dashboard/release-detail/graphs</automated>
  </verify>
  <done>After contact sheets (light + dark) show no overlap or clipping in any scenario/mode/width; preview scaffolding removed; tests green; SUMMARY documents before/after findings.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Pure client-side SVG layout of already-loaded numbers/dates; no new input, network or storage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rzm-01 | Information disclosure | committed screenshots / preview fixtures | mitigate | Placeholder data only (generic version names, synthetic counts); preview files deleted before commit; `git status` check in Task 3 |
| T-rzm-02 | Denial of service | layoutBurnupLabels | accept | Constant-size input (≤2 markers, 2 end labels); bounded collision loop, no unbounded iteration |
| T-rzm-SC | Tampering | package installs | accept | No packages installed; cached Chromium driven directly, Playwright not added |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/release-detail` green (incl. property loops and WR-01 width test).
- `npx tsc --noEmit` clean; `npx biome check` clean on changed files (no new files flagged).
- before-*.png and after-*.png contact sheets in the quick dir; after sheets clean in every cell, both themes.
- No preview scaffolding left in the tree.
</verification>

<success_criteria>
- TODAY/RELEASE labels never overlap or clip, at any distance apart and at plot edges.
- Scope/done end labels never overlap each other, marker labels, axes, or chart bounds, at every compact band height and width tested.
- Layout driven by measured plot width+height via one pure, property-tested function.
- No legend added; visual language unchanged.
</success_criteria>

<output>
Create `.planning/quick/261102-rzm-release-detail-progress-graph-fix-overla/261102-rzm-SUMMARY.md` when done
</output>
