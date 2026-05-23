---
phase: 260521-wbm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/index.tsx
autonomous: true
requirements:
  - QUICK-260521-wbm-01
must_haves:
  truths:
    - "Dashboard background renders exactly 8 curve paths (3 orange top, 3 blue bottom, 1 orange mid-fade, 1 blue mid-fade)"
    - "All paths use quadratic Bezier (Q) commands matching the new AMBIENT_CURVES coordinates exactly"
    - "SVG viewBox is '0 0 1200 900' with preserveAspectRatio='none' so curves stretch to fill the viewport"
    - "Existing layout (greeting section, card grid) is untouched"
  artifacts:
    - path: "taskflow/src/routes/dashboard/index.tsx"
      provides: "Dashboard route with updated AMBIENT_CURVES background"
      contains: "M -50 220 Q 400 90 1250 -20"
  key_links:
    - from: "taskflow/src/routes/dashboard/index.tsx"
      to: "rendered <svg> background"
      via: "inline SVG with .map() over AMBIENT_CURVES array"
      pattern: "AMBIENT_CURVES.*map"
---

<objective>
Replace the dashboard's existing wave-line SVG background (10 cubic Bezier paths) with the new AMBIENT_CURVES specification (8 quadratic Bezier paths). The new design uses an array-driven approach with `M ... Q ... ` quadratic curves, a 1200x900 viewBox, and `preserveAspectRatio='none'` so the curves stretch fluidly across the dashboard.

Purpose: Match the updated visual design spec exactly. The user has provided final coordinates and wants a 1:1 replacement.
Output: Updated `taskflow/src/routes/dashboard/index.tsx` rendering the new curve set.
</objective>

<execution_context>
@/Users/user/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/user/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/index.tsx

<interfaces>
<!-- Current dashboard renders an inline <svg aria-hidden="true" className="absolute inset-0 ..."> -->
<!-- block holding 10 hard-coded <path> elements (5 orange from top-right with cubic Beziers, -->
<!-- 5 cyan from bottom-left with cubic Beziers). It sits inside the outer wrapper: -->
<!--   <div className="relative flex flex-col min-h-full bg-background"> -->
<!--     <svg ...>...</svg>           ← REPLACE THIS BLOCK -->
<!--     <section className="relative px-8 py-12 text-center">...</section> -->
<!--     <div className="relative grid ...">...cards...</div> -->
<!--   </div> -->
<!-- Existing colour palette in this file: -->
<!--   orange = #f97316  (Tailwind orange-500) -->
<!--   blue   = #06b6d4  (Tailwind cyan-500) -->
<!-- These are the values to use when mapping the spec's `TF.orange` / `TF.blue` tokens. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace dashboard SVG curves with AMBIENT_CURVES spec</name>
  <files>taskflow/src/routes/dashboard/index.tsx</files>
  <action>
In `taskflow/src/routes/dashboard/index.tsx`, replace the existing background `<svg aria-hidden="true" ...>...</svg>` block (currently containing 10 hard-coded cubic-Bezier path elements — 5 orange from top-right and 5 cyan from bottom-left, spanning lines 47–67) with an array-driven implementation using the new AMBIENT_CURVES specification.

1. Above the `Dashboard` component (after the imports and `getTimeGreeting` helper), add a module-level constant `AMBIENT_CURVES` typed as `ReadonlyArray<{ d: string; color: 'orange' | 'blue'; w: number; o: number }>` with these eight entries IN ORDER (do not reorder, do not alter any number):
   - `{ d: 'M -50 220 Q 400 90 1250 -20', color: 'orange', w: 1,   o: 0.35 }`
   - `{ d: 'M -50 320 Q 500 160 1250 80',  color: 'orange', w: 0.8, o: 0.25 }`
   - `{ d: 'M -50 420 Q 600 240 1250 180', color: 'orange', w: 0.6, o: 0.18 }`
   - `{ d: 'M -50 760 Q 500 540 1250 380', color: 'blue',   w: 1,   o: 0.32 }`
   - `{ d: 'M -50 860 Q 600 640 1250 480', color: 'blue',   w: 0.8, o: 0.24 }`
   - `{ d: 'M -50 960 Q 700 740 1250 580', color: 'blue',   w: 0.6, o: 0.18 }`
   - `{ d: 'M -50 540 Q 550 380 1250 240', color: 'orange', w: 0.5, o: 0.14 }`
   - `{ d: 'M -50 660 Q 600 460 1250 320', color: 'blue',   w: 0.5, o: 0.14 }`

2. Render the SVG via `AMBIENT_CURVES.map(...)`. Keep `aria-hidden="true"` for accessibility. The opening `<svg>` tag MUST have:
   - `viewBox="0 0 1200 900"`
   - `preserveAspectRatio="none"`
   - `className="absolute inset-0 w-full h-full pointer-events-none"` (preserve existing positioning so it sits behind the greeting and card grid; the spec's inline style is equivalent — keep className form to match codebase Tailwind conventions)
   - `xmlns="http://www.w3.org/2000/svg"`

3. For each curve render a `<path>` with:
   - `key={i}` (index from `.map((c, i) => ...)`)
   - `d={c.d}`
   - `fill="none"`
   - `stroke={c.color === 'orange' ? '#f97316' : '#06b6d4'}` — these are the existing colour tokens already used elsewhere in this file; the spec's `TF.orange` / `TF.blue` map directly to these hex values (Tailwind orange-500 / cyan-500). Do NOT introduce a new `TF` constants object — keep the colour resolution inline.
   - `strokeWidth={c.w}`
   - `strokeLinecap="round"`
   - `opacity={c.o}` (use the `opacity` attribute, NOT `strokeOpacity` — this matches the spec exactly)

4. Do NOT introduce a `Curves` wrapper component, `mode` prop, or `intensity` prop. The spec's component signature (`function Curves({ mode = 'ambient', intensity = 1 })`) is generic; for this quick task we only need the rendered output equivalent to `<Curves mode="ambient" intensity={1} />`. Inlining keeps the change atomic and avoids creating a new file.

5. Delete the entire previous SVG block (all 10 hard-coded paths and surrounding comments about "Wave lines emanating from top-right (orange) and bottom-left (cyan)" / "Orange waves from top-right" / "Cyan waves from bottom-left"). Replace the leading comment with a single one-liner: `{/* Ambient background curves — orange top-right, blue bottom-left */}`.

6. Leave the `<section>` greeting block and the `<div className="relative grid ...">` card grid untouched. The outer `<div className="relative flex flex-col min-h-full bg-background">` wrapper stays identical.
  </action>
  <verify>
    <automated>cd /Users/user/Documents/Projects/taskflow/taskflow &amp;&amp; grep -c "AMBIENT_CURVES" src/routes/dashboard/index.tsx | awk '$1 &gt;= 2 { exit 0 } { exit 1 }' &amp;&amp; grep -q 'M -50 220 Q 400 90 1250 -20' src/routes/dashboard/index.tsx &amp;&amp; grep -q 'M -50 660 Q 600 460 1250 320' src/routes/dashboard/index.tsx &amp;&amp; grep -q 'viewBox="0 0 1200 900"' src/routes/dashboard/index.tsx &amp;&amp; grep -q 'preserveAspectRatio="none"' src/routes/dashboard/index.tsx &amp;&amp; ! grep -q 'strokeOpacity=' src/routes/dashboard/index.tsx &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
- `AMBIENT_CURVES` constant declared with exactly 8 entries matching the spec coordinates, widths, opacities, and colors.
- SVG renders via `.map()` over `AMBIENT_CURVES` with `viewBox="0 0 1200 900"` and `preserveAspectRatio="none"`.
- All 8 path `d` strings are present verbatim in the source.
- Old 10-path cubic-Bezier block is fully removed (no `strokeOpacity=` remains in the file).
- TypeScript typechecks (`npx tsc --noEmit`) pass.
- Dashboard route still imports and renders the three cards (`DashboardSprintCard`, `DashboardInProgressCard`, `DashboardReleaseCard`) unchanged.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Updated dashboard background to use the new AMBIENT_CURVES spec (8 quadratic-Bezier curves: 3 orange top + 3 blue bottom + 1 orange mid + 1 blue mid, viewBox 1200x900, preserveAspectRatio=none).</what-built>
  <how-to-verify>
1. Run the dev server: `cd taskflow &amp;&amp; npm run tauri dev` (or `npm run dev` if browser-only preview is acceptable).
2. Navigate to the dashboard route (the default landing page after login).
3. Visually confirm:
   - Orange curves arc across the upper portion of the screen, flowing from lower-left to upper-right.
   - Blue/cyan curves arc across the lower portion, flowing from lower-left to upper-right.
   - One faint orange curve and one faint blue curve sit in the middle band (opacity 0.14, half-width strokes).
   - Curves stretch edge-to-edge of the viewport (because of `preserveAspectRatio="none"`); resize the window and confirm they stretch (not crop).
   - Greeting text and the three cards (Sprint, In-Progress, Release) remain readable and untouched.
4. Open DevTools → Elements and confirm the rendered `<svg>` contains exactly 8 `<path>` children with `d` attributes starting with `M -50`.
  </how-to-verify>
  <resume-signal>Type "approved" if the new curves match the design intent, or describe the visual issues.</resume-signal>
</task>

</tasks>

<verification>
- `grep -c 'M -50' taskflow/src/routes/dashboard/index.tsx` returns 8 (one occurrence per path)
- No remaining cubic-Bezier path commands in the dashboard SVG (`grep -E 'C[0-9, ]+,' taskflow/src/routes/dashboard/index.tsx` returns nothing inside path `d` attributes for the background SVG)
- TypeScript compiles clean
- Manual visual check confirms the new curve set renders edge-to-edge
</verification>

<success_criteria>
- All 8 AMBIENT_CURVES paths render verbatim with correct color, stroke width, and opacity.
- SVG viewBox is `0 0 1200 900` with `preserveAspectRatio="none"`.
- The old 10-path cubic-Bezier implementation is fully removed.
- Dashboard layout (greeting + 3 cards) is unchanged.
- User approves visual result.
</success_criteria>

<output>
Create `.planning/quick/260521-wbm-update-dashboard-background-curves-to-ma/260521-wbm-SUMMARY.md` when done.
</output>
